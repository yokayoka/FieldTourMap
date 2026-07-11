import type {
  LayerDefinition,
  MediaLink,
  ReferencePaper,
  RoutePath,
  TourConfig,
} from "../types/config";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

function fail(errors: string[]): ValidationResult {
  return { valid: false, errors };
}

function isHttpUrl(url: unknown): boolean {
  return typeof url === "string" && /^https?:\/\//.test(url);
}

// configLoaderはfetchしたJSONを`as T`で無検査キャストしてから渡すため、
// 実行時にはフィールド欠落・型不一致の値が渡ってくる可能性がある。
// 各フィールドは呼び出し前に型を確認し、想定外の値は例外ではなく
// バリデーションエラーとして報告する。
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateLayerDefinition(layer: LayerDefinition): ValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(layer.id)) errors.push("idが空です");
  if (!isNonEmptyString(layer.name)) errors.push("nameが空です");

  if (typeof layer.urlTemplate !== "string") {
    errors.push("urlTemplateが文字列ではありません");
  } else {
    if (!layer.urlTemplate.includes("{z}")) errors.push("urlTemplateに{z}プレースホルダがありません");
    if (!layer.urlTemplate.includes("{x}")) errors.push("urlTemplateに{x}プレースホルダがありません");
    if (!layer.urlTemplate.includes("{y}")) errors.push("urlTemplateに{y}プレースホルダがありません");
  }

  if (!isFiniteNumber(layer.opacity) || layer.opacity < 0 || layer.opacity > 1) {
    errors.push("opacityは0から1の範囲で指定してください");
  }

  if (!isFiniteNumber(layer.minZoom) || !isFiniteNumber(layer.maxZoom)) {
    errors.push("minZoom/maxZoomは数値で指定してください");
  } else if (layer.minZoom > layer.maxZoom) {
    errors.push("minZoomはmaxZoom以下である必要があります");
  }

  return errors.length === 0 ? ok() : fail(errors);
}

export function validateMediaLink(media: MediaLink): ValidationResult {
  const errors: string[] = [];

  if (!isHttpUrl(media.url)) errors.push("urlはhttp(s)://で始まる必要があります");
  if (!isNonEmptyString(media.caption)) errors.push("captionが空です");

  return errors.length === 0 ? ok() : fail(errors);
}

export function validateReferencePaper(paper: ReferencePaper): ValidationResult {
  const errors: string[] = [];

  if (!isHttpUrl(paper.url)) errors.push("urlはhttp(s)://で始まる必要があります");
  if (!isNonEmptyString(paper.citation)) errors.push("citationが空です");

  return errors.length === 0 ? ok() : fail(errors);
}

function validateRoute(route: RoutePath): ValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(route.name)) errors.push("nameが空です");
  if (!Array.isArray(route.points) || route.points.length < 2) {
    errors.push("pointsは2点以上必要です");
  }

  return errors.length === 0 ? ok() : fail(errors);
}

export function validateTourConfig(tour: TourConfig): ValidationResult {
  const errors: string[] = [];

  if (!isNonEmptyString(tour.id)) errors.push("idが空です");
  if (!isNonEmptyString(tour.title)) errors.push("titleが空です");

  if (!Array.isArray(tour.pois)) {
    errors.push("poisが配列ではありません");
  } else {
    tour.pois.forEach((poi, index) => {
      if (!isNonEmptyString(poi.name)) errors.push(`pois[${index}]: nameが空です`);
      if (!isNonEmptyString(poi.description)) errors.push(`pois[${index}]: descriptionが空です`);

      if (!Array.isArray(poi.media)) {
        errors.push(`pois[${index}]: mediaが配列ではありません`);
      } else {
        poi.media.forEach((media, mediaIndex) => {
          const result = validateMediaLink(media);
          result.errors.forEach((error) =>
            errors.push(`pois[${index}].media[${mediaIndex}]: ${error}`),
          );
        });
      }

      if (!Array.isArray(poi.referencePapers)) {
        errors.push(`pois[${index}]: referencePapersが配列ではありません`);
      } else {
        poi.referencePapers.forEach((paper, paperIndex) => {
          const result = validateReferencePaper(paper);
          result.errors.forEach((error) =>
            errors.push(`pois[${index}].referencePapers[${paperIndex}]: ${error}`),
          );
        });
      }
    });
  }

  if (!Array.isArray(tour.routes)) {
    errors.push("routesが配列ではありません");
  } else {
    tour.routes.forEach((route, index) => {
      const result = validateRoute(route);
      result.errors.forEach((error) => errors.push(`routes[${index}]: ${error}`));
    });
  }

  return errors.length === 0 ? ok() : fail(errors);
}
