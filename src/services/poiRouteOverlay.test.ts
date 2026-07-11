import { describe, expect, it, vi } from "vitest";
import { PoiRouteOverlay, type OverlayMapLike } from "./poiRouteOverlay";
import type { TourConfig } from "../types/config";

const tour: TourConfig = {
  id: "sample-tour",
  title: "サンプル巡検",
  layerIds: ["gsi-std"],
  pois: [
    {
      id: "poi-01",
      name: "露頭A",
      description: "花崗岩の貫入部",
      position: { lat: 35.681, lng: 139.767 },
      media: [],
      referencePapers: [],
    },
    {
      id: "poi-02",
      name: "露頭B",
      description: "断層露頭",
      position: { lat: 35.682, lng: 139.768 },
      media: [],
      referencePapers: [],
    },
  ],
  routes: [
    {
      id: "route-01",
      name: "ルート1",
      points: [
        { lat: 35.68, lng: 139.766 },
        { lat: 35.681, lng: 139.767 },
      ],
    },
  ],
};

function createFakeMap(): OverlayMapLike & { added: unknown[]; removed: unknown[] } {
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

function createFakeFactories() {
  const clickHandlers = new Map<string, () => void>();
  const createMarker = vi.fn((poi, onClick: () => void) => {
    clickHandlers.set(poi.id, onClick);
    return { kind: "marker", id: poi.id } as never;
  });
  const createPolyline = vi.fn((route) => ({ kind: "polyline", id: route.id }) as never);
  return { createMarker, createPolyline, clickHandlers };
}

describe("PoiRouteOverlay", () => {
  it("renders one marker per POI and one polyline per route", () => {
    const map = createFakeMap();
    const { createMarker, createPolyline } = createFakeFactories();
    const overlay = new PoiRouteOverlay({ map, createMarker, createPolyline });

    overlay.renderTour(tour);

    expect(createMarker).toHaveBeenCalledTimes(2);
    expect(createPolyline).toHaveBeenCalledTimes(1);
    expect(map.added).toHaveLength(3);
  });

  it("has no open POI initially", () => {
    const map = createFakeMap();
    const { createMarker, createPolyline } = createFakeFactories();
    const overlay = new PoiRouteOverlay({ map, createMarker, createPolyline });

    expect(overlay.getOpenPoiId()).toBeNull();
  });

  it("opens a POI detail and notifies the selection callback when its marker is clicked", () => {
    const map = createFakeMap();
    const { createMarker, createPolyline, clickHandlers } = createFakeFactories();
    const onSelectionChange = vi.fn();
    const overlay = new PoiRouteOverlay({ map, createMarker, createPolyline, onSelectionChange });

    overlay.renderTour(tour);
    clickHandlers.get("poi-02")?.();

    expect(overlay.getOpenPoiId()).toBe("poi-02");
    expect(onSelectionChange).toHaveBeenCalledWith("poi-02");
  });

  it("closes the POI detail and notifies with null", () => {
    const map = createFakeMap();
    const { createMarker, createPolyline, clickHandlers } = createFakeFactories();
    const onSelectionChange = vi.fn();
    const overlay = new PoiRouteOverlay({ map, createMarker, createPolyline, onSelectionChange });

    overlay.renderTour(tour);
    clickHandlers.get("poi-01")?.();
    overlay.closePoiDetail();

    expect(overlay.getOpenPoiId()).toBeNull();
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });

  it("removes previous layers and resets selection when rendering a new tour", () => {
    const map = createFakeMap();
    const { createMarker, createPolyline, clickHandlers } = createFakeFactories();
    const overlay = new PoiRouteOverlay({ map, createMarker, createPolyline });

    overlay.renderTour(tour);
    clickHandlers.get("poi-01")?.();
    expect(overlay.getOpenPoiId()).toBe("poi-01");

    overlay.renderTour({ ...tour, pois: [], routes: [] });

    expect(map.removed).toHaveLength(3);
    expect(map.added).toHaveLength(0);
    expect(overlay.getOpenPoiId()).toBeNull();
  });
});
