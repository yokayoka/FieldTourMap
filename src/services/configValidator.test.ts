import { describe, expect, it } from "vitest";
import {
  validateLayerDefinition,
  validateMediaLink,
  validateReferencePaper,
  validateTourConfig,
} from "./configValidator";
import type { LayerDefinition, MediaLink, ReferencePaper, TourConfig } from "../types/config";

const validLayer: LayerDefinition = {
  id: "gsi-std",
  name: "地理院地図（標準）",
  type: "base",
  urlTemplate: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
  attribution: "国土地理院",
  opacity: 1.0,
  minZoom: 2,
  maxZoom: 18,
  defaultVisible: true,
};

describe("validateLayerDefinition", () => {
  it("accepts a well-formed layer definition", () => {
    expect(validateLayerDefinition(validLayer)).toEqual({ valid: true, errors: [] });
  });

  it("rejects a tile URL missing the {y} placeholder", () => {
    const result = validateLayerDefinition({
      ...validLayer,
      urlTemplate: "https://example.com/{z}/{x}.png",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("urlTemplateに{y}プレースホルダがありません");
  });

  it("rejects a tile URL missing the {z} placeholder", () => {
    const result = validateLayerDefinition({
      ...validLayer,
      urlTemplate: "https://example.com/{x}/{y}.png",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("urlTemplateに{z}プレースホルダがありません");
  });

  it("rejects an empty id or name", () => {
    const result = validateLayerDefinition({ ...validLayer, id: "", name: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("idが空です");
    expect(result.errors).toContain("nameが空です");
  });

  it("rejects opacity outside 0-1", () => {
    const result = validateLayerDefinition({ ...validLayer, opacity: 1.5 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("opacityは0から1の範囲で指定してください");
  });

  it("rejects minZoom greater than maxZoom", () => {
    const result = validateLayerDefinition({ ...validLayer, minZoom: 10, maxZoom: 5 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("minZoomはmaxZoom以下である必要があります");
  });
});

const validMedia: MediaLink = {
  url: "https://drive.google.com/file/d/xxxx/view",
  caption: "露頭全景写真",
  type: "photo",
};

describe("validateMediaLink", () => {
  it("accepts a well-formed media link", () => {
    expect(validateMediaLink(validMedia)).toEqual({ valid: true, errors: [] });
  });

  it("rejects a URL without http(s) scheme", () => {
    const result = validateMediaLink({ ...validMedia, url: "ftp://example.com/file" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("urlはhttp(s)://で始まる必要があります");
  });

  it("rejects an empty caption", () => {
    const result = validateMediaLink({ ...validMedia, caption: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("captionが空です");
  });
});

const validPaper: ReferencePaper = {
  url: "https://doi.org/10.xxxx/example.2020.001",
  citation: "山田太郎ほか (2020)",
};

describe("validateReferencePaper", () => {
  it("accepts a well-formed reference paper", () => {
    expect(validateReferencePaper(validPaper)).toEqual({ valid: true, errors: [] });
  });

  it("rejects a URL without http(s) scheme", () => {
    const result = validateReferencePaper({ ...validPaper, url: "not-a-url" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("urlはhttp(s)://で始まる必要があります");
  });

  it("rejects an empty citation", () => {
    const result = validateReferencePaper({ ...validPaper, citation: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("citationが空です");
  });
});

const validTour: TourConfig = {
  id: "sample-tour",
  title: "サンプル巡検",
  layerIds: ["gsi-std"],
  pois: [
    {
      id: "poi-01",
      name: "露頭A",
      description: "説明文",
      position: { lat: 35.681, lng: 139.767 },
      media: [validMedia],
      referencePapers: [validPaper],
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

describe("validateTourConfig", () => {
  it("accepts a well-formed tour config", () => {
    expect(validateTourConfig(validTour)).toEqual({ valid: true, errors: [] });
  });

  it("rejects an empty title", () => {
    const result = validateTourConfig({ ...validTour, title: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("titleが空です");
  });

  it("collects nested errors from an invalid POI with a prefixed index", () => {
    const result = validateTourConfig({
      ...validTour,
      pois: [{ ...validTour.pois[0], name: "" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("pois[0]: nameが空です");
  });

  it("rejects a route with fewer than 2 points", () => {
    const result = validateTourConfig({
      ...validTour,
      routes: [{ id: "route-01", name: "ルート1", points: [{ lat: 35.68, lng: 139.766 }] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("routes[0]: pointsは2点以上必要です");
  });
});
