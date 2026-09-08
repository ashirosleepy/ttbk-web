// sw.js — Service Worker cho thông báo đẩy (push notification) của TTBK
// Đặt file này ở thư mục gốc (cùng cấp với index.html) để phạm vi (scope) bao trùm cả trang.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Nhận push từ server (Supabase Edge Function) và hiển thị notification
self.addEventListener('push', (event) => {
  let payload = { title: 'TTBK — Việc nhà', body: 'Bạn có thông báo mới.' };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/badge-72.png',
    tag: payload.tag || 'ttbk-notification',
    data: { url: payload.url || '/index.html' },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'TTBK — Việc nhà', options));
});

// Khi người dùng bấm vào notification -> mở/focus đúng tab của app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl.split('?')[0]) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
