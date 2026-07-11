import { describe, expect, it } from "vitest";
import { AdminLayerListStore } from "./adminLayerListStore";
import type { LayerDefinition } from "../../../src/types/config";

const sampleLayer: LayerDefinition = {
  id: "gsi-std",
  name: "地理院地図（標準地図）",
  type: "base",
  urlTemplate: "https://example.com/{z}/{x}/{y}.png",
  attribution: "国土地理院",
  opacity: 1.0,
  minZoom: 2,
  maxZoom: 18,
  defaultVisible: true,
};

describe("AdminLayerListStore", () => {
  it("starts empty", () => {
    const store = new AdminLayerListStore();
    expect(store.list()).toEqual([]);
  });

  it("loads an existing layer array", () => {
    const store = new AdminLayerListStore();
    store.load([sampleLayer]);
    expect(store.list()).toEqual([sampleLayer]);
  });

  it("adds a new layer via upsert", () => {
    const store = new AdminLayerListStore();
    store.upsert(sampleLayer);
    expect(store.list()).toEqual([sampleLayer]);
  });

  it("replaces an existing layer with the same id via upsert", () => {
    const store = new AdminLayerListStore();
    store.upsert(sampleLayer);

    const updated = { ...sampleLayer, name: "更新後の名称" };
    store.upsert(updated);

    expect(store.list()).toEqual([updated]);
  });

  it("preserves insertion order when upserting a new layer after an existing one", () => {
    const store = new AdminLayerListStore();
    store.upsert(sampleLayer);
    const second: LayerDefinition = { ...sampleLayer, id: "osm", name: "OpenStreetMap" };
    store.upsert(second);

    expect(store.list().map((l) => l.id)).toEqual(["gsi-std", "osm"]);
  });

  it("removes a layer by id", () => {
    const store = new AdminLayerListStore();
    store.upsert(sampleLayer);
    const second: LayerDefinition = { ...sampleLayer, id: "osm", name: "OpenStreetMap" };
    store.upsert(second);

    store.remove("gsi-std");

    expect(store.list()).toEqual([second]);
  });

  it("does nothing when removing a non-existent id", () => {
    const store = new AdminLayerListStore();
    store.upsert(sampleLayer);

    expect(() => store.remove("unknown")).not.toThrow();
    expect(store.list()).toHaveLength(1);
  });

  it("exports the current layer list as pretty-printed JSON", () => {
    const store = new AdminLayerListStore();
    store.upsert(sampleLayer);

    expect(JSON.parse(store.toJson())).toEqual([sampleLayer]);
    expect(store.toJson()).toContain("\n");
  });
});
