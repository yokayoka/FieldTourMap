import type { LayerDefinition, LayerType } from "../../../src/types/config";
import { validateLayerDefinition } from "../../../src/services/configValidator";

export interface LayerEditorFormCallbacks {
  onSave: (layer: LayerDefinition) => void;
  onCancel: () => void;
  onPreview?: (layer: LayerDefinition) => void;
}

export interface LayerEditorForm {
  root: HTMLElement;
  showNew(): void;
  showEdit(layer: LayerDefinition): void;
}

function textField(labelText: string, name: string, type = "text"): {
  wrapper: HTMLElement;
  input: HTMLInputElement;
} {
  const wrapper = document.createElement("label");
  wrapper.className = "layer-editor-form__field";
  const labelSpan = document.createElement("span");
  labelSpan.textContent = labelText;
  const input = document.createElement("input");
  input.type = type;
  input.name = name;
  wrapper.append(labelSpan, input);
  return { wrapper, input };
}

export function createLayerEditorForm(callbacks: LayerEditorFormCallbacks): LayerEditorForm {
  const root = document.createElement("form");
  root.className = "layer-editor-form";
  root.hidden = true;

  const id = textField("ID", "id");
  const name = textField("レイヤー名", "name");

  const typeWrapper = document.createElement("label");
  typeWrapper.className = "layer-editor-form__field";
  const typeLabel = document.createElement("span");
  typeLabel.textContent = "種別";
  const typeSelect = document.createElement("select");
  typeSelect.name = "type";
  for (const [value, label] of [
    ["base", "ベース"],
    ["overlay", "オーバーレイ"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    typeSelect.appendChild(option);
  }
  typeWrapper.append(typeLabel, typeSelect);

  const urlTemplate = textField(
    "タイルURL（{z}/{x}/{y}を含む）",
    "urlTemplate",
  );
  const attribution = textField("帰属表示（attribution）", "attribution");
  const opacity = textField("不透明度（0〜1）", "opacity", "number");
  opacity.input.step = "0.1";
  opacity.input.min = "0";
  opacity.input.max = "1";
  const minZoom = textField("最小ズーム", "minZoom", "number");
  const maxZoom = textField("最大ズーム", "maxZoom", "number");

  const defaultVisibleWrapper = document.createElement("label");
  defaultVisibleWrapper.className = "layer-editor-form__field";
  const defaultVisibleLabel = document.createElement("span");
  defaultVisibleLabel.textContent = "初期表示ON";
  const defaultVisible = document.createElement("input");
  defaultVisible.type = "checkbox";
  defaultVisible.name = "defaultVisible";
  defaultVisibleWrapper.append(defaultVisibleLabel, defaultVisible);

  const errors = document.createElement("ul");
  errors.className = "layer-editor-form__errors";
  errors.setAttribute("role", "alert");

  const actions = document.createElement("div");
  actions.className = "layer-editor-form__actions";
  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.className = "layer-editor-form__preview";
  previewButton.textContent = "プレビュー";
  previewButton.addEventListener("click", () => callbacks.onPreview?.(readLayerFromFields()));
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "layer-editor-form__save";
  saveButton.textContent = "保存";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "layer-editor-form__cancel";
  cancelButton.textContent = "キャンセル";
  cancelButton.addEventListener("click", () => callbacks.onCancel());
  actions.append(previewButton, saveButton, cancelButton);

  root.append(
    id.wrapper,
    name.wrapper,
    typeWrapper,
    urlTemplate.wrapper,
    attribution.wrapper,
    opacity.wrapper,
    minZoom.wrapper,
    maxZoom.wrapper,
    defaultVisibleWrapper,
    errors,
    actions,
  );

  function readLayerFromFields(): LayerDefinition {
    return {
      id: id.input.value,
      name: name.input.value,
      type: typeSelect.value as LayerType,
      urlTemplate: urlTemplate.input.value,
      attribution: attribution.input.value,
      opacity: Number(opacity.input.value),
      minZoom: Number(minZoom.input.value),
      maxZoom: Number(maxZoom.input.value),
      defaultVisible: defaultVisible.checked,
    };
  }

  function renderErrors(messages: string[]): void {
    errors.replaceChildren(
      ...messages.map((message) => {
        const li = document.createElement("li");
        li.textContent = message;
        return li;
      }),
    );
  }

  function validateLive(): void {
    const result = validateLayerDefinition(readLayerFromFields());
    renderErrors(result.errors);
  }

  [id.input, name.input, urlTemplate.input, attribution.input, opacity.input, minZoom.input, maxZoom.input].forEach(
    (input) => input.addEventListener("input", validateLive),
  );
  typeSelect.addEventListener("change", validateLive);
  defaultVisible.addEventListener("change", validateLive);

  saveButton.addEventListener("click", () => {
    const layer = readLayerFromFields();
    const result = validateLayerDefinition(layer);
    renderErrors(result.errors);
    if (result.valid) {
      callbacks.onSave(layer);
    }
  });

  function resetFields(layer: LayerDefinition | null): void {
    id.input.value = layer?.id ?? "";
    id.input.disabled = layer !== null;
    name.input.value = layer?.name ?? "";
    typeSelect.value = layer?.type ?? "base";
    urlTemplate.input.value = layer?.urlTemplate ?? "";
    attribution.input.value = layer?.attribution ?? "";
    opacity.input.value = String(layer?.opacity ?? 1);
    minZoom.input.value = String(layer?.minZoom ?? 0);
    maxZoom.input.value = String(layer?.maxZoom ?? 18);
    defaultVisible.checked = layer?.defaultVisible ?? false;
    renderErrors([]);
  }

  return {
    root,
    showNew() {
      resetFields(null);
      root.hidden = false;
    },
    showEdit(layer: LayerDefinition) {
      resetFields(layer);
      root.hidden = false;
    },
  };
}
