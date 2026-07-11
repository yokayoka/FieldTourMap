const DEFAULT_DURATION_MS = 3000;

/**
 * 一定時間後に自動的に消える簡潔なフィードバック通知を表示する
 * （Requirement 14.5: コピー完了を示すトースト通知等）。
 */
export function showToast(root: HTMLElement, message: string, durationMs = DEFAULT_DURATION_MS): void {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  root.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, durationMs);
}
