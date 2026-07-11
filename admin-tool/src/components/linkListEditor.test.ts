import { describe, expect, it } from "vitest";
import { createLinkListEditor } from "./linkListEditor";

describe("createLinkListEditor", () => {
  it("starts with no rows", () => {
    const editor = createLinkListEditor({ labelText: "引用" });
    expect(editor.getItems()).toEqual([]);
    expect(editor.root.querySelectorAll(".link-list-editor__row")).toHaveLength(0);
  });

  it("renders a row per item when items are set", () => {
    const editor = createLinkListEditor({ labelText: "引用" });

    editor.setItems([{ url: "https://a.example", label: "文献A" }]);

    const row = editor.root.querySelector(".link-list-editor__row")!;
    expect(row.querySelector<HTMLInputElement>(".link-list-editor__url")?.value).toBe(
      "https://a.example",
    );
    expect(row.querySelector<HTMLInputElement>(".link-list-editor__label")?.value).toBe("文献A");
  });

  it("adds an empty row when the add button is clicked", () => {
    const editor = createLinkListEditor({ labelText: "引用" });

    editor.root.querySelector<HTMLButtonElement>(".link-list-editor__add")!.click();

    expect(editor.getItems()).toEqual([{ url: "", label: "", extra: undefined }]);
  });

  it("reflects edits to the url and label inputs in getItems()", () => {
    const editor = createLinkListEditor({ labelText: "引用" });
    editor.setItems([{ url: "", label: "" }]);

    const row = editor.root.querySelector(".link-list-editor__row")!;
    const urlInput = row.querySelector<HTMLInputElement>(".link-list-editor__url")!;
    const labelInput = row.querySelector<HTMLInputElement>(".link-list-editor__label")!;
    urlInput.value = "https://b.example";
    urlInput.dispatchEvent(new Event("input"));
    labelInput.value = "文献B";
    labelInput.dispatchEvent(new Event("input"));

    expect(editor.getItems()).toEqual([{ url: "https://b.example", label: "文献B" }]);
  });

  it("removes a row when its remove button is clicked", () => {
    const editor = createLinkListEditor({ labelText: "引用" });
    editor.setItems([
      { url: "https://a.example", label: "A" },
      { url: "https://b.example", label: "B" },
    ]);

    editor.root.querySelectorAll<HTMLButtonElement>(".link-list-editor__remove")[0].click();

    expect(editor.getItems()).toEqual([{ url: "https://b.example", label: "B" }]);
  });

  it("renders and updates an extra select field when configured (e.g. media type)", () => {
    const editor = createLinkListEditor({
      labelText: "キャプション",
      showExtraSelect: true,
      extraOptions: [
        { value: "photo", label: "写真" },
        { value: "video", label: "動画" },
      ],
    });
    editor.setItems([{ url: "https://a.example", label: "写真A", extra: "photo" }]);

    const select = editor.root.querySelector<HTMLSelectElement>(".link-list-editor__extra")!;
    expect(select.value).toBe("photo");

    select.value = "video";
    select.dispatchEvent(new Event("change"));

    expect(editor.getItems()).toEqual([{ url: "https://a.example", label: "写真A", extra: "video" }]);
  });
});
