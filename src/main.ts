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

async function setupPoiOverlay(map: L.Map, root: HTMLElement): Promise<void> {
  let tour;
  try {
    tour = await loadTour(DEFAULT_TOUR_ID);
  } catch (error) {
    console.warn(`ツアー "${DEFAULT_TOUR_ID}" の読み込みに失敗しました`, error);
    return;
  }

  const detailPanel = createPoiDetailPanel(() => overlay.closePoiDetail());
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
}

export async function initializeMap(root: HTMLElement, mapContainer: HTMLElement): Promise<void> {
  // タイルキャッシュの登録は地図表示をブロックしない（Requirement 3）。
  void new OfflineCacheService({ swUrl: `${import.meta.env.BASE_URL}sw.js` }).register();

  const map = L.map(mapContainer).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  // 現在地ボタンとレイヤーパネルは同じ画面下部の親指可動域にまとめる
  // （Requirement 6.2）。location-controlを先に追加し、上側に表示する。
  const bottomControls = document.createElement("div");
  bottomControls.className = "bottom-controls";
  root.appendChild(bottomControls);

  setupLocationTracking(map, bottomControls);

  const layers = await loadLayers();
  const layerManager = new LayerManager({ map, layers, storage: window.localStorage });
  const layerControl = createLayerControl(layers, layerManager);
  bottomControls.appendChild(layerControl);

  await setupPoiOverlay(map, root);
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
