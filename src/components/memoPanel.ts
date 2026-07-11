import type { LatLng, ObservationMemo } from "../types/config";

export interface MemoPanelCallbacks {
  onSaveNew: (text: string, position: LatLng) => void;
  onSaveEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export interface MemoPanel {
  root: HTMLElement;
  showCreateForm(position: LatLng): void;
  showMemo(memo: ObservationMemo): void;
  hide(): void;
}

export function createMemoPanel(callbacks: MemoPanelCallbacks): MemoPanel {
  const root = document.createElement("div");
  root.className = "memo-panel";
  root.hidden = true;

  function renderForm(initialText: string, onSave: (text: string) => void): void {
    root.replaceChildren();

    const textarea = document.createElement("textarea");
    textarea.className = "memo-panel__textarea";
    textarea.value = initialText;
    textarea.rows = 4;

    const actions = document.createElement("div");
    actions.className = "memo-panel__actions";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "memo-panel__save";
    saveButton.textContent = "保存";
    saveButton.addEventListener("click", () => onSave(textarea.value));

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "memo-panel__cancel";
    cancelButton.textContent = "キャンセル";
    cancelButton.addEventListener("click", () => callbacks.onClose());

    actions.append(saveButton, cancelButton);
    root.append(textarea, actions);
  }

  function renderView(memo: ObservationMemo): void {
    root.replaceChildren();

    const text = document.createElement("p");
    text.className = "memo-panel__text";
    text.textContent = memo.text;

    const actions = document.createElement("div");
    actions.className = "memo-panel__actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "memo-panel__edit";
    editButton.textContent = "編集";
    editButton.addEventListener("click", () => {
      renderForm(memo.text, (newText) => callbacks.onSaveEdit(memo.id, newText));
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "memo-panel__delete";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => callbacks.onDelete(memo.id));

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "memo-panel__close";
    closeButton.textContent = "閉じる";
    closeButton.addEventListener("click", () => callbacks.onClose());

    actions.append(editButton, deleteButton, closeButton);
    root.append(text, actions);
  }

  return {
    root,
    showCreateForm(position: LatLng) {
      renderForm("", (text) => callbacks.onSaveNew(text, position));
      root.hidden = false;
    },
    showMemo(memo: ObservationMemo) {
      renderView(memo);
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
    },
  };
}
