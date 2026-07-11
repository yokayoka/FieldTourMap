export interface SimpleListViewCallbacks<T> {
  onAddNew: () => void;
  onEdit: (item: T) => void;
  onDelete: (id: string) => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  addButtonText: string;
}

export interface SimpleListView<T> {
  root: HTMLElement;
  render(items: T[]): void;
}

/** POI一覧・ルート一覧など、名称+編集/削除ボタンだけの一覧表示で共用する汎用コンポーネント。 */
export function createSimpleListView<T>(callbacks: SimpleListViewCallbacks<T>): SimpleListView<T> {
  const root = document.createElement("div");
  root.className = "simple-list-view";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "simple-list-view__add";
  addButton.textContent = callbacks.addButtonText;
  addButton.addEventListener("click", () => callbacks.onAddNew());

  const list = document.createElement("ul");
  list.className = "simple-list-view__list";

  root.append(addButton, list);

  return {
    root,
    render(items: T[]) {
      list.replaceChildren(
        ...items.map((item) => {
          const li = document.createElement("li");
          li.className = "simple-list-view__item";

          const label = document.createElement("span");
          label.className = "simple-list-view__label";
          label.textContent = callbacks.getLabel(item);

          const editButton = document.createElement("button");
          editButton.type = "button";
          editButton.className = "simple-list-view__edit";
          editButton.textContent = "編集";
          editButton.addEventListener("click", () => callbacks.onEdit(item));

          const deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.className = "simple-list-view__delete";
          deleteButton.textContent = "削除";
          deleteButton.addEventListener("click", () => callbacks.onDelete(callbacks.getId(item)));

          li.append(label, editButton, deleteButton);
          return li;
        }),
      );
    },
  };
}
