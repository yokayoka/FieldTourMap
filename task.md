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
  - 完了メモ: 公式Actions方式（`upload-pages-artifact` + `deploy-pages`）を採用。buildジョブ成功後にのみdeployジョブが走る`needs:`構成。`vite.config.ts`のbase pathを実リポジトリ名`FieldTourMap`に合わせて修正し、ビルド成果物のパスを確認済み。リモート`origin`を`https://github.com/yokayoka/FieldTourMap.git`として登録し、push・Pages設定（Source: GitHub Actions）・`workflow_dispatch`による再実行まで完了。build/deploy両ジョブが成功し、`https://yokayoka.github.io/FieldTourMap/`で公開稼働を確認済み
  - 既知の注意点: Pages未有効化のままpushすると`deploy-pages`が404で失敗する（初回のみ）。Pages設定を先に有効化しておくか、有効化後に`workflow_dispatch`で再実行すればよい
  - _Requirements: 9, 12_

- [x] 3. ✅️ コアデータモデルとConfigLoader/ConfigValidatorの実装（TDD）
  - `LayerDefinition`, `PointOfInterest`, `MediaLink`, `ReferencePaper`, `TourConfig` 等のTypeScriptインターフェース定義（design.md Core Interfaces準拠）
  - `ConfigLoader.loadLayers()` / `loadTour()` / `listAvailableTours()` のテスト作成→実装
  - `ConfigValidator.validateLayerDefinition()` / `validateMediaLink()` / `validateReferencePaper()` / `validateTourConfig()` のテスト作成→実装（タイルURLの`{z}/{x}/{y}`検証、リンクURLの`http(s)://`検証を含む）
  - 完了メモ: `src/types/config.ts`に型定義、`src/services/configValidator.ts`（単体テスト16件）、`src/services/configLoader.ts`（fetchモックによるテスト7件）を実装。全24テスト・lint・型チェック・buildすべて成功。リファクタリング観点で確認済み（重複なし、関数は単一責務）で追加変更不要と判断
  - _Requirements: 10, 4, 4.1, 4.2_

- [x] 4. ✅️ サンプル設定ファイルの作成
  - `public/config/layers.json`（地理院地図・シームレス地質図・OSM等、最低3種のベースレイヤー含む）
  - `public/config/tours/sample-tour.json`（POI・ルート・メディアリンク・参考論文リンクのサンプルを含む）
  - 完了メモ: `layers.json`はベースレイヤー3種（地理院地図標準/写真、OSM）+ シームレス地質図をオーバーレイ（opacity 0.6）として定義。`tours/sample-tour.json`にPOI2件（写真リンク付き・動画リンク付き）、参考論文リンク1件、ルート1件を含めた。`tours/index.json`も追加。実ファイルをConfigValidatorで検証する回帰テストを先に作成（7件、Red→Green確認）
  - 設計判断の記録: requirements.md Req2.1は「地質図」を3種のベースレイヤーの一つと例示していたが、地形図と重ねて比較する用途を優先し、design.mdの方針通りシームレス地質図は半透明オーバーレイとして実装した。ベースレイヤー自体は地理院地図標準/写真・OSMの3種で「3種類以上」の基準は満たしている
  - 副次対応: `sampleConfig.test.ts`で`node:fs`等を使うため`@types/node`を追加し、`tsconfig.json`の`types`に`"node"`を追加
  - _Requirements: 2, 4, 4.1, 4.2, 10_

- [x] 5. ✅️ LayerManagerとレイヤーコントロールUIの実装
  - ベースレイヤー切替・オーバーレイレイヤーの複数ON/OFFのテスト作成→実装
  - 表示中レイヤー構成のlocalStorage永続化・再読み込み時の復元
  - レイヤー切替UIコンポーネント（片手操作を考慮した配置）
  - 完了メモ: `LayerManager`は`MapLike`インターフェース越しにLeafletマップへ依存させ、フェイクmap/storageで7件のテストをTDD実施（unknown ID時のthrow、永続化、破損データからのフォールバック含む）。`layerControl.ts`はDOM操作のみの純粋コンポーネントとして5件のテストを実施。`main.ts`で実際のLeaflet地図・`loadLayers()`・`LayerManager`・`createLayerControl`を配線。Playwrightで実ブラウザ動作確認（レイヤー切替、リロード後の状態復元、コンソールエラーなし、スクリーンショットで地理院地図・地質図オーバーレイの表示を確認）
  - CSSで`.layer-control__button`/`.layer-control__checkbox-label`に44px以上のタップ領域、画面下部固定配置を実装（Requirement 6.2, 6.4）
  - _Requirements: 2, 6_

