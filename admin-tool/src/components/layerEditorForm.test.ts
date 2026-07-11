import { describe, expect, it, vi } from "vitest";
import { createLayerEditorForm } from "./layerEditorForm";
import type { LayerDefinition } from "../../../src/types/config";

const sampleLayer: LayerDefinition = {
  id: "gsi-std",
  name: "地理院地図（標準地図）",
  type: "base",
  urlTemplate: "https://example.com/{z}/{x}/{y}.png",
  attribution: "国土地理院",
  opacity: 0.8,
  minZoom: 2,
  maxZoom: 18,
  defaultVisible: true,
};

function fill(root: HTMLElement, selector: string, value: string): void {
  const el = root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    selector,
  )!;
  el.value = value;
  el.dispatchEvent(new Event("input"));
  el.dispatchEvent(new Event("change"));
}

describe("createLayerEditorForm", () => {
  it("shows an empty form for a new layer", () => {
    const form = createLayerEditorForm({ onSave: vi.fn(), onCancel: vi.fn() });

    form.showNew();

    expect(form.root.hidden).toBe(false);
    expect(form.root.querySelector<HTMLInputElement>('[name="id"]')?.value).toBe("");
    expect(form.root.querySelector<HTMLInputElement>('[name="id"]')?.disabled).toBe(false);
  });

  it("saves a well-formed new layer with correctly typed field values", () => {
    const onSave = vi.fn();
    const form = createLayerEditorForm({ onSave, onCancel: vi.fn() });
    form.showNew();

    fill(form.root, '[name="id"]', "osm");
    fill(form.root, '[name="name"]', "OpenStreetMap");
    fill(form.root, '[name="type"]', "base");
    fill(form.root, '[name="urlTemplate"]', "https://tile.osm.org/{z}/{x}/{y}.png");
    fill(form.root, '[name="attribution"]', "OSM contributors");
    fill(form.root, '[name="opacity"]', "1");
    fill(form.root, '[name="minZoom"]', "0");
    fill(form.root, '[name="maxZoom"]', "19");

    form.root.querySelector<HTMLButtonElement>(".layer-editor-form__save")!.click();

    expect(onSave).toHaveBeenCalledWith({
      id: "osm",
      name: "OpenStreetMap",
      type: "base",
      urlTemplate: "https://tile.osm.org/{z}/{x}/{y}.png",
      attribution: "OSM contributors",
      opacity: 1,
      minZoom: 0,
      maxZoom: 19,
      defaultVisible: false,
    });
  });

  it("does not call onSave and shows errors when the tile URL is missing a placeholder", () => {
    const onSave = vi.fn();
    const form = createLayerEditorForm({ onSave, onCancel: vi.fn() });
    form.showNew();

    fill(form.root, '[name="id"]', "osm");
    fill(form.root, '[name="name"]', "OpenStreetMap");
    fill(form.root, '[name="urlTemplate"]', "https://tile.osm.org/{z}/{x}.png");
    fill(form.root, '[name="attribution"]', "OSM contributors");
    fill(form.root, '[name="opacity"]', "1");
    fill(form.root, '[name="minZoom"]', "0");
    fill(form.root, '[name="maxZoom"]', "19");

    form.root.querySelector<HTMLButtonElement>(".layer-editor-form__save")!.click();

    expect(onSave).not.toHaveBeenCalled();
    const errors = form.root.querySelector(".layer-editor-form__errors");
    expect(errors?.textContent).toContain("{y}");
  });

  it("shows validation errors live as fields are edited, before saving", () => {
    const form = createLayerEditorForm({ onSave: vi.fn(), onCancel: vi.fn() });
    form.showNew();

    fill(form.root, '[name="urlTemplate"]', "not-a-valid-template");

    const errors = form.root.querySelector(".layer-editor-form__errors");
    expect(errors?.textContent).not.toBe("");
  });

  it("pre-fills all fields when editing an existing layer, with id disabled", () => {
    const form = createLayerEditorForm({ onSave: vi.fn(), onCancel: vi.fn() });

    form.showEdit(sampleLayer);

    expect(form.root.querySelector<HTMLInputElement>('[name="id"]')?.value).toBe("gsi-std");
    expect(form.root.querySelector<HTMLInputElement>('[name="id"]')?.disabled).toBe(true);
    expect(form.root.querySelector<HTMLInputElement>('[name="name"]')?.value).toBe(
      "地理院地図（標準地図）",
    );
    expect(form.root.querySelector<HTMLInputElement>('[name="opacity"]')?.value).toBe("0.8");
    expect(form.root.querySelector<HTMLInputElement>('[name="defaultVisible"]')?.checked).toBe(
      true,
    );
  });

  it("saves edits to an existing layer keeping its id", () => {
    const onSave = vi.fn();
    const form = createLayerEditorForm({ onSave, onCancel: vi.fn() });
    form.showEdit(sampleLayer);

    fill(form.root, '[name="name"]', "地理院地図（更新後）");
    form.root.querySelector<HTMLButtonElement>(".layer-editor-form__save")!.click();

    expect(onSave).toHaveBeenCalledWith({ ...sampleLayer, name: "地理院地図（更新後）" });
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    const form = createLayerEditorForm({ onSave: vi.fn(), onCancel });
    form.showNew();

    form.root.querySelector<HTMLButtonElement>(".layer-editor-form__cancel")!.click();

    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onPreview with the current (possibly unsaved) field values when the preview button is clicked", () => {
    const onPreview = vi.fn();
    const form = createLayerEditorForm({ onSave: vi.fn(), onCancel: vi.fn(), onPreview });
    form.showNew();

    fill(form.root, '[name="id"]', "osm");
    fill(form.root, '[name="name"]', "OpenStreetMap");
    fill(form.root, '[name="urlTemplate"]', "https://tile.osm.org/{z}/{x}/{y}.png");
    fill(form.root, '[name="attribution"]', "OSM contributors");
    fill(form.root, '[name="opacity"]', "0.5");
    fill(form.root, '[name="minZoom"]', "0");
    fill(form.root, '[name="maxZoom"]', "19");

    form.root.querySelector<HTMLButtonElement>(".layer-editor-form__preview")!.click();

    expect(onPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        urlTemplate: "https://tile.osm.org/{z}/{x}/{y}.png",
        opacity: 0.5,
      }),
    );
  });
});
