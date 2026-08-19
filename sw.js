const CACHE_NAME = 'trd-journey-v110-dimensions-1-to-5-mobile-touch-target-scatter-enhancement';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=v110-dimensions-1-to-5-mobile-touch-target-scatter-enhancement',
  './audioEngine.js?v=v110-dimensions-1-to-5-mobile-touch-target-scatter-enhancement',
  './dataEngine.js?v=v110-dimensions-1-to-5-mobile-touch-target-scatter-enhancement',
  './dock.js?v=v110-dimensions-1-to-5-mobile-touch-target-scatter-enhancement',
  './gallery.js?v=v110-dimensions-1-to-5-mobile-touch-target-scatter-enhancement',
  './app.js?v=v110-dimensions-1-to-5-mobile-touch-target-scatter-enhancement',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((networkRes) => {
      if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
        const clone = networkRes.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
      }
      return networkRes;
    }).catch(() => {
      return caches.match(e.request).then((res) => {
        if (res) return res;
        if (e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
