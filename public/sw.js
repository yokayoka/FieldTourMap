// 野外実習中の圏外・電波不良を想定し、閲覧済みの地図タイルをキャッシュする
// Service Worker（Requirement 3）。アプリ本体（JS/CSS/HTML）のキャッシュは
// 対象外とし、地図タイルのcache-first-with-network-fallbackのみを担う。

const CACHE_NAME = "fieldtour-tiles-v1";

// 対応するタイル配信元ホスト（design.md記載のGSI/産総研/OSM等）。
const TILE_HOSTS = ["cyberjapandata.gsi.go.jp", "gbank.gsj.jp", "tile.openstreetmap.org"];

function isTileRequest(request) {
  if (request.method !== "GET") return false;
  try {
    const url = new URL(request.url);
    return TILE_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (!isTileRequest(event.request)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      // <img>タグ経由のクロスオリジンタイルリクエストはno-corsとなり、
      // レスポンスはopaque（status:0, ok:false）になる。内容は検査できない
      // が有効なレスポンスなのでキャッシュしてよい。
      if (response.ok || response.type === "opaque") {
        cache.put(event.request, response.clone());
      }
      return response;
    }),
  );
});
