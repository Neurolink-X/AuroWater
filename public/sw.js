const CACHE_NAME = 'aurowater-offline-v2';
const OFFLINE_URL = '/offline';
const OFFLINE_ASSET_PATTERN = /^(\/|https:\/\/[^/]+\/)(?:_next\/static\/|icons\/)/;

async function cacheOfflineAssets(cache) {
  const response = await fetch(OFFLINE_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Unable to cache the offline page.');
  }

  await cache.put(OFFLINE_URL, response.clone());

  const html = await response.text();
  const urls = new Set(['/icons/icon-192x192.png']);
  const assetPattern = /(?:src|href)="([^"]+)"/g;

  for (const match of html.matchAll(assetPattern)) {
    const url = match[1];

    if (url.startsWith('/_next/static/') || url.startsWith('/icons/')) {
      urls.add(url);
    }
  }

  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const assetResponse = await fetch(url, { cache: 'no-store' });

        if (assetResponse.ok) {
          await cache.put(url, assetResponse);
        }
      } catch {
        // One optional asset must not prevent offline support from installing.
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cacheOfflineAssets(cache))
      .catch(() => {
        // Keep installation non-blocking if the network disappears mid-install.
      }),
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (
    requestUrl.origin === self.location.origin &&
    (requestUrl.pathname.startsWith('/_next/static/') ||
      requestUrl.pathname.startsWith('/icons/'))
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => {
              void cache.put(event.request, copy);
            });
          }

          return response;
        });
      }),
    );

    return;
  }

  if (event.request.mode !== 'navigate') {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((response) => {
        if (response) {
          return response;
        }

        return new Response('You are offline.', {
          status: 503,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      }),
    ),
  );
});
