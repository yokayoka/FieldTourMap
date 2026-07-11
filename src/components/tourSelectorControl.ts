export interface TourSelectorControlCallbacks {
  onOpen: () => void;
}

export interface TourSelectorControl {
  root: HTMLElement;
  setTitle(title: string): void;
}

const PLACEHOLDER_LABEL = "ツアーを選択";

export function createTourSelectorControl(
  callbacks: TourSelectorControlCallbacks,
): TourSelectorControl {
  const root = document.createElement("div");
  root.className = "tour-selector-control";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tour-selector-control__button";
  button.textContent = PLACEHOLDER_LABEL;
  button.addEventListener("click", () => callbacks.onOpen());

  root.appendChild(button);

  return {
    root,
    setTitle(title: string) {
      button.textContent = title;
    },
  };
}