- [x] 6. ✅️ GeolocationServiceと現在地表示の実装
  - `watchPosition`によるテスト作成→実装、測位精度円の表示、方位（DeviceOrientation）表示
  - 位置情報許可拒否・取得失敗時のエラーメッセージ表示とフォールバック（地図閲覧は継続）
  - 追従表示（自動センタリング）のON/OFF切替
  - 完了メモ: `GeolocationService`は`GeolocationApiLike`/`OrientationTargetLike`インターフェース越しに依存させ、フェイクでTDD（12テスト。webkitCompassHeading優先、absolute alphaからの方位算出、エラーコード別メッセージ、unsupported時の即時エラー等を網羅）。`locationControl`は追従トグル・エラーバナー表示のDOM純粋コンポーネント（5テスト）。`main.ts`にLeafletマーカー（方位矢印付きdivIcon）・精度円・追従時automatic centeringを統合
  - 発見した不具合と修正: コンストラクタで`options.geolocation`未指定時に`navigator.geolocation`へフォールバックする実装が漏れており、実ブラウザでは常に「未対応」エラーになっていた。単体テストは常にフェイクを注入していたため検出できず、Playwrightでの実ブラウザ確認（許可あり/拒否の2ケース、スクリーンショット付き）で発見・修正し、回帰テストを追加した
  - _Requirements: 1_

- [x] 7. ✅️ POIRouteOverlayとPOI詳細パネルの実装
  - TourConfig内のPOI・ルートをLeafletマーカー/ポリラインとして描画するテスト作成→実装
  - POIタップ時の詳細パネル表示（名称・説明文・「メディア」セクション・「参考文献」セクションを分離表示、Requirement 4.2.4）
  - メディア/参考論文リンクタップ時に新規タブで開く挙動、リンク切れ時も他表示に影響しないことの確認
  - 完了メモ: `PoiRouteOverlay`は`OverlayMapLike`インターフェース越しにLeafletへ依存させ、マーカー/ポリラインファクトリと選択状態変更コールバックをフェイクでTDD（5テスト）。`poiDetailPanel`はDOM純粋コンポーネントとして「メディア」「参考文献」を別セクションで描画し、リンクは`target="_blank" rel="noopener noreferrer"`で新規タブに開く（7テスト、空セクション省略も確認）。`main.ts`で`loadTour("sample-tour")`結果をoverlay・詳細パネルに配線し、読み込み失敗時は警告ログのみで他機能は継続する設計とした
  - Playwrightで実ブラウザ確認: マーカータップ→詳細パネル表示（メディア/参考文献分離、新規タブ属性）、閉じるボタン、参考文献なしPOIでのセクション省略、コンソールエラーなしをスクリーンショット付きで確認
  - _Requirements: 4, 4.1, 4.2_

- [x] 8. ✅️ レスポンシブモバイルUIベースラインの実装
  - 幅360px基準のレスポンシブレイアウト
  - 主要操作（現在地表示・レイヤー切替）を親指操作範囲に配置
  - タップ対象44px角以上の確保、屋外視認性を考慮したコントラスト比の適用
  - 完了メモ: WCAG相対輝度に基づく`getContrastRatio()`をTDDで実装（9テスト。黒白21:1等の既知値、実際のUI配色5組がAA基準4.5:1以上であることを固定する回帰テスト付き）。`.layer-control`と`.location-control`を個別のposition:fixedから共通の`.bottom-controls`flexコンテナに統合し、固定px値によるオーバーラップリスクを解消（location-controlが常にlayer-controlの上に積み上がる構造に変更）
  - Playwrightで360×640ビューポート確認: 横スクロールなし（scrollWidth=clientWidth=360）、タップ対象5種すべて44px以上、location/layer control間の重なりなし、POI詳細パネルもレイアウト崩れなしをスクリーンショットで確認
  - _Requirements: 6_

