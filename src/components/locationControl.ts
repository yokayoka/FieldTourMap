export interface LocationControlCallbacks {
  onToggleFollow: (enabled: boolean) => void;
}

export interface LocationControl {
  root: HTMLElement;
  showError(message: string): void;
  clearError(): void;
  setFollowState(enabled: boolean): void;
}

export function createLocationControl(callbacks: LocationControlCallbacks): LocationControl {
  const root = document.createElement("div");
  root.className = "location-control";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "location-control__button";
  button.textContent = "現在地";

  let following = true;

  const updateButtonState = (): void => {
    button.classList.toggle("location-control__button--active", following);
    button.setAttribute("aria-pressed", String(following));
  };

  button.addEventListener("click", () => {
    following = !following;
    updateButtonState();
    callbacks.onToggleFollow(following);
  });

  updateButtonState();

  const errorBanner = document.createElement("div");
  errorBanner.className = "location-control__error";
  errorBanner.setAttribute("role", "alert");
  errorBanner.hidden = true;

  root.appendChild(button);
  root.appendChild(errorBanner);

  return {
    root,
    showError(message: string) {
      errorBanner.textContent = message;
      errorBanner.hidden = false;
    },
    clearError() {
      errorBanner.textContent = "";
      errorBanner.hidden = true;
    },
    setFollowState(enabled: boolean) {
      following = enabled;
      updateButtonState();
    },
  };
}
