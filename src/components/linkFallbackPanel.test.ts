import { describe, expect, it, vi } from "vitest";
import { createLinkFallbackPanel } from "./linkFallbackPanel";

describe("createLinkFallbackPanel", () => {
  it("is hidden initially", () => {
    const panel = createLinkFallbackPanel({ onClose: vi.fn() });
    expect(panel.root.hidden).toBe(true);
  });

  it("shows a read-only, selectable input containing the url", () => {
    const panel = createLinkFallbackPanel({ onClose: vi.fn() });

    panel.show("https://maps.example/x");

    expect(panel.root.hidden).toBe(false);
    const input = panel.root.querySelector<HTMLInputElement>(".link-fallback-panel__input");
    expect(input?.value).toBe("https://maps.example/x");
    expect(input?.readOnly).toBe(true);
  });

  it("calls onClose and hides when the close button is clicked", () => {
    const onClose = vi.fn();
    const panel = createLinkFallbackPanel({ onClose });
    panel.show("https://maps.example/x");

    panel.root.querySelector<HTMLButtonElement>(".link-fallback-panel__close")!.click();

    expect(onClose).toHaveBeenCalled();
    expect(panel.root.hidden).toBe(true);
  });

  it("hides via hide()", () => {
    const panel = createLinkFallbackPanel({ onClose: vi.fn() });
    panel.show("https://maps.example/x");

    panel.hide();

    expect(panel.root.hidden).toBe(true);
  });
});
