import type { LayerDefinition } from "../types/config";
import type { ActiveLayerState } from "../services/layerManager";

export interface LayerControlManager {
  setBaseLayer(layerId: string): void;
  toggleOverlay(layerId: string, visible: boolean): void;
  getActiveLayerState(): ActiveLayerState;
}

export interface LayerControl {
  root: HTMLElement;
  /** マネージャーの状態がコントロール外（ツアー切替等）から変更された際に、表示を再同期する。 */
  refresh(): void;
}

export function createLayerControl(
  layers: LayerDefinition[],
  manager: LayerControlManager,
): LayerControl {
  const root = document.createElement("div");
  root.className = "layer-control";

  const baseSection = document.createElement("div");
  baseSection.className = "layer-control__section";
  baseSection.setAttribute("role", "radiogroup");

  const baseButtons = new Map<string, HTMLButtonElement>();
  const overlayCheckboxes = new Map<string, HTMLInputElement>();

  const refresh = (): void => {
    const { baseLayerId, overlayLayerIds } = manager.getActiveLayerState();
    baseButtons.forEach((button, layerId) => {
      const active = layerId === baseLayerId;
      button.classList.toggle("layer-control__button--active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    overlayCheckboxes.forEach((checkbox, layerId) => {
      checkbox.checked = overlayLayerIds.includes(layerId);
    });
  };

  layers
    .filter((layer) => layer.type === "base")
    .forEach((layer) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "layer-control__button";
      button.textContent = layer.name;
      button.setAttribute("role", "radio");
      button.addEventListener("click", () => {
        manager.setBaseLayer(layer.id);
        refresh();
      });
      baseButtons.set(layer.id, button);
      baseSection.appendChild(button);
    });

  const overlaySection = document.createElement("div");
  overlaySection.className = "layer-control__section";

  layers
    .filter((layer) => layer.type === "overlay")
    .forEach((layer) => {
      const label = document.createElement("label");
      label.className = "layer-control__checkbox-label";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "layer-control__checkbox";
      checkbox.checked = manager.getActiveLayerState().overlayLayerIds.includes(layer.id);
      checkbox.addEventListener("change", () => {
        manager.toggleOverlay(layer.id, checkbox.checked);
      });

      overlayCheckboxes.set(layer.id, checkbox);
      label.appendChild(checkbox);
      label.append(layer.name);
      overlaySection.appendChild(label);
    });

  refresh();

  root.appendChild(baseSection);
  root.appendChild(overlaySection);
  return { root, refresh };
}
