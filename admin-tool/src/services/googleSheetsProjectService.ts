import type { LayerDefinition, TourConfig } from "../../../src/types/config";
import {
  SHEET_NAMES,
  extractTourFromSheets,
  layersToSheet,
  mergeTourIntoSheets,
  sheetToLayers,
  type SheetsData,
} from "./googleSheetsRowMapping";

export interface TokenClientLike {
  requestAccessToken(): void;
}

export interface GoogleIdentityServicesLike {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: { access_token?: string; error?: string }) => void;
      }): TokenClientLike;
    };
  };
}

export interface SheetsApiLike {
  getValues(spreadsheetId: string, range: string): Promise<string[][]>;
  updateValues(spreadsheetId: string, range: string, values: string[][]): Promise<void>;
}

export interface GoogleSheetsProjectServiceOptions {
  loadGis?: () => Promise<GoogleIdentityServicesLike>;
  sheetsApi?: SheetsApiLike;
  fetchFn?: typeof fetch;
}

// Requirement 15.3: 既存のスプレッドシート（他人が所有者の場合を含む）を
// 読み込む必要があるため、作成元がアプリに限定されるdrive.fileではなく
// 読み書き両方に対応するspreadsheetsスコープを使用する。
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`スクリプトの読み込みに失敗しました: ${url}`));
    document.head.appendChild(script);
  });
}

async function defaultLoadGis(): Promise<GoogleIdentityServicesLike> {
  await loadScript(GIS_SCRIPT_URL);
  const google = (window as unknown as { google?: GoogleIdentityServicesLike }).google;
  if (!google) {
    throw new Error("Google Identity Servicesの読み込みに失敗しました");
  }
  return google;
}

function defaultSheetsApi(getToken: () => string | null, fetchFn: typeof fetch): SheetsApiLike {
  function authHeader(): string {
    const token = getToken();
    if (!token) {
      throw new Error("Google認可が完了していません。先にGoogleアカウントで認可してください。");
    }
    return `Bearer ${token}`;
  }

  return {
    async getValues(spreadsheetId, range) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
      const response = await fetchFn(url, { headers: { Authorization: authHeader() } });
      if (!response.ok) {
        throw new Error(`スプレッドシートの読み込みに失敗しました (status: ${response.status})`);
      }
      const data = (await response.json()) as { values?: string[][] };
      return data.values ?? [];
    },
    async updateValues(spreadsheetId, range, values) {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`;
      const response = await fetchFn(url, {
        method: "PUT",
        headers: { Authorization: authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (!response.ok) {
        throw new Error(`スプレッドシートの書き込みに失敗しました (status: ${response.status})`);
      }
    },
  };
}

/**
 * Googleスプレッドシートとのプロジェクト（レイヤー・ツアー）保存/読み込み
 * （Requirement 15）。Admin Config Tool専用で、参加者向けMap Viewerには
 * 組み込まない。gapi等の重量級クライアントは使わず、Google Identity
 * Services（GIS）でトークンを取得し、以降はfetchでSheets API v4を直接
 * 呼び出す。
 */
export class GoogleSheetsProjectService {
  private accessToken: string | null = null;
  private readonly loadGis: () => Promise<GoogleIdentityServicesLike>;
  private readonly sheetsApi: SheetsApiLike;

  constructor(options: GoogleSheetsProjectServiceOptions = {}) {
    this.loadGis = options.loadGis ?? defaultLoadGis;
    this.sheetsApi =
      options.sheetsApi ?? defaultSheetsApi(() => this.accessToken, options.fetchFn ?? fetch);
  }

  isAuthorized(): boolean {
    return this.accessToken !== null;
  }

  async authorize(clientId: string): Promise<boolean> {
    try {
      const google = await this.loadGis();
      return await new Promise<boolean>((resolve) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: (response) => {
            if (response.access_token) {
              this.accessToken = response.access_token;
              resolve(true);
            } else {
              resolve(false);
            }
          },
        });
        client.requestAccessToken();
      });
    } catch (error) {
      console.warn("Google認可に失敗しました", error);
      return false;
    }
  }

  async saveLayers(spreadsheetId: string, layers: LayerDefinition[]): Promise<void> {
    await this.sheetsApi.updateValues(spreadsheetId, "Layers", layersToSheet(layers));
  }

  async loadLayers(spreadsheetId: string): Promise<LayerDefinition[]> {
    const rows = await this.sheetsApi.getValues(spreadsheetId, "Layers");
    return sheetToLayers(rows);
  }

  async saveTour(spreadsheetId: string, tour: TourConfig): Promise<void> {
    const existing = await this.readTourSheets(spreadsheetId);
    const merged = mergeTourIntoSheets(existing, tour);
    await this.writeTourSheets(spreadsheetId, merged);
  }

  async loadTour(spreadsheetId: string, tourId: string): Promise<TourConfig> {
    const sheets = await this.readTourSheets(spreadsheetId);
    const tour = extractTourFromSheets(sheets, tourId);
    if (!tour) {
      throw new Error(`ツアー "${tourId}" がスプレッドシートに見つかりません`);
    }
    return tour;
  }

  private tourSheetNames(): Exclude<(typeof SHEET_NAMES)[number], "Layers">[] {
    return SHEET_NAMES.filter((name): name is Exclude<(typeof SHEET_NAMES)[number], "Layers"> =>
      name !== "Layers",
    );
  }

  private async readTourSheets(spreadsheetId: string): Promise<SheetsData> {
    const entries = await Promise.all(
      this.tourSheetNames().map(
        async (name) => [name, await this.sheetsApi.getValues(spreadsheetId, name)] as const,
      ),
    );
    return Object.fromEntries(entries) as SheetsData;
  }

  private async writeTourSheets(spreadsheetId: string, sheets: SheetsData): Promise<void> {
    await Promise.all(
      this.tourSheetNames().map((name) =>
        this.sheetsApi.updateValues(spreadsheetId, name, sheets[name] ?? []),
      ),
    );
  }
}
