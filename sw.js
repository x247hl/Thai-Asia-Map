const CACHE_NAME = "thaiasia-map-v88";
const TILES_CACHE_NAME = "thaiasia-tiles-v1";
const MAX_CACHED_TILES = 2000;

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
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    })
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

// Giới hạn số lượng tile lưu trong bộ nhớ đệm để không tốn dung lượng máy
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

  // 1. Tuyệt đối không cache API để trạng thái đơn/shipper luôn lấy dữ liệu mới nhất
  if (url.hostname === "api.thaiasiasushibar.de") {
    return;
  }

  // 2. Không cache lớp giao thông trực tiếp (traffic overlay) vì thay đổi từng phút
  const lyrs = url.searchParams.get("lyrs");
  if (lyrs === "traffic" || lyrs === "h,traffic") {
    return;
  }

  // 3. Cache-First cho các mảnh bản đồ nền tĩnh (Google Maps base 'lyrs=m', OSM, CartoDB)
  const isBaseTile =
    (url.hostname.includes("google.com") && lyrs === "m") ||
    url.hostname.includes("tile.openstreetmap.org") ||
    url.hostname.includes("tile.openstreetmap.de") ||
    url.hostname.includes("cartocdn.com");

  if (isBaseTile) {
    event.respondWith(
      caches.open(TILES_CACHE_NAME).then(async cache => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
            limitCacheSize(TILES_CACHE_NAME, MAX_CACHED_TILES);
          }
          return networkResponse;
        } catch (err) {
          return cachedResponse || Promise.reject(err);
        }
      })
    );
    return;
  }

  // 4. Tài nguyên App Shell cục bộ (HTML, JS, CSS, Icons)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        // Nếu là file tĩnh (Leaflet, ảnh, manifest): trả về cache ngay (0ms)
        const isStaticAsset =
          url.pathname.endsWith(".js") ||
          url.pathname.endsWith(".css") ||
          url.pathname.endsWith(".png") ||
          url.pathname.endsWith(".json");

        if (cached && isStaticAsset) {
          // Trả về cache ngay, cập nhật ngầm nếu có bản mới
          fetch(event.request)
            .then(networkRes => {
              if (networkRes && networkRes.status === 200) {
                caches.open(CACHE_NAME).then(c => c.put(event.request, networkRes));
              }
            })
            .catch(() => { });
          return cached;
        }

        // Với index.html: thử mạng trước (nhanh), fallback cache nếu mạng chậm/lỗi
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
