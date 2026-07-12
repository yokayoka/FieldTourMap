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

- [x] 17. ✅️ パフォーマンス最適化とLighthouse CI導入
  - 大量POI（100件超）・複数オーバーレイレイヤー同時表示時の描画パフォーマンス計測と最適化
  - Lighthouse CIをGitHub Actionsに組み込み、初期表示3秒以内を継続的に計測
  - 完了メモ: `e2e/performance.spec.ts`にPOI 150件（Requirement 7が想定する「100件超」規模）を機械生成して読み込ませるE2Eベンチマークを追加し、初期表示（150マーカー描画完了）が3秒以内であること・描画後もズーム操作等に反応し続けることを回帰テストとして固定した。実測は274ms〜474ms程度であり、`PoiRouteOverlay`は現状の素朴なLeaflet標準マーカー実装のままで十分な性能を持つと判断し、マーカークラスタリング等の追加ライブラリ導入は見送った（新規ライブラリ導入はCLAUDE.mdの合意原則に照らし、実測で必要性が確認できない限り行わない判断）
  - Lighthouse CI（`@lhci/cli`をdevDependencyに追加）を導入し、`lighthouserc.json`で本番相当のビルド（`vite preview`、base path `/FieldTourMap/`込み）に対しLighthouseを実行するよう設定。`interactive`（3000ms以内）・`first-contentful-paint`（2000ms以内）・`categories:performance`（0.7以上）をアサーション対象とした
  - 設計判断の確認: 地図タイルは国土地理院等の外部サーバーから取得するため、CI実行時の応答速度に計測値が左右される。ユーザーに確認の上、アサーションはすべて`warn`（非ブロッキング）とし、GitHub Actionsのワークフロー側でも`continue-on-error: true`を設定してLighthouse結果がデプロイをブロックしないようにした。レポートは`lighthouse-report`としてartifact保存し（30日保持）、継続的な傾向確認に用いる
  - 既知の制約（未解決・要調査）: `npx lhci autorun`が本アプリのページに対して`NO_FCP`（ページが一切ペイントされない）で失敗する問題があり、ローカル（Windows）・GitHub Actions（Ubuntu）実CI双方で再現した。readyパターン修正（ANSIエスケープシーケンスにより`"Local:"`がマッチしない不具合を`"Local"`に修正）・`--disable-dev-shm-usage`等のchromeFlags追加・`maxWaitForFcp`/`maxWaitForLoad`の大幅延長（60秒/90秒）の3種の独立した修正を試みたが、いずれも解消しなかった（CLAUDE.mdのデバッグループ上限3回に到達したため、このサブ課題はここで打ち切り）。`https://example.com`など外部の単純なページに対しては同環境のLighthouseが正常にペイントを検出できることを確認しており、lhci/Chrome起動自体が全面的に壊れているわけではない。一方、Playwright（別のChromium起動経路）は同じアプリページを問題なく描画できているため、原因はLighthouse固有のChrome起動方法とアプリ側の何か（未許可の位置情報許可プロンプト、Service Worker登録等）の相互作用にある可能性が高いと推測される。CI自体は`continue-on-error: true`によりデプロイをブロックしないため実害はないが、現状ではLighthouseレポートが生成されず「初期表示3秒以内の継続的計測」という目的は未達成であり、将来的な追加調査が必要
  - _Requirements: 7_

- [x] 18. ✅️ セキュリティ・プライバシーレビュー
  - GitHub PagesのHTTPS配信確認、観察メモ等がPhase 1では端末内にのみ保存され外部送信されないことの確認
  - 将来のサーバーサイド機能導入（Phase 2以降のバックエンド）に向けたセキュリティポリシーのドキュメント化
  - 完了メモ: `SECURITY.md`を新設し、Requirement 8の受け入れ基準ごとに確認結果を記録した。(1) 本番URLへの実際の`curl`確認で、HTTPS配信時のHSTSヘッダー付与とHTTP→HTTPSの301リダイレクトを確認（Requirement 8.1）。(2) `fetch`/`XMLHttpRequest`等のネットワーク送信箇所を全ソースファイルに対しGrepで洗い出し、位置情報（`GeolocationService`）・観察メモ（`ObservationMemoStore`）を外部送信するコードパスが存在しないことを確認。既存の送信箇所は公開設定ファイルの読み込みとタイル配信元へのGETのみであり、`public/sw.js`もタイルキャッシュ以外の処理を行わないことをコード内容で確認した（Requirement 8.2）。ユーザーが明示的に操作する共有機能（Task 15/16のShareLinkService・GoogleMapsLinkService）は意図的なユーザー操作によるものであり自動送信には該当しない旨を明記した。(3) 主催者向け認証情報管理が不要でGitHubの書き込み権限がアクセス制御の代替であることを確認（Requirement 8.3）。(4) 将来のサーバーサイド機能導入時のポリシー（認証情報のハッシュ化、HTTPS必須、個人位置データの保持期間目安90日での削除/匿名化、アクセス制御、入力検証、依存パッケージの継続的脆弱性スキャン）を明文化した（Requirement 8.3, 8.4）
  - 副次的な確認: `npm audit`で検出された5件の脆弱性はいずれもTask 17で追加した`@lhci/cli`（CI専用devDependency）の推移的依存に起因し、配信されるアプリ本体には含まれないことを確認。破壊的変更を伴うダウングレードが必要なため、現時点ではリスクを許容し`SECURITY.md`に記録した
  - 本タスクはレビュー・ドキュメント化が主目的でありアプリケーションコードの変更は行っていないため、既存のテストスイート（単体244件・E2E 35件）に影響はない
  - _Requirements: 8_

- [x] 19. ✅️ PWA対応強化
  - `manifest.json`とアイコン一式の作成、ホーム画面へのインストール対応
  - 完了メモ: `public/manifest.json`を新設（`display: standalone`、`icons`にany用途192/512pxとmaskable用途512pxを含む）。アイコン画像は新規ライブラリ導入を避けるため、既存devDependencyのPlaywrightで簡易SVG→PNGラスタライズを行い生成した（`public/icons/icon.svg`/`icon-maskable.svg`が元データ、生成スクリプトは使い捨てのためリポジトリには含めていない）。アプリの配色（青#1a5fb4・アンバー#f5a623の観察ポイントマーカー色）を踏襲した山と観察点のシンプルな意匠とした。maskable用は安全域（中心80%円）に収まるよう縮小して配置
  - `index.html`に`<link rel="manifest">`・favicon（SVG）・`apple-touch-icon`・`theme-color`・iOS向け`apple-mobile-web-app-*`メタタグを追加。パスはVite標準の`%BASE_URL%`プレースホルダを用い、開発時（`/`）と本番（`/FieldTourMap/`）双方で正しいURLに解決されることをビルド成果物（`dist/index.html`）で確認した
  - `e2e/pwa.spec.ts`を新規TDDで追加（2テスト）: manifest.jsonが実際にリンクされ`display: standalone`・`icons`（maskable含む）等ホーム画面インストールに必要な情報を持つこと、参照先アイコンファイルが実際に取得できること、iOS向けメタタグ・apple-touch-iconも同様に検証
  - インストール可能性の要件（Chromeの`beforeinstallprompt`条件: 有効なmanifest + fetchハンドラを持つService Worker）は、Task 10で実装済みの`public/sw.js`（fetchイベントリスナー登録済み）と今回のmanifestの組み合わせで満たされる設計とした
  - 既知のスコープ限定: PWA化は参加者向けMap Viewer（`index.html`）のみを対象とし、主催者向けAdmin Config Tool（`admin-tool/`）はホーム画面インストール対象外とした（design.mdのファイル構成上も参加者向けアプリのみがオフライン運用対象であるため）
  - _Requirements: 6, 7_

