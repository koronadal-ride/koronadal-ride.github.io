// Service worker
const CACHE = 'koronadal-ride-v6';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './data.js',
  './vendor/leaflet.js', './vendor/leaflet.css', './vendor/supabase.js', './supabase.js', './manifest.webmanifest',
  './admin.html', './admin.css', './admin.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
