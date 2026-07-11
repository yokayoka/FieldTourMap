export interface MemoControlCallbacks {
  onTogglePlacement: (active: boolean) => void;
  onExportCsv: () => void;
  onExportGeoJson: () => void;
}

export interface MemoControl {
  root: HTMLElement;
  setPlacementActive(active: boolean): void;
}

export function createMemoControl(callbacks: MemoControlCallbacks): MemoControl {
  const root = document.createElement("div");
  root.className = "memo-control";

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "memo-control__toggle";
  toggleButton.textContent = "メモを追加";

  let active = false;
  const updateToggleState = (): void => {
    toggleButton.classList.toggle("memo-control__toggle--active", active);
    toggleButton.setAttribute("aria-pressed", String(active));
  };
  toggleButton.addEventListener("click", () => {
    active = !active;
    updateToggleState();
    callbacks.onTogglePlacement(active);
  });
  updateToggleState();

  const csvButton = document.createElement("button");
  csvButton.type = "button";
  csvButton.className = "memo-control__export-csv";
  csvButton.textContent = "CSVでエクスポート";
  csvButton.addEventListener("click", () => callbacks.onExportCsv());

  const geoJsonButton = document.createElement("button");
  geoJsonButton.type = "button";
  geoJsonButton.className = "memo-control__export-geojson";
  geoJsonButton.textContent = "GeoJSONでエクスポート";
  geoJsonButton.addEventListener("click", () => callbacks.onExportGeoJson());

  root.append(toggleButton, csvButton, geoJsonButton);

  return {
    root,
    setPlacementActive(newActive: boolean) {
      active = newActive;
      updateToggleState();
    },
  };
}
