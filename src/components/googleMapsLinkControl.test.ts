import { describe, expect, it, vi } from "vitest";
import { createGoogleMapsLinkControl } from "./googleMapsLinkControl";

describe("createGoogleMapsLinkControl", () => {
  it("renders an inactive toggle button initially", () => {
    const control = createGoogleMapsLinkControl({ onTogglePlacement: vi.fn() });

    const button = control.root.querySelector<HTMLButtonElement>(
      ".google-maps-link-control__toggle",
    );
    expect(button?.classList.contains("google-maps-link-control__toggle--active")).toBe(false);
    expect(button?.getAttribute("aria-pressed")).toBe("false");
  });

  it("toggles active state and notifies the callback when clicked", () => {
    const onTogglePlacement = vi.fn();
    const control = createGoogleMapsLinkControl({ onTogglePlacement });
    const button = control.root.querySelector<HTMLButtonElement>(
      ".google-maps-link-control__toggle",
    )!;

    button.click();
    expect(onTogglePlacement).toHaveBeenLastCalledWith(true);
    expect(button.classList.contains("google-maps-link-control__toggle--active")).toBe(true);

    button.click();
    expect(onTogglePlacement).toHaveBeenLastCalledWith(false);
    expect(button.classList.contains("google-maps-link-control__toggle--active")).toBe(false);
  });

  it("updates the state externally via setActive without invoking the callback", () => {
    const onTogglePlacement = vi.fn();
    const control = createGoogleMapsLinkControl({ onTogglePlacement });
    const button = control.root.querySelector<HTMLButtonElement>(
      ".google-maps-link-control__toggle",
    )!;
    button.click();
    onTogglePlacement.mockClear();

    control.setActive(false);

    expect(button.classList.contains("google-maps-link-control__toggle--active")).toBe(false);
    expect(onTogglePlacement).not.toHaveBeenCalled();
  });
});
