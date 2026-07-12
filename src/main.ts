import "leaflet/dist/leaflet.css";
import "./style.css";
import L from "leaflet";
import { loadLayers, loadTour, listAvailableTours } from "./services/configLoader";
import { LayerManager, DEFAULT_STORAGE_KEY as LAYER_STORAGE_KEY } from "./services/layerManager";
import { createLayerControl, type LayerControl } from "./components/layerControl";
import { GeolocationService, type GeolocationUpdate } from "./services/geolocationService";
import { createLocationControl } from "./components/locationControl";
import { PoiRouteOverlay } from "./services/poiRouteOverlay";
import { createPoiDetailPanel } from "./components/poiDetailPanel";
import { OfflineCacheService } from "./services/offlineCacheService";
import { createPrecacheControl } from "./components/precacheControl";
import {
  ObservationMemoStore,
  DEFAULT_STORAGE_KEY as MEMO_STORAGE_KEY,
} from "./services/observationMemoStore";
import { createMemoPanel } from "./components/memoPanel";
import { createMemoControl } from "./components/memoControl";
import { createTourSelectorControl } from "./components/tourSelectorControl";
import { createTourSelectorPanel } from "./components/tourSelectorPanel";
import type { LatLng, LayerDefinition, ObservationMemo } from "./types/config";
import { downloadTextFile } from "./utils/downloadTextFile";
import { readSelectedTourId, writeSelectedTourId } from "./utils/tourSelection";
import { ShareLinkService } from "./services/shareLinkService";
import { createShareControl } from "./components/shareControl";
import { GoogleMapsLinkService } from "./services/googleMapsLinkService";
import { createGoogleMapsLinkControl } from "./components/googleMapsLinkControl";
import { createLinkFallbackPanel, type LinkFallbackPanel } from "./components/linkFallbackPanel";
import { showToast } from "./components/toast";

// 初期表示位置は現在地取得（Requirement 1）が成功するまでの暫定フォールバック。
const DEFAULT_CENTER: L.LatLngExpression = [35.681236, 139.767125];
const DEFAULT_ZOOM = 15;

/**
 * 同一ブラウザで異なるproject（またはproject未指定の既定サイト）を閲覧した
 * 際に、観察メモ・レイヤー選択・ツアー選択が混在しないようにする
 * （Requirement 16.9）。project未指定時は空文字列（既存キーのまま）。
 */
function projectStorageKeySuffix(projectId: string | undefined): string {
  return projectId ? `.project.${projectId}` : "";
}

export function mountApp(root: HTMLElement): void {
  const mapContainer = document.createElement("div");
  mapContainer.id = "map";
  root.replaceChildren(mapContainer);
}

function showFatalError(root: HTMLElement, message: string): void {
  const banner = document.createElement("div");
  banner.className = "app-error-banner";
  banner.setAttribute("role", "alert");
  banner.textContent = message;
  root.appendChild(banner);
}

