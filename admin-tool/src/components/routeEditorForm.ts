import type { LatLng, RoutePath } from "../../../src/types/config";

export interface RouteEditorFormCallbacks {
  onSave: (route: RoutePath) => void;
  onCancel: () => void;
  generateId?: () => string;
}

export interface RouteEditorForm {
  root: HTMLElement;
  showNew(points: LatLng[]): void;
  showEdit(route: RoutePath): void;
}

function defaultGenerateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `route-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createRouteEditorForm(callbacks: RouteEditorFormCallbacks): RouteEditorForm {
  const generateId = callbacks.generateId ?? defaultGenerateId;

  const root = document.createElement("form");
  root.className = "route-editor-form";
  root.hidden = true;

  let currentId = "";
  let currentPoints: LatLng[] = [];

  const nameLabel = document.createElement("label");
  nameLabel.className = "route-editor-form__field";
  nameLabel.append("ルート名");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.name = "name";
  nameLabel.appendChild(nameInput);

  const pointCount = document.createElement("p");
  pointCount.className = "route-editor-form__point-count";

  const actions = document.createElement("div");
  actions.className = "route-editor-form__actions";
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "route-editor-form__save";
  saveButton.textContent = "保存";
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "route-editor-form__cancel";
  cancelButton.textContent = "キャンセル";
  cancelButton.addEventListener("click", () => callbacks.onCancel());
  actions.append(saveButton, cancelButton);

  root.append(nameLabel, pointCount, actions);

  saveButton.addEventListener("click", () => {
    callbacks.onSave({ id: currentId, name: nameInput.value, points: currentPoints });
  });

  function reset(route: RoutePath | null, points: LatLng[]): void {
    currentId = route?.id ?? generateId();
    currentPoints = points;
    nameInput.value = route?.name ?? "";
    pointCount.textContent = `頂点数: ${points.length}`;
  }

  return {
    root,
    showNew(points: LatLng[]) {
      reset(null, points);
      root.hidden = false;
    },
    showEdit(route: RoutePath) {
      reset(route, route.points);
      root.hidden = false;
    },
  };
}
