import { describe, expect, it, vi } from "vitest";
import { GoogleSheetsProjectService } from "./googleSheetsProjectService";
import { layersToSheet } from "./googleSheetsRowMapping";
import type { LayerDefinition, TourConfig } from "../../../src/types/config";

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

function createFakeGis(accessToken: string | null) {
  return {
    accounts: {
      oauth2: {
        initTokenClient: vi.fn((config: { callback: (response: { access_token?: string }) => void }) => ({
          requestAccessToken: () => {
            config.callback(accessToken ? { access_token: accessToken } : {});
          },
        })),
      },
    },
  };
}

/** 実際のスプレッドシートのようにシート名をキーとした状態を保持するフェイク。 */
function createFakeSheetsApi() {
  const store = new Map<string, string[][]>();
  return {
    store,
    getValues: vi.fn(async (_spreadsheetId: string, range: string) => store.get(range) ?? []),
    updateValues: vi.fn(async (_spreadsheetId: string, range: string, values: string[][]) => {
      store.set(range, values);
    }),
  };
}

describe("GoogleSheetsProjectService", () => {
  describe("authorize / isAuthorized", () => {
    it("is not authorized before authorize() succeeds", () => {
      const service = new GoogleSheetsProjectService({ loadGis: async () => createFakeGis("token") });
      expect(service.isAuthorized()).toBe(false);
    });

    it("becomes authorized when the user grants consent", async () => {
      const service = new GoogleSheetsProjectService({ loadGis: async () => createFakeGis("token-abc") });

      const result = await service.authorize("client-id");

      expect(result).toBe(true);
      expect(service.isAuthorized()).toBe(true);
    });

    it("resolves false and stays unauthorized when the user denies consent", async () => {
      const service = new GoogleSheetsProjectService({ loadGis: async () => createFakeGis(null) });

      const result = await service.authorize("client-id");

      expect(result).toBe(false);
      expect(service.isAuthorized()).toBe(false);
    });

    it("resolves false instead of throwing when the GIS script fails to load", async () => {
      const service = new GoogleSheetsProjectService({
        loadGis: async () => {
          throw new Error("script load failed");
        },
      });

      await expect(service.authorize("client-id")).resolves.toBe(false);
    });
  });

  describe("saveLayers / loadLayers", () => {
    it("round-trips layers through the injected Sheets API", async () => {
      const sheetsApi = createFakeSheetsApi();
      const service = new GoogleSheetsProjectService({ sheetsApi });

      await service.saveLayers("sheet-id", layers);
      const loaded = await service.loadLayers("sheet-id");

      expect(loaded).toEqual(layers);
    });

    it("writes to the Layers range", async () => {
      const sheetsApi = createFakeSheetsApi();
      const service = new GoogleSheetsProjectService({ sheetsApi });

      await service.saveLayers("sheet-id", layers);

      expect(sheetsApi.updateValues).toHaveBeenCalledWith("sheet-id", "Layers", layersToSheet(layers));
    });
  });

  describe("saveTour / loadTour", () => {
    it("round-trips a tour through the injected Sheets API", async () => {
      const sheetsApi = createFakeSheetsApi();
      const service = new GoogleSheetsProjectService({ sheetsApi });

      await service.saveTour("sheet-id", tour);
      const loaded = await service.loadTour("sheet-id", "sample-tour");

      expect(loaded).toEqual(tour);
    });

    it("preserves another tour already saved in the same spreadsheet", async () => {
      const sheetsApi = createFakeSheetsApi();
      const service = new GoogleSheetsProjectService({ sheetsApi });
      const otherTour: TourConfig = { ...tour, id: "second-tour", title: "第二巡検コース" };

      await service.saveTour("sheet-id", otherTour);
      await service.saveTour("sheet-id", tour);

      await expect(service.loadTour("sheet-id", "second-tour")).resolves.toEqual(otherTour);
      await expect(service.loadTour("sheet-id", "sample-tour")).resolves.toEqual(tour);
    });

    it("throws a descriptive error when the requested tour is not found", async () => {
      const sheetsApi = createFakeSheetsApi();
      const service = new GoogleSheetsProjectService({ sheetsApi });

      await expect(service.loadTour("sheet-id", "unknown-tour")).rejects.toThrow(/unknown-tour/);
    });
  });

  describe("default Sheets API implementation (fetchFn)", () => {
    it("getValues issues a GET to the values endpoint with the bearer token", async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ values: layersToSheet(layers) }),
      });
      const service = new GoogleSheetsProjectService({
        loadGis: async () => createFakeGis("token-xyz"),
        fetchFn,
      });
      await service.authorize("client-id");

      const values = await service.loadLayers("sheet-id");

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("https://sheets.googleapis.com/v4/spreadsheets/sheet-id/values/Layers"),
        expect.objectContaining({ headers: { Authorization: "Bearer token-xyz" } }),
      );
      expect(values).toEqual(layers);
    });

    it("updateValues issues a PUT with the serialized rows as the body", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      const service = new GoogleSheetsProjectService({
        loadGis: async () => createFakeGis("token-xyz"),
        fetchFn,
      });
      await service.authorize("client-id");

      await service.saveLayers("sheet-id", layers);

      expect(fetchFn).toHaveBeenCalledWith(
        expect.stringContaining("https://sheets.googleapis.com/v4/spreadsheets/sheet-id/values/Layers"),
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({ Authorization: "Bearer token-xyz" }),
          body: JSON.stringify({ values: layersToSheet(layers) }),
        }),
      );
    });

    it("throws a descriptive error when the Sheets API responds with a non-ok status", async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
      const service = new GoogleSheetsProjectService({
        loadGis: async () => createFakeGis("token-xyz"),
        fetchFn,
      });
      await service.authorize("client-id");

      await expect(service.loadLayers("sheet-id")).rejects.toThrow(/404/);
    });

    it("throws when called before authorize() has completed", async () => {
      const fetchFn = vi.fn();
      const service = new GoogleSheetsProjectService({ fetchFn });

      await expect(service.loadLayers("sheet-id")).rejects.toThrow(/認可/);
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });
});
