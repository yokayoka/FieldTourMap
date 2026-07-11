import "leaflet/dist/leaflet.css";
import "./style.css";
import L from "leaflet";
import { loadLayers } from "./services/configLoader";
import { LayerManager } from "./services/layerManager";
import { createLayerControl } from "./components/layerControl";

// 初期表示位置は現在地取得（Requirement 1）実装までの暫定フォールバック。
const DEFAULT_CENTER: L.LatLngExpression = [35.681236, 139.767125];
const DEFAULT_ZOOM = 15;

export function mountApp(root: HTMLElement): void {
  const mapContainer = document.createElement("div");
  mapContainer.id = "map";
  root.replaceChildren(mapContainer);
}

export async function initializeMap(root: HTMLElement, mapContainer: HTMLElement): Promise<void> {
  const map = L.map(mapContainer).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  const layers = await loadLayers();
  const layerManager = new LayerManager({ map, layers, storage: window.localStorage });
  const control = createLayerControl(layers, layerManager);
  root.appendChild(control);
}

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (appRoot) {
  mountApp(appRoot);
  const mapContainer = appRoot.querySelector<HTMLDivElement>("#map");
  if (mapContainer) {
    void initializeMap(appRoot, mapContainer);
  }
}
