import { describe, expect, it, vi } from "vitest";
import { createLayerControl, type LayerControlManager } from "./layerControl";
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

function createFakeManager(initialOverlayIds: string[] = []): LayerControlManager {
  let state = { baseLayerId: "gsi-std", overlayLayerIds: initialOverlayIds };
  return {
    setBaseLayer: vi.fn((layerId: string) => {
      state = { ...state, baseLayerId: layerId };
    }),
    toggleOverlay: vi.fn((layerId: string, visible: boolean) => {
      const ids = new Set(state.overlayLayerIds);
      if (visible) ids.add(layerId);
      else ids.delete(layerId);
      state = { ...state, overlayLayerIds: Array.from(ids) };
    }),
    getActiveLayerState: () => state,
  };
}

describe("createLayerControl", () => {
  it("renders one button per base layer and one checkbox per overlay layer", () => {
    const manager = createFakeManager();
    const { root } = createLayerControl(layers, manager);

    expect(root.querySelectorAll(".layer-control__button")).toHaveLength(2);
    expect(root.querySelectorAll(".layer-control__checkbox")).toHaveLength(1);
  });

  it("marks the initially active base layer button", () => {
    const manager = createFakeManager();
    const { root } = createLayerControl(layers, manager);

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(".layer-control__button"));
    const active = buttons.find((b) => b.classList.contains("layer-control__button--active"));
    expect(active?.textContent).toBe("地理院地図（標準地図）");
    expect(active?.getAttribute("aria-pressed")).toBe("true");
  });

  it("reflects initial overlay checked state from the manager", () => {
    const manager = createFakeManager(["aist-geology"]);
    const { root } = createLayerControl(layers, manager);

    const checkbox = root.querySelector<HTMLInputElement>(".layer-control__checkbox");
    expect(checkbox?.checked).toBe(true);
  });

  it("calls setBaseLayer and updates the active button when a base layer button is clicked", () => {
    const manager = createFakeManager();
    const { root } = createLayerControl(layers, manager);

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(".layer-control__button"));
    const osmButton = buttons.find((b) => b.textContent === "OpenStreetMap")!;
    osmButton.click();

    expect(manager.setBaseLayer).toHaveBeenCalledWith("osm");
    expect(osmButton.classList.contains("layer-control__button--active")).toBe(true);
    expect(osmButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("calls toggleOverlay with the checkbox state when clicked", () => {
    const manager = createFakeManager();
    const { root } = createLayerControl(layers, manager);

    const checkbox = root.querySelector<HTMLInputElement>(".layer-control__checkbox")!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));

    expect(manager.toggleOverlay).toHaveBeenCalledWith("aist-geology", true);
  });

  it("refresh() re-syncs base button and overlay checkbox state after external manager changes", () => {
    const manager = createFakeManager();
    const { root, refresh } = createLayerControl(layers, manager);

    // ツアー切替等、コントロールのクリックを介さずマネージャーの状態が
    // 外部から変更されるケースを想定する。
    manager.setBaseLayer("osm");
    manager.toggleOverlay("aist-geology", true);
    refresh();

    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(".layer-control__button"));
    const osmButton = buttons.find((b) => b.textContent === "OpenStreetMap")!;
    expect(osmButton.classList.contains("layer-control__button--active")).toBe(true);

    const checkbox = root.querySelector<HTMLInputElement>(".layer-control__checkbox")!;
    expect(checkbox.checked).toBe(true);
  });
});
