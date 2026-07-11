import { afterEach, describe, expect, it, vi } from "vitest";
import { loadLayers, loadTour, listAvailableTours } from "./configLoader";
import type { LayerDefinition, TourConfig } from "../types/config";

const sampleLayers: LayerDefinition[] = [
  {
    id: "gsi-std",
    name: "地理院地図（標準）",
    type: "base",
    urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    attribution: "国土地理院",
    opacity: 1.0,
    minZoom: 2,
    maxZoom: 18,
    defaultVisible: true,
  },
];

const sampleTour: TourConfig = {
  id: "sample-tour",
  title: "サンプル巡検",
  layerIds: ["gsi-std"],
  pois: [],
  routes: [],
};

function mockFetchOnce(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadLayers", () => {
  it("fetches and returns layer definitions from config/layers.json", async () => {
    mockFetchOnce(sampleLayers);

    const layers = await loadLayers();

    expect(fetch).toHaveBeenCalledWith("config/layers.json");
    expect(layers).toEqual(sampleLayers);
  });

  it("throws when the response is not ok", async () => {
    mockFetchOnce(null, false, 404);

    await expect(loadLayers()).rejects.toThrow("layers.jsonの取得に失敗しました (status: 404)");
  });

  it("throws when a layer definition fails validation", async () => {
    mockFetchOnce([{ ...sampleLayers[0], id: "" }]);

    await expect(loadLayers()).rejects.toThrow(/idが空です/);
  });
});

describe("loadTour", () => {
  it("fetches and returns a tour config by id", async () => {
    mockFetchOnce(sampleTour);

    const tour = await loadTour("sample-tour");

    expect(fetch).toHaveBeenCalledWith("config/tours/sample-tour.json");
    expect(tour).toEqual(sampleTour);
  });

  it("throws when the response is not ok", async () => {
    mockFetchOnce(null, false, 404);

    await expect(loadTour("missing-tour")).rejects.toThrow(
      "missing-tour.jsonの取得に失敗しました (status: 404)",
    );
  });

  it("throws when the tour config fails validation", async () => {
    mockFetchOnce({ ...sampleTour, title: "" });

    await expect(loadTour("sample-tour")).rejects.toThrow(/titleが空です/);
  });
});

describe("listAvailableTours", () => {
  it("fetches and returns the tour index", async () => {
    const index = [{ id: "sample-tour", title: "サンプル巡検" }];
    mockFetchOnce(index);

    const tours = await listAvailableTours();

    expect(fetch).toHaveBeenCalledWith("config/tours/index.json");
    expect(tours).toEqual(index);
  });
});
