export interface LinkListItem {
  url: string;
  label: string;
  extra?: string;
}

export interface LinkListEditorOptions {
  labelText: string;
  showExtraSelect?: boolean;
  extraOptions?: { value: string; label: string }[];
}

export interface LinkListEditor {
  root: HTMLElement;
  getItems(): LinkListItem[];
  setItems(items: LinkListItem[]): void;
}

/**
 * URL + 短いテキスト（キャプション/引用）の行を追加・編集・削除できる
 * 汎用リストエディタ。メディアリンク（写真/動画、Requirement 4.1）と
 * 参考論文リンク（Requirement 4.2）の両方で共用する。
 */
export function createLinkListEditor(options: LinkListEditorOptions): LinkListEditor {
  const root = document.createElement("div");
  root.className = "link-list-editor";

  const rows = document.createElement("div");
  rows.className = "link-list-editor__rows";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "link-list-editor__add";
  addButton.textContent = "＋ 追加";

  let items: LinkListItem[] = [];

  function render(): void {
    rows.replaceChildren(
      ...items.map((item, index) => {
        const row = document.createElement("div");
        row.className = "link-list-editor__row";

        const urlInput = document.createElement("input");
        urlInput.type = "text";
        urlInput.className = "link-list-editor__url";
        urlInput.placeholder = "URL";
        urlInput.value = item.url;
        urlInput.addEventListener("input", () => {
          items = items.map((it, i) => (i === index ? { ...it, url: urlInput.value } : it));
        });

        const labelInput = document.createElement("input");
        labelInput.type = "text";
        labelInput.className = "link-list-editor__label";
        labelInput.placeholder = options.labelText;
        labelInput.value = item.label;
        labelInput.addEventListener("input", () => {
          items = items.map((it, i) => (i === index ? { ...it, label: labelInput.value } : it));
        });

        row.append(urlInput, labelInput);

        if (options.showExtraSelect) {
          const select = document.createElement("select");
          select.className = "link-list-editor__extra";
          (options.extraOptions ?? []).forEach(({ value, label }) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
          });
          select.value = item.extra ?? options.extraOptions?.[0]?.value ?? "";
          select.addEventListener("change", () => {
            items = items.map((it, i) => (i === index ? { ...it, extra: select.value } : it));
          });
          row.appendChild(select);
        }

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "link-list-editor__remove";
        removeButton.textContent = "削除";
        removeButton.addEventListener("click", () => {
          items = items.filter((_, i) => i !== index);
          render();
        });
        row.appendChild(removeButton);

        return row;
      }),
    );
  }

  addButton.addEventListener("click", () => {
    items = [...items, { url: "", label: "", extra: options.extraOptions?.[0]?.value }];
    render();
  });

  root.append(rows, addButton);

  return {
    root,
    getItems() {
      return items;
    },
    setItems(newItems: LinkListItem[]) {
      items = [...newItems];
      render();
    },
  };
}
