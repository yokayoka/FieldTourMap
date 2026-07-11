import type { GoogleMapsLinkParams } from "../types/config";
import { copyToClipboard, defaultClipboard, type ClipboardLike } from "../utils/clipboard";

export interface GoogleMapsLinkServiceOptions {
  clipboard?: ClipboardLike;
}

const COORDINATE_PRECISION = 6;

export class GoogleMapsLinkService {
  private readonly clipboard?: ClipboardLike;

  constructor(options: GoogleMapsLinkServiceOptions = {}) {
    this.clipboard = "clipboard" in options ? options.clipboard : defaultClipboard();
  }

  /**
   * ピン留め（検索）形式のGoogleマップURLを生成する（Requirement 14.2）。
   * 送信先が自分のGoogleマップアプリでも他者へのSNS共有でも、出発地に
   * 依存せず汎用的に使えるようdirections形式ではなくsearch形式を使う。
   */
  buildSearchUrl(params: GoogleMapsLinkParams): string {
    const lat = params.lat.toFixed(COORDINATE_PRECISION);
    const lng = params.lng.toFixed(COORDINATE_PRECISION);
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  async copyToClipboard(url: string): Promise<boolean> {
    return copyToClipboard(url, this.clipboard);
  }
}
