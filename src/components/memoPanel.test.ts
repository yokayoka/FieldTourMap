import { describe, expect, it, vi } from "vitest";
import { createMemoPanel } from "./memoPanel";
import type { ObservationMemo } from "../types/config";

const sampleMemo: ObservationMemo = {
  id: "memo-1",
  position: { lat: 35.68, lng: 139.76 },
  text: "既存のメモ",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createCallbacks() {
  return {
    onSaveNew: vi.fn(),
    onSaveEdit: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  };
}

describe("createMemoPanel", () => {
  it("is hidden initially", () => {
    const panel = createMemoPanel(createCallbacks());
    expect(panel.root.hidden).toBe(true);
  });

  it("shows an empty textarea and save/cancel buttons for a new memo", () => {
    const panel = createMemoPanel(createCallbacks());

    panel.showCreateForm({ lat: 35.68, lng: 139.76 });

    expect(panel.root.hidden).toBe(false);
    const textarea = panel.root.querySelector<HTMLTextAreaElement>(".memo-panel__textarea");
    expect(textarea?.value).toBe("");
    expect(panel.root.querySelector(".memo-panel__save")).not.toBeNull();
    expect(panel.root.querySelector(".memo-panel__cancel")).not.toBeNull();
  });

  it("calls onSaveNew with the entered text and original position when saved", () => {
    const callbacks = createCallbacks();
    const panel = createMemoPanel(callbacks);
    panel.showCreateForm({ lat: 35.68, lng: 139.76 });

    const textarea = panel.root.querySelector<HTMLTextAreaElement>(".memo-panel__textarea")!;
    textarea.value = "新しい観察メモ";
    textarea.dispatchEvent(new Event("input"));
    panel.root.querySelector<HTMLButtonElement>(".memo-panel__save")!.click();

    expect(callbacks.onSaveNew).toHaveBeenCalledWith("新しい観察メモ", { lat: 35.68, lng: 139.76 });
  });

  it("calls onClose when cancel is clicked while creating", () => {
    const callbacks = createCallbacks();
    const panel = createMemoPanel(callbacks);
    panel.showCreateForm({ lat: 35.68, lng: 139.76 });

    panel.root.querySelector<HTMLButtonElement>(".memo-panel__cancel")!.click();

    expect(callbacks.onClose).toHaveBeenCalled();
  });

  it("shows the memo text with edit/delete/close buttons in view mode", () => {
    const panel = createMemoPanel(createCallbacks());

    panel.showMemo(sampleMemo);

    expect(panel.root.hidden).toBe(false);
    expect(panel.root.querySelector(".memo-panel__text")?.textContent).toBe("既存のメモ");
    expect(panel.root.querySelector(".memo-panel__edit")).not.toBeNull();
    expect(panel.root.querySelector(".memo-panel__delete")).not.toBeNull();
    expect(panel.root.querySelector(".memo-panel__close")).not.toBeNull();
  });

  it("switches to an edit form pre-filled with the memo text", () => {
    const panel = createMemoPanel(createCallbacks());
    panel.showMemo(sampleMemo);

    panel.root.querySelector<HTMLButtonElement>(".memo-panel__edit")!.click();

    const textarea = panel.root.querySelector<HTMLTextAreaElement>(".memo-panel__textarea");
    expect(textarea?.value).toBe("既存のメモ");
  });

  it("calls onSaveEdit with the memo id and new text when the edit form is saved", () => {
    const callbacks = createCallbacks();
    const panel = createMemoPanel(callbacks);
    panel.showMemo(sampleMemo);
    panel.root.querySelector<HTMLButtonElement>(".memo-panel__edit")!.click();

    const textarea = panel.root.querySelector<HTMLTextAreaElement>(".memo-panel__textarea")!;
    textarea.value = "編集後のテキスト";
    textarea.dispatchEvent(new Event("input"));
    panel.root.querySelector<HTMLButtonElement>(".memo-panel__save")!.click();

    expect(callbacks.onSaveEdit).toHaveBeenCalledWith("memo-1", "編集後のテキスト");
  });

  it("calls onDelete with the memo id when delete is clicked", () => {
    const callbacks = createCallbacks();
    const panel = createMemoPanel(callbacks);
    panel.showMemo(sampleMemo);

    panel.root.querySelector<HTMLButtonElement>(".memo-panel__delete")!.click();

    expect(callbacks.onDelete).toHaveBeenCalledWith("memo-1");
  });

  it("calls onClose when close is clicked in view mode", () => {
    const callbacks = createCallbacks();
    const panel = createMemoPanel(callbacks);
    panel.showMemo(sampleMemo);

    panel.root.querySelector<HTMLButtonElement>(".memo-panel__close")!.click();

    expect(callbacks.onClose).toHaveBeenCalled();
  });

  it("hides via hide()", () => {
    const panel = createMemoPanel(createCallbacks());
    panel.showMemo(sampleMemo);

    panel.hide();

    expect(panel.root.hidden).toBe(true);
  });
});
