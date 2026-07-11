import { parseCsv } from "../utils/csv";
import {
  SHEET_NAMES,
  extractTourFromSheets,
  sheetToLayers,
  sheetToTourSummaries,
  type SheetsData,
} from "./googleSheetsRowMapping";
import type { LayerDefinition, TourConfig } from "../types/config";

export interface PublicSheetProjectLoaderOptions {
  fetchFn?: typeof fetch;
}

function csvUrl(spreadsheetId: string, sheetName: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

/**
 * URLの`project`パラメータで指定されたGoogleスプレッドシートを、認証情報
 * なしで読み取り専用に読み込む（Requirement 16）。スプレッドシートの
 * 「ウェブに公開」機能で得られる公開CSVエンドポイントをfetchするのみで、
 * OAuth・APIキーは一切使わない。GoogleSheetsProjectService（Admin Tool専用、
 * OAuth読み書き）とは独立した、参加者向けMap Viewer専用の実装。
 */
export class PublicSheetProjectLoader {
  private readonly fetchFn: typeof fetch;

  constructor(options: PublicSheetProjectLoaderOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private async fetchSheet(spreadsheetId: string, sheetName: string): Promise<string[][]> {
    let response: Response;
    try {
      response = await this.fetchFn(csvUrl(spreadsheetId, sheetName));
    } catch (error) {
      throw new Error(
        `プロジェクト（シート: ${sheetName}）の読み込みに失敗しました。ネットワーク接続を確認してください。`,
        { cause: error },
      );
    }
    if (!response.ok) {
      throw new Error(
        `プロジェクト（シート: ${sheetName}）の読み込みに失敗しました。スプレッドシートが「ウェブに公開」されているか、IDが正しいか確認してください。(status: ${response.status})`,
      );
    }
    return parseCsv(await response.text());
  }

  async loadLayers(spreadsheetId: string): Promise<LayerDefinition[]> {
    const rows = await this.fetchSheet(spreadsheetId, "Layers");
    return sheetToLayers(rows);
  }

  async listAvailableTours(spreadsheetId: string): Promise<{ id: string; title: string }[]> {
    const rows = await this.fetchSheet(spreadsheetId, "Tours");
    return sheetToTourSummaries(rows);
  }

  async loadTour(spreadsheetId: string, tourId: string): Promise<TourConfig> {
    const tourSheetNames = SHEET_NAMES.filter(
      (name): name is Exclude<(typeof SHEET_NAMES)[number], "Layers"> => name !== "Layers",
    );
    const entries = await Promise.all(
      tourSheetNames.map(
        async (name) => [name, await this.fetchSheet(spreadsheetId, name)] as const,
      ),
    );
    const sheets = Object.fromEntries(entries) as SheetsData;

    const tour = extractTourFromSheets(sheets, tourId);
    if (!tour) {
      throw new Error(`ツアー "${tourId}" がスプレッドシートに見つかりません`);
    }
    return tour;
  }
}
