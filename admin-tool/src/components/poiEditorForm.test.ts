import { describe, expect, it, vi } from "vitest";
import { createPoiEditorForm } from "./poiEditorForm";
import type { PointOfInterest } from "../../../src/types/config";

const samplePoi: PointOfInterest = {
  id: "poi-1",
  name: "露頭A",
  description: "花崗岩の貫入部",
  position: { lat: 35.68, lng: 139.76 },
  media: [{ url: "https://drive.example/1", caption: "写真1", type: "photo" }],
  referencePapers: [{ url: "https://doi.example/1", citation: "山田 (2020)" }],
};

function fill(root: HTMLElement, selector: string, value: string): void {
  const el = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  el.value = value;
  el.dispatchEvent(new Event("input"));
}

describe("createPoiEditorForm", () => {
  it("shows empty fields for a new POI at the given position", () => {
    const form = createPoiEditorForm({
      onSave: vi.fn(),
      onCancel: vi.fn(),
      generateId: () => "generated-id",
    });

    form.showNew({ lat: 35.68, lng: 139.76 });

    expect(form.root.hidden).toBe(false);
    expect(form.root.querySelector<HTMLInputElement>('[name="name"]')?.value).toBe("");
    expect(form.root.querySelectorAll(".link-list-editor__row")).toHaveLength(0);
  });

  it("saves a new POI with a generated id, the given position, and entered text", () => {
    const onSave = vi.fn();
    const form = createPoiEditorForm({ onSave, onCancel: vi.fn(), generateId: () => "generated-id" });
    form.showNew({ lat: 35.68, lng: 139.76 });

    fill(form.root, '[name="name"]', "新しい露頭");
    fill(form.root, '[name="description"]', "説明文");
    form.root.querySelector<HTMLButtonElement>(".poi-editor-form__save")!.click();

    expect(onSave).toHaveBeenCalledWith({
      id: "generated-id",
      name: "新しい露頭",
      description: "説明文",
      position: { lat: 35.68, lng: 139.76 },
      media: [],
      referencePapers: [],
    });
  });

  it("includes added media links and reference papers when saving", () => {
    const onSave = vi.fn();
    const form = createPoiEditorForm({ onSave, onCancel: vi.fn(), generateId: () => "generated-id" });
    form.showNew({ lat: 0, lng: 0 });

    fill(form.root, '[name="name"]', "露頭X");
    fill(form.root, '[name="description"]', "説明");

    form.root.querySelector<HTMLButtonElement>(".poi-editor-form__media-add")!.click();
    const mediaRow = form.root.querySelector(".poi-editor-form__media .link-list-editor__row")!;
    fill(mediaRow as HTMLElement, ".link-list-editor__url", "https://drive.example/x");
    fill(mediaRow as HTMLElement, ".link-list-editor__label", "写真X");

    form.root.querySelector<HTMLButtonElement>(".poi-editor-form__paper-add")!.click();
    const paperRow = form.root.querySelector(".poi-editor-form__papers .link-list-editor__row")!;
    fill(paperRow as HTMLElement, ".link-list-editor__url", "https://doi.example/x");
    fill(paperRow as HTMLElement, ".link-list-editor__label", "引用X");

    form.root.querySelector<HTMLButtonElement>(".poi-editor-form__save")!.click();

    const saved = onSave.mock.calls[0][0] as PointOfInterest;
    expect(saved.media).toEqual([
      { url: "https://drive.example/x", caption: "写真X", type: "photo" },
    ]);
    expect(saved.referencePapers).toEqual([
      { url: "https://doi.example/x", citation: "引用X" },
    ]);
  });

  it("pre-fills all fields including media/papers when editing an existing POI", () => {
    const form = createPoiEditorForm({ onSave: vi.fn(), onCancel: vi.fn() });

    form.showEdit(samplePoi);

    expect(form.root.querySelector<HTMLInputElement>('[name="name"]')?.value).toBe("露頭A");
    expect(
      form.root.querySelector<HTMLTextAreaElement>('[name="description"]')?.value,
    ).toBe("花崗岩の貫入部");
    expect(form.root.querySelectorAll(".poi-editor-form__media .link-list-editor__row")).toHaveLength(
      1,
    );
    expect(
      form.root.querySelectorAll(".poi-editor-form__papers .link-list-editor__row"),
    ).toHaveLength(1);
  });

  it("keeps the same id and position when saving edits to an existing POI", () => {
    const onSave = vi.fn();
    const form = createPoiEditorForm({ onSave, onCancel: vi.fn() });
    form.showEdit(samplePoi);

    fill(form.root, '[name="name"]', "露頭A（更新）");
    form.root.querySelector<HTMLButtonElement>(".poi-editor-form__save")!.click();

    expect(onSave).toHaveBeenCalledWith({ ...samplePoi, name: "露頭A（更新）" });
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    const form = createPoiEditorForm({ onSave: vi.fn(), onCancel });
    form.showNew({ lat: 0, lng: 0 });

    form.root.querySelector<HTMLButtonElement>(".poi-editor-form__cancel")!.click();

    expect(onCancel).toHaveBeenCalled();
  });
});
