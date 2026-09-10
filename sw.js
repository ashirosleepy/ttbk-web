// ============================================================
// SW.JS — Service Worker cho TTBK (PWA)
// Chiến lược: "cache trước, mạng sau" cho các file tĩnh (giao diện),
// còn dữ liệu thật (Supabase) luôn lấy từ mạng — không cache lại
// để mọi người luôn thấy dữ liệu mới nhất, chỉ cache phần "vỏ" app.
// Tăng CACHE_VERSION mỗi khi đổi các file tĩnh để buộc cập nhật cache.
// ============================================================

const CACHE_VERSION = "ttbk-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Các file "vỏ" app — đủ để mở lại giao diện khi mất mạng tạm thời.
// Đường dẫn để tương đối theo scope của service worker (ngang cấp index.html).
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./css/shopping.css",
  "./manifest.json",
  "./css/ttbk.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Không để 1 file lỗi (404) làm hỏng toàn bộ cài đặt
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("ttbk-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Không cache API/DB (Supabase) hay tài nguyên ngoài origin — luôn lấy mới từ mạng.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("supabase")) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached); // mất mạng: dùng bản cache nếu có

      // Có cache sẵn thì trả ngay (nhanh), vẫn âm thầm cập nhật cache ở nền.
      return cached || networkFetch;
    })
  );
});
