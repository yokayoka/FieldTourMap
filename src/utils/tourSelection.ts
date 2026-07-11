export const DEFAULT_STORAGE_KEY = "fieldtour.selectedTourId.v1";

export function readSelectedTourId(storage: Storage, keySuffix = ""): string | null {
  try {
    return storage.getItem(DEFAULT_STORAGE_KEY + keySuffix);
  } catch {
    return null;
  }
}

export function writeSelectedTourId(storage: Storage, tourId: string, keySuffix = ""): void {
  try {
    storage.setItem(DEFAULT_STORAGE_KEY + keySuffix, tourId);
  } catch (error) {
    console.warn("選択中ツアーの保存に失敗しました", error);
  }
}
