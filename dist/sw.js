// PWA Service Worker v7 — 纯透传，调试模式
const CACHE = 'novel-v7';

// 安装时跳过等待
self.addEventListener('install', () => self.skipWaiting());

// 激活时清理所有旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => caches.delete(k))
    )).then(() => clients.claim())
  );
});

// 全部请求走网络，不缓存
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request));
});
