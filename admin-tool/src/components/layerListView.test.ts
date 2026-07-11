import { describe, expect, it, vi } from "vitest";
import { createLayerListView } from "./layerListView";
import type { LayerDefinition } from "../../../src/types/config";

const layerA: LayerDefinition = {
  id: "gsi-std",
  name: "地理院地図（標準地図）",
  type: "base",
  urlTemplate: "https://example.com/{z}/{x}/{y}.png",
  attribution: "国土地理院",
  opacity: 1,
  minZoom: 2,
  maxZoom: 18,
  defaultVisible: true,
};

const layerB: LayerDefinition = {
  id: "aist-geology",
  name: "シームレス地質図",
  type: "overlay",
  urlTemplate: "https://example.com/{z}/{y}/{x}.png",
  attribution: "産総研",
  opacity: 0.6,
  minZoom: 2,
  maxZoom: 16,
  defaultVisible: false,
};

function createCallbacks() {
  return { onAddNew: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
}

describe("createLayerListView", () => {
  it("renders no items and an add button when the list is empty", () => {
    const view = createLayerListView(createCallbacks());
    view.render([]);

    expect(view.root.querySelectorAll(".layer-list-view__item")).toHaveLength(0);
    expect(view.root.querySelector(".layer-list-view__add")).not.toBeNull();
  });

  it("renders one item per layer with its name and type", () => {
    const view = createLayerListView(createCallbacks());
    view.render([layerA, layerB]);

    const items = view.root.querySelectorAll(".layer-list-view__item");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("地理院地図（標準地図）");
    expect(items[1].textContent).toContain("シームレス地質図");
  });

  it("calls onAddNew when the add button is clicked", () => {
    const callbacks = createCallbacks();
    const view = createLayerListView(callbacks);
    view.render([]);

    view.root.querySelector<HTMLButtonElement>(".layer-list-view__add")!.click();

    expect(callbacks.onAddNew).toHaveBeenCalled();
  });

  it("calls onEdit with the corresponding layer when its edit button is clicked", () => {
    const callbacks = createCallbacks();
    const view = createLayerListView(callbacks);
    view.render([layerA, layerB]);

    view.root
      .querySelectorAll<HTMLButtonElement>(".layer-list-view__edit")[1]
      .click();

    expect(callbacks.onEdit).toHaveBeenCalledWith(layerB);
  });

  it("calls onDelete with the corresponding layer id when its delete button is clicked", () => {
    const callbacks = createCallbacks();
    const view = createLayerListView(callbacks);
    view.render([layerA, layerB]);

    view.root
      .querySelectorAll<HTMLButtonElement>(".layer-list-view__delete")[0]
      .click();

    expect(callbacks.onDelete).toHaveBeenCalledWith("gsi-std");
  });

  it("re-renders cleanly when called again with a different list", () => {
    const view = createLayerListView(createCallbacks());
    view.render([layerA, layerB]);
    view.render([layerA]);

    expect(view.root.querySelectorAll(".layer-list-view__item")).toHaveLength(1);
  });
});
