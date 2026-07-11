# Implementation Plan

> 各タスクの先頭には CLAUDE.md の自律実行ループが参照するステータス絵文字を付与する。
> 🔴 未実装 / 🟢 最小実装済（テスト成功） / ✅️ リファクタリング済 / ⚠️ ブロック済
> 初期状態はすべて 🔴 とする。

## Phase 1: MVP (Minimum Viable Product)

- [x] 1. ✅️ プロジェクト基盤構築
  - Vite + TypeScript + Leaflet でのプロジェクト雛形作成
  - ディレクトリ構成の作成（`src/components`, `src/services`, `public/config/`, `admin-tool/`）
  - ESLint / Prettier / Vitest のセットアップ
  - `design.md` の File Storage Structure に準拠したディレクトリ構成とすること
  - 完了メモ: `mountApp()`の疎通テスト作成→実装でTDDサイクルを確認、`tsc --noEmit`・`vite build`・`eslint`すべて成功
  - _Requirements: 9, 12_

- [x] 2. ✅️ GitHub Actions によるCI/CDパイプライン構築
  - `.github/workflows/deploy.yml` の作成（push時にlint→型チェック→単体テスト→buildを実行）
  - テスト失敗時にGitHub Pagesへのデプロイをブロックする設定
  - GitHub Pagesへの自動デプロイ設定（base path・サブパス配信を考慮）
  - 完了メモ: 公式Actions方式（`upload-pages-artifact` + `deploy-pages`）を採用。buildジョブ成功後にのみdeployジョブが走る`needs:`構成。`vite.config.ts`のbase pathを実リポジトリ名`FieldTourMap`に合わせて修正し、ビルド成果物のパスを確認済み。リモート`origin`を`https://github.com/yokayoka/FieldTourMap.git`として登録
  - 残タスク: GitHubリポジトリのSettings → Pages → Source を「GitHub Actions」に変更（初回push後、リポジトリ側で手動設定が必要）
  - _Requirements: 9, 12_

- [ ] 3. 🔴 コアデータモデルとConfigLoader/ConfigValidatorの実装（TDD）
  - `LayerDefinition`, `PointOfInterest`, `MediaLink`, `ReferencePaper`, `TourConfig` 等のTypeScriptインターフェース定義（design.md Core Interfaces準拠）
  - `ConfigLoader.loadLayers()` / `loadTour()` / `listAvailableTours()` のテスト作成→実装
  - `ConfigValidator.validateLayerDefinition()` / `validateMediaLink()` / `validateReferencePaper()` / `validateTourConfig()` のテスト作成→実装（タイルURLの`{z}/{x}/{y}`検証、リンクURLの`http(s)://`検証を含む）
  - _Requirements: 10, 4, 4.1, 4.2_

- [ ] 4. 🔴 サンプル設定ファイルの作成
  - `public/config/layers.json`（地理院地図・シームレス地質図・OSM等、最低3種のベースレイヤー含む）
  - `public/config/tours/sample-tour.json`（POI・ルート・メディアリンク・参考論文リンクのサンプルを含む）
  - _Requirements: 2, 4, 4.1, 4.2, 10_

- [ ] 5. 🔴 LayerManagerとレイヤーコントロールUIの実装
  - ベースレイヤー切替・オーバーレイレイヤーの複数ON/OFFのテスト作成→実装
  - 表示中レイヤー構成のlocalStorage永続化・再読み込み時の復元
  - レイヤー切替UIコンポーネント（片手操作を考慮した配置）
  - _Requirements: 2, 6_

- [ ] 6. 🔴 GeolocationServiceと現在地表示の実装
  - `watchPosition`によるテスト作成→実装、測位精度円の表示、方位（DeviceOrientation）表示
  - 位置情報許可拒否・取得失敗時のエラーメッセージ表示とフォールバック（地図閲覧は継続）
  - 追従表示（自動センタリング）のON/OFF切替
  - _Requirements: 1_

- [ ] 7. 🔴 POIRouteOverlayとPOI詳細パネルの実装
  - TourConfig内のPOI・ルートをLeafletマーカー/ポリラインとして描画するテスト作成→実装
  - POIタップ時の詳細パネル表示（名称・説明文・「メディア」セクション・「参考文献」セクションを分離表示、Requirement 4.2.4）
  - メディア/参考論文リンクタップ時に新規タブで開く挙動、リンク切れ時も他表示に影響しないことの確認
  - _Requirements: 4, 4.1, 4.2_

- [ ] 8. 🔴 レスポンシブモバイルUIベースラインの実装
  - 幅360px基準のレスポンシブレイアウト
  - 主要操作（現在地表示・レイヤー切替）を親指操作範囲に配置
  - タップ対象44px角以上の確保、屋外視認性を考慮したコントラスト比の適用
  - _Requirements: 6_

- [ ] 9. 🔴 Phase 1統合テストとMVP動作確認
  - Playwright等によるモックGeolocation・モックfetchを用いた結合テスト（レイヤー切替、現在地表示、POI詳細表示のE2Eフロー）
  - 実際にGitHub Pages（テスト用リポジトリ）へデプロイし、スマートフォン実機/エミュレータで一連の動作を確認
  - _Requirements: 9, 1, 2, 4_

