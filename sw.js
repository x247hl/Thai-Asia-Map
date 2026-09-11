const CACHE_NAME = "thaiasia-map-v90";
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

// Giới hạn dung lượng cache tile nếu vượt quá 10.000 ô (chạy ngầm lúc activate, không chặn fetch)
async function pruneTilesCacheIfNeeded() {
  try {
    const cache = await caches.open(TILES_CACHE_NAME);
    const keys = await cache.keys();
    if (keys.length > MAX_CACHED_TILES) {
      const deleteCount = keys.length - MAX_CACHED_TILES;
      for (let i = 0; i < deleteCount; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch (e) { }
}

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== TILES_CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => pruneTilesCacheIfNeeded())
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // 1. Không cache API đơn hàng/shipper
  if (url.hostname === "api.thaiasiasushibar.de") {
    return;
  }

  // 2. Mảnh bản đồ Google Maps / OSM / CartoDB -> Chiến lược Cache-First ("Load 1 lần nhớ mãi")
  // Nếu đã xem qua rồi -> nạp tức thì 0ms từ bộ nhớ máy, siêu mượt, không tốn mạng
  // Nếu chưa có -> tải từ mạng và tự động lưu vào máy vĩnh viễn
  const isMapTile =
    url.hostname.includes("google.com") ||
    url.hostname.includes("tile.openstreetmap") ||
    url.hostname.includes("cartocdn.com");

  if (isMapTile && (url.pathname.includes("/vt/") || url.pathname.endsWith(".png"))) {
    event.respondWith(
      caches.open(TILES_CACHE_NAME).then(async cache => {
        // 1. Đọc từ cache trước (0ms)
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // 2. Chưa có trong cache -> tải từ mạng và lưu vào máy
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === "opaque")) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return cachedResponse || new Response("", { status: 408, headers: { "Content-Type": "image/png" } });
        }
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
