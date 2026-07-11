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
});
