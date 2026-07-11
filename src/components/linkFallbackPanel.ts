export interface LinkFallbackPanelCallbacks {
  onClose: () => void;
}

export interface LinkFallbackPanel {
  root: HTMLElement;
  show(url: string): void;
  hide(): void;
}

/**
 * クリップボードAPIが利用できない環境向けに、リンク文字列を選択して
 * 手動でコピーできる代替UI（Requirement 14.6）。
 */
export function createLinkFallbackPanel(callbacks: LinkFallbackPanelCallbacks): LinkFallbackPanel {
  const root = document.createElement("div");
  root.className = "link-fallback-panel";
  root.hidden = true;

  const message = document.createElement("p");
  message.textContent = "自動コピーができませんでした。下のリンクを選択して手動でコピーしてください。";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "link-fallback-panel__input";
  input.readOnly = true;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "link-fallback-panel__close";
  closeButton.textContent = "閉じる";
  closeButton.addEventListener("click", () => {
    root.hidden = true;
    callbacks.onClose();
  });

  root.append(message, input, closeButton);

  return {
    root,
    show(url: string) {
      input.value = url;
      root.hidden = false;
      input.focus();
      input.select();
    },
    hide() {
      root.hidden = true;
    },
  };
}
