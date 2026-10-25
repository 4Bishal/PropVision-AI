const CACHE = 'propvision-shell-v2';
const SHELL = ['/index.html', '/manifest.json', '/assets/logo.png', '/assets/logo-dark.png', '/assets/favicon.png', '/assets/icon-512.png'];
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))); });
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('propvision-shell-') && key !== CACHE).map((key) => caches.delete(key))))); });
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache API responses, predictions, remote data, or model artifacts.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode !== 'navigate' && !url.pathname.startsWith('/assets/')) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy))); }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === 'navigate' ? caches.match('/index.html') : Response.error()))));
});
