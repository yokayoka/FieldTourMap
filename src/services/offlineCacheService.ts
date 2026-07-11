export interface ServiceWorkerContainerLike {
  register(scriptURL: string): Promise<unknown>;
}

export interface OfflineCacheServiceOptions {
  serviceWorkerContainer?: ServiceWorkerContainerLike;
  swUrl?: string;
  cachesApi?: CacheStorage;
  cacheName?: string;
}

const DEFAULT_SW_URL = "sw.js";
const DEFAULT_CACHE_NAME = "fieldtour-tiles-v1";

export class OfflineCacheService {
  private readonly container?: ServiceWorkerContainerLike;
  private readonly swUrl: string;
  private readonly cachesApi?: CacheStorage;
  private readonly cacheName: string;

  constructor(options: OfflineCacheServiceOptions = {}) {
    this.container =
      options.serviceWorkerContainer ??
      (typeof navigator !== "undefined" ? navigator.serviceWorker : undefined);
    this.swUrl = options.swUrl ?? DEFAULT_SW_URL;
    this.cachesApi = options.cachesApi ?? (typeof caches !== "undefined" ? caches : undefined);
    this.cacheName = options.cacheName ?? DEFAULT_CACHE_NAME;
  }

  async register(): Promise<void> {
    if (!this.container) return;
    try {
      await this.container.register(this.swUrl);
    } catch (error) {
      // Service Worker登録の失敗（未対応環境・非HTTPS等）はオフライン
      // キャッシュ機能なしでの継続を許容し、アプリ全体は落とさない。
      console.warn("Service Workerの登録に失敗しました", error);
    }
  }

  async isTileCached(url: string): Promise<boolean> {
    if (!this.cachesApi) return false;
    const cache = await this.cachesApi.open(this.cacheName);
    const match = await cache.match(url);
    return match !== undefined;
  }
}
