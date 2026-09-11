const CACHE_NAME = "thaiasia-map-v88";
const TILES_CACHE_NAME = "thaiasia-tiles-v1";
const MAX_CACHED_TILES = 10000;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./shipper-car-top.png",
  "./shipper-car-side.png",
  "./leaflet/leaflet.js",
  "./leaflet/leaflet.css",
  "./leaflet/images/marker-icon.png",
  "./leaflet/images/marker-icon-2x.png",
  "./leaflet/images/marker-shadow.png",
  "./leaflet/images/layers.png",
  "./leaflet/images/layers-2x.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)),
      caches.open(TILES_CACHE_NAME)
    ])
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== TILES_CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

async function limitCacheSize(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const deleteCount = keys.length - maxItems;
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (e) { }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // 1. Không cache API đơn hàng/shipper
  if (url.hostname === "api.thaiasiasushibar.de") {
    return;
  }

  // 2. Mảnh bản đồ Google Maps / OSM / CartoDB -> Chiến lược "Load 1 lần nhớ mãi"
  // Đã tải 1 lần là lưu vĩnh viễn trên máy, mở lại nạp tức thì 0ms, không sợ mất mạng
  const isMapTile =
    url.hostname.includes("google.com") ||
    url.hostname.includes("tile.openstreetmap") ||
    url.hostname.includes("cartocdn.com");

  if (isMapTile && (url.pathname.includes("/vt/") || url.pathname.endsWith(".png"))) {
    event.respondWith(
      caches.open(TILES_CACHE_NAME).then(async cache => {
        const cachedResponse = await cache.match(event.request);

        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === "opaque")) {
              const copy = networkResponse.clone();
              cache.put(event.request, copy);
              limitCacheSize(TILES_CACHE_NAME, MAX_CACHED_TILES);
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        // Nếu đã có sẵn trên máy -> trả về ngay 0ms, đồng thời chạy ngầm cập nhật
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. Tài nguyên App Shell cục bộ (HTML, JS, CSS, PNG)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const isStaticAsset =
          url.pathname.endsWith(".js") ||
          url.pathname.endsWith(".css") ||
          url.pathname.endsWith(".png") ||
          url.pathname.endsWith(".json");

        if (cached && isStaticAsset) {
          fetch(event.request)
            .then(networkRes => {
              if (networkRes && networkRes.status === 200) {
                caches.open(CACHE_NAME).then(c => c.put(event.request, networkRes));
              }
            })
            .catch(() => { });
          return cached;
        }

        return fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => cached || caches.match("./index.html"));
      })
    );
  }
});
