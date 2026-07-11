import { describe, expect, it, vi } from "vitest";
import { createLocationControl } from "./locationControl";

describe("createLocationControl", () => {
  it("renders a follow button that is active by default", () => {
    const control = createLocationControl({ onToggleFollow: vi.fn() });

    const button = control.root.querySelector<HTMLButtonElement>(".location-control__button");
    expect(button?.classList.contains("location-control__button--active")).toBe(true);
    expect(button?.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders a hidden error banner by default", () => {
    const control = createLocationControl({ onToggleFollow: vi.fn() });

    const banner = control.root.querySelector<HTMLElement>(".location-control__error");
    expect(banner?.hidden).toBe(true);
  });

  it("toggles follow mode and calls the callback when the button is clicked", () => {
    const onToggleFollow = vi.fn();
    const control = createLocationControl({ onToggleFollow });
    const button = control.root.querySelector<HTMLButtonElement>(".location-control__button")!;

    button.click();

    expect(onToggleFollow).toHaveBeenCalledWith(false);
    expect(button.classList.contains("location-control__button--active")).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");

    button.click();

    expect(onToggleFollow).toHaveBeenCalledWith(true);
    expect(button.classList.contains("location-control__button--active")).toBe(true);
  });

  it("shows and clears an error message", () => {
    const control = createLocationControl({ onToggleFollow: vi.fn() });
    const banner = control.root.querySelector<HTMLElement>(".location-control__error")!;

    control.showError("現在地を取得できませんでした。");
    expect(banner.hidden).toBe(false);
    expect(banner.textContent).toBe("現在地を取得できませんでした。");

    control.clearError();
    expect(banner.hidden).toBe(true);
    expect(banner.textContent).toBe("");
  });

  it("updates the follow button state externally without invoking the callback", () => {
    const onToggleFollow = vi.fn();
    const control = createLocationControl({ onToggleFollow });
    const button = control.root.querySelector<HTMLButtonElement>(".location-control__button")!;

    control.setFollowState(false);

    expect(button.classList.contains("location-control__button--active")).toBe(false);
    expect(onToggleFollow).not.toHaveBeenCalled();
  });
});
