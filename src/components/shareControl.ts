export interface ShareResult {
  success: boolean;
  message: string;
}

export interface ShareControlCallbacks {
  onShare: () => Promise<ShareResult>;
}

export interface ShareControl {
  root: HTMLElement;
}

const FEEDBACK_TIMEOUT_MS = 3000;

export function createShareControl(callbacks: ShareControlCallbacks): ShareControl {
  const root = document.createElement("div");
  root.className = "share-control";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "share-control__button";
  button.textContent = "共有";

  const feedback = document.createElement("span");
  feedback.className = "share-control__feedback";
  feedback.setAttribute("role", "status");
  feedback.hidden = true;

  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  button.addEventListener("click", () => {
    void (async () => {
      const result = await callbacks.onShare();
      feedback.textContent = result.message;
      feedback.hidden = false;
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        feedback.hidden = true;
      }, FEEDBACK_TIMEOUT_MS);
    })();
  });

  root.append(button, feedback);

  return { root };
}
