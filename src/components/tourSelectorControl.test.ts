import { describe, expect, it, vi } from "vitest";
import { createTourSelectorControl } from "./tourSelectorControl";

describe("createTourSelectorControl", () => {
  it("shows a placeholder label before setTitle is called", () => {
    const control = createTourSelectorControl({ onOpen: vi.fn() });
    expect(control.root.textContent).toContain("ツアーを選択");
  });

  it("setTitle() updates the displayed label", () => {
    const control = createTourSelectorControl({ onOpen: vi.fn() });
    control.setTitle("サンプル巡検コース");
    expect(control.root.textContent).toContain("サンプル巡検コース");
  });

  it("calls onOpen when clicked", () => {
    const onOpen = vi.fn();
    const control = createTourSelectorControl({ onOpen });
    control.root.querySelector("button")!.click();
    expect(onOpen).toHaveBeenCalled();
  });
});
