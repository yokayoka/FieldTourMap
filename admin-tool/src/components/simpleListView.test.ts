import { describe, expect, it, vi } from "vitest";
import { createSimpleListView } from "./simpleListView";

interface Item {
  id: string;
  name: string;
}

const itemA: Item = { id: "a", name: "アイテムA" };
const itemB: Item = { id: "b", name: "アイテムB" };

function createCallbacks() {
  return {
    onAddNew: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    getId: (item: Item) => item.id,
    getLabel: (item: Item) => item.name,
    addButtonText: "＋ 追加",
  };
}

describe("createSimpleListView", () => {
  it("renders the add button with the given text and no items initially", () => {
    const view = createSimpleListView<Item>(createCallbacks());
    view.render([]);

    expect(view.root.querySelector(".simple-list-view__add")?.textContent).toBe("＋ 追加");
    expect(view.root.querySelectorAll(".simple-list-view__item")).toHaveLength(0);
  });

  it("renders one item per entry with its label", () => {
    const view = createSimpleListView<Item>(createCallbacks());
    view.render([itemA, itemB]);

    const items = view.root.querySelectorAll(".simple-list-view__item");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("アイテムA");
    expect(items[1].textContent).toContain("アイテムB");
  });

  it("calls onAddNew when the add button is clicked", () => {
    const callbacks = createCallbacks();
    const view = createSimpleListView<Item>(callbacks);
    view.render([]);

    view.root.querySelector<HTMLButtonElement>(".simple-list-view__add")!.click();

    expect(callbacks.onAddNew).toHaveBeenCalled();
  });

  it("calls onEdit with the item when its edit button is clicked", () => {
    const callbacks = createCallbacks();
    const view = createSimpleListView<Item>(callbacks);
    view.render([itemA, itemB]);

    view.root.querySelectorAll<HTMLButtonElement>(".simple-list-view__edit")[1].click();

    expect(callbacks.onEdit).toHaveBeenCalledWith(itemB);
  });

  it("calls onDelete with the item id when its delete button is clicked", () => {
    const callbacks = createCallbacks();
    const view = createSimpleListView<Item>(callbacks);
    view.render([itemA, itemB]);

    view.root.querySelectorAll<HTMLButtonElement>(".simple-list-view__delete")[0].click();

    expect(callbacks.onDelete).toHaveBeenCalledWith("a");
  });
});
