import type { TourIndexEntry } from "../services/configLoader";

export interface TourSelectorPanelCallbacks {
  onSelect: (tourId: string) => void;
  onClose: () => void;
}

export interface TourSelectorPanel {
  root: HTMLElement;
  show(tours: TourIndexEntry[], activeTourId: string | null): void;
  hide(): void;
}

export function createTourSelectorPanel(
  callbacks: TourSelectorPanelCallbacks,
): TourSelectorPanel {
  const root = document.createElement("div");
  root.className = "tour-selector-panel";
  root.hidden = true;

  return {
    root,
    show(tours, activeTourId) {
      root.replaceChildren();

      const heading = document.createElement("h2");
      heading.className = "tour-selector-panel__heading";
      heading.textContent = "ツアーを選択";
      root.appendChild(heading);

      const list = document.createElement("div");
      list.className = "tour-selector-panel__list";
      tours.forEach((tour) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "tour-selector-panel__item";
        item.textContent = tour.title;
        const active = tour.id === activeTourId;
        item.classList.toggle("tour-selector-panel__item--active", active);
        item.setAttribute("aria-pressed", String(active));
        item.addEventListener("click", () => {
          callbacks.onSelect(tour.id);
          root.hidden = true;
        });
        list.appendChild(item);
      });
      root.appendChild(list);

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "tour-selector-panel__close";
      closeButton.textContent = "閉じる";
      closeButton.addEventListener("click", () => {
        callbacks.onClose();
        root.hidden = true;
      });
      root.appendChild(closeButton);

      root.hidden = false;
    },
    hide() {
      root.hidden = true;
    },
  };
}
