import "leaflet/dist/leaflet.css";
import "./style.css";
import L from "leaflet";
import { AdminTourStore } from "./services/adminTourStore";
import { createPoiEditorForm } from "./components/poiEditorForm";
import { createRouteEditorForm } from "./components/routeEditorForm";
import { createSimpleListView } from "./components/simpleListView";
import { createAdminNav } from "./components/adminNav";
import { downloadTextFile } from "../../src/utils/downloadTextFile";
import { validateTourConfig } from "../../src/services/configValidator";
import type { LatLng, PointOfInterest, RoutePath, TourConfig } from "../../src/types/config";

const DEFAULT_CENTER: L.LatLngExpression = [35.681236, 139.767125];
const DEFAULT_ZOOM = 15;
const DEFAULT_TOUR_ID = "sample-tour";

type Mode = "view" | "addingPoi" | "addingRoute";

interface Layout {
  loadInput: HTMLInputElement;
  exportButton: HTMLButtonElement;
  idInput: HTMLInputElement;
  titleInput: HTMLInputElement;
  statusText: HTMLElement;
  addPoiButton: HTMLButtonElement;
  addRouteButton: HTMLButtonElement;
  finishRouteButton: HTMLButtonElement;
  modeStatus: HTMLElement;
  poiListSection: HTMLElement;
  routeListSection: HTMLElement;
  formColumn: HTMLElement;
  mapContainer: HTMLElement;
}

function buildLayout(root: HTMLElement): Layout {
  const nav = createAdminNav("tour");

  const heading = document.createElement("h1");
  heading.textContent = "ツアー編集（POI・ルート）";

  const toolbar = document.createElement("div");
  toolbar.className = "admin-toolbar";

  const loadLabel = document.createElement("label");
  loadLabel.append("既存のtours/*.jsonを読み込む: ");
  const loadInput = document.createElement("input");
  loadInput.type = "file";
  loadInput.accept = "application/json";
  loadLabel.appendChild(loadInput);

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "admin-toolbar__export";
  exportButton.textContent = "tours/*.jsonをダウンロード";

  toolbar.append(loadLabel, exportButton);

  const metadataForm = document.createElement("div");
  metadataForm.className = "tour-metadata-form";
  const idLabel = document.createElement("label");
  idLabel.append("ツアーID");
  const idInput = document.createElement("input");
  idInput.name = "tour-id";
  idLabel.appendChild(idInput);
  const titleLabel = document.createElement("label");
  titleLabel.append("タイトル");
  const titleInput = document.createElement("input");
  titleInput.name = "tour-title";
  titleLabel.appendChild(titleInput);
  metadataForm.append(idLabel, titleLabel);

  const statusText = document.createElement("p");
  statusText.className = "admin-status";
  statusText.setAttribute("role", "status");

  const mapToolbar = document.createElement("div");
  mapToolbar.className = "map-mode-toolbar";
  const addPoiButton = document.createElement("button");
  addPoiButton.type = "button";
  addPoiButton.className = "map-mode-toolbar__add-poi";
  addPoiButton.textContent = "POIを追加";
  const addRouteButton = document.createElement("button");
  addRouteButton.type = "button";
  addRouteButton.className = "map-mode-toolbar__add-route";
  addRouteButton.textContent = "ルートを追加";
  const finishRouteButton = document.createElement("button");
  finishRouteButton.type = "button";
  finishRouteButton.className = "map-mode-toolbar__finish-route";
  finishRouteButton.textContent = "ルートを確定";
  finishRouteButton.disabled = true;
  const modeStatus = document.createElement("span");
  modeStatus.className = "map-mode-toolbar__status";
  mapToolbar.append(addPoiButton, addRouteButton, finishRouteButton, modeStatus);

  const main = document.createElement("div");
  main.className = "admin-main";

  const listColumn = document.createElement("div");
  listColumn.className = "admin-list-column";
  const poiListSection = document.createElement("section");
  const poiHeading = document.createElement("h2");
  poiHeading.textContent = "見学ポイント（POI）";
  poiListSection.appendChild(poiHeading);
  const routeListSection = document.createElement("section");
  const routeHeading = document.createElement("h2");
  routeHeading.textContent = "巡検ルート";
  routeListSection.appendChild(routeHeading);
  listColumn.append(poiListSection, routeListSection);

  const formColumn = document.createElement("div");
  formColumn.className = "admin-form-column";

  main.append(listColumn, formColumn);

  const mapContainer = document.createElement("div");
  mapContainer.id = "tour-preview-map";
  mapContainer.className = "admin-preview-map";

  root.append(nav, heading, toolbar, metadataForm, statusText, mapToolbar, main, mapContainer);

  return {
    loadInput,
    exportButton,
    idInput,
    titleInput,
    statusText,
    addPoiButton,
    addRouteButton,
    finishRouteButton,
    modeStatus,
    poiListSection,
    routeListSection,
    formColumn,
    mapContainer,
  };
}

