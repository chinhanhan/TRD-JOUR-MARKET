const CACHE_NAME = 'trd-journey-v204';
const ASSETS = [
  './', './index.html', './styles.css', './dock.css', './auth.css',
  './firebaseConfig.js', './auth.js', './cloudSync.js', './stateSyncCore.js', './backupCore.js',
  './audioEngine.js', './dataEngine.js', './dock.js', './gallery.js', './app.js',
  './longGameLogic.js', './manifest.json', './assets/tng_duitnow_qr.png'
];
const EXTERNAL = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js',
  ...['app', 'auth', 'firestore', 'storage', 'analytics'].map(name =>
    `https://www.gstatic.com/firebasejs/10.12.0/firebase-${name}-compat.js`)
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    await cache.addAll(ASSETS);
    // Optional CDN caching must not prevent the core app from installing.
    await Promise.allSettled(EXTERNAL.map(url => cache.add(url)));
  }));
  // Updates wait for the user's reload action to avoid mixing live versions.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('trd-journey-') && key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (event.data?.action === 'skipWaiting') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const local = url.origin === self.location.origin;
  const allowed = local ? ASSETS.some(asset => new URL(asset, self.registration.scope).pathname === url.pathname) : EXTERNAL.includes(url.href);
  if (!allowed) return; // Never cache authentication, Firestore or payment APIs.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    // A coherent installed version remains in use until the update is activated.
    if (cached) return cached;
    return fetch(event.request);
  })());
});
