import { describe, expect, it, vi } from "vitest";
import { createTourSelectorPanel } from "./tourSelectorPanel";
import type { TourIndexEntry } from "../services/configLoader";

const tours: TourIndexEntry[] = [
  { id: "sample-tour", title: "サンプル巡検コース" },
  { id: "second-tour", title: "第二巡検コース" },
];

describe("createTourSelectorPanel", () => {
  it("starts hidden", () => {
    const panel = createTourSelectorPanel({ onSelect: vi.fn(), onClose: vi.fn() });
    expect(panel.root.hidden).toBe(true);
  });

  it("show() renders one entry per tour and marks the active one", () => {
    const panel = createTourSelectorPanel({ onSelect: vi.fn(), onClose: vi.fn() });
    panel.show(tours, "second-tour");

    const items = panel.root.querySelectorAll(".tour-selector-panel__item");
    expect(items).toHaveLength(2);
    const active = panel.root.querySelector(".tour-selector-panel__item--active");
    expect(active?.textContent).toContain("第二巡検コース");
    expect(panel.root.hidden).toBe(false);
  });

  it("calls onSelect with the tapped tour id and hides the panel", () => {
    const onSelect = vi.fn();
    const panel = createTourSelectorPanel({ onSelect, onClose: vi.fn() });
    panel.show(tours, "sample-tour");

    const items = panel.root.querySelectorAll<HTMLButtonElement>(".tour-selector-panel__item");
    items[1].click();

    expect(onSelect).toHaveBeenCalledWith("second-tour");
    expect(panel.root.hidden).toBe(true);
  });

  it("calls onClose and hides when the close button is clicked", () => {
    const onClose = vi.fn();
    const panel = createTourSelectorPanel({ onSelect: vi.fn(), onClose });
    panel.show(tours, "sample-tour");

    panel.root.querySelector<HTMLButtonElement>(".tour-selector-panel__close")!.click();

    expect(onClose).toHaveBeenCalled();
    expect(panel.root.hidden).toBe(true);
  });

  it("hide() hides the panel", () => {
    const panel = createTourSelectorPanel({ onSelect: vi.fn(), onClose: vi.fn() });
    panel.show(tours, "sample-tour");
    panel.hide();
    expect(panel.root.hidden).toBe(true);
  });
});
