export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

export function defaultClipboard(): ClipboardLike | undefined {
  if (typeof navigator === "undefined" || !navigator.clipboard) return undefined;
  return navigator.clipboard;
}

/**
 * Clipboard APIへの書き込みを試み、成否をbooleanで返す共通ヘルパー。
 * 非対応環境・書き込み拒否のいずれも例外を投げず、呼び出し側に
 * フォールバックUIを表示させる判断材料を提供する。
 */
export async function copyToClipboard(text: string, clipboard?: ClipboardLike): Promise<boolean> {
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
