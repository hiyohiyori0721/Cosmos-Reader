/* Cosmos-Reader Service Worker
 * 预缓存应用壳（index/css/js），lib/（epub/pdf/jszip）保持按需加载；
 * 访问过的资源做运行时缓存，实现离线可用。
 * 缓存治理：
 *  - 写入时去掉 ?v= query（cache-busting）作为 key，同资源只保留最新版本
 *  - 运行时缓存有上限（条目数 + 总字节），超限从最旧清理（保护 SHELL 与 lib） */
const CACHE = 'cosmos-reader-v6';
const SHELL = [
  './',
  './index.html',
  './css/variables.css',
  './css/base.css',
  './css/topbar.css',
  './css/reader.css',
  './css/panels.css',
  './css/settings.css',
  './css/library.css',
  './css/modals.css',
  './css/toast.css',
  './js/storage.js',
  './js/reader.js',
  './js/app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];
// 清理缓存时保护的核心资源（离线打开书籍依赖 lib）
const PROTECTED = SHELL
  .concat(['lib/jszip.min.js', 'lib/epub.min.js', 'lib/pdf.min.js', 'lib/pdf.worker.min.js'])
  .map((p) => new URL(p, self.location.origin).href);
const MAX_ENTRIES = 80;             // 运行时缓存最大条目数
const MAX_BYTES = 50 * 1024 * 1024; // 运行时缓存最大总字节（50MB）

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** 清理运行时缓存：超限时从最旧开始删除（跳过 PROTECTED 核心资源） */
async function trimCache() {
  try {
    const cache = await caches.open(CACHE);
    const keys = await cache.keys();
    let total = 0;
    const sizes = new Map();
    for (const req of keys) {
      if (PROTECTED.includes(req.url)) { sizes.set(req.url, 0); continue; }
      let size = 0;
      const res = await cache.match(req);
      if (res) {
        const cl = res.headers.get('Content-Length');
        size = cl ? parseInt(cl, 10) : (await res.clone().blob()).size;
      }
      sizes.set(req.url, size);
      total += size;
    }
    let i = 0;
    while (i < keys.length && (keys.length - i > MAX_ENTRIES || total > MAX_BYTES)) {
      const req = keys[i];
      if (PROTECTED.includes(req.url)) { i++; continue; }
      if (await cache.delete(req)) total -= sizes.get(req.url) || 0;
      i++;
    }
  } catch (_) {}
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  // 网络优先：保证 cache-busting 的 ?v= 新代码总是生效（避免命中旧 SW 缓存）；
  // 网络失败（离线）时回退缓存（ignoreSearch 命中无 query 条目，离线可用）
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          // 归一化缓存 key（去 ?v= query），避免版本更新导致旧条目堆积
          const cleanUrl = req.url.split('?')[0];
          caches.open(CACHE).then((c) => {
            c.put(cleanUrl, copy);
            trimCache();
          });
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