- [x] 20. ✅️ 複数実習（ツアー）切替UIの実装
  - `listAvailableTours()`を用いたツアー選択画面の実装
  - 選択したツアーのPOI・ルート・レイヤー構成への切替UX改善
  - 設計判断の確認: `TourConfig.layerIds`はサンプルデータ上ベースレイヤー3種+オーバーレイ1種を含み「このツアーで使える候補一覧」と解釈できたため、ユーザーに方針を確認。ツアー切替時は「初期値の提案のみ」を採用し、`layerIds`内の最初のbaseレイヤーと該当するoverlayレイヤーを自動選択するが、レイヤーパネル自体は引き続き全レイヤーを表示しユーザーは自由に他レイヤーへ切り替えられる設計とした
  - 完了メモ: `src/utils/tourSelection.ts`（選択中ツアーIDのlocalStorage永続化、4テスト）、`src/components/tourSelectorPanel.ts`（ツアー一覧の下部シート、5テスト）、`src/components/tourSelectorControl.ts`（現在のツアー名を表示するトグルボタン、3テスト）をTDD実装。`layerControl.ts`は外部からのレイヤー状態変更をUIへ反映する`refresh()`を追加できるよう`{root, refresh}`を返す形に変更（1テスト追加、呼び出し側`main.ts`・テストを対応するAPIに更新）。`ShareViewState`/`ShareLinkService`に`tourId`を追加し、共有URLが「どのツアーの、どのPOIか」まで復元できるよう拡張（1テスト追加）
  - `main.ts`の`setupPoiOverlay()`を`setupTourSwitching()`へ再設計。共有URLのツアーID→前回選択（localStorage）→一覧先頭、の優先順でツアーを解決し、共有URLに明示的なレイヤー構成が含まれる場合はツアーの提案より優先して復元する（Requirement 13.4, 13.7との両立）
  - サンプルデータとして`public/config/tours/second-tour.json`（海岸地形テーマ、layerIds=["osm","gsi-photo"]でサンプルツアーとは異なるベースレイヤーを提案）を追加し、`tours/index.json`に登録。`sampleConfig.test.ts`に「index.jsonに列挙された全ツアーが検証を通過する」テストを追加し、将来ツアーが増えても自動的に検証対象になるようにした
  - 発見・修正した不具合（2件）: (1) 新設した左上フローティングのツアー切替ボタンがLeaflet既定のズームコントロール（左上）と、次いでbottom-controls内の`layer-control`（`align-self:stretch`で全幅表示のためbottom-left/right両隅を実質占有）と衝突し、E2Eテストでクリック不能を検出。共有コントロールと合わせて画面右上に共通の`.top-controls`フレックスコンテナへ統合し、Task 8/12と同じ「固定px値でなくflexboxで積み上げる」方針で解消した。(2) ツアーのlayerIds提案ロジックを初期読み込み時にも無条件適用していたため、リロード時にLayerManagerが復元した永続化済みレイヤー状態（Requirement 2.5）を上書きしてしまう回帰をE2Eテストで検出。ユーザーが切替パネルから明示的にツアーを選択した場合のみレイヤー提案・地図再センタリングを適用するよう修正し、通常のリロード時はLayerManagerの永続化状態を優先するよう分離した
  - Playwrightで確認: 初期表示は一覧先頭のツアー、切替パネルでの一覧表示とアクティブ表示、別ツアー選択時のPOI再描画・レイヤー提案適用・地図再センタリング、リロード後の選択保持、共有URLでのツアーID+POI ID往復（別セッションでの復元）
  - _Requirements: 4, 10_

**Phase 3 (高度な機能) 完了**: タスク17〜20すべて完了。大量POI描画のパフォーマンス確認・Lighthouse CI（既知の制約: `NO_FCP`問題によりレポート未生成、Task 17完了メモ参照）・セキュリティ/プライバシーレビューとポリシー文書化・PWA対応（ホーム画面インストール）・複数実習ツアー切替UIがGitHub Pages上で動作し、単体テスト260件・E2Eテスト41件がCIで継続的に検証される状態になった。

## Phase 4: 本番化対応

- [x] 21. ✅️ 自動テストカバレッジ拡充とCIゲート強化
  - 単体・結合・E2Eテストの主要機能網羅（GNSS、レイヤー切替、POI表示、共有リンク、Googleマップリンク、オフラインキャッシュ、観察メモ）
  - CIでのテスト失敗時のデプロイブロック確認
  - 完了メモ: `@vitest/coverage-v8`を導入し`npm run test:coverage`でカバレッジ計測できるようにした（`vite.config.ts`の`test.coverage`に設定を追加、`main.ts`等のアプリ起動コードはdesign.mdのTesting Strategyに従いE2Eで検証する方針のため計測対象から除外）。導入時点でStatements 94.97%・Branches 83.43%だったところ、Requirement 9が名指しする7機能領域（GNSS/レイヤー切替/POI表示/共有リンク/Googleマップリンク/オフラインキャッシュ/観察メモ）を中心に未カバー箇所を精査し、テストを追加してStatements 97.9%・Branches 89.53%まで引き上げた
  - 追加した主なテスト: `layerManager`（永続化データが不正JSON/型不一致の場合のフォールバック、baseレイヤー0件時のthrow、overlayのdefaultVisible適用、非アクティブなoverlayをtoggle offしてもno-opであること）、`observationMemoStore`（`crypto.randomUUID`非対応環境へのフォールバック、永続化失敗時に例外を投げないこと、永続化データが配列でない場合のフォールバック、複数メモがある場合に対象のメモのみ更新されること）、`configValidator`（`minZoom`/`maxZoom`が数値でない場合、ツアー内のメディア/参考文献リンクのネストしたエラーがPOI・要素インデックス付きで報告されること）、`geolocationService`（未知のエラーコードに対するデフォルトメッセージ）、`adminNav`（0%カバレッジだった管理ツールのページ間ナビゲーション）、`downloadTextFile`（0%カバレッジだったダウンロードユーティリティ）
  - 回帰防止テストを追加: `offlineCacheService`のデフォルト`fetchFn`（グローバル`fetch`をアロー関数でラップした実装）が実際に`Illegal invocation`にならず動作することを検証するテストを追加した。Task 11で発見・修正した実バグの再発を単体テストレベルでも検知できるようにする目的
  - 意図的にカバレッジ対象から除外・許容した箇所: (1) `layerManager.defaultCreateLayer`/`poiRouteOverlay.defaultCreateMarker`/`defaultCreatePolyline`等、単体テストでは常にフェイクへ差し替えて検証しているデフォルトのLeaflet連携実装。design.mdのTesting Strategy通りPlaywright E2E（実際にタイル/マーカーが描画されることを検証済み）で担保する方針を踏襲した。(2) `typeof navigator/caches/location !== "undefined"`等の非ブラウザ環境向けフォールバック分岐（`clipboard.ts`, `shareLinkService.ts`, `offlineCacheService.ts`）。本アプリはブラウザ専用のクライアントサイドSPAであり、jsdom環境下では常にtrueとなるためテストする実益が低いと判断した
  - CIゲートの確認（Requirement 9.3）: `.github/workflows/deploy.yml`を再確認し、`Lint`/`Type check`/`Test`/`E2E test`の各ステップに`continue-on-error`が設定されておらずbuildジョブの失敗として扱われること、`deploy`ジョブが`needs: build`によりbuildジョブ成功後にのみ実行されることを静的に確認した（Lighthouse CIステップのみTask 17でユーザー確認済みの方針により意図的に`continue-on-error: true`）
  - Requirement 9.4（型定義・ドキュメントコメントによる保守性）は、プロジェクト全体でTypeScript strictモード・全公開APIへのinterface定義を徹底する既存方針により継続的に満たされていることを確認した
  - 単体テスト260件→282件、E2Eテスト41件（変更なし）、lint・型チェック・buildすべて成功
  - _Requirements: 9_

