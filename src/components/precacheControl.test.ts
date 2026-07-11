import { describe, expect, it, vi } from "vitest";
import { createPrecacheControl } from "./precacheControl";

describe("createPrecacheControl", () => {
  it("renders a button and no progress/error initially", () => {
    const control = createPrecacheControl({ onStart: vi.fn() });

    const button = control.root.querySelector<HTMLButtonElement>(".precache-control__button");
    expect(button?.textContent).toBe("この範囲を事前ダウンロード");
    expect(button?.disabled).toBe(false);
    expect(control.root.querySelector<HTMLElement>(".precache-control__progress")?.hidden).toBe(
      true,
    );
    expect(control.root.querySelector<HTMLElement>(".precache-control__error")?.hidden).toBe(
      true,
    );
  });

  it("calls onStart when the button is clicked", () => {
    const onStart = vi.fn();
    const control = createPrecacheControl({ onStart });

    control.root.querySelector<HTMLButtonElement>(".precache-control__button")!.click();

    expect(onStart).toHaveBeenCalled();
  });

  it("shows in-progress text and disables the button while downloading", () => {
    const control = createPrecacheControl({ onStart: vi.fn() });

    control.setProgress({ completed: 3, total: 10 });

    const button = control.root.querySelector<HTMLButtonElement>(".precache-control__button")!;
    const progress = control.root.querySelector<HTMLElement>(".precache-control__progress")!;
    expect(button.disabled).toBe(true);
    expect(progress.hidden).toBe(false);
    expect(progress.textContent).toContain("3");
    expect(progress.textContent).toContain("10");
  });

  it("shows a completion message and re-enables the button when done", () => {
    const control = createPrecacheControl({ onStart: vi.fn() });

    control.setProgress({ completed: 10, total: 10 });

    const button = control.root.querySelector<HTMLButtonElement>(".precache-control__button")!;
    const progress = control.root.querySelector<HTMLElement>(".precache-control__progress")!;
    expect(button.disabled).toBe(false);
    expect(progress.hidden).toBe(false);
    expect(progress.textContent).toContain("10");
  });

  it("hides progress and re-enables the button when set to null", () => {
    const control = createPrecacheControl({ onStart: vi.fn() });

    control.setProgress({ completed: 3, total: 10 });
    control.setProgress(null);

    const button = control.root.querySelector<HTMLButtonElement>(".precache-control__button")!;
    const progress = control.root.querySelector<HTMLElement>(".precache-control__progress")!;
    expect(button.disabled).toBe(false);
    expect(progress.hidden).toBe(true);
  });

  it("shows and clears an error message", () => {
    const control = createPrecacheControl({ onStart: vi.fn() });
    const errorEl = control.root.querySelector<HTMLElement>(".precache-control__error")!;

    control.setError("タイルの取得に失敗しました");
    expect(errorEl.hidden).toBe(false);
    expect(errorEl.textContent).toBe("タイルの取得に失敗しました");

    control.setError(null);
    expect(errorEl.hidden).toBe(true);
  });
});