function createLocationIcon(heading: number | null): L.DivIcon {
  const arrow =
    heading !== null
      ? `<div class="location-marker__arrow" style="transform: rotate(${heading}deg)"></div>`
      : "";
  return L.divIcon({
    className: "location-marker",
    html: `<div class="location-marker__dot"></div>${arrow}`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export interface LocationTrackingHandle {
  /** メモ・Googleマップリンク等の地点配置モード中、GPS追従による地図の
   *  再センタリングを一時停止する。ユーザーが狙った地点をタップしようと
   *  している最中に地図が動いてしまうと操作できなくなるため。 */
  suspendFollow(): void;
  resumeFollow(): void;
}

function setupLocationTracking(map: L.Map, bottomControls: HTMLElement): LocationTrackingHandle {
  const geolocationService = new GeolocationService();
  let marker: L.Marker | null = null;
  let accuracyCircle: L.Circle | null = null;
  let followSuspended = false;

  const locationControl = createLocationControl({
    onToggleFollow: (enabled) => {
      geolocationService.setFollowMode(enabled);
      // iOS 13+ Safariでは方位取得の許可リクエストをユーザー操作の文脈内
      // から呼び出す必要があるため、ボタンのクリックハンドラで行う
      // （Android Chrome等では何もしない。GeolocationServiceの実装参照）。
      void geolocationService.requestOrientationPermission();
    },
  });
  bottomControls.appendChild(locationControl.root);

  const handleUpdate = (update: GeolocationUpdate): void => {
    locationControl.clearError();
    const latlng: L.LatLngExpression = [update.lat, update.lng];
    const icon = createLocationIcon(update.heading);

    if (!marker) {
      marker = L.marker(latlng, { icon }).addTo(map);
    } else {
      marker.setLatLng(latlng);
      marker.setIcon(icon);
    }

    if (!accuracyCircle) {
      accuracyCircle = L.circle(latlng, {
        radius: update.accuracy,
        color: "#1a5fb4",
        weight: 1,
        fillOpacity: 0.15,
      }).addTo(map);
    } else {
      accuracyCircle.setLatLng(latlng);
      accuracyCircle.setRadius(update.accuracy);
    }

    if (geolocationService.isFollowModeEnabled() && !followSuspended) {
      map.setView(latlng, map.getZoom());
    }
  };

  geolocationService.startWatching(handleUpdate, (message) => {
    locationControl.showError(message);
  });

  return {
    suspendFollow: () => {
      followSuspended = true;
    },
    resumeFollow: () => {
      followSuspended = false;
    },
  };
}

// 現在のズームから何段階分ズームインした範囲まで事前ダウンロードするか
// （Requirement 3.4）。広範囲・高倍率になり過ぎないよう小さめに抑える。
const PRECACHE_ZOOM_STEPS = 2;

function setupPrecacheControl(
  map: L.Map,
  layerManager: LayerManager,
  layers: LayerDefinition[],
  layerControlEl: HTMLElement,
  offlineCacheService: OfflineCacheService,
): void {
  const control = createPrecacheControl({
    onStart: () => void runPrecache(),
  });
  layerControlEl.appendChild(control.root);

  async function runPrecache(): Promise<void> {
    control.setError(null);

    const state = layerManager.getActiveLayerState();
    const activeLayerIds = [state.baseLayerId, ...state.overlayLayerIds];
    const activeLayers = layers.filter((layer) => activeLayerIds.includes(layer.id));

    const bounds = map.getBounds();
    const tileBounds = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    };
    const baseZoom = map.getZoom();

    // レイヤーをまたいだ進捗を合算して表示する。
    const completedByLayer = new Map<string, number>();
    const totalByLayer = new Map<string, number>();
    const reportAggregateProgress = (): void => {
      const completed = Array.from(completedByLayer.values()).reduce((a, b) => a + b, 0);
      const total = Array.from(totalByLayer.values()).reduce((a, b) => a + b, 0);
      control.setProgress({ completed, total });
    };

    try {
      for (const layer of activeLayers) {
        const zoomLevels = Array.from(
          { length: PRECACHE_ZOOM_STEPS + 1 },
          (_, i) => baseZoom + i,
        ).filter((zoom) => zoom >= layer.minZoom && zoom <= layer.maxZoom);
        if (zoomLevels.length === 0) continue;

        await offlineCacheService.precacheArea({
          bounds: tileBounds,
          zoomLevels,
          urlTemplates: [layer.urlTemplate],
          onProgress: (progress) => {
            completedByLayer.set(layer.id, progress.completed);
            totalByLayer.set(layer.id, progress.total);
            reportAggregateProgress();
          },
        });
      }
    } catch (error) {
      console.error("事前ダウンロードに失敗しました", error);
      control.setError("事前ダウンロードに失敗しました。もう一度お試しください。");
      control.setProgress(null);
    }
  }
}

function setupShareControl(
  map: L.Map,
  layerManager: LayerManager,
  getOverlay: () => PoiRouteOverlay | null,
  getCurrentTourId: () => string | undefined,
  topControls: HTMLElement,
  shareLinkService: ShareLinkService,
  fallbackPanel: LinkFallbackPanel,
  projectId: string | undefined,
): void {
  const control = createShareControl({
    onShare: async () => {
      const center = map.getCenter();
      const layerState = layerManager.getActiveLayerState();
      const poiId = getOverlay()?.getOpenPoiId() ?? undefined;
      const tourId = getCurrentTourId();

      const url = shareLinkService.encode({
        lat: center.lat,
        lng: center.lng,
        zoom: map.getZoom(),
        baseLayerId: layerState.baseLayerId,
        overlayLayerIds: layerState.overlayLayerIds,
        ...(poiId ? { poiId } : {}),
        ...(tourId ? { tourId } : {}),
        ...(projectId ? { projectId } : {}),
      });

      if (await shareLinkService.shareViaWebShareApi(url)) {
        return { success: true, message: "共有しました" };
      }
      if (await shareLinkService.copyToClipboard(url)) {
        return { success: true, message: "リンクをコピーしました" };
      }
      // Web Share API・クリップボードAPIのいずれも使えない/失敗した環境
      // （iOS Safariでのユーザー操作コンテキスト消失等を含む）でも共有
      // 手段を失わないよう、手動コピー用フォールバックUIを表示する
      // （Googleマップリンク取得機能のRequirement 14.6と同様の設計）。
      fallbackPanel.show(url);
      return {
        success: false,
        message: "自動コピーができませんでした。下に表示されたリンクをコピーしてください。",
      };
    },
  });
  // POI詳細パネルやメモパネルが画面下部を覆っている間も共有操作を行える
  // よう、bottom-controlsではなく画面上部のtopControlsに配置する
  // （Requirement 13.2）。
  topControls.appendChild(control.root);
}

/**
 * 任意地点のGoogleマップリンクを取得する機能（Requirement 14）。
 * 地図タップモードと、POI詳細パネルの「Googleマップで開くリンクを
 * 取得」ボタンの双方から共通の requestLink() を呼び出せるようにする。
 */
function setupGoogleMapsLinkFeature(
  map: L.Map,
  root: HTMLElement,
  bottomControls: HTMLElement,
  fallbackPanel: LinkFallbackPanel,
  locationTracking: LocationTrackingHandle,
): { requestLink: (point: LatLng) => Promise<void> } {
  const googleMapsLinkService = new GoogleMapsLinkService();

  async function requestLink(point: LatLng): Promise<void> {
    const url = googleMapsLinkService.buildSearchUrl(point);
    // クリップボードAPIが使えない環境では、選択・手動コピー可能な
    // フォールバックUIを表示する（Requirement 14.6）。
    const copied = await googleMapsLinkService.copyToClipboard(url);
    if (copied) {
      showToast(root, "Googleマップのリンクをコピーしました");
    } else {
      fallbackPanel.show(url);
    }
  }

  let placementActive = false;
  const control = createGoogleMapsLinkControl({
    onTogglePlacement: (active) => {
      placementActive = active;
      // 配置モード中はGPS追従による地図の再センタリングを止める
      // （ユーザーが狙った地点をタップしようとしている最中に地図が動くと
      // 操作できなくなるため）。
      if (active) locationTracking.suspendFollow();
      else locationTracking.resumeFollow();
    },
  });
  bottomControls.appendChild(control.root);

  map.on("click", (event: L.LeafletMouseEvent) => {
    if (!placementActive) return;
    placementActive = false;
    control.setActive(false);
    locationTracking.resumeFollow();
    void requestLink({ lat: event.latlng.lat, lng: event.latlng.lng });
  });

  return { requestLink };
}

function createMemoIcon(): L.DivIcon {
  return L.divIcon({
    className: "memo-marker",
    html: `<div class="memo-marker__dot"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function setupObservationMemos(
  map: L.Map,
  root: HTMLElement,
  bottomControls: HTMLElement,
  storageKeySuffix: string,
  locationTracking: LocationTrackingHandle,
): void {
  const store = new ObservationMemoStore({ storageKey: MEMO_STORAGE_KEY + storageKeySuffix });
  let memoMarkers: L.Marker[] = [];
  let placementActive = false;

  const memoPanel = createMemoPanel({
    onSaveNew: (text, position) => {
      if (text.trim() !== "") {
        store.add({ position, text });
        renderMemoMarkers();
      }
      memoPanel.hide();
    },
    onSaveEdit: (id, text) => {
      store.update(id, text);
      renderMemoMarkers();
      memoPanel.hide();
    },
    onDelete: (id) => {
      store.delete(id);
      renderMemoMarkers();
      memoPanel.hide();
    },
    onClose: () => memoPanel.hide(),
  });
  root.appendChild(memoPanel.root);

  function renderMemoMarkers(): void {
    memoMarkers.forEach((marker) => map.removeLayer(marker));
    memoMarkers = store.list().map((memo: ObservationMemo) => {
      const marker = L.marker([memo.position.lat, memo.position.lng], { icon: createMemoIcon() });
      marker.on("click", () => memoPanel.showMemo(memo));
      marker.addTo(map);
      return marker;
    });
  }
  renderMemoMarkers();

  const memoControl = createMemoControl({
    onTogglePlacement: (active) => {
      placementActive = active;
      // 配置モード中はGPS追従による地図の再センタリングを止める
      // （ユーザーが狙った地点をタップしようとしている最中に地図が動くと
      // 操作できなくなるため）。
      if (active) locationTracking.suspendFollow();
      else locationTracking.resumeFollow();
    },
    onExportCsv: () => downloadTextFile("observation-memos.csv", store.exportAsCsv(), "text/csv"),
    onExportGeoJson: () =>
      downloadTextFile(
        "observation-memos.geojson",
        store.exportAsGeoJson(),
        "application/geo+json",
      ),
  });
  bottomControls.appendChild(memoControl.root);

  // メモ配置モード中に地図（POI/メモマーカー以外）をタップした地点に
  // メモ作成フォームを開く（Requirement 5.1）。
  map.on("click", (event: L.LeafletMouseEvent) => {
    if (!placementActive) return;
    placementActive = false;
    memoControl.setPlacementActive(false);
    locationTracking.resumeFollow();
    memoPanel.showCreateForm({ lat: event.latlng.lat, lng: event.latlng.lng });
  });
}

interface TourSwitchingHandle {
  getCurrentTourId: () => string | undefined;
  getOverlay: () => PoiRouteOverlay | null;
}

interface TourSwitchingInitialState {
  tourId?: string;
  poiId?: string;
  layerOverride?: { baseLayerId: string; overlayLayerIds: string[] };
  hasSharedView?: boolean;
}

/**
 * 複数実習（ツアー）切替機能（Requirement 20）。listAvailableTours()で
 * 取得したツアー一覧からユーザーが選択でき、選択に応じてPOI/ルート描画
 * とレイヤー構成（初期値の提案のみ。パネル自体は全レイヤーを引き続き
 * 表示し、ユーザーは自由に他レイヤーへ切り替えられる）を切り替える。
 */
async function setupTourSwitching(
  map: L.Map,
  root: HTMLElement,
  topControls: HTMLElement,
  layerManager: LayerManager,
  layers: LayerDefinition[],
  layerControl: LayerControl,
  requestGoogleMapsLink: (point: LatLng) => Promise<void>,
  initial: TourSwitchingInitialState,
  projectId: string | undefined,
): Promise<TourSwitchingHandle> {
  const storageKeySuffix = projectStorageKeySuffix(projectId);

  let availableTours: { id: string; title: string }[] = [];
  try {
    availableTours = await listAvailableTours(projectId);
  } catch (error) {
    console.warn("ツアー一覧の取得に失敗しました", error);
  }

  if (availableTours.length === 0) {
    return { getCurrentTourId: () => undefined, getOverlay: () => null };
  }

  const detailPanel = createPoiDetailPanel(
    () => overlay.closePoiDetail(),
    (poi) => void requestGoogleMapsLink(poi.position),
  );
  root.appendChild(detailPanel.root);

  // POIの参照はoverlay.getPoiById()経由で行う。tour変数を直接クロージャで
  // 保持すると、renderTour()が別のツアーで再度呼ばれた際に古いツアーの
  // POI配列を参照し続けてしまうため。
  const overlay = new PoiRouteOverlay({
    map,
    onSelectionChange: (poiId) => {
      if (poiId === null) {
        detailPanel.hide();
        return;
      }
      const poi = overlay.getPoiById(poiId);
      if (poi) detailPanel.show(poi);
    },
  });

  let currentTourId: string | undefined;

  const selectorPanel = createTourSelectorPanel({
    // パネルからの明示的な切替時は、地図をそのツアーのPOI範囲へ再センタリング
    // する（Requirement 20: 切替UX改善）。初期読み込み時は既存の現在地・
    // 共有ビュー復元ロジックを優先させるため対象外とする。
    onSelect: (tourId) => void selectTour(tourId, { isExplicitSwitch: true }),
    onClose: () => {},
  });
  root.appendChild(selectorPanel.root);

  const selectorControl = createTourSelectorControl({
    onOpen: () => selectorPanel.show(availableTours, currentTourId ?? null),
  });
  topControls.appendChild(selectorControl.root);

  async function selectTour(
    tourId: string,
    options: { poiId?: string; isExplicitSwitch?: boolean; centerOnPois?: boolean } = {},
  ): Promise<void> {
    let tour;
    try {
      tour = await loadTour(tourId, projectId);
    } catch (error) {
      console.warn(`ツアー "${tourId}" の読み込みに失敗しました`, error);
      return;
    }

    currentTourId = tourId;
    overlay.renderTour(tour);
    selectorControl.setTitle(tour.title);
    writeSelectedTourId(window.localStorage, tourId, storageKeySuffix);

    // ツアーのlayerIdsから初期値を提案する（レイヤーパネル自体は全レイヤー
    // を引き続き表示し、ユーザーは自由に他レイヤーへ切り替えられる）。
    // ユーザーが明示的にツアーを切り替えた場合のみ適用し、通常の再読み込み
    // 時はLayerManagerが復元する永続化済みレイヤー状態を優先する
    // （Requirement 2.5との両立）。
    if (options.isExplicitSwitch) {
      const suggestedBase = tour.layerIds.find(
        (id) => layers.find((layer) => layer.id === id)?.type === "base",
      );
      if (suggestedBase) layerManager.setBaseLayer(suggestedBase);
      layers
        .filter((layer) => layer.type === "overlay")
        .forEach((layer) => {
          layerManager.toggleOverlay(layer.id, tour.layerIds.includes(layer.id));
        });
      layerControl.refresh();
    }

    // 地図の再センタリングは、明示的なツアー切替時（Requirement 20）に加え、
    // 初期読み込み時でも共有URLによる明示的なビュー指定が無い場合は行う
    // （centerOnPois）。DEFAULT_CENTERは既定サンプルの位置に固定されており、
    // `?project=`で読み込んだ第三者プロジェクトのPOIが遠方（例: 能登半島）
    // にある場合、再センタリングしないと常に無関係な地点が表示され続け、
    // ユーザーが不具合と誤認する原因になっていた。
    if ((options.isExplicitSwitch || options.centerOnPois) && tour.pois.length > 0) {
      const bounds = L.latLngBounds(
        tour.pois.map((poi): L.LatLngTuple => [poi.position.lat, poi.position.lng]),
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }

    if (options.poiId && overlay.getPoiById(options.poiId)) {
      overlay.openPoiDetail(options.poiId);
    }
  }

  const persistedTourId = readSelectedTourId(window.localStorage, storageKeySuffix);
  const isKnownTour = (id: string | null): id is string =>
    id !== null && availableTours.some((tour) => tour.id === id);
  // 共有URLで指定されたツアー（Requirement 13）を最優先とし、次に
  // 前回選択したツアー、いずれも無効なら一覧の先頭のツアーを使う。
  const initialTourId =
    (isKnownTour(initial.tourId ?? null) ? initial.tourId! : undefined) ??
    (isKnownTour(persistedTourId) ? persistedTourId : undefined) ??
    availableTours[0].id;

  // 初期読み込み時にPOI範囲へ再センタリングするのは、`?project=`で読み込んだ
  // 第三者プロジェクト（DEFAULT_CENTERが無関係な地点になりうる）かつ、共有URL
  // による明示的なビュー指定が無い場合に限る。既定の静的サンプルはDEFAULT_
  // CENTER付近に置かれている前提のため、この対象からは除外し既存の見た目を
  // 変えない。
  await selectTour(initialTourId, {
    poiId: initial.poiId,
    centerOnPois: !initial.hasSharedView && projectId !== undefined,
  });

  // 共有URLに明示的なレイヤー構成が含まれていた場合は、ツアーの提案より
  // 優先して適用する（Requirement 13.4, 13.7）。
  if (initial.layerOverride) {
    const validLayerIds = new Set(layers.map((layer) => layer.id));
    if (validLayerIds.has(initial.layerOverride.baseLayerId)) {
      layerManager.setBaseLayer(initial.layerOverride.baseLayerId);
    }
    const overlayIds = initial.layerOverride.overlayLayerIds;
    layers
      .filter((layer) => layer.type === "overlay")
      .forEach((layer) => {
        layerManager.toggleOverlay(layer.id, overlayIds.includes(layer.id));
      });
    layerControl.refresh();
  }

  return {
    getCurrentTourId: () => currentTourId,
    getOverlay: () => overlay,
  };
}

export async function initializeMap(
  root: HTMLElement,
  mapContainer: HTMLElement,
  projectId?: string,
): Promise<void> {
  const storageKeySuffix = projectStorageKeySuffix(projectId);

  // 共有URL（Requirement 13）にビュー状態が含まれていれば復元する。
  // 不正・破損したURLの場合はdecode()がnullを返し、通常の初期表示に
  // フォールバックする（Requirement 13.7）。
  const shareLinkService = new ShareLinkService();
  const sharedState = shareLinkService.decode(location.href);

  // タイルキャッシュの登録は地図表示をブロックしない（Requirement 3）。
  const offlineCacheService = new OfflineCacheService({
    swUrl: `${import.meta.env.BASE_URL}sw.js`,
  });
  void offlineCacheService.register();

  const initialCenter: L.LatLngExpression = sharedState
    ? [sharedState.lat, sharedState.lng]
    : DEFAULT_CENTER;
  const initialZoom = sharedState?.zoom ?? DEFAULT_ZOOM;
  const map = L.map(mapContainer).setView(initialCenter, initialZoom);

  // 現在地ボタンとレイヤーパネルは同じ画面下部の親指可動域にまとめる
  // （Requirement 6.2）。location-controlを先に追加し、上側に表示する。
  const bottomControls = document.createElement("div");
  bottomControls.className = "bottom-controls";
  root.appendChild(bottomControls);

  // POI詳細パネルやメモパネルが画面下部を覆っていても常に操作できる
  // コントロール（共有・ツアー切替）をまとめる、画面右上のフローティング
  // 領域（Requirement 13.2, 20）。Leafletのデフォルトズームコントロール
  // （左上）とは重ならない。
  const topControls = document.createElement("div");
  topControls.className = "top-controls";
  root.appendChild(topControls);

  const locationTracking = setupLocationTracking(map, bottomControls);

  // projectIdが指定されている場合は認証なしの公開スプレッドシート読み込み
  // （Requirement 16）へ、指定されない場合は従来通り静的JSON設定ファイルへ
  // 委譲する（ConfigLoader内部で分岐）。
  const layers = await loadLayers(projectId);
  const layerManager = new LayerManager({
    map,
    layers,
    storage: window.localStorage,
    storageKey: LAYER_STORAGE_KEY + storageKeySuffix,
  });
  const layerControl = createLayerControl(layers, layerManager);
  bottomControls.appendChild(layerControl.root);
  setupPrecacheControl(map, layerManager, layers, layerControl.root, offlineCacheService);
  setupObservationMemos(map, root, bottomControls, storageKeySuffix, locationTracking);

  // クリップボードAPI等が使えない/失敗した環境向けの手動コピー用UI
  // （Requirement 14.6）。共有機能・Googleマップリンク取得機能で共用する。
  const fallbackPanel = createLinkFallbackPanel({ onClose: () => {} });
  root.appendChild(fallbackPanel.root);

  const googleMapsLink = setupGoogleMapsLinkFeature(
    map,
    root,
    bottomControls,
    fallbackPanel,
    locationTracking,
  );

  // ツアー選択・POI/ルート描画・（提案としての）レイヤー構成の切替
  // （Requirement 20）。共有URLにツアーID・明示的なレイヤー構成が含まれて
  // いれば、ツアーの提案よりも優先して復元する（Requirement 13.4, 13.7）。
  const tourSwitching = await setupTourSwitching(
    map,
    root,
    topControls,
    layerManager,
    layers,
    layerControl,
    googleMapsLink.requestLink,
    {
      tourId: sharedState?.tourId,
      poiId: sharedState?.poiId,
      layerOverride: sharedState
        ? { baseLayerId: sharedState.baseLayerId, overlayLayerIds: sharedState.overlayLayerIds }
        : undefined,
      hasSharedView: sharedState !== null,
    },
    projectId,
  );

  setupShareControl(
    map,
    layerManager,
    tourSwitching.getOverlay,
    tourSwitching.getCurrentTourId,
    topControls,
    shareLinkService,
    fallbackPanel,
    projectId,
  );
}

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (appRoot) {
  mountApp(appRoot);
  const mapContainer = appRoot.querySelector<HTMLDivElement>("#map");
  if (mapContainer) {
    // URLの`project`パラメータで、認証なしの公開スプレッドシート読み込み
    // （Requirement 16）へ切り替える。指定されない場合は既存の静的JSON
    // 設定ファイルを読み込む従来通りの動作。
    const projectId = new URLSearchParams(location.search).get("project") ?? undefined;
    initializeMap(appRoot, mapContainer, projectId).catch((error: unknown) => {
      console.error("アプリの初期化に失敗しました", error);
      showFatalError(
        appRoot,
        projectId
          ? "プロジェクトの読み込みに失敗しました。URLのproject指定や、スプレッドシートが「ウェブに公開」されているかを確認してください。"
          : "アプリの初期化に失敗しました。しばらくしてから再度お試しください。",
      );
    });
  }
}