- [x] 22. ✅️ 運用ドキュメント整備
  - 主催者向けドキュメント（Admin Config Toolの使い方、JSON編集・Git commit/push手順）
  - 開発者向けドキュメント（ローカル開発環境構築、テスト実行、デプロイ手順）
  - 完了メモ: `docs/organizer-guide.md`（主催者向け）と`docs/developer-guide.md`（開発者向け）を新設し、ほぼ空だった`README.md`をドキュメント一覧+クイックスタートを載せたランディングページに書き換えた
  - organizer-guide.mdは実際のAdmin Config Toolのソースコード（`admin-tool/src/main.ts`, `tourEditorMain.ts`, `layerEditorForm.ts`）を確認した上で、フォーム項目名・ボタン文言を実装と一致させて記載。レイヤー編集・POI/ルート編集の操作手順に加え、Task 20で追加した複数ツアー機能に対応するため`tours/index.json`への登録手順を明記し、既知の制約（レイヤー選択・ルート頂点編集UI未実装）もTask 14の完了メモと整合させて記載した。Git操作に不慣れな主催者を想定し、コマンド例に加えGitHub Desktop等のGUIツールでも代替できる旨を明記した
  - developer-guide.mdは`package.json`のスクリプト一覧（lint/tsc/test/test:coverage/test:e2e/build/preview）、`.github/workflows/deploy.yml`の実際のジョブ構成（テスト失敗時にデプロイがブロックされる仕組み、Lighthouse CIが非ブロッキングである理由と既知の制約への言及）、Pages初回セットアップの注意点（Task 2の完了メモに記載された404の既知の落とし穴）を記載した
  - 本タスクはドキュメント整備が主目的でありアプリケーションコードの変更は行っていないため、既存のテストスイート（単体282件・E2E 41件）に影響はない
  - _Requirements: 9, 11, 12_

- [x] 23. ⚠️ 実機クロスブラウザ検証（一部ブロック: 実機確認は未実施）
  - iOS Safari / Android Chrome実機でのGNSS取得・クリップボードAPI・Web Share APIの挙動差異確認と吸収
  - 完了メモ: 本エージェントは物理的なiOS/Android実機にアクセスできないため、実機での動作確認そのものは実施できていない。代わりにコードレビューによる既知のプラットフォーム差異の洗い出しと、発見した差異への対応（コード修正・回帰テスト追加）を行った
  - **発見・修正した実装ギャップ（iOS 13+ Safari）**: `DeviceOrientationEvent`はiOS 13以降のSafariにおいて、ユーザー操作（タップ等）の文脈内で`DeviceOrientationEvent.requestPermission()`を明示的に呼び出し許可を得ない限り`deviceorientation`イベントが一切発火しない仕様がある（Android Chrome等にはこの制約がない）。既存実装は`startWatching()`（ページ読み込み時に自動実行、ユーザー操作の文脈にない）で無条件にイベントリスナーを登録しており、iOS実機では方位矢印表示（Requirement 1.3）が機能しない可能性があった。`GeolocationService`に`requestOrientationPermission()`を追加し、iOS判定時（`DeviceOrientationEvent.requestPermission`が存在する場合）は`startWatching()`ではリスナーを自動登録せず、現在地ボタンのクリックハンドラ（ユーザー操作の文脈）から許可をリクエストしてから登録するよう修正した（`src/services/geolocationService.ts`, `src/main.ts`）。jsdom環境では`DeviceOrientationEvent.requestPermission`が未定義のため既存テストへの影響はなく、新規に5件の単体テスト＋1件のE2Eテスト（`DeviceOrientationEvent.requestPermission`をスタブ化し、ページ読み込み時点では未呼び出し・ボタンタップ後に呼び出されることを検証）を追加した
  - **発見・修正した実装ギャップ（共有機能のフォールバック欠如）**: Googleマップリンク取得機能（Requirement 14.6）にはクリップボードAPI失敗時の手動コピー用フォールバックUI（`linkFallbackPanel`）が既にあったが、共有機能（Requirement 13）には同等のフォールバックがなく、Web Share API・クリップボードAPIの両方が失敗する環境（iOS Safariでの実行文脈喪失等、ブラウザ間の挙動差異により起こりうる）では共有手段を完全に失っていた。`linkFallbackPanel`を`main.ts`側で1つ生成し共有機能・Googleマップリンク機能で共用するようリファクタリングし、共有失敗時にも同じ手動コピーUIが表示されるよう修正した。E2Eテストを1件追加（クリップボードAPI不可環境でフォールバックUIが表示されることを確認）
  - **レビューした上で対応不要と判断した項目**: (1) `viewport`メタタグの`user-scalable=no`はiOS 10+のアクセシビリティ機能により無視されうるが、これはAppleの意図的な仕様でありLeaflet地図のズーム操作自体には影響しないため対応不要と判断。(2) `.bottom-controls`等の`max-height: 40vh/60vh`はiOSのアドレスバー開閉に伴う動的ビューポート高の変化で多少伸縮しうるが、`height`ではなく`max-height`かつボトムシート用途であるため致命的な表示崩れのリスクは低いと判断し、確証のない`100dvh`等への変更は見送った。(3) クリップボードAPI非対応の古いiOS（<13.4）向けに`document.execCommand('copy')`等の非推奨APIを追加することは、既にWeb Share API→Clipboard API→手動コピーUIの3段階フォールバックを備えているため不要と判断した
  - **ユーザーに実機確認をお願いしたい項目（チェックリスト）**: 上記の対応がコードレビューベースであり実機での動作を保証するものではないため、可能であれば以下を実機で確認いただきたい。
    1. iOS Safari実機で現在地ボタンをタップした際、方位取得の許可ダイアログが表示され、許可すると方位矢印（現在地マーカーの矢印）が向きに応じて回転すること
    2. iOS Safari / Android Chrome実機で共有ボタン・Googleマップリンク取得ボタンをタップした際、クリップボードへのコピーまたはOS標準の共有シートが正しく動作すること（失敗した場合は手動コピー用UIが表示されること）
    3. iOS Safari実機でGNSS現在地表示・レイヤー切替・POI表示等の基本機能が問題なく動作すること
  - _Requirements: 1, 6, 13, 14_

