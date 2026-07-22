/* PHONE GAT service worker — enables installability + offline fallback.
   Strategy: network-first for all same-origin GETs (content always fresh online),
   fall back to cache when offline. Bump CACHE to invalidate on major asset changes. */
const CACHE = 'pg-v1';
const SHELL = ['./', './index.html', './manifest.json', './logo.jpg', './logo-mark.png', './icon-192.png', './whatsapp-logo.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return; // leave analytics / fonts / web3forms alone
  e.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.ok) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (r) {
          return r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined);
        });
      })
  );
});
