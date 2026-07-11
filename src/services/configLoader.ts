import type { LayerDefinition, TourConfig } from "../types/config";
import { validateLayerDefinition, validateTourConfig } from "./configValidator";

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

export async function loadLayers(): Promise<LayerDefinition[]> {
  const layers = await fetchJson<LayerDefinition[]>("config/layers.json", "layers.json");

  layers.forEach((layer, index) => {
    const result = validateLayerDefinition(layer);
    if (!result.valid) {
      throw new Error(`layers.json[${index}]の検証に失敗しました: ${result.errors.join(", ")}`);
    }
  });

  return layers;
}

export async function loadTour(tourId: string): Promise<TourConfig> {
  const tour = await fetchJson<TourConfig>(
    `config/tours/${tourId}.json`,
    `${tourId}.json`,
  );

  const result = validateTourConfig(tour);
  if (!result.valid) {
    throw new Error(`${tourId}.jsonの検証に失敗しました: ${result.errors.join(", ")}`);
  }

  return tour;
}

export async function listAvailableTours(): Promise<TourIndexEntry[]> {
  return fetchJson<TourIndexEntry[]>("config/tours/index.json", "tours/index.json");
}