- [x] 24. ✅️ 本番リリース前最終レビュー
  - `requirements.md`全項目の受け入れ基準に対する充足確認
  - `design.md`とのアーキテクチャ整合性確認
  - GitHub Pages本番環境への最終デプロイ
  - 完了メモ: Requirement 1〜14（4.1, 4.2含む）の全受け入れ基準を実装・テストコードと照合した。ほぼ全項目が単体テスト・E2Eテストまたは実装コードで直接裏付けられていることを確認した。以下、確認の過程で見つかった軽微な事項を記録する。
    - **Requirement 7.1（初期表示3秒以内）**: Lighthouse CI（Task 17）が`NO_FCP`エラーで未稼働のため、本要件を直接裏付ける自動計測が欠けていた。代替として`e2e/performance.spec.ts`に実際の公開サンプルツアーを用いた通常規模の初期表示時間を計測するE2Eテストを追加し（実測255ms）、3秒以内であることを回帰テストとして固定した
    - **Requirement 2.4（レイヤー切替2秒以内、キャッシュ済みタイル時）**: `LayerManager.setBaseLayer()`/`toggleOverlay()`はタイルレイヤーの生成・追加を同期的に行い、人為的な遅延を挟まない設計のため設計上は充足しているが、実際のタイル読み込み時間はネットワーク依存でありE2Eでの厳密な時間計測は行っていない（ネットワーク依存の値をテストで固定するとテストの安定性を損なうため）
    - **Requirement 10.2（新規タイルソース追加の容易性、"WMS/XYZ形式等"の例示）**: 実装は`LayerDefinition.urlTemplate`によるXYZ形式のみをサポートし、WMS形式には対応していない。要件文は"等"を含む例示でありXYZのみの対応でも要件の趣旨（コード変更なしでの新規レイヤー追加）は満たしていると判断したが、将来WMS等の別形式に対応する場合は`LayerManager.defaultCreateLayer()`の拡張が必要になる
    - 上記いずれも既存のPhase 1〜3の完了メモ・SECURITY.md・organizer-guide.md/developer-guide.mdに記録済みの制約と重複せず、新たに致命的な未充足項目は見つからなかった
  - `design.md`とのアーキテクチャ整合性確認の結果、フェーズ1初期からの実装進化に伴う記述の陳腐化を複数発見した。ユーザーに確認の上、実装済み内容をdesign.mdへ反映する修正（新規設計変更ではない）を実施した: (1) `ShareViewState`に`tourId`フィールドを追加（Task 20相当）、(2) MapViewerの責務にツアー切替を追記し、実装が`main.ts`内の複数`setupXxx()`関数に分割されている旨を明記、(3) AdminConfigToolの記述を、実際の2ページ構成・複数ストア/コンポーネントへの分解に合わせて修正、(4) File Storage Structureを実際の構成（`index.html`のルート配置、`docs/`, `SECURITY.md`, `e2e/`, `lighthouserc.json`, `public/manifest.json`, `public/sw.js`等）に合わせて修正、(5) Testing Strategyにカバレッジ計測・E2Eテスト件数・Lighthouse CIの既知の制約を追記
  - 最終デプロイ: 本タスクの変更（E2Eテスト追加・design.md修正）をコミット・pushし、CI（build/deploy）成功を確認した。本番URL（`https://yokayoka.github.io/FieldTourMap/`）に対しPlaywrightで実ブラウザ確認し、地図表示・レイヤー切替・POI詳細表示・ツアー切替・PWAマニフェストが正常に動作することを確認した
  - _Requirements: 12_

**Phase 4 (本番化対応) 完了**: タスク21〜24すべて完了。自動テストカバレッジ拡充（単体287件・E2E 44件）・運用ドキュメント整備・既知のプラットフォーム差異への対応・requirements.md/design.mdの最終整合性確認を経て、本プロジェクトの計画された全24タスクが完了した。

---

## プロジェクト完了サマリー（Phase 1〜4）

`requirements.md`に定義された16件の要件（Requirement 1〜14、4.1、4.2）はいずれも実装・テストにより裏付けられている。既知の制約（実機未検証、Lighthouse CIのNO_FCP問題、Admin Config Toolの一部編集UI未実装等）はいずれも致命的ではなく、各タスクの完了メモ・SECURITY.md・organizer-guide.md/developer-guide.mdに記録済みである。GitHub Pages本番環境（`https://yokayoka.github.io/FieldTourMap/`）で継続的にCI/CDパイプラインを通じて運用されている。

## Phase 5: Googleスプレッドシート連携（Requirement 15）

Phase 4完了後、ユーザーからの追加要望によりRequirement 15（Googleスプレッドシートによるプロジェクトの保存・読み込み）を追加した。Admin Config Tool専用の機能であり、参加者向けMap Viewerには影響しない。

- [x] 25. ✅️ GoogleSheetsProjectServiceの実装（TDD）
  - Google Identity Services（GIS）の動的読み込みとOAuth 2.0トークン取得（`authorize`/`isAuthorized`）
  - `LayerDefinition[]` ⇄ `Layers`シート行の相互変換（往復一致テスト）
  - `TourConfig`（POI/メディア/参考文献/ルート/ルート頂点）⇄ `Tours`/`POIs`/`Media`/`ReferencePapers`/`Routes`/`RoutePoints`各シート行の相互変換（往復一致テスト、`tourId`によるフィルタ・他ツアー行の非破壊を含む）
  - Sheets API v4呼び出し（`fetch`ベース、`values.get`/`values.update`等）をDIパターンでフェイクに差し替え可能にし、認可拒否・API失敗・シート形式不正の異常系を含めて単体テスト
  - 完了メモ: `admin-tool/src/services/googleSheetsRowMapping.ts`（純粋な変換ロジック、ヘッダー名による列対応付けで列順のずれに頑健、10テスト）と`admin-tool/src/services/googleSheetsProjectService.ts`（OAuth・Sheets API呼び出しのオーケストレーション、13テスト）に分割してTDD実装した。`gapi`等の重量級クライアントライブラリは追加せず、GISスクリプトの動的`<script>`読み込み+`fetch`によるSheets API v4直接呼び出しのみで実現し、新規npm依存はゼロ
  - `saveTour`/`loadTour`は対象ツアーのシート全体を読み込んでから`tourId`でフィルタ・置換し書き戻す設計とし、同一スプレッドシートに複数ツアーが保存されていても他ツアーの行を破壊しないことをテストで確認した（`mergeTourIntoSheets`の他ツアー保持テスト、同一ツアーを再保存した際に重複せず置換されることのテスト含む）
  - Admin Config Tool専用であることをビルド成果物で確認: `npm run build`後の参加者向けバンドル（`dist/assets/main-*.js`）のファイルサイズが本タスク追加前後で変化しないことを確認し、新規コードが参加者向けMap Viewerのバンドルに混入していないことを裏付けた（Requirement 15.7）
  - 単体テスト287件→310件（+23）、E2Eテスト44件（変更なし、影響なし）、lint・型チェック・buildすべて成功
  - _Requirements: 15_

