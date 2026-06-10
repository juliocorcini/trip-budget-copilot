const CACHE_NAME = 'trippilot-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// GAP-036: precache the hashed build assets referenced by index.html so the
// app shell works offline right after install (no build plugin required).
async function precacheBuildAssets(cache) {
  try {
    const response = await fetch('/index.html', { cache: 'no-cache' });
    if (!response.ok) return;
    const html = await response.text();
    const assetUrls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    if (assetUrls.length > 0) {
      await cache.addAll(assetUrls);
    }
  } catch {
    // Offline during install — runtime caching will fill the gap later.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(STATIC_ASSETS);
      await precacheBuildAssets(cache);
    })
  );
  // DEC-082: no automatic skipWaiting — the page shows an update toast and
  // the user decides when to activate the new version (SKIP_WAITING message).
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isNavigationRequest(request) {
  return request.mode === 'navigate' || new URL(request.url).pathname === '/index.html';
}

// DEC-082 (GAP-R2-001): navigation/index.html is network-first so a new deploy
// reaches the user on the next load; hashed assets stay cache-first (immutable).
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request) || await cache.match('/index.html');
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (isNavigationRequest(event.request)) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(cacheFirst(event.request));
});
