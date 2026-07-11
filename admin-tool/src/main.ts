import "leaflet/dist/leaflet.css";
import "./style.css";
import L from "leaflet";
import { AdminLayerListStore } from "./services/adminLayerListStore";
import { createLayerListView } from "./components/layerListView";
import { createLayerEditorForm } from "./components/layerEditorForm";
import { createAdminNav } from "./components/adminNav";
import { createGoogleSheetsPanel } from "./components/googleSheetsPanel";
import { GoogleSheetsProjectService } from "./services/googleSheetsProjectService";
import { downloadTextFile } from "../../src/utils/downloadTextFile";
import { validateLayerDefinition } from "../../src/services/configValidator";
import type { LayerDefinition } from "../../src/types/config";

const GOOGLE_SHEETS_CLIENT_ID_KEY = "fieldtour-admin.googleSheets.clientId";
const GOOGLE_SHEETS_SPREADSHEET_ID_KEY = "fieldtour-admin.googleSheets.spreadsheetId";

const DEFAULT_CENTER: L.LatLngExpression = [35.681236, 139.767125];
const DEFAULT_ZOOM = 12;

interface Layout {
  listSection: HTMLElement;
  formSection: HTMLElement;
  mapContainer: HTMLElement;
  exportButton: HTMLButtonElement;
  loadInput: HTMLInputElement;
  statusText: HTMLElement;
  googleSheetsSection: HTMLElement;
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

  const googleSheetsSection = document.createElement("section");
  googleSheetsSection.className = "admin-google-sheets-section";

  root.append(nav, heading, toolbar, statusText, main, googleSheetsSection);

  return {
    listSection,
    formSection,
    mapContainer,
    exportButton,
    loadInput,
    statusText,
    googleSheetsSection,
  };
}

async function main(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>("#admin-app");
  if (!root) return;

  const {
    listSection,
    formSection,
    mapContainer,
    exportButton,
    loadInput,
    statusText,
    googleSheetsSection,
  } = buildLayout(root);

  const store = new AdminLayerListStore();
  const map = L.map(mapContainer).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
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

  // Googleスプレッドシート連携（Requirement 15）。OAuthクライアントID・
  // スプレッドシートIDはブラウザのlocalStorageに保存し、次回起動時も
  // 入力し直さずに済むようにする。認可・保存・読み込みの失敗は
  // google-sheets-panel__status上に表示するのみで、既存のJSON
  // ダウンロード/読み込み機能には一切影響を与えない（Requirement 15.6）。
  const googleSheetsService = new GoogleSheetsProjectService();
  const googleSheetsPanel = createGoogleSheetsPanel(
    {
      clientId: localStorage.getItem(GOOGLE_SHEETS_CLIENT_ID_KEY) ?? "",
      spreadsheetId: localStorage.getItem(GOOGLE_SHEETS_SPREADSHEET_ID_KEY) ?? "",
    },
    {
      onClientIdChange: (clientId) => localStorage.setItem(GOOGLE_SHEETS_CLIENT_ID_KEY, clientId),
      onSpreadsheetIdChange: (spreadsheetId) =>
        localStorage.setItem(GOOGLE_SHEETS_SPREADSHEET_ID_KEY, spreadsheetId),
      onAuthorize: () => {
        void (async () => {
          const clientId = localStorage.getItem(GOOGLE_SHEETS_CLIENT_ID_KEY) ?? "";
          if (!clientId) {
            googleSheetsPanel.setStatus("OAuthクライアントIDを入力してください。", true);
            return;
          }
          const authorized = await googleSheetsService.authorize(clientId);
          googleSheetsPanel.setAuthorized(authorized);
          googleSheetsPanel.setStatus(
            authorized ? "Googleアカウントで認可されました。" : "Googleの認可に失敗しました。",
            !authorized,
          );
        })();
      },
      onSave: () => {
        void (async () => {
          const spreadsheetId = localStorage.getItem(GOOGLE_SHEETS_SPREADSHEET_ID_KEY) ?? "";
          if (!spreadsheetId) {
            googleSheetsPanel.setStatus("スプレッドシートIDを入力してください。", true);
            return;
          }
          try {
            await googleSheetsService.saveLayers(spreadsheetId, store.list());
            googleSheetsPanel.setStatus("スプレッドシートに保存しました。", false);
          } catch (error) {
            console.error("スプレッドシートへの保存に失敗しました", error);
            googleSheetsPanel.setStatus(
              error instanceof Error ? error.message : "スプレッドシートへの保存に失敗しました。",
              true,
            );
          }
        })();
      },
      onLoad: () => {
        void (async () => {
          const spreadsheetId = localStorage.getItem(GOOGLE_SHEETS_SPREADSHEET_ID_KEY) ?? "";
          if (!spreadsheetId) {
            googleSheetsPanel.setStatus("スプレッドシートIDを入力してください。", true);
            return;
          }
          try {
            const layers = await googleSheetsService.loadLayers(spreadsheetId);
            store.load(layers);
            listView.render(store.list());
            googleSheetsPanel.setStatus(
              `スプレッドシートから読み込みました（${layers.length}件）。`,
              false,
            );
          } catch (error) {
            console.error("スプレッドシートからの読み込みに失敗しました", error);
            googleSheetsPanel.setStatus(
              error instanceof Error
                ? error.message
                : "スプレッドシートからの読み込みに失敗しました。",
              true,
            );
          }
        })();
      },
    },
  );
  googleSheetsSection.appendChild(googleSheetsPanel.root);

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
