import { describe, expect, it, vi } from "vitest";
import { createMemoControl } from "./memoControl";

function createCallbacks() {
  return {
    onTogglePlacement: vi.fn(),
    onExportCsv: vi.fn(),
    onExportGeoJson: vi.fn(),
  };
}

describe("createMemoControl", () => {
  it("renders an inactive toggle button and two export buttons", () => {
    const control = createMemoControl(createCallbacks());

    const toggle = control.root.querySelector<HTMLButtonElement>(".memo-control__toggle");
    expect(toggle?.classList.contains("memo-control__toggle--active")).toBe(false);
    expect(toggle?.getAttribute("aria-pressed")).toBe("false");
    expect(control.root.querySelector(".memo-control__export-csv")).not.toBeNull();
    expect(control.root.querySelector(".memo-control__export-geojson")).not.toBeNull();
  });

  it("toggles placement mode and notifies the callback", () => {
    const callbacks = createCallbacks();
    const control = createMemoControl(callbacks);
    const toggle = control.root.querySelector<HTMLButtonElement>(".memo-control__toggle")!;

    toggle.click();
    expect(callbacks.onTogglePlacement).toHaveBeenLastCalledWith(true);
    expect(toggle.classList.contains("memo-control__toggle--active")).toBe(true);

    toggle.click();
    expect(callbacks.onTogglePlacement).toHaveBeenLastCalledWith(false);
    expect(toggle.classList.contains("memo-control__toggle--active")).toBe(false);
  });

  it("calls onExportCsv when the CSV export button is clicked", () => {
    const callbacks = createCallbacks();
    const control = createMemoControl(callbacks);

    control.root.querySelector<HTMLButtonElement>(".memo-control__export-csv")!.click();

    expect(callbacks.onExportCsv).toHaveBeenCalled();
  });

  it("calls onExportGeoJson when the GeoJSON export button is clicked", () => {
    const callbacks = createCallbacks();
    const control = createMemoControl(callbacks);

    control.root.querySelector<HTMLButtonElement>(".memo-control__export-geojson")!.click();

    expect(callbacks.onExportGeoJson).toHaveBeenCalled();
  });

  it("updates the toggle state externally without invoking the callback", () => {
    const callbacks = createCallbacks();
    const control = createMemoControl(callbacks);
    const toggle = control.root.querySelector<HTMLButtonElement>(".memo-control__toggle")!;
    toggle.click();
    callbacks.onTogglePlacement.mockClear();

    control.setPlacementActive(false);

    expect(toggle.classList.contains("memo-control__toggle--active")).toBe(false);
    expect(callbacks.onTogglePlacement).not.toHaveBeenCalled();
  });
});
