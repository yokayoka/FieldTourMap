import { describe, expect, it } from "vitest";
import { AdminTourStore } from "./adminTourStore";
import type { PointOfInterest, RoutePath, TourConfig } from "../../../src/types/config";

const samplePoi: PointOfInterest = {
  id: "poi-1",
  name: "露頭A",
  description: "花崗岩の貫入部",
  position: { lat: 35.68, lng: 139.76 },
  media: [],
  referencePapers: [],
};

const sampleRoute: RoutePath = {
  id: "route-1",
  name: "ルート1",
  points: [
    { lat: 35.68, lng: 139.76 },
    { lat: 35.681, lng: 139.761 },
  ],
};

describe("AdminTourStore", () => {
  it("starts with empty metadata, pois, and routes", () => {
    const store = new AdminTourStore();
    expect(store.getMetadata()).toEqual({ id: "", title: "", description: "", layerIds: [] });
    expect(store.listPois()).toEqual([]);
    expect(store.listRoutes()).toEqual([]);
  });

  it("loads an existing tour config", () => {
    const store = new AdminTourStore();
    const tour: TourConfig = {
      id: "sample-tour",
      title: "サンプル巡検",
      description: "説明",
      layerIds: ["gsi-std"],
      pois: [samplePoi],
      routes: [sampleRoute],
    };

    store.load(tour);

    expect(store.getMetadata()).toEqual({
      id: "sample-tour",
      title: "サンプル巡検",
      description: "説明",
      layerIds: ["gsi-std"],
    });
    expect(store.listPois()).toEqual([samplePoi]);
    expect(store.listRoutes()).toEqual([sampleRoute]);
  });

  it("updates metadata fields", () => {
    const store = new AdminTourStore();
    store.setMetadata({ id: "new-tour", title: "新しいツアー" });
    expect(store.getMetadata()).toEqual({
      id: "new-tour",
      title: "新しいツアー",
      description: "",
      layerIds: [],
    });
  });

  it("adds and replaces a POI via upsertPoi", () => {
    const store = new AdminTourStore();
    store.upsertPoi(samplePoi);
    expect(store.listPois()).toEqual([samplePoi]);

    const updated = { ...samplePoi, name: "更新後の名称" };
    store.upsertPoi(updated);
    expect(store.listPois()).toEqual([updated]);
  });

  it("removes a POI by id", () => {
    const store = new AdminTourStore();
    store.upsertPoi(samplePoi);
    store.upsertPoi({ ...samplePoi, id: "poi-2", name: "露頭B" });

    store.removePoi("poi-1");

    expect(store.listPois()).toHaveLength(1);
    expect(store.listPois()[0].id).toBe("poi-2");
  });

  it("adds and replaces a route via upsertRoute", () => {
    const store = new AdminTourStore();
    store.upsertRoute(sampleRoute);
    expect(store.listRoutes()).toEqual([sampleRoute]);

    const updated = { ...sampleRoute, name: "更新後のルート" };
    store.upsertRoute(updated);
    expect(store.listRoutes()).toEqual([updated]);
  });

  it("removes a route by id", () => {
    const store = new AdminTourStore();
    store.upsertRoute(sampleRoute);
    store.upsertRoute({ ...sampleRoute, id: "route-2", name: "ルート2" });

    store.removeRoute("route-1");

    expect(store.listRoutes()).toHaveLength(1);
    expect(store.listRoutes()[0].id).toBe("route-2");
  });

  it("exports the full tour as pretty-printed JSON matching TourConfig shape", () => {
    const store = new AdminTourStore();
    store.setMetadata({ id: "sample-tour", title: "サンプル巡検", layerIds: ["gsi-std"] });
    store.upsertPoi(samplePoi);
    store.upsertRoute(sampleRoute);

    const parsed = JSON.parse(store.toJson());

    expect(parsed).toEqual({
      id: "sample-tour",
      title: "サンプル巡検",
      description: "",
      layerIds: ["gsi-std"],
      pois: [samplePoi],
      routes: [sampleRoute],
    });
    expect(store.toJson()).toContain("\n");
  });
});