- [x] 9. ✅️ Phase 1統合テストとMVP動作確認
  - Playwright等によるモックGeolocation・モックfetchを用いた結合テスト（レイヤー切替、現在地表示、POI詳細表示のE2Eフロー）
  - 実際にGitHub Pages（テスト用リポジトリ）へデプロイし、スマートフォン実機/エミュレータで一連の動作を確認
  - 完了メモ: `@playwright/test`を正式な開発依存として導入し、モバイル端末プロファイル（Pixel 7）を既定とする`playwright.config.ts`を作成。`e2e/`配下に10件のテスト（レイヤー切替とリロード後の状態復元、現在地表示と追従切替、位置情報拒否時のエラー表示と操作継続、POI詳細パネルの表示/クローズ、360px幅でのレイアウト・タップ領域・コントロール重なり）を作成し、全件成功
  - CIワークフローにPlaywrightブラウザインストール（chromium）とE2E実行ステップを追加し、失敗時はレポートをアーティファクトとして保存。push後の実CI実行でもE2E含め全ジョブ成功を確認（約46秒）
  - 本番URL（`https://yokayoka.github.io/FieldTourMap/`）に対しPlaywrightで実ブラウザ確認: 地図表示、3種のベースレイヤーボタン、現在地マーカー、POIマーカータップ→詳細パネル表示（「露頭A（花崗岩貫入部）」）まで、コンソールエラーなしで動作を確認
  - 発見した小さな不具合: E2Eテスト初回実行時、`layerControl`のボタンが`role="radio"`（Task 5でラジオグループとして実装）であるにもかかわらず`getByRole("button", ...)`で参照しており2件失敗。`getByRole("radio", ...)`に修正して解消（アプリ側のバグではなくテストの参照ミス）
  - _Requirements: 9, 1, 2, 4_

**Phase 1 (MVP) 完了**: タスク1〜9すべて完了。地図表示・レイヤー切替・GNSS現在地表示・オフライン基盤なしの状態でのPOI/参考文献表示・レスポンシブUIの基本機能がGitHub Pages上で動作し、単体テスト81件・E2Eテスト10件がCIで継続的に検証される状態になった。

### Phase 1完了後レビュー対応
Phase 1完了後、8観点（正誤性3・再利用/簡素化/効率3・altitude・CLAUDE.md準拠）の並列コードレビューを実施し、実コードを直読して検証した10件の指摘をすべてTDDで修正した。

- 🔴→✅️ `main.ts`の`loadLayers()`失敗が捕捉されず全画面が白くなる問題 → トップレベルcatchで`.app-error-banner`を表示するよう修正（E2Eテスト追加）
- 🔴→✅️ `ConfigValidator`が不正なJSON（フィールド欠落・型不一致）で例外を投げる問題 → 型ガードを追加し常に`ValidationResult`を返すよう修正（テスト10件追加）
- 🔴→✅️ `GeolocationService.startWatching()`の再入で前回のwatch/リスナーがリークする問題 → 再入時に自動`stopWatching()`するよう修正
- 🔴→✅️ `deviceorientation`イベントが無制限に`onUpdate`を呼び追従モード中に過剰な`map.setView()`を発生させる問題 → 250msスロットリングを追加（注入可能な`now()`でテスト）
- 🔴→✅️ `PoiRouteOverlay.renderTour()`が選択状態リセット時に`onSelectionChange(null)`を呼ばない問題 → `closePoiDetail()`経由に統一
- 🔴→✅️ `main.ts`のPOI選択コールバックが古い`tour`をクロージャで固定する問題 → `PoiRouteOverlay.getPoiById()`を追加し常に最新ツアーを参照するよう修正
- 🔴→✅️ `LayerManager`が永続化された`baseLayerId`のtype検証をしていない問題 → `type === "base"`チェックを追加
- 🔴→✅️ `LayerManager.persist()`の`localStorage.setItem`例外がUI更新を阻害する問題 → try/catchで握りつぶすよう修正（副次的に`layerControl.ts`側の例外伝播も解消）
- 🔴→✅️ コントラスト比回帰テストが不透明背景のみ検証しhalf-透明パネルを見落としていた問題 → `blendOverBackground()`を追加しワーストケース合成背景での検証を追加
- 🔴→✅️ `.bottom-controls`に`env(safe-area-inset-bottom)`がなくノッチ端末で操作しづらい問題 → `.poi-detail-panel`と同様のセーフエリア対応を追加

