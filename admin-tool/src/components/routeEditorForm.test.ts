import { describe, expect, it, vi } from "vitest";
import { createRouteEditorForm } from "./routeEditorForm";
import type { RoutePath } from "../../../src/types/config";

const samplePoints = [
  { lat: 35.68, lng: 139.76 },
  { lat: 35.681, lng: 139.761 },
  { lat: 35.682, lng: 139.762 },
];

describe("createRouteEditorForm", () => {
  it("shows an empty name field and the point count for a new route", () => {
    const form = createRouteEditorForm({
      onSave: vi.fn(),
      onCancel: vi.fn(),
      generateId: () => "generated-id",
    });

    form.showNew(samplePoints);

    expect(form.root.hidden).toBe(false);
    expect(form.root.querySelector<HTMLInputElement>('[name="name"]')?.value).toBe("");
    expect(form.root.querySelector(".route-editor-form__point-count")?.textContent).toContain("3");
  });

  it("saves a new route with a generated id and the given points", () => {
    const onSave = vi.fn();
    const form = createRouteEditorForm({
      onSave,
      onCancel: vi.fn(),
      generateId: () => "generated-id",
    });
    form.showNew(samplePoints);

    const nameInput = form.root.querySelector<HTMLInputElement>('[name="name"]')!;
    nameInput.value = "駐車場〜露頭ルート";
    nameInput.dispatchEvent(new Event("input"));
    form.root.querySelector<HTMLButtonElement>(".route-editor-form__save")!.click();

    expect(onSave).toHaveBeenCalledWith({
      id: "generated-id",
      name: "駐車場〜露頭ルート",
      points: samplePoints,
    });
  });

  it("pre-fills the name and point count when editing an existing route", () => {
    const route: RoutePath = { id: "route-1", name: "既存ルート", points: samplePoints };
    const form = createRouteEditorForm({ onSave: vi.fn(), onCancel: vi.fn() });

    form.showEdit(route);

    expect(form.root.querySelector<HTMLInputElement>('[name="name"]')?.value).toBe("既存ルート");
    expect(form.root.querySelector(".route-editor-form__point-count")?.textContent).toContain("3");
  });

  it("keeps the same id and points when saving edits to an existing route", () => {
    const route: RoutePath = { id: "route-1", name: "既存ルート", points: samplePoints };
    const onSave = vi.fn();
    const form = createRouteEditorForm({ onSave, onCancel: vi.fn() });
    form.showEdit(route);

    const nameInput = form.root.querySelector<HTMLInputElement>('[name="name"]')!;
    nameInput.value = "更新後のルート名";
    nameInput.dispatchEvent(new Event("input"));
    form.root.querySelector<HTMLButtonElement>(".route-editor-form__save")!.click();

    expect(onSave).toHaveBeenCalledWith({ ...route, name: "更新後のルート名" });
  });

  it("calls onCancel when the cancel button is clicked", () => {
    const onCancel = vi.fn();
    const form = createRouteEditorForm({ onSave: vi.fn(), onCancel });
    form.showNew(samplePoints);

    form.root.querySelector<HTMLButtonElement>(".route-editor-form__cancel")!.click();

    expect(onCancel).toHaveBeenCalled();
  });
});
