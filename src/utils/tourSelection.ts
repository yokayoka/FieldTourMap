const STORAGE_KEY = "fieldtour.selectedTourId.v1";

export function readSelectedTourId(storage: Storage): string | null {
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeSelectedTourId(storage: Storage, tourId: string): void {
  try {
    storage.setItem(STORAGE_KEY, tourId);
  } catch (error) {
    console.warn("選択中ツアーの保存に失敗しました", error);
  }
}
