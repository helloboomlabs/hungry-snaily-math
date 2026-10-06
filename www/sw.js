/* Offline support for the web version (not used inside the iOS app).
   Caches the whole game on first visit so it works without internet.
   CACHE_VERSION is replaced with the commit id by the Pages workflow. */
const CACHE = 'snaily-CACHE_VERSION';
const FILES = [
  './', 'index.html', 'garden.html', 'story.html', 'support.js', 'manifest.webmanifest',
  'app/app.css', 'app/fonts.css', 'app/home.css', 'app/home.js', 'app/native.js', 'app/config.js', 'app/friends.js',
  'vendor/qrcode.js', 'vendor/jsQR.js',
  'vendor/capacitor.js', 'vendor/react.production.min.js', 'vendor/react-dom.production.min.js',
  'vendor/fonts/fredoka-latin-400-normal.woff2', 'vendor/fonts/fredoka-latin-500-normal.woff2',
  'vendor/fonts/fredoka-latin-600-normal.woff2', 'vendor/fonts/fredoka-latin-700-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  })));
});
