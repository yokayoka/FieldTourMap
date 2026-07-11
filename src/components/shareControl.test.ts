import { describe, expect, it, vi } from "vitest";
import { createShareControl } from "./shareControl";

describe("createShareControl", () => {
  it("renders a share button with hidden feedback initially", () => {
    const control = createShareControl({ onShare: vi.fn() });

    expect(control.root.querySelector(".share-control__button")?.textContent).toBe("共有");
    expect(control.root.querySelector<HTMLElement>(".share-control__feedback")?.hidden).toBe(
      true,
    );
  });

  it("shows the feedback message returned by onShare after clicking", async () => {
    const onShare = vi.fn().mockResolvedValue({ success: true, message: "リンクをコピーしました" });
    const control = createShareControl({ onShare });

    control.root.querySelector<HTMLButtonElement>(".share-control__button")!.click();
    await vi.waitFor(() => {
      expect(
        control.root.querySelector<HTMLElement>(".share-control__feedback")?.hidden,
      ).toBe(false);
    });

    const feedback = control.root.querySelector<HTMLElement>(".share-control__feedback")!;
    expect(feedback.textContent).toBe("リンクをコピーしました");
  });

  it("calls onShare exactly once per click", async () => {
    const onShare = vi.fn().mockResolvedValue({ success: true, message: "共有しました" });
    const control = createShareControl({ onShare });

    control.root.querySelector<HTMLButtonElement>(".share-control__button")!.click();
    await vi.waitFor(() => expect(onShare).toHaveBeenCalledTimes(1));
  });
});
