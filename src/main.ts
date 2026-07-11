import "leaflet/dist/leaflet.css";
import "./style.css";
import L from "leaflet";
import { loadLayers, loadTour, listAvailableTours } from "./services/configLoader";
import { LayerManager } from "./services/layerManager";
import { createLayerControl, type LayerControl } from "./components/layerControl";
import { GeolocationService, type GeolocationUpdate } from "./services/geolocationService";
import { createLocationControl } from "./components/locationControl";
import { PoiRouteOverlay } from "./services/poiRouteOverlay";
import { createPoiDetailPanel } from "./components/poiDetailPanel";
import { OfflineCacheService } from "./services/offlineCacheService";
import { createPrecacheControl } from "./components/precacheControl";
import { ObservationMemoStore } from "./services/observationMemoStore";
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
import { createLinkFallbackPanel } from "./components/linkFallbackPanel";
import { showToast } from "./components/toast";

// 初期表示位置は現在地取得（Requirement 1）が成功するまでの暫定フォールバック。
const DEFAULT_CENTER: L.LatLngExpression = [35.681236, 139.767125];
const DEFAULT_ZOOM = 15;

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

function setupLocationTracking(map: L.Map, bottomControls: HTMLElement): void {
  const geolocationService = new GeolocationService();
  let marker: L.Marker | null = null;
  let accuracyCircle: L.Circle | null = null;

  const locationControl = createLocationControl({
    onToggleFollow: (enabled) => geolocationService.setFollowMode(enabled),
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

    if (geolocationService.isFollowModeEnabled()) {
      map.setView(latlng, map.getZoom());
    }
  };

  geolocationService.startWatching(handleUpdate, (message) => {
    locationControl.showError(message);
  });
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
      });

      if (await shareLinkService.shareViaWebShareApi(url)) {
        return { success: true, message: "共有しました" };
      }
      if (await shareLinkService.copyToClipboard(url)) {
        return { success: true, message: "リンクをコピーしました" };
      }
      return {
        success: false,
        message: "共有に失敗しました。ブラウザの設定を確認してください。",
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
): { requestLink: (point: LatLng) => Promise<void> } {
  const googleMapsLinkService = new GoogleMapsLinkService();

  const fallbackPanel = createLinkFallbackPanel({ onClose: () => {} });
  root.appendChild(fallbackPanel.root);

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
    },
  });
  bottomControls.appendChild(control.root);

  map.on("click", (event: L.LeafletMouseEvent) => {
    if (!placementActive) return;
    placementActive = false;
    control.setActive(false);
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

function setupObservationMemos(map: L.Map, root: HTMLElement, bottomControls: HTMLElement): void {
  const store = new ObservationMemoStore();
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
): Promise<TourSwitchingHandle> {
  let availableTours: { id: string; title: string }[] = [];
  try {
    availableTours = await listAvailableTours();
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
    options: { poiId?: string; isExplicitSwitch?: boolean } = {},
  ): Promise<void> {
    let tour;
    try {
      tour = await loadTour(tourId);
    } catch (error) {
      console.warn(`ツアー "${tourId}" の読み込みに失敗しました`, error);
      return;
    }

    currentTourId = tourId;
    overlay.renderTour(tour);
    selectorControl.setTitle(tour.title);
    writeSelectedTourId(window.localStorage, tourId);

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

      if (tour.pois.length > 0) {
        const bounds = L.latLngBounds(
          tour.pois.map((poi): L.LatLngTuple => [poi.position.lat, poi.position.lng]),
        );
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
      }
    }

    if (options.poiId && overlay.getPoiById(options.poiId)) {
      overlay.openPoiDetail(options.poiId);
    }
  }

  const persistedTourId = readSelectedTourId(window.localStorage);
  const isKnownTour = (id: string | null): id is string =>
    id !== null && availableTours.some((tour) => tour.id === id);
  // 共有URLで指定されたツアー（Requirement 13）を最優先とし、次に
  // 前回選択したツアー、いずれも無効なら一覧の先頭のツアーを使う。
  const initialTourId =
    (isKnownTour(initial.tourId ?? null) ? initial.tourId! : undefined) ??
    (isKnownTour(persistedTourId) ? persistedTourId : undefined) ??
    availableTours[0].id;

  await selectTour(initialTourId, { poiId: initial.poiId });

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

export async function initializeMap(root: HTMLElement, mapContainer: HTMLElement): Promise<void> {
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

  setupLocationTracking(map, bottomControls);

  const layers = await loadLayers();
  const layerManager = new LayerManager({ map, layers, storage: window.localStorage });
  const layerControl = createLayerControl(layers, layerManager);
  bottomControls.appendChild(layerControl.root);
  setupPrecacheControl(map, layerManager, layers, layerControl.root, offlineCacheService);
  setupObservationMemos(map, root, bottomControls);

  const googleMapsLink = setupGoogleMapsLinkFeature(map, root, bottomControls);

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
    },
  );

  setupShareControl(
    map,
    layerManager,
    tourSwitching.getOverlay,
    tourSwitching.getCurrentTourId,
    topControls,
    shareLinkService,
  );
}

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (appRoot) {
  mountApp(appRoot);
  const mapContainer = appRoot.querySelector<HTMLDivElement>("#map");
  if (mapContainer) {
    initializeMap(appRoot, mapContainer).catch((error: unknown) => {
      console.error("アプリの初期化に失敗しました", error);
      showFatalError(
        appRoot,
        "アプリの初期化に失敗しました。しばらくしてから再度お試しください。",
      );
    });
  }
}
