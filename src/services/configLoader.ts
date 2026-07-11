import type { LayerDefinition, TourConfig } from "../types/config";
import { validateLayerDefinition, validateTourConfig } from "./configValidator";
import { PublicSheetProjectLoader } from "./publicSheetProjectLoader";

export interface TourIndexEntry {
  id: string;
  title: string;
}

async function fetchJson<T>(url: string, notFoundLabel: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${notFoundLabel}の取得に失敗しました (status: ${response.status})`);
  }
  return (await response.json()) as T;
}

function validateLayers(layers: LayerDefinition[]): void {
  layers.forEach((layer, index) => {
    const result = validateLayerDefinition(layer);
    if (!result.valid) {
      throw new Error(`レイヤー[${index}]の検証に失敗しました: ${result.errors.join(", ")}`);
    }
  });
}

/**
 * `projectId`が指定された場合は認証なしの公開スプレッドシート読み込み
 * （Requirement 16）へ、指定されない場合は従来通り静的JSON設定ファイルへ
 * 委譲する。第三者が作成した未検証のプロジェクトも含め、構造的な検証は
 * 両経路で同一のConfigValidatorを通す。
 */
export async function loadLayers(projectId?: string): Promise<LayerDefinition[]> {
  const layers = projectId
    ? await new PublicSheetProjectLoader().loadLayers(projectId)
    : await fetchJson<LayerDefinition[]>("config/layers.json", "layers.json");

  validateLayers(layers);
  return layers;
}

export async function loadTour(tourId: string, projectId?: string): Promise<TourConfig> {
  const tour = projectId
    ? await new PublicSheetProjectLoader().loadTour(projectId, tourId)
    : await fetchJson<TourConfig>(`config/tours/${tourId}.json`, `${tourId}.json`);

  const result = validateTourConfig(tour);
  if (!result.valid) {
    throw new Error(`ツアー "${tourId}" の検証に失敗しました: ${result.errors.join(", ")}`);
  }

  return tour;
}

export async function listAvailableTours(projectId?: string): Promise<TourIndexEntry[]> {
  if (projectId) {
    return new PublicSheetProjectLoader().listAvailableTours(projectId);
  }
  return fetchJson<TourIndexEntry[]>("config/tours/index.json", "tours/index.json");
}
