export interface PrecacheControlCallbacks {
  onStart: () => void;
}

export interface PrecacheProgressLike {
  completed: number;
  total: number;
}

export interface PrecacheControl {
  root: HTMLElement;
  setProgress(progress: PrecacheProgressLike | null): void;
  setError(message: string | null): void;
}

export function createPrecacheControl(callbacks: PrecacheControlCallbacks): PrecacheControl {
  const root = document.createElement("div");
  root.className = "precache-control";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "precache-control__button";
  button.textContent = "この範囲を事前ダウンロード";
  button.addEventListener("click", () => callbacks.onStart());

  const progressText = document.createElement("span");
  progressText.className = "precache-control__progress";
  progressText.hidden = true;

  const errorText = document.createElement("span");
  errorText.className = "precache-control__error";
  errorText.setAttribute("role", "alert");
  errorText.hidden = true;

  root.append(button, progressText, errorText);

  return {
    root,
    setProgress(progress: PrecacheProgressLike | null) {
      if (!progress) {
        progressText.hidden = true;
        button.disabled = false;
        return;
      }

      const isDone = progress.completed >= progress.total;
      button.disabled = !isDone;
      progressText.hidden = false;
      progressText.textContent = isDone
        ? `${progress.total} 件のタイルを保存しました`
        : `${progress.completed} / ${progress.total} タイルを取得中...`;
    },
    setError(message: string | null) {
      errorText.hidden = message === null;
      errorText.textContent = message ?? "";
    },
  };
}
