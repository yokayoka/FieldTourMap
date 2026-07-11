import { describe, expect, it, vi } from "vitest";
import { PublicSheetProjectLoader } from "./publicSheetProjectLoader";
import { layersToSheet, mergeTourIntoSheets } from "./googleSheetsRowMapping";
import type { LayerDefinition, TourConfig } from "../types/config";

const layers: LayerDefinition[] = [
  {
    id: "gsi-std",
    name: "地理院地図（標準地図）",
    type: "base",
    urlTemplate: "https://example.com/std/{z}/{x}/{y}.png",
    attribution: "国土地理院",
    opacity: 1,
    minZoom: 2,
    maxZoom: 18,
    defaultVisible: true,
  },
];

const tour: TourConfig = {
  id: "sample-tour",
  title: "サンプル巡検コース",
  description: "",
  layerIds: ["gsi-std"],
  pois: [
    {
      id: "poi-01",
      name: "露頭A",
      description: "花崗岩の貫入部",
      position: { lat: 35.681236, lng: 139.767125 },
      media: [],
      referencePapers: [],
    },
  ],
  routes: [],
};

/** シート行(string[][])をGoogleの公開CSVエンドポイント相当のCSVテキストへ変換する。 */
function rowsToCsvText(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => (/[,"\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(","),
    )
    .join("\n");
}

/** シート名ごとのCSVテキストを返すフェイクfetch。実際のgvizエンドポイントの挙動を模す。 */
function createFakeFetch(
  sheetsBySheetName: Record<string, string[][]>,
  options?: { status?: number },
): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    const match = /sheet=([^&]+)/.exec(url);
    const sheetName = match ? decodeURIComponent(match[1]) : "";
    if (options?.status && options.status !== 200) {
      return { ok: false, status: options.status, text: async () => "" } as Response;
    }
    const rows = sheetsBySheetName[sheetName];
    if (!rows) {
      return { ok: false, status: 400, text: async () => "" } as Response;
    }
    return { ok: true, status: 200, text: async () => rowsToCsvText(rows) } as Response;
  });
}

describe("PublicSheetProjectLoader", () => {
  describe("loadLayers", () => {
    it("fetches the Layers sheet's public CSV and parses it", async () => {
      const fetchFn = createFakeFetch({ Layers: layersToSheet(layers) });
      const loader = new PublicSheetProjectLoader({ fetchFn });

      const result = await loader.loadLayers("sheet-id");

      expect(result).toEqual(layers);
      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://docs.google.com/spreadsheets/d/sheet-id/gviz/tq?tqx=out:csv&sheet=Layers",
        ),
      );
    });

    it("throws a descriptive error when the sheet is unpublished/unreachable", async () => {
      const fetchFn = createFakeFetch({}, { status: 400 });
      const loader = new PublicSheetProjectLoader({ fetchFn });

      await expect(loader.loadLayers("sheet-id")).rejects.toThrow(/Layers/);
    });
  });

  describe("listAvailableTours", () => {
    it("fetches the Tours sheet and returns id/title summaries", async () => {
      const merged = mergeTourIntoSheets({}, tour);
      const fetchFn = createFakeFetch({ Tours: merged.Tours ?? [] });
      const loader = new PublicSheetProjectLoader({ fetchFn });

      const result = await loader.listAvailableTours("sheet-id");

      expect(result).toEqual([{ id: "sample-tour", title: "サンプル巡検コース" }]);
    });
  });

  describe("loadTour", () => {
    it("fetches all tour-related sheets and assembles the requested tour", async () => {
      const merged = mergeTourIntoSheets({}, tour);
      const fetchFn = createFakeFetch({
        Tours: merged.Tours ?? [],
        POIs: merged.POIs ?? [],
        Media: merged.Media ?? [],
        ReferencePapers: merged.ReferencePapers ?? [],
        Routes: merged.Routes ?? [],
        RoutePoints: merged.RoutePoints ?? [],
      });
      const loader = new PublicSheetProjectLoader({ fetchFn });

      const result = await loader.loadTour("sheet-id", "sample-tour");

      expect(result).toEqual(tour);
    });

    it("throws a descriptive error when the requested tour is not found", async () => {
      const merged = mergeTourIntoSheets({}, tour);
      const fetchFn = createFakeFetch({
        Tours: merged.Tours ?? [],
        POIs: merged.POIs ?? [],
        Media: merged.Media ?? [],
        ReferencePapers: merged.ReferencePapers ?? [],
        Routes: merged.Routes ?? [],
        RoutePoints: merged.RoutePoints ?? [],
      });
      const loader = new PublicSheetProjectLoader({ fetchFn });

      await expect(loader.loadTour("sheet-id", "unknown-tour")).rejects.toThrow(/unknown-tour/);
    });

    it("throws a descriptive error when a required sheet cannot be fetched", async () => {
      const fetchFn = createFakeFetch({}, { status: 404 });
      const loader = new PublicSheetProjectLoader({ fetchFn });

      await expect(loader.loadTour("sheet-id", "sample-tour")).rejects.toThrow();
    });
  });
});
