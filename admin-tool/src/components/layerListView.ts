import type { LayerDefinition } from "../../../src/types/config";

export interface LayerListViewCallbacks {
  onAddNew: () => void;
  onEdit: (layer: LayerDefinition) => void;
  onDelete: (id: string) => void;
}

export interface LayerListView {
  root: HTMLElement;
  render(layers: LayerDefinition[]): void;
}

const TYPE_LABEL: Record<LayerDefinition["type"], string> = {
  base: "ベース",
  overlay: "オーバーレイ",
};

export function createLayerListView(callbacks: LayerListViewCallbacks): LayerListView {
  const root = document.createElement("div");
  root.className = "layer-list-view";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "layer-list-view__add";
  addButton.textContent = "＋ 新規レイヤー追加";
  addButton.addEventListener("click", () => callbacks.onAddNew());

  const list = document.createElement("ul");
  list.className = "layer-list-view__list";

  root.append(addButton, list);

  return {
    root,
    render(layers: LayerDefinition[]) {
      list.replaceChildren(
        ...layers.map((layer) => {
          const item = document.createElement("li");
          item.className = "layer-list-view__item";

          const label = document.createElement("span");
          label.className = "layer-list-view__label";
          label.textContent = `${layer.name}（${TYPE_LABEL[layer.type]}）`;

          const editButton = document.createElement("button");
          editButton.type = "button";
          editButton.className = "layer-list-view__edit";
          editButton.textContent = "編集";
          editButton.addEventListener("click", () => callbacks.onEdit(layer));

          const deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.className = "layer-list-view__delete";
          deleteButton.textContent = "削除";
          deleteButton.addEventListener("click", () => callbacks.onDelete(layer.id));

          item.append(label, editButton, deleteButton);
          return item;
        }),
      );
    },
  };
}