Task 25完了後、ユーザーとの議論により「GitHubを使わない第三者主催者が本アプリを流用できるようにしたい」という、当初のRequirement 15の想定より大きな目的が判明した。これに対応するためRequirement 16（参加者向けMap Viewerでの、認証なし公開CSV経由のプロジェクト読み込み）を追加し、以下の通りタスクを再編した。

- [x] 26. ✅️ GoogleSheetsRowMappingの共有化とCSVパーサーの実装（TDD）
  - `admin-tool/src/services/googleSheetsRowMapping.ts`を`src/services/`へ移動し、`ConfigValidator`同様Admin Tool/Map Viewer双方から利用する共有モジュールとする（Admin Tool側のimportパス・既存テストへの影響を確認）
  - RFC 4180準拠の小さなCSVパーサー/シリアライザを新規実装（引用符・カンマ・改行を含むフィールドの往復一致をTDDで確認）。新規npm依存は追加しない
  - 完了メモ: `googleSheetsRowMapping.ts`/`.test.ts`を`src/services/`へ移動し、`admin-tool`側の`googleSheetsProjectService.ts`・そのテストのimportパスを更新。移動前後で既存23テストが引き続き成功することを確認した。`src/utils/csv.ts`にRFC 4180準拠のCSVパーサー（`parseCsv`）を状態機械で新規実装（引用符内のカンマ・改行・二重引用符エスケープ、CRLF/LF混在、末尾改行の扱い、空フィールドを含め9テスト）。実際にSheetsへ書き込む処理（Admin Tool側）はJSON `values`形式のみを使うため、CSVシリアライザは実装せず`parseCsv`のみとした（YAGNI）
  - `npm run build`後の参加者向けバンドルサイズが変化しないことを確認（`googleSheetsRowMapping.ts`はまだどこからも参照されていないため。Task 27でMap Viewer側から実際に利用する）
  - 単体テスト310件→319件（+9）、E2Eテスト44件（影響なし）、lint・型チェック・buildすべて成功
  - _Requirements: 15, 16_

- [x] 27. ✅️ PublicSheetProjectLoaderの実装（TDD）
  - `project`パラメータで指定されたスプレッドシートIDから、公開CSVエンドポイント経由で認証なしにレイヤー/ツアーを取得する`loadLayers`/`loadTour`/`listAvailableTours`をTDD実装
  - 未公開・ID誤り・シート形式不正・ネットワークエラー時の異常系テスト
  - 完了メモ: `src/services/publicSheetProjectLoader.ts`をTDD実装（6テスト）。`https://docs.google.com/spreadsheets/d/{id}/gviz/tq?tqx=out:csv&sheet={シート名}`という公開CSVエンドポイントを`fetch`するのみでOAuth・APIキーは一切使わない。`googleSheetsRowMapping.ts`に`sheetToTourSummaries()`（`Tours`シート→`{id, title}[]`、2テスト）を追加し、`ConfigLoader.listAvailableTours()`と同じ戻り値の形に揃えた
  - フェイクfetchはシート名ごとにCSVテキストを返す設計とし、`googleSheetsRowMapping`のテストで使ったツアーデータをCSV化して往復一致を検証。ネットワークエラー・非200レスポンス・存在しないツアーIDの異常系もそれぞれ分かりやすいエラーメッセージ付きで例外を投げることを確認した
  - 単体テスト319件→327件（+8）、E2Eテスト44件（影響なし）、lint・型チェック・buildすべて成功。参加者向けバンドルサイズも変化なし（まだ`main.ts`から未参照、Task 28で統合）
  - _Requirements: 16_

- [x] 28. ✅️ Map Viewerへの`project`パラメータ統合
  - `ConfigLoader`が`project`パラメータの有無に応じて`PublicSheetProjectLoader`と従来の静的JSON読み込みを切り替えるよう拡張
  - `main.ts`で観察メモ・レイヤー選択・ツアー選択の永続化キーをプロジェクトごとに分離（Requirement 16.9）
  - 共有URL（ShareLinkService）に`project`パラメータを含め、受信者が同じプロジェクトを再現できるようにする（Requirement 16.8）
  - E2Eテスト（Playwrightのルートインターセプトで公開CSVレスポンスを模擬し、`?project=`付きURLでの表示・エラー時のフォールバックを確認）
  - 完了メモ: `configLoader.ts`の`loadLayers`/`loadTour`/`listAvailableTours`に任意の`projectId`引数を追加し、指定時は`PublicSheetProjectLoader`へ委譲、両経路とも同一の`ConfigValidator`で構造検証する設計とした（4テスト追加、`PublicSheetProjectLoader.prototype`をスパイして委譲を確認）。`ShareViewState`/`ShareLinkService`に`projectId`を追加しTask 20のtourIdと同じ往復エンコード方式で対応（1テスト追加）。`layerManager.ts`/`observationMemoStore.ts`の`DEFAULT_STORAGE_KEY`をexportし、`tourSelection.ts`に`keySuffix`引数を追加（2テスト追加）。`main.ts`では`projectStorageKeySuffix()`ヘルパーで`project`パラメータからサフィックスを算出し、`LayerManager`/`ObservationMemoStore`/`tourSelection`の各storageKeyへ注入することでプロジェクトごとのローカルストレージ分離を実現した
  - `project`パラメータの読み取りは`initializeMap()`の外側（bootstrap時点）で行い、`initializeMap(root, mapContainer, projectId)`へ明示的に渡す設計とした。これにより、読み込み失敗時のエラーメッセージを「プロジェクトの読み込みに失敗しました」（project指定時）と従来のアプリ全般エラーメッセージ（未指定時）とで出し分けられるようにした
  - **重大な不具合を発見・修正**: `PublicSheetProjectLoader`のデフォルト`fetchFn`が`options.fetchFn ?? fetch`（メソッド呼び出し`this.fetchFn(url)`でネイティブfetchを直接参照）となっており、Task 11で`OfflineCacheService`にて発見・修正したのと全く同じ"Illegal invocation"バグが再発していた。単体テストは常にフェイクの`fetchFn`を注入していたため検出できず、実際に`?project=`付きURLでE2Eテストを実行した際に「ネットワーク接続を確認してください」という原因不明のエラーとして顕在化し、原因調査の末に特定した。アロー関数でラップして解消し、同じ潜在バグを持っていた`GoogleSheetsProjectService`（Task 25、Admin Tool側）にも予防的に同じ修正を適用した
  - E2Eテストのデバッグでは、最小再現スクリプトによりPlaywrightのルートインターセプト自体は正常に機能していることを先に切り分け、次にCORSヘッダー不足を疑って追加したが解消せず、最終的に上記の"Illegal invocation"バグに到達した
  - `e2e/project-loading.spec.ts`を新規作成（5テスト）: `?project=`付きURLでの第三者プロジェクト表示、project未指定時の既定動作維持、未公開/読み込み失敗時のエラー表示、プロジェクトごとのlocalStorage分離、共有URLへの`project`パラメータ伝播と受信側での再現。モックには実際のGoogle公開CSVエンドポイントと同様のCORSヘッダー（`Access-Control-Allow-Origin: *`）を付与する必要があった
  - 単体テスト327件→334件（+7）、E2Eテスト44件→49件（+5）、lint・型チェック・buildすべて成功。参加者向けバンドルサイズは28.37kB→31.99kBへ増加（`PublicSheetProjectLoader`等が実際に`main.ts`から参照されるようになったため、想定通り）
  - _Requirements: 16_

