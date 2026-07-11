import { describe, expect, it } from "vitest";
import {
  layersToSheet,
  sheetToLayers,
  mergeTourIntoSheets,
  extractTourFromSheets,
  type SheetsData,
} from "./googleSheetsRowMapping";
import type { LayerDefinition, TourConfig } from "../types/config";

const layers: LayerDefinition[] = [
  {
    id: "gsi-std",
    name: "地理院地図（標準地図）",
    type: "base",
    urlTemplate: "https://example.com/std/{z}/{x}/{y}.png",
    attribution: "国土地理院",
    opacity: 1,
    minZoom: 2,
    maxZoom: 18,
    defaultVisible: true,
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

const tour: TourConfig = {
  id: "sample-tour",
  title: "サンプル巡検コース",
  description: "動作確認用のサンプルツアーです。",
  layerIds: ["gsi-std", "aist-geology"],
  pois: [
    {
      id: "poi-01",
      name: "露頭A",
      description: "花崗岩の貫入部",
      position: { lat: 35.681236, lng: 139.767125 },
      media: [
        { url: "https://drive.google.com/file/d/xxx/view", caption: "全景写真", type: "photo" },
      ],
      referencePapers: [{ url: "https://doi.org/10.xxxx/example", citation: "山田 (2020)" }],
    },
    {
      id: "poi-02",
      name: "露頭B",
      description: "断層露頭",
      position: { lat: 35.6826, lng: 139.7684 },
      media: [],
      referencePapers: [],
    },
  ],
  routes: [
    {
      id: "route-01",
      name: "駐車場〜露頭Aルート",
      points: [
        { lat: 35.68, lng: 139.766 },
        { lat: 35.681236, lng: 139.767125 },
      ],
    },
  ],
};

describe("layersToSheet / sheetToLayers", () => {
  it("round-trips a list of layers through sheet rows", () => {
    const rows = layersToSheet(layers);
    expect(sheetToLayers(rows)).toEqual(layers);
  });

  it("produces a header row followed by one row per layer", () => {
    const rows = layersToSheet(layers);
    expect(rows[0]).toEqual([
      "id",
      "name",
      "type",
      "urlTemplate",
      "attribution",
      "opacity",
      "minZoom",
      "maxZoom",
      "defaultVisible",
    ]);
    expect(rows).toHaveLength(3);
  });

  it("returns an empty array for an empty/header-only sheet", () => {
    expect(sheetToLayers([])).toEqual([]);
    expect(sheetToLayers([["id", "name", "type"]])).toEqual([]);
  });
});

describe("mergeTourIntoSheets / extractTourFromSheets", () => {
  it("round-trips a tour with POIs (media, reference papers) and routes", () => {
    const merged = mergeTourIntoSheets({}, tour);
    expect(extractTourFromSheets(merged, "sample-tour")).toEqual(tour);
  });

  it("round-trips a tour with no POIs and no routes", () => {
    const emptyTour: TourConfig = { ...tour, pois: [], routes: [] };
    const merged = mergeTourIntoSheets({}, emptyTour);
    expect(extractTourFromSheets(merged, "sample-tour")).toEqual(emptyTour);
  });

  it("returns null when the requested tour id is not present", () => {
    const merged = mergeTourIntoSheets({}, tour);
    expect(extractTourFromSheets(merged, "unknown-tour")).toBeNull();
  });

  it("preserves an unrelated tour's rows already present in the sheets", () => {
    const otherTour: TourConfig = {
      id: "second-tour",
      title: "第二巡検コース",
      description: "",
      layerIds: ["osm"],
      pois: [
        {
          id: "poi-101",
          name: "露頭C",
          description: "海岸段丘",
          position: { lat: 35.65, lng: 139.72 },
          media: [],
          referencePapers: [],
        },
      ],
      routes: [],
    };

    const withOtherTour = mergeTourIntoSheets({}, otherTour);
    const withBoth = mergeTourIntoSheets(withOtherTour, tour);

    expect(extractTourFromSheets(withBoth, "second-tour")).toEqual(otherTour);
    expect(extractTourFromSheets(withBoth, "sample-tour")).toEqual(tour);
  });

  it("replaces (not duplicates) a tour's rows when saved again after an edit", () => {
    const firstSave = mergeTourIntoSheets({}, tour);
    const editedTour: TourConfig = {
      ...tour,
      pois: [{ ...tour.pois[0], name: "露頭A（改題）" }],
    };
    const secondSave = mergeTourIntoSheets(firstSave, editedTour);

    const result = extractTourFromSheets(secondSave, "sample-tour");
    expect(result?.pois).toHaveLength(1);
    expect(result?.pois[0].name).toBe("露頭A（改題）");
  });

  it("leaves the Layers sheet untouched when merging a tour", () => {
    const existing: SheetsData = { Layers: layersToSheet(layers) };
    const merged = mergeTourIntoSheets(existing, tour);
    expect(merged.Layers).toEqual(existing.Layers);
  });

  it("round-trips an empty layerIds list", () => {
    const noLayerTour: TourConfig = { ...tour, layerIds: [] };
    const merged = mergeTourIntoSheets({}, noLayerTour);
    expect(extractTourFromSheets(merged, "sample-tour")?.layerIds).toEqual([]);
  });
});
