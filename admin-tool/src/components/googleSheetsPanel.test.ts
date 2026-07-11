import { describe, expect, it, vi } from "vitest";
import { createGoogleSheetsPanel } from "./googleSheetsPanel";

function createCallbacks() {
  return {
    onClientIdChange: vi.fn(),
    onSpreadsheetIdChange: vi.fn(),
    onAuthorize: vi.fn(),
    onSave: vi.fn(),
    onLoad: vi.fn(),
  };
}

describe("createGoogleSheetsPanel", () => {
  it("prefills the client id / spreadsheet id fields from the given initial values", () => {
    const panel = createGoogleSheetsPanel(
      { clientId: "client-123", spreadsheetId: "sheet-abc" },
      createCallbacks(),
    );

    const clientIdInput = panel.root.querySelector<HTMLInputElement>(
      ".google-sheets-panel__client-id",
    )!;
    const spreadsheetIdInput = panel.root.querySelector<HTMLInputElement>(
      ".google-sheets-panel__spreadsheet-id",
    )!;

    expect(clientIdInput.value).toBe("client-123");
    expect(spreadsheetIdInput.value).toBe("sheet-abc");
  });

  it("calls onClientIdChange / onSpreadsheetIdChange as the fields are edited", () => {
    const callbacks = createCallbacks();
    const panel = createGoogleSheetsPanel({ clientId: "", spreadsheetId: "" }, callbacks);

    const clientIdInput = panel.root.querySelector<HTMLInputElement>(
      ".google-sheets-panel__client-id",
    )!;
    clientIdInput.value = "new-client-id";
    clientIdInput.dispatchEvent(new Event("input"));

    const spreadsheetIdInput = panel.root.querySelector<HTMLInputElement>(
      ".google-sheets-panel__spreadsheet-id",
    )!;
    spreadsheetIdInput.value = "new-sheet-id";
    spreadsheetIdInput.dispatchEvent(new Event("input"));

    expect(callbacks.onClientIdChange).toHaveBeenCalledWith("new-client-id");
    expect(callbacks.onSpreadsheetIdChange).toHaveBeenCalledWith("new-sheet-id");
  });

  it("calls onAuthorize when the login button is clicked", () => {
    const callbacks = createCallbacks();
    const panel = createGoogleSheetsPanel({ clientId: "", spreadsheetId: "" }, callbacks);

    panel.root.querySelector<HTMLButtonElement>(".google-sheets-panel__authorize")!.click();

    expect(callbacks.onAuthorize).toHaveBeenCalled();
  });

  it("disables save/load buttons until setAuthorized(true) is called", () => {
    const panel = createGoogleSheetsPanel({ clientId: "", spreadsheetId: "" }, createCallbacks());

    const saveButton = panel.root.querySelector<HTMLButtonElement>(".google-sheets-panel__save")!;
    const loadButton = panel.root.querySelector<HTMLButtonElement>(".google-sheets-panel__load")!;
    expect(saveButton.disabled).toBe(true);
    expect(loadButton.disabled).toBe(true);

    panel.setAuthorized(true);
    expect(saveButton.disabled).toBe(false);
    expect(loadButton.disabled).toBe(false);

    panel.setAuthorized(false);
    expect(saveButton.disabled).toBe(true);
    expect(loadButton.disabled).toBe(true);
  });

  it("calls onSave/onLoad when their buttons are clicked after authorization", () => {
    const callbacks = createCallbacks();
    const panel = createGoogleSheetsPanel({ clientId: "", spreadsheetId: "" }, callbacks);
    panel.setAuthorized(true);

    panel.root.querySelector<HTMLButtonElement>(".google-sheets-panel__save")!.click();
    panel.root.querySelector<HTMLButtonElement>(".google-sheets-panel__load")!.click();

    expect(callbacks.onSave).toHaveBeenCalled();
    expect(callbacks.onLoad).toHaveBeenCalled();
  });

  it("displays a status message, distinguishing error state", () => {
    const panel = createGoogleSheetsPanel({ clientId: "", spreadsheetId: "" }, createCallbacks());
    const status = panel.root.querySelector<HTMLElement>(".google-sheets-panel__status")!;

    panel.setStatus("保存しました", false);
    expect(status.textContent).toBe("保存しました");
    expect(status.classList.contains("google-sheets-panel__status--error")).toBe(false);

    panel.setStatus("失敗しました", true);
    expect(status.textContent).toBe("失敗しました");
    expect(status.classList.contains("google-sheets-panel__status--error")).toBe(true);
  });
});