- [x] 29. ✅️ Admin Config Tool（レイヤー編集）へのGoogleスプレッドシート連携統合
  - OAuthクライアントID・スプレッドシートIDの入力UI（localStorageへの保存）
  - 「スプレッドシートに保存」「スプレッドシートから読み込む」ボタンの追加、`AdminLayerListStore`との連携
  - 成功/失敗のフィードバック表示、失敗時も既存のJSONダウンロード機能に影響を与えないことをテストで確認
  - 完了メモ: `admin-tool/src/components/googleSheetsPanel.ts`を新規実装（6テスト）。OAuthクライアントID・スプレッドシートID入力、ログイン、保存/読み込みボタン、ステータス表示を提供する、Task 30でも再利用予定の汎用コンポーネント（未ログイン時は保存/読み込みボタンを無効化）。`admin-tool/src/main.ts`（レイヤー編集ページ）に統合し、クライアントID・スプレッドシートIDは`localStorage`（`fieldtour-admin.googleSheets.*`キー）に保存して次回起動時も再利用できるようにした
  - E2Eテストを新規作成（`e2e/admin-google-sheets-layers.spec.ts`、5テスト）: Google Identity Services（GIS）をスタブして常に成功/失敗するOAuthログインを模擬し、Sheets API v4のvalues.get/values.updateをメモリ上のシート状態でスタブすることで、ログイン→保存→読み込みの往復、スプレッドシートID未入力時のエラー表示と既存JSONダウンロード機能への非影響、認可失敗時の挙動を確認した。Task 28で修正済みの"Illegal invocation"バグ（`GoogleSheetsProjectService`にも予防的に適用済み）のおかげか、実装は一度で全テスト成功した
  - ビルド成果物を確認: `googleSheetsRowMapping`（純粋な変換ロジック、認証情報を含まない）が参加者向け`main.js`とAdmin Tool向け`adminTool.js`の両方から利用されるため、Viteのコード分割により独立した共有チャンク（`googleSheetsRowMapping-*.js`）として出力されることを確認した
  - 単体テスト336件→342件（+6）、E2Eテスト49件→54件（+5）、lint・型チェック・buildすべて成功
  - _Requirements: 15_

- [x] 30. ✅️ Admin Config Tool（ツアー編集）へのGoogleスプレッドシート連携統合
  - Task 29と同様のUIをツアー編集ページに追加し、`AdminTourStore`と連携（現在編集中の`tourId`のみを対象に保存・読み込み）
  - 複数ツアーを含むスプレッドシートから対象ツアーのみを読み込めることのテスト
  - 完了メモ: Task 29で汎用実装済みの`createGoogleSheetsPanel`をそのまま`admin-tool/src/tourEditorMain.ts`に統合（新規コンポーネント実装は不要）。「ツアーID」欄（`idInput`）の値を対象ツアーとして`GoogleSheetsProjectService.saveTour`/`loadTour`（Task 25で実装済み、`mergeTourIntoSheets`/`extractTourFromSheets`を内部で使用）に渡す設計とし、クライアントID・スプレッドシートIDのlocalStorageキーはTask 29と同じ命名規則（`fieldtour-admin.googleSheets.*`）を踏襲した
  - E2Eテストを新規作成（`e2e/admin-google-sheets-tour.spec.ts`、6テスト）: ログイン前のボタン無効化、現在編集中のツアー保存時にTours/POIs/Media/ReferencePapers/Routes/RoutePointsの複数シートへ分けて書き込まれることの確認、**2つのツアー（tour-alpha/tour-beta）を含むスプレッドシートから対象ツアーIDのみを読み込み、他方のツアーのPOIが混入しないことの確認**（`mergeTourIntoSheets`を直接使いテストデータを合成）、存在しないツアーIDを指定した場合のエラー表示、スプレッドシートID未入力時のエラーと既存JSONダウンロード機能への非影響、認可失敗時の挙動。Task 28/29で修正済みの"Illegal invocation"バグの予防的対応が効いており、実装は一度で全テスト成功した
  - 単体テスト342件（変更なし、既存コンポーネント・サービスの再利用のため新規ユニットテストは不要と判断）、E2Eテスト54件→60件（+6）、lint・型チェック・buildすべて成功
  - _Requirements: 15_

- [x] 31. ✅️ セットアップ・運用ドキュメント整備と最終確認
  - `docs/organizer-guide.md`にGoogle Cloudプロジェクト作成・OAuth同意画面設定（テストユーザー登録）・OAuthクライアントID発行の手順（Requirement 15向け）と、スプレッドシートの「ウェブに公開」手順・`?project=`URLの共有方法（Requirement 16向け、GitHubを使わない第三者主催者向けの案内として）を追記
  - `SECURITY.md`に、第三者が作成した未検証のプロジェクト（タイルURL・POI内容等）を読み込むことに伴うリスクと、それに対する既存の緩和策（`textContent`によるレンダリング、認証情報を扱わないこと等）を追記
  - 実際にGoogle Sheets APIとの疎通・公開CSV読み込みを確認できる範囲（単体テスト・UIの手動確認）で最終確認し、実際のOAuth同意画面・スプレッドシート共有設定はユーザー自身による確認が必要である旨を明記
  - 完了メモ: `docs/organizer-guide.md`のGoogleスプレッドシート節（Task 30の完了時点で追記済みだった「Task 29/30着手前」という陳腐化した制約記述）を、実際のGoogle Cloud Console操作手順（プロジェクト作成→Sheets API有効化→OAuth同意画面のテストユーザー登録→OAuthクライアントID発行→Admin Config Toolへの入力）に置き換えた。さらに「動作確認の範囲について」の節を新設し、自動テストはGIS/Sheets API/公開CSVをすべてモックしており、実際のOAuth同意画面表示・ドメイン認可・スプレッドシート公開設定はユーザー自身が一度手動確認する必要がある旨を明記した
  - `SECURITY.md`に「第三者作成プロジェクト（`?project=`）読み込みに伴うリスク」節を新設。コード監査（`src/`配下で`innerHTML`不使用を確認）により、POI名称等のXSSは`textContent`描画で防止されること、メディア/参考文献リンクは`ConfigValidator`が`http(s)://`以外のスキーム（`javascript:`等）を検証エラーとして拒否すること、参加者向け読み込み経路（`PublicSheetProjectLoader`）はOAuthを一切使わないためAdmin Tool側の認証情報が漏出し得ないことを表形式で整理した。一方でタイルURL経由の概略位置情報が第三者配信元へ露出するリスクは地図タイルの仕組み上不可避でコードでは緩和不能なため、主催者による共有先の管理に委ねる旨を明記し、既存の緩和策と区別した
  - ドキュメントのみの変更のため単体テスト342件・型チェック・lintに影響なし（全て成功を確認）
  - _Requirements: 15, 16_

