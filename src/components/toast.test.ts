import { describe, expect, it, vi } from "vitest";
import { showToast } from "./toast";

describe("showToast", () => {
  it("appends a toast element with the given message to the root", () => {
    const root = document.createElement("div");

    showToast(root, "リンクをコピーしました");

    const toast = root.querySelector(".toast");
    expect(toast?.textContent).toBe("リンクをコピーしました");
    expect(toast?.getAttribute("role")).toBe("status");
  });

  it("removes the toast automatically after the given duration", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");

    showToast(root, "メッセージ", 1000);
    expect(root.querySelector(".toast")).not.toBeNull();

    vi.advanceTimersByTime(1000);
    expect(root.querySelector(".toast")).toBeNull();

    vi.useRealTimers();
  });

  it("does not remove a newer toast when an older toast's timer fires", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");

    showToast(root, "1件目", 1000);
    vi.advanceTimersByTime(500);
    showToast(root, "2件目", 1000);
    vi.advanceTimersByTime(500);

    // 1件目のタイマーが発火するタイミングだが、2件目はまだ残っているはず。
    const toasts = root.querySelectorAll(".toast");
    expect(Array.from(toasts).some((t) => t.textContent === "2件目")).toBe(true);

    vi.useRealTimers();
  });
});
