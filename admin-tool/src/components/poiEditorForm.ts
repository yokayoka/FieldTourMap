import type { LatLng, MediaType, PointOfInterest } from "../../../src/types/config";
import { createLinkListEditor, type LinkListItem } from "./linkListEditor";

export interface PoiEditorFormCallbacks {
  onSave: (poi: PointOfInterest) => void;
  onCancel: () => void;
  generateId?: () => string;
}

export interface PoiEditorForm {
  root: HTMLElement;
  showNew(position: LatLng): void;
  showEdit(poi: PointOfInterest): void;
}

function defaultGenerateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `poi-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createPoiEditorForm(callbacks: PoiEditorFormCallbacks): PoiEditorForm {
  const generateId = callbacks.generateId ?? defaultGenerateId;

  const root = document.createElement("form");
  root.className = "poi-editor-form";
  root.hidden = true;

  let currentId = "";
  let currentPosition: LatLng = { lat: 0, lng: 0 };

  const nameLabel = document.createElement("label");
  nameLabel.className = "poi-editor-form__field";
  nameLabel.append("名称");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.name = "name";
  nameLabel.appendChild(nameInput);

  const descriptionLabel = document.createElement("label");
  descriptionLabel.className = "poi-editor-form__field";
  descriptionLabel.append("説明文");
  const descriptionInput = document.createElement("textarea");
  descriptionInput.name = "description";
  descriptionLabel.appendChild(descriptionInput);

  const mediaSection = document.createElement("div");
  mediaSection.className = "poi-editor-form__media";
  const mediaHeading = document.createElement("h3");
  mediaHeading.textContent = "メディア（写真・動画）";
  const mediaEditor = createLinkListEditor({
    labelText: "キャプション",
    showExtraSelect: true,
    extraOptions: [
      { value: "photo", label: "写真" },
      { value: "video", label: "動画" },
    ],
  });
  mediaEditor.root.querySelector<HTMLButtonElement>(".link-list-editor__add")!.className +=
    " poi-editor-form__media-add";
  mediaSection.append(mediaHeading, mediaEditor.root);

  const paperSection = document.createElement("div");
  paperSection.className = "poi-editor-form__papers";
  const paperHeading = document.createElement("h3");
  paperHeading.textContent = "参考文献";
  const paperEditor = createLinkListEditor({ labelText: "引用" });
  paperEditor.root.querySelector<HTMLButtonElement>(".link-list-editor__add")!.className +=
    " poi-editor-form__paper-add";
  paperSection.append(paperHeading, paperEditor.root);

  const actions = document.createElement("div");
  actions.className = "poi-editor-form__actions";
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "poi-editor-form__save";
  saveButton.textContent = "保存";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "poi-editor-form__cancel";
  cancelButton.textContent = "キャンセル";
  cancelButton.addEventListener("click", () => callbacks.onCancel());
  actions.append(saveButton, cancelButton);

  root.append(nameLabel, descriptionLabel, mediaSection, paperSection, actions);

  function toMediaLinks(items: LinkListItem[]): PointOfInterest["media"] {
    return items.map((item) => ({
      url: item.url,
      caption: item.label,
      type: (item.extra as MediaType) ?? "photo",
    }));
  }

  function toReferencePapers(items: LinkListItem[]): PointOfInterest["referencePapers"] {
    return items.map((item) => ({ url: item.url, citation: item.label }));
  }

  saveButton.addEventListener("click", () => {
    const poi: PointOfInterest = {
      id: currentId,
      name: nameInput.value,
      description: descriptionInput.value,
      position: currentPosition,
      media: toMediaLinks(mediaEditor.getItems()),
      referencePapers: toReferencePapers(paperEditor.getItems()),
    };
    callbacks.onSave(poi);
  });

  function reset(poi: PointOfInterest | null, position: LatLng): void {
    currentId = poi?.id ?? generateId();
    currentPosition = position;
    nameInput.value = poi?.name ?? "";
    descriptionInput.value = poi?.description ?? "";
    mediaEditor.setItems(
      (poi?.media ?? []).map((m) => ({ url: m.url, label: m.caption, extra: m.type })),
    );
    paperEditor.setItems(
      (poi?.referencePapers ?? []).map((p) => ({ url: p.url, label: p.citation })),
    );
  }

  return {
    root,
    showNew(position: LatLng) {
      reset(null, position);
      root.hidden = false;
    },
    showEdit(poi: PointOfInterest) {
      reset(poi, poi.position);
      root.hidden = false;
    },
  };
}
