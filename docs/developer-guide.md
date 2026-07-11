# 開発者向けガイド

このガイドは、本リポジトリ（Field Tour: 野外教育向けWebGIS）の開発環境構築・テスト実行・デプロイ手順をまとめたものである。プロジェクトの要件・設計・実装計画は [requirements.md](../requirements.md) / [design.md](../design.md) / [task.md](../task.md) を、セキュリティ方針は [SECURITY.md](../SECURITY.md) を参照。

## ローカル開発環境構築

### 前提

- Node.js（CI では 24 系を使用。開発時もそれに準じたバージョンを推奨）
- npm

### セットアップ

```
git clone https://github.com/yokayoka/FieldTourMap.git
cd FieldTourMap
npm install
```

### 開発サーバー起動

参加者向けMap Viewer・Admin Config Tool（レイヤー編集/ツアー編集）はいずれも同じVite開発サーバーから配信される（マルチページ構成、`vite.config.ts`の`build.rollupOptions.input`参照）。

```
npm run dev
```

- Map Viewer: `http://localhost:5173/`
- Admin Config Tool（レイヤー編集）: `http://localhost:5173/admin-tool/index.html`
- Admin Config Tool（ツアー編集）: `http://localhost:5173/admin-tool/tour-editor.html`

GNSS（現在地取得）を試す場合はブラウザの位置情報許可が必要。`localhost`はセキュアコンテキスト扱いのため、HTTPSでなくても`navigator.geolocation`が利用できる。

## テスト実行

| コマンド | 内容 |
| --- | --- |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript型チェック（strictモード） |
| `npm run test` | 単体テスト（Vitest、jsdom環境） |
| `npm run test:watch` | 単体テストをwatchモードで実行 |
| `npm run test:coverage` | 単体テストをカバレッジ計測付きで実行（`coverage/index.html`にHTMLレポート出力） |
| `npm run test:e2e` | E2Eテスト（Playwright、モバイル端末プロファイルでheadless実行） |

E2Eテストは初回実行前に一度だけブラウザ本体の取得が必要。

```
npx playwright install --with-deps chromium
```

`npm run test:e2e`は内部で開発サーバー（`npm run dev -- --port 4173 --strictPort`）を自動起動する（`playwright.config.ts`の`webServer`設定）。既に同ポートでサーバーが動いている場合はそれを再利用する。

テストの方針（単体テストはDIで注入したフェイクによる高速な検証、Leaflet等ブラウザAPIとの実結合はE2Eで検証する等）は[design.mdのTesting Strategy](../design.md#testing-strategy)を参照。

## ビルド・プレビュー

```
npm run build     # tsc + vite build。dist/ に静的ファイル一式を出力
npm run preview   # ビルド成果物をローカルで配信して確認
```

`vite.config.ts`の`base`はビルド時のみ本番のGitHub Pagesサブパス（`/FieldTourMap/`）に切り替わる（Requirement 12.4）。開発サーバー起動時は`base: "/"`のままなので、本番相当のパス構成で確認したい場合は`npm run build && npm run preview`を使う。

## デプロイ

`.github/workflows/deploy.yml`により、`master`ブランチへのpush時に自動でビルド・GitHub Pagesへのデプロイが行われる（Requirement 9.3, 12.3）。

### パイプラインの流れ（`build`ジョブ）

1. Lint → 型チェック → 単体テスト → Playwrightブラウザインストール → E2Eテスト
2. いずれかが失敗するとジョブ全体が失敗し、後続のビルド・デプロイは実行されない（テスト失敗時のデプロイブロック、Requirement 9.3）
3. ビルド（`npm run build`）
4. Lighthouse CI（`npx lhci autorun`）。外部タイル配信元への依存で計測値が変動しうるため、基準未達でもビルドは失敗させない（`continue-on-error: true`）。既知の制約として`NO_FCP`エラーによりレポートが生成されない問題が未解決（詳細は[task.md](../task.md)のTask 17完了メモを参照）
5. ビルド成果物（`dist/`）をPages用アーティファクトとしてアップロード

### `deploy`ジョブ

`build`ジョブの成功を前提（`needs: build`）に、`actions/deploy-pages`でGitHub Pagesへデプロイする。

### 手動での再実行

GitHubリポジトリの「Actions」タブから該当ワークフローを選択し、「Run workflow」（`workflow_dispatch`）でも実行できる。

### 初回セットアップ時の注意

リポジトリでGitHub Pagesの「Source」を「GitHub Actions」に設定していない状態でワークフローを実行すると、`deploy-pages`ステップが404で失敗する。リポジトリの Settings → Pages で Source を GitHub Actions に設定してから、再度push または `workflow_dispatch`で実行すること。

## 本番URL

- Map Viewer: `https://yokayoka.github.io/FieldTourMap/`
- Admin Config Toolはローカル専用（GitHub Pagesには公開しない設計。詳細は[organizer-guide.md](./organizer-guide.md)参照）

## プロジェクト構成

ディレクトリ構成・データフローの詳細は[design.mdのFile Storage Structure](../design.md)を参照。要点のみ:

- `src/`: 参加者向けMap Viewer（SPA）のソース
- `admin-tool/`: 主催者向けAdmin Config Toolのソース（`src/`の型・サービスを一部共有利用）
- `public/config/`: レイヤー定義・ツアー定義のJSON設定ファイル（実行時にfetchされる）
- `public/sw.js`: 地図タイルをcache-first-with-network-fallbackでキャッシュするService Worker
- `e2e/`: Playwright E2Eテスト
- `task.md`: 実装計画と各タスクの完了メモ（発見した不具合・設計判断の記録を含む）