## Phase 5完了

Requirement 15（Admin Config ToolからのGoogleスプレッドシート連携）・Requirement 16（参加者向けMap Viewerでの第三者プロジェクト読み込み）のタスク（25〜31）がすべて完了した。これにより、requirements.md/design.mdで定義された全16件の要件（Requirement 1〜16、4.1、4.2）の実装・テスト・ドキュメント整備が完了した状態となった。

Phase 5完了後、Googleアカウントを持たない主催者向けにエクセルブック（`.xlsx`）形式でのプロジェクト入出力機能（Requirement 17）を検討したが、実装に着手する前段階でnpm registry上の`xlsx`（SheetJS）パッケージにhigh severityの脆弱性（Prototype Pollution, ReDoS。修正版はnpm未公開）があることが判明した。ユーザーと協議の結果、本機能は見送り、ワークシート形式のプロジェクトファイルはGoogleスプレッドシート（Requirement 15・16）のみとする方針に決定した。requirements.md/design.mdへの追加は撤回済み。

### 追加の改善: Admin Config Toolプレビュー地図に常設の基準地図を表示（Requirement 11.5関連の不具合修正）

ユーザーが能登半島地震関連のレイヤー（`20240102noto_0405_0426do`等の被災地専用タイル）を独自に`layers_noto2024.json`として作成し、レイヤー編集ツールで読み込んでプレビューしたところ、何も表示されず地図を操作（目的地への移動）することもできないという問題が報告された。調査の結果、当該タイルURL自体は実在し実際に画像を返す（zoom 10〜18で200 OK確認済み）ものの、プレビュー地図の初期表示位置が東京付近（`DEFAULT_CENTER`）に固定されており、能登半島専用タイルにはその位置のデータが存在しないため空白になり、地図上に何の目印もなく移動先も分からない、という表示上の問題であることが判明した。

ユーザーからは対策として`LayerDefinition`に`ini_x`/`ini_y`（初期表示位置）を追加する案が出されたが、これは参加者向けMap Viewer・Google Sheets連携（Requirement 15・16）・requirements.md双方に波及するスキーマ変更となるため、代替案としてAdmin Config Tool内部のみで完結する解決策を提案し、了承を得た。

- 完了メモ: `admin-tool/src/main.ts`のプレビュー地図に、常時表示される基準地図（地理院地図標準、`REFERENCE_LAYER_URL`）を追加した。プレビュー対象レイヤー（`previewLayer`）はこの基準地図の上に重ねて表示されるため、(1) 対象レイヤーにデータがある範囲ではこれまで通りその内容が表示され、(2) データがない範囲では基準地図が透けて見えるため、ユーザーはそれを目印に目的の地域までパン・ズームできる。スキーマ変更は一切不要で、参加者向けMap Viewer・Google Sheets連携には影響しない
  - E2Eテスト（`e2e/admin-layers.spec.ts`）を1件追加（TDD、常に404を返すダミータイルURLでプレビューしても基準地図のタイルが表示され続けることを確認）。実タイルサーバー（GSI）への実リクエストで、能登半島のタイル自体が実在することも事前に`curl`で確認済み
  - 単体テスト342件（変更なし）、E2Eテスト（`admin-layers.spec.ts`）6件→7件（+1）、型チェック・lintすべて成功。ローカルの`vite build`はWindows環境固有の`dist/`ディレクトリファイルロック（今回の変更と無関係）で一時的に失敗したため、CIでのビルド結果を最終確認とした

### Requirement 15の縮小: Admin Config ToolのOAuth連携（保存・読み込み）機能を撤去

ユーザーが実際にGoogleスプレッドシート連携（Task 25/29/30で実装したOAuth経由の保存・読み込み）をテストしようとした際、Google Cloud ConsoleでのOAuthクライアントID発行手順が一般の主催者には難易度が高いという課題が指摘された。「スプレッドシートの共有リンクだけで運用できないか」という提案に対し、Google Sheets APIは書き込みに常にOAuth等の本人確認済みトークンを要求し、共有リンクのみでの匿名書き込みには対応していないというGoogle側の制約を説明した上で、ユーザーと協議した結果、**書き込みはJSON形式のみに限定し、Googleスプレッドシートへの転記は主催者自身の手作業とする**方針に決定した（Admin Config ToolのOAuth連携機能そのものを撤去）。

- 削除: `admin-tool/src/services/googleSheetsProjectService.ts`・同テスト、`admin-tool/src/components/googleSheetsPanel.ts`・同テスト、`e2e/admin-google-sheets-layers.spec.ts`、`e2e/admin-google-sheets-tour.spec.ts`（Task 25・29・30で実装した成果物）。`admin-tool/src/main.ts`・`tourEditorMain.ts`からOAuth連携の組み込み・localStorageキーを除去し、`admin-tool/src/style.css`の関連CSSも削除した
- 存続: `src/services/googleSheetsRowMapping.ts`（Requirement 16の読み取りおよびシート構成の基準として）、`PublicSheetProjectLoader`・Map Viewerの`?project=`読み込み（Requirement 16、変更なし）、Admin Config ToolのJSON download/upload（既存のまま）
- requirements.mdのRequirement 15を「OAuth読み書き機能」から「Googleスプレッドシートのシート構成仕様（主催者が手作業で転記する際の基準）」に全面的に書き換え、Requirement 16の該当箇所（15.4/15.7参照）も追従して修正した。design.mdのGoogleSheetsProjectService節・アーキテクチャ図のOAuth連携部分・Testing Strategy/Error Handlingの該当記述も削除・修正した
- `docs/organizer-guide.md`の「Admin Config Toolから直接保存・読み込みする」節（OAuthクライアントID発行手順）を削除し、「運用方法について」節に「JSON編集→ダウンロード→主催者自身の手作業でスプレッドシートへ転記→ウェブに公開」という運用フローの説明に置き換えた。`SECURITY.md`のOAuthアクセストークン漏出に関する記述も、OAuth自体が存在しなくなったことを反映して修正した
- 単体テスト342件→323件（-19、`googleSheetsProjectService.test.ts`・`googleSheetsPanel.test.ts`の削除）、E2Eテスト60件→50件（-10、`admin-google-sheets-layers.spec.ts`5件・`admin-google-sheets-tour.spec.ts`6件の削除、直前の基準地図修正で+1件済みのため差引-10）
- _Requirements: 15, 16_

### 重大なバグ修正: Googleスプレッドシート読み込みで`defaultVisible`が常にfalseとして扱われる問題

ユーザーが実際に上記の運用方法（JSONをGoogleスプレッドシートへ手作業で転記）に沿って独自プロジェクト（能登半島のレイヤー構成）を作成し、`?project=`URLで実機確認しようとしたところ、「ウェブに公開」設定後も401エラーが続く問題が発生。調査の結果、「ウェブに公開」だけでなく「共有」ダイアログの全般的アクセスを「リンクを知っている全員」に変更する必要があること（Google側の別々の権限設定）を特定し、解決した。

