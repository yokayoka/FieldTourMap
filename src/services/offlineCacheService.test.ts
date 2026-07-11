import { describe, expect, it, vi } from "vitest";
import { OfflineCacheService, type ServiceWorkerContainerLike } from "./offlineCacheService";

function createFakeContainer(): ServiceWorkerContainerLike & {
  register: ReturnType<typeof vi.fn>;
} {
  return {
    register: vi.fn().mockResolvedValue({ scope: "/" }),
  };
}

function createFakeCache(entries: string[] = []): Cache {
  return {
    match: vi.fn(async (request: RequestInfo) => {
      const url = typeof request === "string" ? request : request.url;
      return entries.includes(url) ? new Response("tile") : undefined;
    }),
  } as unknown as Cache;
}

function createFakeCachesApi(entries: string[] = []): CacheStorage {
  const cache = createFakeCache(entries);
  return {
    open: vi.fn().mockResolvedValue(cache),
  } as unknown as CacheStorage;
}

describe("OfflineCacheService", () => {
  it("registers the service worker with the configured script URL", async () => {
    const container = createFakeContainer();
    const service = new OfflineCacheService({ serviceWorkerContainer: container, swUrl: "sw.js" });

    await service.register();

    expect(container.register).toHaveBeenCalledWith("sw.js");
  });

  it("does not throw when service workers are unsupported", async () => {
    const service = new OfflineCacheService({ serviceWorkerContainer: undefined });

    await expect(service.register()).resolves.toBeUndefined();
  });

  it("does not throw when registration itself rejects", async () => {
    const container = createFakeContainer();
    container.register.mockRejectedValue(new Error("not allowed in this context"));
    const service = new OfflineCacheService({ serviceWorkerContainer: container });

    await expect(service.register()).resolves.toBeUndefined();
  });

  it("reports a tile as cached when the cache has a matching entry", async () => {
    const cachesApi = createFakeCachesApi(["https://example.com/tile/1/2/3.png"]);
    const service = new OfflineCacheService({ cachesApi, cacheName: "fieldtour-tiles-v1" });

    const result = await service.isTileCached("https://example.com/tile/1/2/3.png");

    expect(result).toBe(true);
  });

  it("reports a tile as not cached when there is no matching entry", async () => {
    const cachesApi = createFakeCachesApi([]);
    const service = new OfflineCacheService({ cachesApi });

    const result = await service.isTileCached("https://example.com/tile/1/2/3.png");

    expect(result).toBe(false);
  });

  it("reports false without throwing when the Cache API is unavailable", async () => {
    const service = new OfflineCacheService({ cachesApi: undefined });

    await expect(service.isTileCached("https://example.com/tile/1/2/3.png")).resolves.toBe(false);
  });

  describe("precacheArea", () => {
    // 単一タイルとなるよう、zoom 0（世界全体が1タイル）を使う。
    const WORLD_BOUNDS = { north: 45, south: -45, east: 170, west: -170 };

    it("fetches every tile url across the given zoom levels and templates", async () => {
      const fetchFn = vi.fn().mockResolvedValue(new Response("tile"));
      const service = new OfflineCacheService({ fetchFn });

      await service.precacheArea({
        bounds: WORLD_BOUNDS,
        zoomLevels: [0],
        urlTemplates: ["https://a.example/{z}/{x}/{y}.png", "https://b.example/{z}/{x}/{y}.png"],
      });

      expect(fetchFn).toHaveBeenCalledWith("https://a.example/0/0/0.png");
      expect(fetchFn).toHaveBeenCalledWith("https://b.example/0/0/0.png");
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it("reports progress from 0 up to the total tile count", async () => {
      const fetchFn = vi.fn().mockResolvedValue(new Response("tile"));
      const service = new OfflineCacheService({ fetchFn });
      const onProgress = vi.fn();

      await service.precacheArea({
        bounds: WORLD_BOUNDS,
        zoomLevels: [0],
        urlTemplates: ["https://a.example/{z}/{x}/{y}.png"],
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledWith({ completed: 0, total: 1 });
      expect(onProgress).toHaveBeenLastCalledWith({ completed: 1, total: 1 });
    });

    it("continues precaching remaining tiles when one tile fetch fails", async () => {
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce(new Response("tile"))
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce(new Response("tile"));
      const service = new OfflineCacheService({ fetchFn });
      const onProgress = vi.fn();

      // zoom 0（世界全体が1タイル）× 3テンプレートで、確実に3件のURLにする。
      await expect(
        service.precacheArea({
          bounds: WORLD_BOUNDS,
          zoomLevels: [0],
          urlTemplates: [
            "https://a.example/{z}/{x}/{y}.png",
            "https://b.example/{z}/{x}/{y}.png",
            "https://c.example/{z}/{x}/{y}.png",
          ],
          onProgress,
          concurrency: 1,
        }),
      ).resolves.toBeUndefined();

      expect(fetchFn).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenLastCalledWith({ completed: 3, total: 3 });
    });

    it("limits the number of concurrent tile fetches in flight", async () => {
      let active = 0;
      let maxActive = 0;
      const fetchFn = vi.fn(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        return new Response("tile");
      });
      const service = new OfflineCacheService({ fetchFn });

      await service.precacheArea({
        bounds: { north: 10, south: -10, east: 10, west: -10 },
        zoomLevels: [4],
        urlTemplates: ["https://a.example/{z}/{x}/{y}.png"],
        concurrency: 2,
      });

      expect(maxActive).toBeLessThanOrEqual(2);
      expect(fetchFn.mock.calls.length).toBeGreaterThan(2);
    });
  });
});
