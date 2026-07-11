import "leaflet/dist/leaflet.css";
import "./style.css";
import L from "leaflet";
import { AdminLayerListStore } from "./services/adminLayerListStore";
import { createLayerListView } from "./components/layerListView";
import { createLayerEditorForm } from "./components/layerEditorForm";
import { createAdminNav } from "./components/adminNav";
import { downloadTextFile } from "../../src/utils/downloadTextFile";
import { validateLayerDefinition } from "../../src/services/configValidator";
import type { LayerDefinition } from "../../src/types/config";

const DEFAULT_CENTER: L.LatLngExpression = [35.681236, 139.767125];
const DEFAULT_ZOOM = 12;

// プレビュー対象のレイヤーが現在の表示範囲にデータを持たない場合（例:
// 特定地域専用のタイルを東京付近のデフォルト表示位置でプレビューする場合）
// でも、常に背景に基準地図を表示しておくことで、ユーザーが地図を見ながら
// 目的の地域までパン・ズームできるようにする。
const REFERENCE_LAYER_URL = "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png";
const REFERENCE_LAYER_ATTRIBUTION = "地理院タイル（国土地理院）";

interface Layout {
  listSection: HTMLElement;
  formSection: HTMLElement;
  mapContainer: HTMLElement;
  exportButton: HTMLButtonElement;
  loadInput: HTMLInputElement;
  statusText: HTMLElement;
}

function buildLayout(root: HTMLElement): Layout {
  const nav = createAdminNav("layers");

  const heading = document.createElement("h1");
  heading.textContent = "レイヤー編集（管理ツール）";

  const toolbar = document.createElement("div");
  toolbar.className = "admin-toolbar";

  const loadLabel = document.createElement("label");
  loadLabel.className = "admin-toolbar__load";
  loadLabel.append("既存のlayers.jsonを読み込む: ");
  const loadInput = document.createElement("input");
  loadInput.type = "file";
  loadInput.accept = "application/json";
  loadLabel.appendChild(loadInput);

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "admin-toolbar__export";
  exportButton.textContent = "layers.jsonをダウンロード";

  toolbar.append(loadLabel, exportButton);

  const statusText = document.createElement("p");
  statusText.className = "admin-status";
  statusText.setAttribute("role", "status");

  const main = document.createElement("div");
  main.className = "admin-main";

  const listSection = document.createElement("section");
  listSection.className = "admin-list-section";

  const formSection = document.createElement("section");
  formSection.className = "admin-form-section";

  const mapContainer = document.createElement("div");
  mapContainer.id = "preview-map";
  mapContainer.className = "admin-preview-map";

  main.append(listSection, formSection, mapContainer);

  root.append(nav, heading, toolbar, statusText, main);

  return {
    listSection,
    formSection,
    mapContainer,
    exportButton,
    loadInput,
    statusText,
  };
}

async function main(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>("#admin-app");
  if (!root) return;

  const { listSection, formSection, mapContainer, exportButton, loadInput, statusText } =
    buildLayout(root);

  const store = new AdminLayerListStore();
  const map = L.map(mapContainer).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer(REFERENCE_LAYER_URL, { attribution: REFERENCE_LAYER_ATTRIBUTION }).addTo(map);
  let previewLayer: L.Layer | null = null;

  function updatePreview(layer: LayerDefinition): void {
    if (previewLayer) {
      map.removeLayer(previewLayer);
      previewLayer = null;
    }
    // 不正なURL等はプレビューできないため、有効な値のときのみ描画する
    // （Requirement 11.4, 11.5）。
    if (!validateLayerDefinition(layer).valid) return;
    previewLayer = L.tileLayer(layer.urlTemplate, {
      attribution: layer.attribution,
      opacity: layer.opacity,
      minZoom: layer.minZoom,
      maxZoom: layer.maxZoom,
    }).addTo(map);
  }

  const listView = createLayerListView({
    onAddNew: () => form.showNew(),
    onEdit: (layer) => {
      form.showEdit(layer);
      updatePreview(layer);
    },
    onDelete: (id) => {
      store.remove(id);
      listView.render(store.list());
    },
  });
  listSection.appendChild(listView.root);

  const form = createLayerEditorForm({
    onSave: (layer) => {
      store.upsert(layer);
      listView.render(store.list());
      form.root.hidden = true;
      statusText.textContent = `「${layer.name}」を保存しました（まだダウンロードしていません）`;
    },
    onCancel: () => {
      form.root.hidden = true;
    },
    onPreview: (layer) => updatePreview(layer),
  });
  formSection.appendChild(form.root);

  exportButton.addEventListener("click", () => {
    downloadTextFile("layers.json", store.toJson(), "application/json");
    statusText.textContent = "layers.jsonをダウンロードしました。Gitリポジトリにコミット・pushしてください。";
  });

  loadInput.addEventListener("change", () => {
    void (async () => {
      const file = loadInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as LayerDefinition[];
        const errors: string[] = [];
        parsed.forEach((layer, index) => {
          const result = validateLayerDefinition(layer);
          if (!result.valid) errors.push(`[${index}] ${result.errors.join(", ")}`);
        });
        if (errors.length > 0) {
          statusText.textContent = `読み込み失敗: ${errors.join(" / ")}`;
          return;
        }
        store.load(parsed);
        listView.render(store.list());
        statusText.textContent = `${file.name} を読み込みました（${parsed.length}件）`;
      } catch (error) {
        console.error("layers.jsonの読み込みに失敗しました", error);
        statusText.textContent = "JSONの読み込みに失敗しました。ファイル形式を確認してください。";
      }
    })();
  });

  // 現在サイトに公開されているlayers.jsonを初期状態として読み込む。
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}config/layers.json`);
    if (response.ok) {
      const layers = (await response.json()) as LayerDefinition[];
      store.load(layers);
    }
  } catch (error) {
    console.warn("公開中のlayers.jsonの読み込みに失敗しました", error);
  }

  listView.render(store.list());
}

void main();
