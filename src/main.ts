import "leaflet/dist/leaflet.css";
import "./style.css";
import L from "leaflet";
import { loadLayers } from "./services/configLoader";
import { LayerManager } from "./services/layerManager";
import { createLayerControl } from "./components/layerControl";
import { GeolocationService, type GeolocationUpdate } from "./services/geolocationService";
import { createLocationControl } from "./components/locationControl";

// 初期表示位置は現在地取得（Requirement 1）が成功するまでの暫定フォールバック。
const DEFAULT_CENTER: L.LatLngExpression = [35.681236, 139.767125];
const DEFAULT_ZOOM = 15;

export function mountApp(root: HTMLElement): void {
  const mapContainer = document.createElement("div");
  mapContainer.id = "map";
  root.replaceChildren(mapContainer);
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

function setupLocationTracking(map: L.Map, root: HTMLElement): void {
  const geolocationService = new GeolocationService();
  let marker: L.Marker | null = null;
  let accuracyCircle: L.Circle | null = null;

  const locationControl = createLocationControl({
    onToggleFollow: (enabled) => geolocationService.setFollowMode(enabled),
  });
  root.appendChild(locationControl.root);

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

export async function initializeMap(root: HTMLElement, mapContainer: HTMLElement): Promise<void> {
  const map = L.map(mapContainer).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  const layers = await loadLayers();
  const layerManager = new LayerManager({ map, layers, storage: window.localStorage });
  const layerControl = createLayerControl(layers, layerManager);
  root.appendChild(layerControl);

  setupLocationTracking(map, root);
}

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (appRoot) {
  mountApp(appRoot);
  const mapContainer = appRoot.querySelector<HTMLDivElement>("#map");
  if (mapContainer) {
    void initializeMap(appRoot, mapContainer);
  }
}
