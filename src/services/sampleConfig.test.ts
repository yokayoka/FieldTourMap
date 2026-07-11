import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateLayerDefinition, validateTourConfig } from "./configValidator";
import { parseCsv } from "../utils/csv";
import { sheetToLayers, extractTourFromSheets, SHEET_NAMES } from "./googleSheetsRowMapping";
import type { LayerDefinition, TourConfig } from "../types/config";

function readJson<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, "../../public/config", relativePath);
  return JSON.parse(readFileSync(fullPath, "utf-8")) as T;
}

function readSampleProjectSheet(sheetName: string): string[][] {
  const fullPath = resolve(__dirname, "../../docs/sample-project", `${sheetName}.csv`);
  return parseCsv(readFileSync(fullPath, "utf-8"));
}

describe("public/config/layers.json", () => {
  const layers = readJson<LayerDefinition[]>("layers.json");

  it("provides at least 3 base layers (Requirement 2.1)", () => {
    const baseLayers = layers.filter((layer) => layer.type === "base");
    expect(baseLayers.length).toBeGreaterThanOrEqual(3);
  });

  it("every layer passes ConfigValidator", () => {
    layers.forEach((layer) => {
      const result = validateLayerDefinition(layer);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });
  });

  it("has unique layer ids", () => {
    const ids = layers.map((layer) => layer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("public/config/tours/sample-tour.json", () => {
  const tour = readJson<TourConfig>("tours/sample-tour.json");

  it("passes ConfigValidator", () => {
    const result = validateTourConfig(tour);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("contains at least one POI with a media link and a reference paper (Requirement 4.1, 4.2)", () => {
    const hasMedia = tour.pois.some((poi) => poi.media.length > 0);
    const hasPaper = tour.pois.some((poi) => poi.referencePapers.length > 0);
    expect(hasMedia).toBe(true);
    expect(hasPaper).toBe(true);
  });

  it("references only layer ids that exist in layers.json", () => {
    const layers = readJson<LayerDefinition[]>("layers.json");
    const validIds = new Set(layers.map((layer) => layer.id));
    tour.layerIds.forEach((id) => expect(validIds.has(id)).toBe(true));
  });
});

describe("public/config/tours/index.json", () => {
  it("lists the sample tour", () => {
    const index = readJson<{ id: string; title: string }[]>("tours/index.json");
    expect(index.some((entry) => entry.id === "sample-tour")).toBe(true);
  });

  it("lists at least two tours (Requirement 20: 複数実習ツアー切替)", () => {
    const index = readJson<{ id: string; title: string }[]>("tours/index.json");
    expect(index.length).toBeGreaterThanOrEqual(2);
  });

  it("every listed tour resolves to a valid tour config file", () => {
    const index = readJson<{ id: string; title: string }[]>("tours/index.json");
    const layers = readJson<LayerDefinition[]>("layers.json");
    const validLayerIds = new Set(layers.map((layer) => layer.id));

    index.forEach((entry) => {
      const tour = readJson<TourConfig>(`tours/${entry.id}.json`);
      const result = validateTourConfig(tour);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
      expect(tour.id).toBe(entry.id);
      tour.layerIds.forEach((id) => expect(validLayerIds.has(id)).toBe(true));
    });
  });
});

describe("docs/sample-project/*.csv（Requirement 16のGoogleスプレッドシートサンプル）", () => {
  it("Layers.csvはpublic/config/layers.jsonと同一のレイヤー一覧にパースできる", () => {
    const layers = sheetToLayers(readSampleProjectSheet("Layers"));
    expect(layers).toEqual(readJson<LayerDefinition[]>("layers.json"));
  });

  it("各ツアーのシート群は対応するtours/*.jsonと同一のツアー設定にパースできる", () => {
    const sheets = Object.fromEntries(
      SHEET_NAMES.filter((name) => name !== "Layers").map((name) => [
        name,
        readSampleProjectSheet(name),
      ]),
    );

    const index = readJson<{ id: string; title: string }[]>("tours/index.json");
    index.forEach((entry) => {
      const expected = readJson<TourConfig>(`tours/${entry.id}.json`);
      expect(extractTourFromSheets(sheets, entry.id)).toEqual(expected);
    });
  });
});
