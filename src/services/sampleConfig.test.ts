import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateLayerDefinition, validateTourConfig } from "./configValidator";
import type { LayerDefinition, TourConfig } from "../types/config";

function readJson<T>(relativePath: string): T {
  const fullPath = resolve(__dirname, "../../public/config", relativePath);
  return JSON.parse(readFileSync(fullPath, "utf-8")) as T;
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
});
