import type { ShareViewState } from "../types/config";
import { copyToClipboard, defaultClipboard, type ClipboardLike } from "../utils/clipboard";

export type { ClipboardLike };

export interface WebShareLike {
  share(data: { url: string }): Promise<void>;
  canShare?(data?: { url: string }): boolean;
}

export interface ShareLinkServiceOptions {
  baseUrl?: string;
  clipboard?: ClipboardLike;
  webShare?: WebShareLike;
}

const COORDINATE_PRECISION = 6;

function defaultBaseUrl(): string {
  if (typeof location === "undefined") return "";
  return `${location.origin}${location.pathname}`;
}

function defaultWebShare(): WebShareLike | undefined {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return undefined;
  return navigator;
}

export class ShareLinkService {
  private readonly baseUrl: string;
  private readonly clipboard?: ClipboardLike;
  private readonly webShare?: WebShareLike;

  constructor(options: ShareLinkServiceOptions = {}) {
    this.baseUrl = options.baseUrl ?? defaultBaseUrl();
    this.clipboard = options.clipboard ?? defaultClipboard();
    this.webShare = options.webShare ?? defaultWebShare();
  }

  /**
   * ビュー状態をURLへエンコードする（Requirement 13.1, 13.2, 13.6）。
   * 簡潔さのため座標は小数点以下6桁（約11cm精度）に丸める。
   */
  encode(state: ShareViewState): string {
    const params = new URLSearchParams();
    params.set("lat", state.lat.toFixed(COORDINATE_PRECISION));
    params.set("lng", state.lng.toFixed(COORDINATE_PRECISION));
    params.set("zoom", String(state.zoom));
    params.set("base", state.baseLayerId);
    if (state.overlayLayerIds.length > 0) {
      params.set("overlay", state.overlayLayerIds.join(","));
    }
    if (state.poiId) {
      params.set("poi", state.poiId);
    }
    if (state.tourId) {
      params.set("tour", state.tourId);
    }
    if (state.projectId) {
      params.set("project", state.projectId);
    }

    const separator = this.baseUrl.includes("?") ? "&" : "?";
    return `${this.baseUrl}${separator}${params.toString()}`;
  }

  /**
   * 共有URLからビュー状態を復元する。不正・破損したURL（パラメータ欠損・
   * 数値として解釈できない等）の場合はnullを返し、呼び出し側で初期表示
   * へのフォールバックを行わせる（Requirement 13.7）。
   */
  decode(url: string): ShareViewState | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    const params = parsed.searchParams;
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const zoom = Number(params.get("zoom"));
    const baseLayerId = params.get("base");

    if (
      params.get("lat") === null ||
      params.get("lng") === null ||
      params.get("zoom") === null ||
      !baseLayerId ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(zoom)
    ) {
      return null;
    }

    const overlayParam = params.get("overlay");
    const overlayLayerIds = overlayParam ? overlayParam.split(",").filter((id) => id !== "") : [];
    const poiId = params.get("poi") ?? undefined;
    const tourId = params.get("tour") ?? undefined;
    const projectId = params.get("project") ?? undefined;

    return {
      lat,
      lng,
      zoom,
      baseLayerId,
      overlayLayerIds,
      ...(poiId ? { poiId } : {}),
      ...(tourId ? { tourId } : {}),
      ...(projectId ? { projectId } : {}),
    };
  }

  async copyToClipboard(url: string): Promise<boolean> {
    return copyToClipboard(url, this.clipboard);
  }

  async shareViaWebShareApi(url: string): Promise<boolean> {
    if (!this.webShare) return false;
    try {
      await this.webShare.share({ url });
      return true;
    } catch {
      return false;
    }
  }
}
