import { buildTileUrl, getTileCoordsForBounds, type TileBounds } from "../utils/tileMath";

export interface ServiceWorkerContainerLike {
  register(scriptURL: string): Promise<unknown>;
}

export interface OfflineCacheServiceOptions {
  serviceWorkerContainer?: ServiceWorkerContainerLike;
  swUrl?: string;
  cachesApi?: CacheStorage;
  cacheName?: string;
  fetchFn?: typeof fetch;
}

export interface PrecacheProgress {
  completed: number;
  total: number;
}

export interface PrecacheAreaOptions {
  bounds: TileBounds;
  zoomLevels: number[];
  urlTemplates: string[];
  onProgress?: (progress: PrecacheProgress) => void;
  concurrency?: number;
}

const DEFAULT_SW_URL = "sw.js";
const DEFAULT_CACHE_NAME = "fieldtour-tiles-v1";
const DEFAULT_PRECACHE_CONCURRENCY = 6;

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const index = nextIndex++;
    if (index >= items.length) return;
    await worker(items[index]);
    await runNext();
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
}

export class OfflineCacheService {
  private readonly container?: ServiceWorkerContainerLike;
  private readonly swUrl: string;
  private readonly cachesApi?: CacheStorage;
  private readonly cacheName: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: OfflineCacheServiceOptions = {}) {
    this.container =
      options.serviceWorkerContainer ??
      (typeof navigator !== "undefined" ? navigator.serviceWorker : undefined);
    this.swUrl = options.swUrl ?? DEFAULT_SW_URL;
    this.cachesApi = options.cachesApi ?? (typeof caches !== "undefined" ? caches : undefined);
    this.cacheName = options.cacheName ?? DEFAULT_CACHE_NAME;
    // ネイティブfetchはwindowにバインドされていないと"Illegal invocation"に
    // なるため、メソッド呼び出し(this.fetchFn(url))でも安全なようラップする。
    this.fetchFn = options.fetchFn ?? ((...args) => fetch(...args));
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

  /**
   * 指定範囲・ズームレベルのタイルをまとめて取得する（Requirement 3.4）。
   * 取得したレスポンスはService Worker（public/sw.js）のfetchハンドラが
   * 自動的にキャッシュへ格納するため、ここではfetchを発行するのみでよい。
   * 個々のタイル取得の失敗は無視して残りのタイルの取得を継続する。
   */
  async precacheArea(options: PrecacheAreaOptions): Promise<void> {
    const urls = options.urlTemplates.flatMap((template) =>
      options.zoomLevels.flatMap((zoom) =>
        getTileCoordsForBounds(options.bounds, zoom).map((coord) => buildTileUrl(template, coord)),
      ),
    );

    let completed = 0;
    const total = urls.length;
    options.onProgress?.({ completed, total });

    await runWithConcurrency(urls, options.concurrency ?? DEFAULT_PRECACHE_CONCURRENCY, async (url) => {
      try {
        await this.fetchFn(url);
      } catch (error) {
        console.warn(`タイルの事前キャッシュに失敗しました: ${url}`, error);
      }
      completed++;
      options.onProgress?.({ completed, total });
    });
  }
}
