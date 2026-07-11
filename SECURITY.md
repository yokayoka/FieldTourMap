# セキュリティ・プライバシーポリシー

本ドキュメントはRequirement 8（セキュリティ・プライバシー）に対応する。現状（Phase
1〜2: GitHub Pagesによる静的サイト配信）のセキュリティ・プライバシー方針の確認結果と、
将来サーバーサイド機能（Phase 2以降のバックエンド）を追加する際に遵守すべきポリシー
を記載する。

## 1. 配信経路（Requirement 8.1）

サイトはGitHub Pagesの標準機能によりHTTPSで配信されている。2026-07-11時点で本番URL
（`https://yokayoka.github.io/FieldTourMap/`）に対し以下を確認済み。

- HTTPSアクセス時、`Strict-Transport-Security: max-age=31556952` ヘッダーが付与される。
- HTTPでアクセスした場合、`301 Moved Permanently` でHTTPS URLへ自動リダイレクトされる。

GitHub Pages側の追加設定（Enforce HTTPS等）は不要で、標準機能により満たされている。

## 2. 位置情報・観察メモの外部送信有無（Requirement 8.2）

コード監査の結果、本リポジトリ内でネットワーク送信（`fetch`/`XMLHttpRequest`等）を
行っている箇所は以下のみであることを確認した。

| ファイル | 送信内容 | 送信先 |
| --- | --- | --- |
| `src/services/configLoader.ts` | 公開設定ファイル（`layers.json`/`tours/*.json`）の読み込み（GET） | 同一オリジン |
| `src/services/offlineCacheService.ts` | 地図タイルの事前ダウンロード（GET） | タイル配信元（国土地理院・産総研・OSM） |
| `public/sw.js`（Service Worker） | 上記タイルリクエストのキャッシュ処理のみ | 同上 |
| `admin-tool/src/main.ts`, `admin-tool/src/tourEditorMain.ts` | 公開設定ファイルの読み込み（GET） | 同一オリジン |

`GeolocationService`（`src/services/geolocationService.ts`）は
`navigator.geolocation.watchPosition`で取得した位置情報をコールバック経由でブラウザ内
の呼び出し元（地図マーカー更新等）に渡すのみで、外部への送信は行わない。
`ObservationMemoStore`（`src/services/observationMemoStore.ts`）は
`localStorage`のみを使用し、ネットワークAPIを一切呼び出さない。

以上より、位置情報・観察メモが端末外（他の学生・第三者・開発者のサーバー等）へ自動
送信されるコードパスは存在しないことを確認した。

### 例外: ユーザーが明示的に選択した共有操作

`ShareLinkService`（Requirement 13）・`GoogleMapsLinkService`（Requirement 14）は、
ユーザーが共有ボタン等を明示的にタップした場合にのみ、現在のビュー状態や地点座標を
クリップボード・OS標準の共有シート・Googleマップへ渡す。これはユーザー本人の意図的
な操作によるものであり、Requirement 8.2が禁止する「自動送信」には該当しない。

## 3. 主催者向けアクセス制御（Requirement 8.3）

Phase 1〜2ではアカウント・パスワード等の認証情報管理は行わない。GitHubリポジトリへの
書き込み権限（Admin Config Toolで生成したJSONをcommit/pushできること）をアクセス制御
の代替手段とする。Admin Config Tool自体はパスワード等の秘匿情報を扱わない設計であり、
保存すべき認証情報は存在しない。

## 4. 依存パッケージの脆弱性（参考: `npm audit`結果, 2026-07-11時点）

`npm audit`で5件（high 1, moderate 2, low 2）の脆弱性が検出されているが、すべて
`@lhci/cli`（Lighthouse CI、Task 17で追加したCI専用のdevDependency）が依存する
`tmp`/`uuid`/`inquirer`の推移的依存に起因するものであり、配信されるアプリ本体
（`dist/`配下の成果物）には含まれない。CI実行環境（GitHub Actionsのジョブ内）に限定
される影響であり、修正には`@lhci/cli`の大幅なダウングレード（破壊的変更）が必要な
ため、現時点ではリスクを許容し対応を見送る。今後`@lhci/cli`のアップデートで解消され
次第、追随する。

## 5. 将来のサーバーサイド機能導入に向けたセキュリティポリシー（Requirement 8.3, 8.4）

Phase 2以降でサーバーサイド機能（主催者アカウント管理・参加者の位置履歴集約等）を
追加する場合、以下を満たすこと。

- **認証情報の保存**: パスワードは平文で保存しない。bcrypt/argon2等の適応的ハッシュ
  関数を用い、ソルトはユーザーごとに個別生成する。
- **通信の暗号化**: すべてのAPI通信をHTTPS必須とし、Cookieを利用する場合は
  `Secure`・`HttpOnly`・`SameSite`属性を付与する。
- **個人位置データの保持期間（Requirement 8.4）**: 個人を特定しうる位置履歴データを
  サーバー保存する場合、実習終了後一定期間（目安90日）以内に削除するか、個人識別性
  を下げる処理（匿名化・集計化）を施した上でアーカイブする運用ポリシーを設ける。
- **アクセス制御**: 主催者・参加者のロールを分離し、最小権限の原則に従う。
- **入力検証**: サーバーAPIはすべての入力をバリデーションし、XSS・SQLインジェクショ
  ン等のOWASP Top 10相当の脆弱性クラスに対策する。
- **依存パッケージの継続的な脆弱性スキャン**: `npm audit`等をCIに組み込み、本番へ
  配信される依存関係の脆弱性を継続的に検知する。
