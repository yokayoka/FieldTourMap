export interface GoogleSheetsPanelInitial {
  clientId: string;
  spreadsheetId: string;
}

export interface GoogleSheetsPanelCallbacks {
  onClientIdChange: (clientId: string) => void;
  onSpreadsheetIdChange: (spreadsheetId: string) => void;
  onAuthorize: () => void;
  onSave: () => void;
  onLoad: () => void;
}

export interface GoogleSheetsPanel {
  root: HTMLElement;
  setAuthorized(authorized: boolean): void;
  setStatus(message: string, isError: boolean): void;
}

/**
 * Admin Config Toolのレイヤー編集・ツアー編集の両ページで共用する、
 * Googleスプレッドシート連携UI（Requirement 15）。OAuthクライアントID・
 * スプレッドシートIDの入力、ログイン、保存/読み込みボタンを提供する。
 * 実際のOAuth・Sheets API呼び出しは呼び出し側（各ページのmain.ts）が
 * GoogleSheetsProjectServiceを介して行う。
 */
export function createGoogleSheetsPanel(
  initial: GoogleSheetsPanelInitial,
  callbacks: GoogleSheetsPanelCallbacks,
): GoogleSheetsPanel {
  const root = document.createElement("div");
  root.className = "google-sheets-panel";

  const heading = document.createElement("h2");
  heading.textContent = "Googleスプレッドシート連携";
  root.appendChild(heading);

  const clientIdLabel = document.createElement("label");
  clientIdLabel.className = "google-sheets-panel__field";
  clientIdLabel.append("OAuthクライアントID");
  const clientIdInput = document.createElement("input");
  clientIdInput.type = "text";
  clientIdInput.className = "google-sheets-panel__client-id";
  clientIdInput.value = initial.clientId;
  clientIdInput.addEventListener("input", () => callbacks.onClientIdChange(clientIdInput.value));
  clientIdLabel.appendChild(clientIdInput);
  root.appendChild(clientIdLabel);

  const spreadsheetIdLabel = document.createElement("label");
  spreadsheetIdLabel.className = "google-sheets-panel__field";
  spreadsheetIdLabel.append("スプレッドシートID");
  const spreadsheetIdInput = document.createElement("input");
  spreadsheetIdInput.type = "text";
  spreadsheetIdInput.className = "google-sheets-panel__spreadsheet-id";
  spreadsheetIdInput.value = initial.spreadsheetId;
  spreadsheetIdInput.addEventListener("input", () =>
    callbacks.onSpreadsheetIdChange(spreadsheetIdInput.value),
  );
  spreadsheetIdLabel.appendChild(spreadsheetIdInput);
  root.appendChild(spreadsheetIdLabel);

  const actions = document.createElement("div");
  actions.className = "google-sheets-panel__actions";

  const authorizeButton = document.createElement("button");
  authorizeButton.type = "button";
  authorizeButton.className = "google-sheets-panel__authorize";
  authorizeButton.textContent = "Googleでログイン";
  authorizeButton.addEventListener("click", () => callbacks.onAuthorize());

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "google-sheets-panel__save";
  saveButton.textContent = "スプレッドシートに保存";
  saveButton.disabled = true;
  saveButton.addEventListener("click", () => callbacks.onSave());

  const loadButton = document.createElement("button");
  loadButton.type = "button";
  loadButton.className = "google-sheets-panel__load";
  loadButton.textContent = "スプレッドシートから読み込む";
  loadButton.disabled = true;
  loadButton.addEventListener("click", () => callbacks.onLoad());

  actions.append(authorizeButton, saveButton, loadButton);
  root.appendChild(actions);

  const status = document.createElement("p");
  status.className = "google-sheets-panel__status";
  status.setAttribute("role", "status");
  root.appendChild(status);

  return {
    root,
    setAuthorized(authorized: boolean) {
      saveButton.disabled = !authorized;
      loadButton.disabled = !authorized;
    },
    setStatus(message: string, isError: boolean) {
      status.textContent = message;
      status.classList.toggle("google-sheets-panel__status--error", isError);
    },
  };
}