## Phase 2: 機能拡張

- [ ] 10. 🔴 Service Workerによるオフラインタイルキャッシュの実装
  - OfflineCacheServiceのテスト作成→実装（閲覧済みタイル・アプリアセットのキャッシュ）
  - オフライン時の未キャッシュタイルに対するグレーアウト代替表示、アプリ非クラッシュの確認
  - _Requirements: 3_

- [ ] 11. 🔴 想定エリアの一括プリキャッシュ機能
  - `OfflineCacheService.precacheArea()` のテスト作成→実装
  - 主催者向け（または管理ツール向け）エリア選択UIとダウンロード進捗表示
  - _Requirements: 3_

- [ ] 12. 🔴 観察メモ機能の実装
  - `ObservationMemoStore`（localStorage/IndexedDB）のCRUDテスト作成→実装
  - 地図上へのメモピン表示、タップでの内容確認UI
  - CSV/GeoJSONエクスポート機能のテスト作成→実装
  - _Requirements: 5_

- [ ] 13. 🔴 Admin Config Tool: レイヤー編集機能
  - レイヤー一覧表示、タイルURL・名称・種別・不透明度・ズーム範囲・attributionの入力フォーム
  - `ConfigValidator`を用いたリアルタイム検証、地図プレビュー表示
  - JSON出力（ダウンロード）機能
  - _Requirements: 11, 10_

- [ ] 14. 🔴 Admin Config Tool: POI・ルート・メディア・参考論文編集機能
  - 地図クリックによるPOI作成、名称・説明文の入力
  - メディアリンク（写真/動画）・参考論文リンクの追加・編集・削除フォーム
  - 巡検ルート（複数POIを結ぶ線データ）の作成UI
  - JSON出力（`tours/*.json`形式）機能
  - _Requirements: 4, 4.1, 4.2, 11_

- [ ] 15. 🔴 ShareLinkServiceとビュー共有機能の実装
  - `encode()`/`decode()`の往復一致テスト作成→実装（中心座標・ズーム・レイヤー構成・POI IDのURLエンコード）
  - クリップボードコピー・Web Share APIによる共有UIの実装
  - 不正・破損した共有URLを受け取った場合のデフォルトビューへのフォールバックのテスト作成→実装
  - _Requirements: 13_

- [ ] 16. 🔴 GoogleMapsLinkServiceの実装
  - ピン留め形式URL生成（`https://www.google.com/maps/search/?api=1&query={lat},{lng}`）のテスト作成→実装
  - クリップボードコピーとコピー完了フィードバック（トースト）の実装
  - クリップボードAPI非対応環境向けの手動コピーUIフォールバックの実装
  - _Requirements: 14_

## Phase 3: 高度な機能

- [ ] 17. 🔴 パフォーマンス最適化とLighthouse CI導入
  - 大量POI（100件超）・複数オーバーレイレイヤー同時表示時の描画パフォーマンス計測と最適化
  - Lighthouse CIをGitHub Actionsに組み込み、初期表示3秒以内を継続的に計測
  - _Requirements: 7_

- [ ] 18. 🔴 セキュリティ・プライバシーレビュー
  - GitHub PagesのHTTPS配信確認、観察メモ等がPhase 1では端末内にのみ保存され外部送信されないことの確認
  - 将来のサーバーサイド機能導入（Phase 2以降のバックエンド）に向けたセキュリティポリシーのドキュメント化
  - _Requirements: 8_

- [ ] 19. 🔴 PWA対応強化
  - `manifest.json`とアイコン一式の作成、ホーム画面へのインストール対応
  - _Requirements: 6, 7_

- [ ] 20. 🔴 複数実習（ツアー）切替UIの実装
  - `listAvailableTours()`を用いたツアー選択画面の実装
  - 選択したツアーのPOI・ルート・レイヤー構成への切替UX改善
  - _Requirements: 4, 10_

## Phase 4: 本番化対応

- [ ] 21. 🔴 自動テストカバレッジ拡充とCIゲート強化
  - 単体・結合・E2Eテストの主要機能網羅（GNSS、レイヤー切替、POI表示、共有リンク、Googleマップリンク、オフラインキャッシュ、観察メモ）
  - CIでのテスト失敗時のデプロイブロック確認
  - _Requirements: 9_

- [ ] 22. 🔴 運用ドキュメント整備
  - 主催者向けドキュメント（Admin Config Toolの使い方、JSON編集・Git commit/push手順）
  - 開発者向けドキュメント（ローカル開発環境構築、テスト実行、デプロイ手順）
  - _Requirements: 9, 11, 12_

- [ ] 23. 🔴 実機クロスブラウザ検証
  - iOS Safari / Android Chrome実機でのGNSS取得・クリップボードAPI・Web Share APIの挙動差異確認と吸収
  - _Requirements: 1, 6, 13, 14_

- [ ] 24. 🔴 本番リリース前最終レビュー
  - `requirements.md`全項目の受け入れ基準に対する充足確認
  - `design.md`とのアーキテクチャ整合性確認
  - GitHub Pages本番環境への最終デプロイ
  - _Requirements: 12_
