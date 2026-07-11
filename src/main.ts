import "leaflet/dist/leaflet.css";
import "./style.css";
import L from "leaflet";
import { loadLayers, loadTour } from "./services/configLoader";
import { LayerManager } from "./services/layerManager";
import { createLayerControl } from "./components/layerControl";
import { GeolocationService, type GeolocationUpdate } from "./services/geolocationService";
import { createLocationControl } from "./components/locationControl";
import { PoiRouteOverlay } from "./services/poiRouteOverlay";
import { createPoiDetailPanel } from "./components/poiDetailPanel";
import { OfflineCacheService } from "./services/offlineCacheService";
import { createPrecacheControl } from "./components/precacheControl";
import { ObservationMemoStore } from "./services/observationMemoStore";
import { createMemoPanel } from "./components/memoPanel";
import { createMemoControl } from "./components/memoControl";
import type { LatLng, LayerDefinition, ObservationMemo } from "./types/config";
import { downloadTextFile } from "./utils/downloadTextFile";
import { ShareLinkService } from "./services/shareLinkService";
import { createShareControl } from "./components/shareControl";
import { GoogleMapsLinkService } from "./services/googleMapsLinkService";
import { createGoogleMapsLinkControl } from "./components/googleMapsLinkControl";
import { createLinkFallbackPanel } from "./components/linkFallbackPanel";
import { showToast } from "./components/toast";

// 初期表示位置は現在地取得（Requirement 1）が成功するまでの暫定フォールバック。
const DEFAULT_CENTER: L.LatLngExpression = [35.681236, 139.767125];
const DEFAULT_ZOOM = 15;

// Phase 1では単一ツアーの読み込みに固定する（複数ツアー切替はTask 20で対応）。
const DEFAULT_TOUR_ID = "sample-tour";

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
  root: HTMLElement,
  shareLinkService: ShareLinkService,
): void {
  const control = createShareControl({
    onShare: async () => {
      const center = map.getCenter();
      const layerState = layerManager.getActiveLayerState();
      const poiId = getOverlay()?.getOpenPoiId() ?? undefined;

      const url = shareLinkService.encode({
        lat: center.lat,
        lng: center.lng,
        zoom: map.getZoom(),
        baseLayerId: layerState.baseLayerId,
        overlayLayerIds: layerState.overlayLayerIds,
        ...(poiId ? { poiId } : {}),
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
  // よう、bottom-controlsではなく画面上部に独立して配置する
  // （Requirement 13.2）。
  control.root.classList.add("share-control--floating");
  root.appendChild(control.root);
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

async function setupPoiOverlay(
  map: L.Map,
  root: HTMLElement,
  initialPoiId: string | undefined,
  requestGoogleMapsLink: (point: LatLng) => Promise<void>,
): Promise<PoiRouteOverlay | null> {
  let tour;
  try {
    tour = await loadTour(DEFAULT_TOUR_ID);
  } catch (error) {
    console.warn(`ツアー "${DEFAULT_TOUR_ID}" の読み込みに失敗しました`, error);
    return null;
  }

  const detailPanel = createPoiDetailPanel(
    () => overlay.closePoiDetail(),
    (poi) => void requestGoogleMapsLink(poi.position),
  );
  root.appendChild(detailPanel.root);

  // POIの参照はoverlay.getPoiById()経由で行う。tour変数を直接クロージャで
  // 保持すると、将来renderTour()が別のツアーで再度呼ばれた際に古いツアーの
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

  overlay.renderTour(tour);

  // 共有URLにPOI IDが含まれていた場合、そのPOI詳細を自動的に開く
  // （Requirement 13.2）。
  if (initialPoiId && overlay.getPoiById(initialPoiId)) {
    overlay.openPoiDetail(initialPoiId);
  }

  return overlay;
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

  setupLocationTracking(map, bottomControls);

  const layers = await loadLayers();
  const layerManager = new LayerManager({ map, layers, storage: window.localStorage });

  // 共有URLで指定されたレイヤー構成を適用する。存在しないレイヤーIDは
  // 無視し、通常のデフォルト/永続化済み状態のまま継続する
  // （Requirement 13.4, 13.7）。
  if (sharedState) {
    const validLayerIds = new Set(layers.map((layer) => layer.id));
    if (validLayerIds.has(sharedState.baseLayerId)) {
      layerManager.setBaseLayer(sharedState.baseLayerId);
    }
    layers
      .filter((layer) => layer.type === "overlay")
      .forEach((layer) => {
        layerManager.toggleOverlay(layer.id, sharedState.overlayLayerIds.includes(layer.id));
      });
  }

  const layerControl = createLayerControl(layers, layerManager);
  bottomControls.appendChild(layerControl);
  setupPrecacheControl(map, layerManager, layers, layerControl, offlineCacheService);
  setupObservationMemos(map, root, bottomControls);

  let poiOverlay: PoiRouteOverlay | null = null;
  setupShareControl(map, layerManager, () => poiOverlay, root, shareLinkService);
  const googleMapsLink = setupGoogleMapsLinkFeature(map, root, bottomControls);

  poiOverlay = await setupPoiOverlay(map, root, sharedState?.poiId, googleMapsLink.requestLink);
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