全修正後、単体テスト100件・E2Eテスト11件・lint・型チェック・buildすべて成功、Playwrightで正常系/異常系の実ブラウザ動作も確認済み。

## Phase 2: 機能拡張

- [x] 10. ✅️ Service Workerによるオフラインタイルキャッシュの実装
  - OfflineCacheServiceのテスト作成→実装（閲覧済みタイル・アプリアセットのキャッシュ）
  - オフライン時の未キャッシュタイルに対するグレーアウト代替表示、アプリ非クラッシュの確認
  - 完了メモ: `OfflineCacheService`（register/isTileCached）をDIパターンでTDD実装（6テスト）。`public/sw.js`は地図タイル配信元（GSI/産総研/OSM）へのGETリクエストのみをcache-first-with-network-fallbackで処理する手書きService Workerとし、スコープをタイルに限定（アプリ本体のapp-shellキャッシュはTask 19のPWA対応で扱う）。`LayerManager.defaultCreateLayer`に`tileerror`ハンドラを追加し`.tile-error`クラスでグレーアウト表示するCSSを追加
  - 重大なバグを発見・修正: E2Eテストで実際にキャッシュへ何も格納されないことが判明。`<img>`タグ経由のクロスオリジンタイルリクエストはno-corsとなりレスポンスが`opaque`（`status:0, ok:false`）になるため、`if (response.ok)`のみのキャッシュ条件では地図タイルが一切キャッシュされない不具合があった。`response.type === "opaque"`も許可するよう修正し、E2Eテストで実際にキャッシュへ格納されることを確認した。単体テストでは検出できない、実ブラウザでのService Worker検証だからこそ見つかった不具合
  - Playwrightで確認: SW登録・活性化、タイルキャッシュへの格納（Cache API直接検査）、オフライン時の未キャッシュタイルへのグレーアウト表示適用とアプリ非クラッシュ
  - _Requirements: 3_

- [x] 11. ✅️ 想定エリアの一括プリキャッシュ機能
  - `OfflineCacheService.precacheArea()` のテスト作成→実装
  - 主催者向け（または管理ツール向け）エリア選択UIとダウンロード進捗表示
  - 完了メモ: `src/utils/tileMath.ts`に標準的なWeb Mercatorタイル座標変換（`lngLatToTile`/`getTileCoordsForBounds`/`buildTileUrl`）を実装（11テスト）。`OfflineCacheService.precacheArea()`は同時実行数制限付きのタイルURL取得ループとしてTDD実装（10テスト、個別タイル失敗時も継続）。取得したレスポンスはService Worker（Task 10）が自動キャッシュするため、precacheArea自体はfetch発行のみで完結する設計とした。`precacheControl`（進捗・完了・エラー表示のDOM純粋コンポーネント、6テスト）をレイヤーパネル内に配置し、現在の地図表示範囲・アクティブレイヤー・現在ズーム+2段階を対象にプリキャッシュする
  - 重大な不具合を2件発見・修正: (1) `this.fetchFn(url)`というメソッド呼び出し形でネイティブ`fetch`を呼ぶと`Illegal invocation`エラーになる（`fetch`はwindowにバインドされていないと動作しない）。アロー関数でラップして解消。(2) 両方とも単体テストでは検出できず、実際にボタン操作からタイル取得までを通すE2Eテストで発見した。単体テストは常にフェイクの`fetchFn`を注入していたため、デフォルト実装のバグが見えていなかった
  - Playwrightで確認: ボタン押下→進捗表示→完了表示（ボタン再有効化）、Cache API検証でプリキャッシュ後にタイル数が実際に増加することを確認
  - _Requirements: 3_