async function main(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>("#admin-app");
  if (!root) return;

  const layout = buildLayout(root);
  const store = new AdminTourStore();
  const map = L.map(layout.mapContainer).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

  let mode: Mode = "view";
  let draftPoints: LatLng[] = [];
  let draftPolyline: L.Polyline | null = null;
  let poiMarkers = new Map<string, L.Marker>();
  let routeLines = new Map<string, L.Polyline>();

  function setMode(next: Mode): void {
    mode = next;
    layout.addPoiButton.classList.toggle("map-mode-toolbar__add-poi--active", mode === "addingPoi");
    layout.addRouteButton.classList.toggle(
      "map-mode-toolbar__add-route--active",
      mode === "addingRoute",
    );
    if (mode !== "addingRoute") {
      draftPoints = [];
      if (draftPolyline) {
        map.removeLayer(draftPolyline);
        draftPolyline = null;
      }
      layout.finishRouteButton.disabled = true;
    }
    layout.modeStatus.textContent =
      mode === "addingPoi"
        ? "地図をタップしてPOIを追加"
        : mode === "addingRoute"
          ? `地図をタップして頂点を追加（${draftPoints.length}点）`
          : "";
  }

  function renderPois(): void {
    poiMarkers.forEach((marker) => map.removeLayer(marker));
    poiMarkers = new Map();
    store.listPois().forEach((poi) => {
      const marker = L.marker([poi.position.lat, poi.position.lng]);
      marker.on("click", () => {
        routeForm.root.hidden = true;
        poiForm.showEdit(poi);
      });
      marker.addTo(map);
      poiMarkers.set(poi.id, marker);
    });
    poiListView.render(store.listPois());
  }

  function renderRoutes(): void {
    routeLines.forEach((line) => map.removeLayer(line));
    routeLines = new Map();
    store.listRoutes().forEach((route) => {
      const line = L.polyline(
        route.points.map((p) => [p.lat, p.lng] as L.LatLngTuple),
        { color: "#f5a623" },
      );
      line.addTo(map);
      routeLines.set(route.id, line);
    });
    routeListView.render(store.listRoutes());
  }

  const poiForm = createPoiEditorForm({
    onSave: (poi) => {
      store.upsertPoi(poi);
      renderPois();
      poiForm.root.hidden = true;
      layout.statusText.textContent = `POI「${poi.name}」を保存しました（まだダウンロードしていません）`;
    },
    onCancel: () => {
      poiForm.root.hidden = true;
    },
  });
  layout.formColumn.appendChild(poiForm.root);

  const routeForm = createRouteEditorForm({
    onSave: (route) => {
      store.upsertRoute(route);
      renderRoutes();
      routeForm.root.hidden = true;
      setMode("view");
      layout.statusText.textContent = `ルート「${route.name}」を保存しました（まだダウンロードしていません）`;
    },
    onCancel: () => {
      routeForm.root.hidden = true;
      setMode("view");
    },
  });
  layout.formColumn.appendChild(routeForm.root);

  const poiListView = createSimpleListView<PointOfInterest>({
    onAddNew: () => setMode("addingPoi"),
    onEdit: (poi) => {
      routeForm.root.hidden = true;
      poiForm.showEdit(poi);
    },
    onDelete: (id) => {
      store.removePoi(id);
      renderPois();
    },
    getId: (poi) => poi.id,
    getLabel: (poi) => poi.name,
    addButtonText: "＋ 地図でPOIを追加",
  });
  layout.poiListSection.appendChild(poiListView.root);

  const routeListView = createSimpleListView<RoutePath>({
    onAddNew: () => setMode("addingRoute"),
    onEdit: (route) => {
      poiForm.root.hidden = true;
      routeForm.showEdit(route);
    },
    onDelete: (id) => {
      store.removeRoute(id);
      renderRoutes();
    },
    getId: (route) => route.id,
    getLabel: (route) => `${route.name}（${route.points.length}点）`,
    addButtonText: "＋ 地図でルートを追加",
  });
  layout.routeListSection.appendChild(routeListView.root);

  layout.addPoiButton.addEventListener("click", () => {
    setMode(mode === "addingPoi" ? "view" : "addingPoi");
  });
  layout.addRouteButton.addEventListener("click", () => {
    setMode(mode === "addingRoute" ? "view" : "addingRoute");
  });
  layout.finishRouteButton.addEventListener("click", () => {
    if (draftPoints.length < 2) return;
    poiForm.root.hidden = true;
    routeForm.showNew(draftPoints);
  });

  map.on("click", (event: L.LeafletMouseEvent) => {
    const point: LatLng = { lat: event.latlng.lat, lng: event.latlng.lng };

    if (mode === "addingPoi") {
      setMode("view");
      routeForm.root.hidden = true;
      poiForm.showNew(point);
      return;
    }

    if (mode === "addingRoute") {
      draftPoints = [...draftPoints, point];
      if (draftPolyline) map.removeLayer(draftPolyline);
      draftPolyline = L.polyline(
        draftPoints.map((p) => [p.lat, p.lng] as L.LatLngTuple),
        { color: "#1a5fb4", dashArray: "6 6" },
      ).addTo(map);
      layout.finishRouteButton.disabled = draftPoints.length < 2;
      layout.modeStatus.textContent = `地図をタップして頂点を追加（${draftPoints.length}点）`;
    }
  });

  layout.idInput.addEventListener("input", () => store.setMetadata({ id: layout.idInput.value }));
  layout.titleInput.addEventListener("input", () =>
    store.setMetadata({ title: layout.titleInput.value }),
  );

  layout.exportButton.addEventListener("click", () => {
    const tour = store.toTourConfig();
    const result = validateTourConfig(tour);
    if (!result.valid) {
      layout.statusText.textContent = `エクスポート失敗: ${result.errors.join(" / ")}`;
      return;
    }
    downloadTextFile(`${tour.id || "tour"}.json`, store.toJson(), "application/json");
    layout.statusText.textContent = `${tour.id || "tour"}.jsonをダウンロードしました。Gitリポジトリにコミット・pushしてください。`;
  });

  layout.loadInput.addEventListener("change", () => {
    void (async () => {
      const file = layout.loadInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as TourConfig;
        const result = validateTourConfig(parsed);
        if (!result.valid) {
          layout.statusText.textContent = `読み込み失敗: ${result.errors.join(" / ")}`;
          return;
        }
        store.load(parsed);
        layout.idInput.value = store.getMetadata().id;
        layout.titleInput.value = store.getMetadata().title;
        renderPois();
        renderRoutes();
        layout.statusText.textContent = `${file.name} を読み込みました`;
      } catch (error) {
        console.error("ツアー設定の読み込みに失敗しました", error);
        layout.statusText.textContent = "JSONの読み込みに失敗しました。ファイル形式を確認してください。";
      }
    })();
  });

  // 現在サイトに公開されているサンプルツアーを初期状態として読み込む。
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}config/tours/${DEFAULT_TOUR_ID}.json`,
    );
    if (response.ok) {
      const tour = (await response.json()) as TourConfig;
      store.load(tour);
      layout.idInput.value = store.getMetadata().id;
      layout.titleInput.value = store.getMetadata().title;
    }
  } catch (error) {
    console.warn("公開中のツアー設定の読み込みに失敗しました", error);
  }

  renderPois();
  renderRoutes();
  setMode("view");
}

void main();
