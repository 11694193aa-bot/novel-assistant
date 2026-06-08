// 最小 PWA Service Worker — 让 App 可安装
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
self.addEventListener('fetch', (e) => {
  // 对 API 请求走网络，其他缓存
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open('v1').then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