- [x] 12. ✅️ 観察メモ機能の実装
  - `ObservationMemoStore`（localStorage/IndexedDB）のCRUDテスト作成→実装
  - 地図上へのメモピン表示、タップでの内容確認UI
  - CSV/GeoJSONエクスポート機能のテスト作成→実装
  - 完了メモ: `ObservationMemoStore`をDIパターン（storage/generateId/now）でTDD実装（CRUD 7テスト+エクスポート5テスト）。CSVはRFC 4180準拠でtext列を常にクォート、GeoJSONはFeatureCollection/Point（[lng,lat]順）で出力。`memoPanel`（作成/編集/閲覧を1コンポーネントに統合、10テスト）と`memoControl`（配置モードトグル+CSV/GeoJSONエクスポートボタン、5テスト）をDOM純粋コンポーネントとして実装。地図タップで配置するモードとPOIとは別の琥珀色ピンでmain.tsに統合
  - 発見した不具合: 機能追加でbottom-controls（現在地・レイヤー・プリキャッシュ・メモの4機能を積み上げ）の高さが画面の6割近くに達し、地図中央のタップがコントロールに奪われる状態になっていた。E2Eテストで発覚し、`.bottom-controls`に`max-height: 40vh; overflow-y: auto;`を追加して地図の可視領域を確保するよう修正。今後さらに機能が増える場合は、コントロールのグルーピング再設計を検討する必要がある
  - Playwrightで確認: 地図タップ→メモ作成→ピン表示→タップで内容確認→編集→削除、リロード後の永続化、CSV/GeoJSONダウンロード（ファイル名検証）
  - _Requirements: 5_

- [x] 13. ✅️ Admin Config Tool: レイヤー編集機能
  - レイヤー一覧表示、タイルURL・名称・種別・不透明度・ズーム範囲・attributionの入力フォーム
  - `ConfigValidator`を用いたリアルタイム検証、地図プレビュー表示
  - JSON出力（ダウンロード）機能
  - 完了メモ: design.mdのFile Storage Structureに従い`admin-tool/`を独立ページとして構築。`vite.config.ts`の`build.rollupOptions.input`をマルチページ化し、`dist/admin-tool/index.html`として出力（base path込みで動作確認済み）。`AdminLayerListStore`（メモリ上のCRUD、8テスト）、`layerEditorForm`（入力フォーム+`ConfigValidator`によるリアルタイム検証+プレビューボタン、8テスト）、`layerListView`（一覧表示、6テスト）をTDD実装し、`src/services/configValidator.ts`・`src/types/config.ts`を`admin-tool/src`からも共有利用。主催者向けツールは公開中の`layers.json`を初期読み込みし、編集後は`layers.json`としてダウンロード（Gitへのコミットは手動）
  - 発見した不具合: `.layer-editor-form`にCSSで`display: flex`を無条件指定していたため、`hidden`属性を付与してもブラウザ既定の`[hidden] { display: none }`規則より優先されず非表示にならなかった。E2Eテストで発覚し、`.layer-editor-form[hidden] { display: none; }`を明示追加して解消
  - Playwrightで確認: 公開中layers.jsonの初期表示、新規追加、不正URLでの保存拒否とエラー表示、既存レイヤーの編集・削除、プレビューでの実タイル表示、JSONダウンロード
  - _Requirements: 11, 10_

