export interface GoogleMapsLinkControlCallbacks {
  onTogglePlacement: (active: boolean) => void;
}

export interface GoogleMapsLinkControl {
  root: HTMLElement;
  setActive(active: boolean): void;
}

export function createGoogleMapsLinkControl(
  callbacks: GoogleMapsLinkControlCallbacks,
): GoogleMapsLinkControl {
  const root = document.createElement("div");
  root.className = "google-maps-link-control";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "google-maps-link-control__toggle";
  button.textContent = "地図タップでGoogleマップリンク取得";

  let active = false;
  const updateState = (): void => {
    button.classList.toggle("google-maps-link-control__toggle--active", active);
    button.setAttribute("aria-pressed", String(active));
  };

  button.addEventListener("click", () => {
    active = !active;
    updateState();
    callbacks.onTogglePlacement(active);
  });
  updateState();

  root.appendChild(button);

  return {
    root,
    setActive(newActive: boolean) {
      active = newActive;
      updateState();
    },
  };
}
