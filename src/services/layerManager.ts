import L from "leaflet";
import type { LayerDefinition } from "../types/config";

export interface MapLike {
  addLayer(layer: L.Layer): void;
  removeLayer(layer: L.Layer): void;
}

export interface ActiveLayerState {
  baseLayerId: string;
  overlayLayerIds: string[];
}

export interface LayerManagerOptions {
  map: MapLike;
  layers: LayerDefinition[];
  createLayer?: (definition: LayerDefinition) => L.Layer;
  storage?: Storage;
  storageKey?: string;
}

const DEFAULT_STORAGE_KEY = "fieldtour.layerState.v1";

function defaultCreateLayer(definition: LayerDefinition): L.Layer {
  return L.tileLayer(definition.urlTemplate, {
    attribution: definition.attribution,
    opacity: definition.opacity,
    minZoom: definition.minZoom,
    maxZoom: definition.maxZoom,
  });
}

export class LayerManager {
  private readonly map: MapLike;
  private readonly layers: Map<string, LayerDefinition>;
  private readonly createLayer: (definition: LayerDefinition) => L.Layer;
  private readonly storage?: Storage;
  private readonly storageKey: string;

  private baseLayerId: string;
  private readonly overlayInstances = new Map<string, L.Layer>();
  private baseLayerInstance: L.Layer | undefined;

  constructor(options: LayerManagerOptions) {
    this.map = options.map;
    this.layers = new Map(options.layers.map((layer) => [layer.id, layer]));
    this.createLayer = options.createLayer ?? defaultCreateLayer;
    this.storage = options.storage;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;

    const initialState = this.resolveInitialState(options.layers);
    this.baseLayerId = initialState.baseLayerId;
    this.applyBaseLayer(this.baseLayerId);
    initialState.overlayLayerIds.forEach((id) => this.applyOverlay(id, true));
  }

  private resolveInitialState(layers: LayerDefinition[]): ActiveLayerState {
    const persisted = this.readPersistedState();
    if (persisted && this.layers.has(persisted.baseLayerId)) {
      const validOverlayIds = persisted.overlayLayerIds.filter(
        (id) => this.layers.get(id)?.type === "overlay",
      );
      return { baseLayerId: persisted.baseLayerId, overlayLayerIds: validOverlayIds };
    }

    const defaultBase =
      layers.find((layer) => layer.type === "base" && layer.defaultVisible) ??
      layers.find((layer) => layer.type === "base");
    if (!defaultBase) {
      throw new Error("layersに少なくとも1つのbaseレイヤーが必要です");
    }
    const defaultOverlays = layers
      .filter((layer) => layer.type === "overlay" && layer.defaultVisible)
      .map((layer) => layer.id);

    return { baseLayerId: defaultBase.id, overlayLayerIds: defaultOverlays };
  }

  private readPersistedState(): ActiveLayerState | null {
    if (!this.storage) return null;
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as ActiveLayerState;
      if (typeof parsed.baseLayerId !== "string" || !Array.isArray(parsed.overlayLayerIds)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private persist(): void {
    if (!this.storage) return;
    this.storage.setItem(this.storageKey, JSON.stringify(this.getActiveLayerState()));
  }

  private getLayerOrThrow(layerId: string): LayerDefinition {
    const layer = this.layers.get(layerId);
    if (!layer) {
      throw new Error(`unknown layer id: ${layerId}`);
    }
    return layer;
  }

  private applyBaseLayer(layerId: string): void {
    const definition = this.getLayerOrThrow(layerId);
    const instance = this.createLayer(definition);
    this.map.addLayer(instance);
    this.baseLayerInstance = instance;
  }

  private applyOverlay(layerId: string, visible: boolean): void {
    if (visible) {
      const definition = this.getLayerOrThrow(layerId);
      const instance = this.createLayer(definition);
      this.map.addLayer(instance);
      this.overlayInstances.set(layerId, instance);
    } else {
      const instance = this.overlayInstances.get(layerId);
      if (instance) {
        this.map.removeLayer(instance);
        this.overlayInstances.delete(layerId);
      }
    }
  }

  setBaseLayer(layerId: string): void {
    this.getLayerOrThrow(layerId);
    if (this.baseLayerInstance) {
      this.map.removeLayer(this.baseLayerInstance);
    }
    this.baseLayerId = layerId;
    this.applyBaseLayer(layerId);
    this.persist();
  }

  toggleOverlay(layerId: string, visible: boolean): void {
    this.getLayerOrThrow(layerId);
    this.applyOverlay(layerId, visible);
    this.persist();
  }

  getActiveLayerState(): ActiveLayerState {
    return {
      baseLayerId: this.baseLayerId,
      overlayLayerIds: Array.from(this.overlayInstances.keys()),
    };
  }
}
