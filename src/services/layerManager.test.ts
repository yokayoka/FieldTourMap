import { describe, expect, it, vi } from "vitest";
import { LayerManager, type MapLike } from "./layerManager";
import type { LayerDefinition } from "../types/config";

const layers: LayerDefinition[] = [
  {
    id: "gsi-std",
    name: "地理院地図（標準地図）",
    type: "base",
    urlTemplate: "https://example.com/std/{z}/{x}/{y}.png",
    attribution: "国土地理院",
    opacity: 1.0,
    minZoom: 2,
    maxZoom: 18,
    defaultVisible: true,
  },
  {
    id: "osm",
    name: "OpenStreetMap",
    type: "base",
    urlTemplate: "https://example.com/osm/{z}/{x}/{y}.png",
    attribution: "OSM",
    opacity: 1.0,
    minZoom: 2,
    maxZoom: 19,
    defaultVisible: false,
  },
  {
    id: "aist-geology",
    name: "シームレス地質図",
    type: "overlay",
    urlTemplate: "https://example.com/geo/{z}/{y}/{x}.png",
    attribution: "産総研",
    opacity: 0.6,
    minZoom: 2,
    maxZoom: 16,
    defaultVisible: false,
  },
];

function createFakeMap(): MapLike & { added: unknown[]; removed: unknown[] } {
  return {
    added: [],
    removed: [],
    addLayer(layer) {
      this.added.push(layer);
    },
    removeLayer(layer) {
      this.removed.push(layer);
      this.added = this.added.filter((l) => l !== layer);
    },
  };
}

function createFakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

function createManager(overrides?: { storage?: Storage }) {
  const map = createFakeMap();
  const createLayer = vi.fn((definition: LayerDefinition) => ({ id: definition.id }) as never);
  const storage = overrides?.storage ?? createFakeStorage();
  const manager = new LayerManager({
    map,
    layers,
    createLayer,
    storage,
    storageKey: "fieldtour.layerState.test",
  });
  return { map, createLayer, storage, manager };
}

describe("LayerManager", () => {
  it("applies the defaultVisible base and overlay layers on construction", () => {
    const { manager, map } = createManager();

    expect(manager.getActiveLayerState()).toEqual({
      baseLayerId: "gsi-std",
      overlayLayerIds: [],
    });
    expect(map.added).toHaveLength(1);
  });

  it("switches the base layer, removing the previous one", () => {
    const { manager, map } = createManager();

    manager.setBaseLayer("osm");

    expect(manager.getActiveLayerState().baseLayerId).toBe("osm");
    expect(map.removed).toHaveLength(1);
    expect(map.added).toHaveLength(1);
  });

  it("throws when switching to an unknown base layer id", () => {
    const { manager } = createManager();

    expect(() => manager.setBaseLayer("unknown")).toThrow(/unknown/);
  });

  it("toggles an overlay layer on and off", () => {
    const { manager, map } = createManager();

    manager.toggleOverlay("aist-geology", true);
    expect(manager.getActiveLayerState().overlayLayerIds).toEqual(["aist-geology"]);
    expect(map.added).toHaveLength(2);

    manager.toggleOverlay("aist-geology", false);
    expect(manager.getActiveLayerState().overlayLayerIds).toEqual([]);
    expect(map.added).toHaveLength(1);
  });

  it("persists layer state changes to storage", () => {
    const { manager, storage } = createManager();

    manager.setBaseLayer("osm");
    manager.toggleOverlay("aist-geology", true);

    const saved = JSON.parse(storage.getItem("fieldtour.layerState.test") ?? "{}");
    expect(saved).toEqual({ baseLayerId: "osm", overlayLayerIds: ["aist-geology"] });
  });

  it("restores persisted state on construction", () => {
    const storage = createFakeStorage();
    storage.setItem(
      "fieldtour.layerState.test",
      JSON.stringify({ baseLayerId: "osm", overlayLayerIds: ["aist-geology"] }),
    );

    const { manager } = createManager({ storage });

    expect(manager.getActiveLayerState()).toEqual({
      baseLayerId: "osm",
      overlayLayerIds: ["aist-geology"],
    });
  });

  it("falls back to defaults when persisted state references an unknown layer id", () => {
    const storage = createFakeStorage();
    storage.setItem(
      "fieldtour.layerState.test",
      JSON.stringify({ baseLayerId: "removed-layer", overlayLayerIds: ["removed-overlay"] }),
    );

    const { manager } = createManager({ storage });

    expect(manager.getActiveLayerState()).toEqual({
      baseLayerId: "gsi-std",
      overlayLayerIds: [],
    });
  });
});