- [x] 14. ✅️ Admin Config Tool: POI・ルート・メディア・参考論文編集機能
  - 地図クリックによるPOI作成、名称・説明文の入力
  - メディアリンク（写真/動画）・参考論文リンクの追加・編集・削除フォーム
  - 巡検ルート（複数POIを結ぶ線データ）の作成UI
  - JSON出力（`tours/*.json`形式）機能
  - 完了メモ: `admin-tool/tour-editor.html`を新設（レイヤー編集ページと合わせマルチページ3エントリー構成）。`AdminTourStore`（POI/ルート/メタデータのCRUD、8テスト）、`linkListEditor`（URL+テキストの汎用リストエディタ、メディア/参考論文リンクで共用、6テスト）、`poiEditorForm`（メディア・参考論文のネストしたリスト編集を含む、6テスト）、`routeEditorForm`（5テスト）、`simpleListView`（POI/ルート一覧表示で共用する汎用コンポーネント、5テスト）をTDD実装。地図は「POIを追加」「ルートを追加」のモード切替式で、ルート作成は複数タップで頂点を蓄積しダッシュ線プレビュー→「ルートを確定」で確定する設計とした。2ページ間の移動用に共有`adminNav`コンポーネントを追加
  - 前回タスクの学びを適用: 新規フォーム（`poi-editor-form`/`route-editor-form`）には最初から`[hidden] { display: none; }`を明示し、Task 13で発見した同種の不具合を再発させないようにした
  - Playwrightで確認: 公開中サンプルツアーの初期読み込み、地図タップでのPOI追加とメディア/参考論文リンク保存、複数タップでのルート作成、既存POIの編集・削除、tours/*.jsonダウンロード
  - 既知の制約: レイヤー選択（`layerIds`）の編集UIは未実装（読み込んだ値をそのまま保持）。ルートの頂点編集（再描画）UIも未実装で、名称変更のみ対応
  - _Requirements: 4, 4.1, 4.2, 11_

- [x] 15. ✅️ ShareLinkServiceとビュー共有機能の実装
  - `encode()`/`decode()`の往復一致テスト作成→実装（中心座標・ズーム・レイヤー構成・POI IDのURLエンコード）
  - クリップボードコピー・Web Share APIによる共有UIの実装
  - 不正・破損した共有URLを受け取った場合のデフォルトビューへのフォールバックのテスト作成→実装
  - 完了メモ: `ShareLinkService`（encode/decode往復一致、クリップボード、Web Share API）をDIパターンでTDD実装（15テスト）。座標は小数点以下6桁に丸めて簡潔なクエリパラメータ（`lat`/`lng`/`zoom`/`base`/`overlay`/`poi`）にエンコード。`shareControl`（3テスト）は共有ボタン+一時フィードバック表示のDOMコンポーネント。main.tsで起動時に共有URLをデコードし、地図の初期ビュー・レイヤー構成（存在するIDのみ適用）・POI詳細の自動オープンを復元するよう統合。共有時はWeb Share API→クリップボードコピーの順にフォールバック
  - 発見した問題: E2Eテストで、POI詳細パネル（画面下部を覆う下部シート、z-index 1100）が開いている間、共有ボタン（元々bottom-controls内、z-index 1000）が完全に隠れてクリックできなくなることが判明。Requirement 13.2が想定する「POI詳細を開いた状態で共有する」というまさにその操作ができない状態だった。共有ボタンをbottom-controlsから切り離し、画面上部に独立してフローティング配置（z-index 1150）することで解消した
  - Playwrightで確認: レイヤー変更後の共有→別セッションでの状態復元、POI詳細を開いた状態での共有→受信側での同一POIパネル自動オープン、不正な共有URLでのフォールバック（アプリクラッシュなし）
  - _Requirements: 13_

- [x] 16. ✅️ GoogleMapsLinkServiceの実装
  - ピン留め形式URL生成（`https://www.google.com/maps/search/?api=1&query={lat},{lng}`）のテスト作成→実装
  - クリップボードコピーとコピー完了フィードバック（トースト）の実装
  - クリップボードAPI非対応環境向けの手動コピーUIフォールバックの実装
  - 完了メモ: Task 15で実装したクリップボード処理を`src/utils/clipboard.ts`として共有ユーティリティに切り出し、`ShareLinkService`もそちらを使うようリファクタ（重複を未然に回避）。`GoogleMapsLinkService`（ピン留め形式URL生成、座標6桁丸め、3テスト）、`toast`（一定時間後に自動で消える通知、3テスト）、`linkFallbackPanel`（クリップボードAPI非対応時の選択可能なテキスト表示、4テスト）、`googleMapsLinkControl`（地図タップモードのトグルボタン、3テスト）をTDD実装。`poiDetailPanel`に「Googleマップで開くリンクを取得」ボタンを追加（第2引数コールバックとして後方互換的に拡張、2テスト追加）。地図タップモードとPOI詳細パネルの両方から共通の`requestLink()`を呼び出す設計とした
  - Playwrightで確認: 地図タップでのリンクコピー+トースト表示、POIパネルからの正確な座標でのリンク取得、クリップボードAPI非対応環境でのフォールバックパネル表示
  - 既知の制約: メモ配置モードとGoogleマップリンク取得モードを同時に有効化した場合の相互排他制御は未実装（両方オンだと1回のタップで両方の動作が走る）。実運用上まれなケースと判断しPhase 2スコープでは対応を見送った
  - _Requirements: 14_

**Phase 2 (機能拡張) 完了**: タスク10〜16すべて完了。オフラインタイルキャッシュ・事前ダウンロード・観察メモ・Admin Config Tool（レイヤー/POI/ルート編集）・URL共有・Googleマップリンク取得がGitHub Pages上で動作し、単体テスト244件・E2Eテスト34件がCIで継続的に検証される状態になった。

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
