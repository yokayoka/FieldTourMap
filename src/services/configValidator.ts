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

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}

export function validateLayerDefinition(layer: LayerDefinition): ValidationResult {
  const errors: string[] = [];

  if (layer.id.trim() === "") errors.push("idが空です");
  if (layer.name.trim() === "") errors.push("nameが空です");
  if (!layer.urlTemplate.includes("{z}")) errors.push("urlTemplateに{z}プレースホルダがありません");
  if (!layer.urlTemplate.includes("{x}")) errors.push("urlTemplateに{x}プレースホルダがありません");
  if (!layer.urlTemplate.includes("{y}")) errors.push("urlTemplateに{y}プレースホルダがありません");
  if (layer.opacity < 0 || layer.opacity > 1) errors.push("opacityは0から1の範囲で指定してください");
  if (layer.minZoom > layer.maxZoom) errors.push("minZoomはmaxZoom以下である必要があります");

  return errors.length === 0 ? ok() : fail(errors);
}

export function validateMediaLink(media: MediaLink): ValidationResult {
  const errors: string[] = [];

  if (!isHttpUrl(media.url)) errors.push("urlはhttp(s)://で始まる必要があります");
  if (media.caption.trim() === "") errors.push("captionが空です");

  return errors.length === 0 ? ok() : fail(errors);
}

export function validateReferencePaper(paper: ReferencePaper): ValidationResult {
  const errors: string[] = [];

  if (!isHttpUrl(paper.url)) errors.push("urlはhttp(s)://で始まる必要があります");
  if (paper.citation.trim() === "") errors.push("citationが空です");

  return errors.length === 0 ? ok() : fail(errors);
}

function validateRoute(route: RoutePath): ValidationResult {
  const errors: string[] = [];

  if (route.name.trim() === "") errors.push("nameが空です");
  if (route.points.length < 2) errors.push("pointsは2点以上必要です");

  return errors.length === 0 ? ok() : fail(errors);
}

export function validateTourConfig(tour: TourConfig): ValidationResult {
  const errors: string[] = [];

  if (tour.id.trim() === "") errors.push("idが空です");
  if (tour.title.trim() === "") errors.push("titleが空です");

  tour.pois.forEach((poi, index) => {
    if (poi.name.trim() === "") errors.push(`pois[${index}]: nameが空です`);
    if (poi.description.trim() === "") errors.push(`pois[${index}]: descriptionが空です`);

    poi.media.forEach((media, mediaIndex) => {
      const result = validateMediaLink(media);
      result.errors.forEach((error) =>
        errors.push(`pois[${index}].media[${mediaIndex}]: ${error}`),
      );
    });

    poi.referencePapers.forEach((paper, paperIndex) => {
      const result = validateReferencePaper(paper);
      result.errors.forEach((error) =>
        errors.push(`pois[${index}].referencePapers[${paperIndex}]: ${error}`),
      );
    });
  });

  tour.routes.forEach((route, index) => {
    const result = validateRoute(route);
    result.errors.forEach((error) => errors.push(`routes[${index}]: ${error}`));
  });

  return errors.length === 0 ? ok() : fail(errors);
}