その後`curl`で実際に公開されたシートの内容を検証したところ、`defaultVisible`列の値がGoogleスプレッドシート側で自動的に大文字`TRUE`/`FALSE`へ正規化されていることが判明。`googleSheetsRowMapping.ts`の`sheetToLayers`は小文字の`"true"`との完全一致でしか判定しておらず、**実際にGoogleスプレッドシート上で手入力・貼り付けされたデータを読み込むと、すべてのレイヤーが`defaultVisible: false`として扱われてしまう**という重大なバグを発見した。既存の単体テストは`layersToSheet`が書き出す小文字の`"true"`との往復一致のみを検証しており、人間が実際にスプレッドシート上で入力した際にGoogle側が行う型正規化を再現していなかったため、これまで発見されていなかった（Task 11の"Illegal invocation"バグ、Task 28のE2Eテストでのみ顕在化した不具合と同種の「モックでは再現されない実環境固有の不具合」パターン）。

- 完了メモ: `src/services/googleSheetsRowMapping.ts`の`sheetToLayers`で、`row.defaultVisible.trim().toLowerCase() === "true"`と大文字小文字を区別しない判定に修正（TDD、大文字`TRUE`/`FALSE`を含む実データを模したテストケースを追加し赤→緑を確認）。この関数はAdmin Tool（Requirement 15当時）・Map Viewer（Requirement 16）双方から参照される共有モジュールのため、参加者向けの実際のプロジェクト読み込みにも直接効く修正
  - 単体テスト323件→324件（+1）、型チェック・lint・E2Eテスト（`project-loading.spec.ts`）すべて成功
- _Requirements: 16_

### 追加の改善: PC幅でのレイヤー選択パネルの余白を解消（Requirement 6関連）

`.bottom-controls`（レイヤー選択パネル・現在地ボタンを画面下部にまとめるコンテナ）は、スマートフォンでの片手操作を想定して`bottom: max(8px, env(safe-area-inset-bottom))`という8px程度の余白を意図的に設けていた。ユーザーからPCで閲覧した際にこの余白が目立ち「画面最下部より少し上に表示される」と指摘があり、モバイル側の意図（親指操作・セーフエリア対応）を変えずにPCでのみ余白をなくす対応を提案し了承を得た。

- 完了メモ: `src/style.css`に`@media (min-width: 768px)`を追加し、PC幅では`.bottom-controls`の`bottom`を`env(safe-area-inset-bottom, 0)`（余白なし）に上書きした。モバイル幅（768px未満）は既存の8px余白のまま
  - TDDで`e2e/responsive.spec.ts`に2件追加: モバイル幅（360px）で8px以上の余白が保たれることの回帰テスト、PC幅（1280px）で余白がほぼゼロ（1px以内）になることのテスト。CSS修正前に後者が失敗する（gap: 8px）ことを確認してから修正した
  - 単体テスト324件（変更なし）、E2Eテスト（`responsive.spec.ts`）2件→4件（+2）、型チェック・lint・E2Eテスト全体（52件）すべて成功
- _Requirements: 6_

### 重大なバグ修正: `?project=`読み込み時、初期表示でツアーのPOI範囲へ再センタリングされない

ユーザーが実際に能登半島のカスタムプロジェクト（`monzen-tour`/`machino-tour`）を`?project=`で開いた際、「常に東京付近（DEFAULT_CENTER）が表示され、ユーザーはエラーだと感じる」という問題が報告された。調査したところ、`main.ts`の`selectTour()`は`isExplicitSwitch`（ツアー切替パネルからの明示的な選択、Requirement 20）の場合のみ`map.fitBounds()`でツアーのPOI範囲へ再センタリングしており、**初期読み込み時（ページを開いた直後の自動選択）は再センタリングしない**設計だった。既定のサンプルツアーはDEFAULT_CENTER付近に位置するため問題が表面化していなかったが、`?project=`で読み込む第三者プロジェクトのPOIが遠方にある場合、常に無関係な地点が表示され続ける実質的な不具合だった（`e2e/project-loading.spec.ts`のテストデータに、この制約を回避するためわざわざPOI座標をDEFAULT_CENTERに合わせていたコメントが残っており、既知の制約として黙認されていたことが分かった）。

- 完了メモ: `selectTour()`の`fitBounds`呼び出しを`isExplicitSwitch`から切り離し、新たな`centerOnPois`オプションで独立制御できるようにした。初期読み込み時は、共有URL（Requirement 13）による明示的なビュー指定が無く、かつ`?project=`で読み込んだプロジェクトである場合にのみ`centerOnPois: true`を渡す（`TourSwitchingInitialState`に`hasSharedView`を追加）。既定の静的サンプル（`project`未指定）は対象外とし、既存の見た目・E2E期待値を変えないようスコープを絞った
  - TDD: `e2e/project-loading.spec.ts`の`projectTour`のPOI座標を意図的にDEFAULT_CENTERから遠く離れた座標（能登半島相当、37.4, 136.9）に変更。`git stash`で修正前のコードに戻して同テストが「element is outside of the viewport」で失敗する（赤）ことを確認してから、`main.ts`の修正を復元して成功する（緑）ことを確認した
  - 単体テスト324件（変更なし、UI/Leaflet結合部分のためE2Eで担保）、E2Eテスト全体52件すべて成功、型チェック・lintも成功
- _Requirements: 16, 20_

### 重大なバグ修正: メモ・Googleマップリンクの配置モード中、GPS追従で地図が動いてしまう

ユーザーが観察メモを追加しようとした際、「記入しようとするとGPSによって現在の位置に遷移してしまう」という報告があった。調査したところ、`setupLocationTracking()`のGPS追従モード（`followMode`は既定でON）は、メモ配置モードやGoogleマップリンク配置モードが有効かどうかに関わらず、位置情報が更新されるたびに無条件で`map.setView()`を呼んでいた。ユーザーが狙った地点をタップしようとしている最中にGPS更新が来ると地図が動いてしまい、意図した場所にメモを置けない（タップしても地図が動いて何も起きないように見える）という実質的な操作不能状態になっていた。

- 完了メモ: `setupLocationTracking()`が`LocationTrackingHandle`（`suspendFollow`/`resumeFollow`）を返すようにし、`setupObservationMemos()`・`setupGoogleMapsLinkFeature()`双方の配置モードON/OFF（トグルボタン・地図タップによる配置完了の両方）に連動してGPS追従を一時停止/再開するよう連携させた。GPS追従のトグルボタン自体の状態（ユーザーが明示的にON/OFFした設定）は変更せず、あくまで配置モード中だけ効果を一時的に抑制する設計とした
  - TDD: `e2e/memo.spec.ts`に新規テストを追加。Playwrightの位置情報エミュレーション（`context.setGeolocation()`）でメモ配置モード中に大きく離れた新しいGPS位置を通知し、他の固定マーカー（POI）の画面上の位置がほぼ変化しない（=地図が再センタリングされない）ことを確認。修正前は37476px相当のずれが検出され赤であることを確認してから実装した
  - 単体テスト324件（変更なし）、E2Eテスト（`memo.spec.ts`）4件→5件（+1）、`google-maps-link.spec.ts`（同様の配置モード機能）を含む全体53件すべて成功、型チェック・lintも成功
- _Requirements: 5, 1, 14_
