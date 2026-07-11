import type {
  LayerDefinition,
  LayerType,
  MediaType,
  PointOfInterest,
  RoutePath,
  TourConfig,
} from "../types/config";

export interface SheetsData {
  Layers?: string[][];
  Tours?: string[][];
  POIs?: string[][];
  Media?: string[][];
  ReferencePapers?: string[][];
  Routes?: string[][];
  RoutePoints?: string[][];
}

export const SHEET_NAMES = [
  "Layers",
  "Tours",
  "POIs",
  "Media",
  "ReferencePapers",
  "Routes",
  "RoutePoints",
] as const;

const LAYERS_HEADER = [
  "id",
  "name",
  "type",
  "urlTemplate",
  "attribution",
  "opacity",
  "minZoom",
  "maxZoom",
  "defaultVisible",
] as const;
const TOURS_HEADER = ["tourId", "title", "description", "layerIds"] as const;
const POIS_HEADER = ["tourId", "poiId", "name", "description", "lat", "lng"] as const;
const MEDIA_HEADER = ["tourId", "poiId", "url", "caption", "type"] as const;
const PAPERS_HEADER = ["tourId", "poiId", "url", "citation"] as const;
const ROUTES_HEADER = ["tourId", "routeId", "name"] as const;
const ROUTE_POINTS_HEADER = ["tourId", "routeId", "order", "lat", "lng"] as const;

/**
 * ヘッダー行を列名として扱い、以降の行をオブジェクトへ変換する。列の並び順が
 * ずれていてもヘッダー名で対応付けるため頑健。すべてのセルが空の行（余白行）
 * は除外する。
 */
function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const [header, ...dataRows] = rows;
  return dataRows
    .filter((row) => row.some((cell) => (cell ?? "") !== ""))
    .map((row) => {
      const obj: Record<string, string> = {};
      header.forEach((key, i) => {
        obj[key] = row[i] ?? "";
      });
      return obj;
    });
}

function objectsToRows(header: readonly string[], objects: Record<string, string>[]): string[][] {
  return [[...header], ...objects.map((obj) => header.map((key) => obj[key] ?? ""))];
}

export function layersToSheet(layers: LayerDefinition[]): string[][] {
  return objectsToRows(
    LAYERS_HEADER,
    layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      type: layer.type,
      urlTemplate: layer.urlTemplate,
      attribution: layer.attribution,
      opacity: String(layer.opacity),
      minZoom: String(layer.minZoom),
      maxZoom: String(layer.maxZoom),
      defaultVisible: String(layer.defaultVisible),
    })),
  );
}

export function sheetToLayers(rows: string[][]): LayerDefinition[] {
  return rowsToObjects(rows).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type as LayerType,
    urlTemplate: row.urlTemplate,
    attribution: row.attribution,
    opacity: Number(row.opacity),
    minZoom: Number(row.minZoom),
    maxZoom: Number(row.maxZoom),
    defaultVisible: row.defaultVisible === "true",
  }));
}

/**
 * 対象ツアー（tour.id）に該当する行をtour由来の内容で置き換え、他のツアーの
 * 行はそのまま保持する（読み込み→フィルタ→追記→書き戻しのマージ）。
 * Layersシートはツアーとは独立したグローバルなレイヤー一覧のため対象外。
 */
export function mergeTourIntoSheets(existing: SheetsData, tour: TourConfig): SheetsData {
  const keepOtherTours = (rows: string[][] | undefined): Record<string, string>[] =>
    rowsToObjects(rows ?? []).filter((row) => row.tourId !== tour.id);

  const toursRows = [
    ...keepOtherTours(existing.Tours),
    {
      tourId: tour.id,
      title: tour.title,
      description: tour.description ?? "",
      layerIds: tour.layerIds.join(","),
    },
  ];

  const poisRows = [
    ...keepOtherTours(existing.POIs),
    ...tour.pois.map((poi) => ({
      tourId: tour.id,
      poiId: poi.id,
      name: poi.name,
      description: poi.description,
      lat: String(poi.position.lat),
      lng: String(poi.position.lng),
    })),
  ];

  const mediaRows = [
    ...keepOtherTours(existing.Media),
    ...tour.pois.flatMap((poi) =>
      poi.media.map((media) => ({
        tourId: tour.id,
        poiId: poi.id,
        url: media.url,
        caption: media.caption,
        type: media.type,
      })),
    ),
  ];

  const papersRows = [
    ...keepOtherTours(existing.ReferencePapers),
    ...tour.pois.flatMap((poi) =>
      poi.referencePapers.map((paper) => ({
        tourId: tour.id,
        poiId: poi.id,
        url: paper.url,
        citation: paper.citation,
      })),
    ),
  ];

  const routesRows = [
    ...keepOtherTours(existing.Routes),
    ...tour.routes.map((route) => ({ tourId: tour.id, routeId: route.id, name: route.name })),
  ];

  const routePointsRows = [
    ...keepOtherTours(existing.RoutePoints),
    ...tour.routes.flatMap((route) =>
      route.points.map((point, index) => ({
        tourId: tour.id,
        routeId: route.id,
        order: String(index),
        lat: String(point.lat),
        lng: String(point.lng),
      })),
    ),
  ];

  return {
    Layers: existing.Layers,
    Tours: objectsToRows(TOURS_HEADER, toursRows),
    POIs: objectsToRows(POIS_HEADER, poisRows),
    Media: objectsToRows(MEDIA_HEADER, mediaRows),
    ReferencePapers: objectsToRows(PAPERS_HEADER, papersRows),
    Routes: objectsToRows(ROUTES_HEADER, routesRows),
    RoutePoints: objectsToRows(ROUTE_POINTS_HEADER, routePointsRows),
  };
}

export function extractTourFromSheets(sheets: SheetsData, tourId: string): TourConfig | null {
  const toursRow = rowsToObjects(sheets.Tours ?? []).find((row) => row.tourId === tourId);
  if (!toursRow) return null;

  const poiRows = rowsToObjects(sheets.POIs ?? []).filter((row) => row.tourId === tourId);
  const mediaRows = rowsToObjects(sheets.Media ?? []).filter((row) => row.tourId === tourId);
  const paperRows = rowsToObjects(sheets.ReferencePapers ?? []).filter((row) => row.tourId === tourId);
  const routeRows = rowsToObjects(sheets.Routes ?? []).filter((row) => row.tourId === tourId);
  const routePointRows = rowsToObjects(sheets.RoutePoints ?? []).filter((row) => row.tourId === tourId);

  const pois: PointOfInterest[] = poiRows.map((row) => ({
    id: row.poiId,
    name: row.name,
    description: row.description,
    position: { lat: Number(row.lat), lng: Number(row.lng) },
    media: mediaRows
      .filter((media) => media.poiId === row.poiId)
      .map((media) => ({ url: media.url, caption: media.caption, type: media.type as MediaType })),
    referencePapers: paperRows
      .filter((paper) => paper.poiId === row.poiId)
      .map((paper) => ({ url: paper.url, citation: paper.citation })),
  }));

  const routes: RoutePath[] = routeRows.map((row) => ({
    id: row.routeId,
    name: row.name,
    points: routePointRows
      .filter((point) => point.routeId === row.routeId)
      .sort((a, b) => Number(a.order) - Number(b.order))
      .map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) })),
  }));

  return {
    id: toursRow.tourId,
    title: toursRow.title,
    description: toursRow.description,
    layerIds: toursRow.layerIds ? toursRow.layerIds.split(",").filter((id) => id !== "") : [],
    pois,
    routes,
  };
}
