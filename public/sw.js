/* eslint-disable no-restricted-globals */
/**
 * public/sw.js: AuroTap / AuroWater service worker
 *
 * What it does:
 *  1. Navigation preload: the page request starts while the service worker
 *     is still waking up, so repeat launches are not slowed down by it.
 *  2. /_next/static/*  (hashed, never changes)  → cache first = instant.
 *  3. Icons, images, fonts                       → show cached, refresh quietly.
 *  4. Pages                                      → network first, so orders,
 *     prices and login are ALWAYS fresh. Offline page only if there is no internet.
 *  5. Never touches POST, /api, Supabase or any other website.
 *
 * Bump VERSION when you want every phone to drop its old cache.
 */

const VERSION = 'v4';
const SHELL_CACHE = `aurowater-shell-${VERSION}`;
const RUNTIME_CACHE = `aurowater-runtime-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, RUNTIME_CACHE];

const OFFLINE_URL = '/offline';
const MAX_RUNTIME_ENTRIES = 150; // old files are dropped first

const CORE_ASSETS = [
  '/icons/icon-192x192.png',
  '/aurotap-mark.svg',
  '/splash-logo.svg',
];

/* ── Helpers ─────────────────────────────────────────────────────────── */

function isCacheable(response) {
  return Boolean(response) && response.status === 200 && response.type === 'basic';
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxEntries) {
    await Promise.all(
      keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)),
    );
  }
}

/** Saves the offline page + the files it needs, so it works with no internet. */
async function cacheOfflineAssets(cache) {
  const response = await fetch(OFFLINE_URL, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error('Unable to cache the offline page.');
  }

  await cache.put(OFFLINE_URL, response.clone());

  const html = await response.text();
  const urls = new Set(CORE_ASSETS);
  const assetPattern = /(?:src|href)="([^"]+)"/g;

  for (const match of html.matchAll(assetPattern)) {
    const url = match[1];

    if (url.startsWith('/_next/static/') || url.startsWith('/icons/')) {
      urls.add(url);
    }
  }

  await Promise.allSettled(
    [...urls].map(async (url) => {
      const assetResponse = await fetch(url, { cache: 'no-store' });

      if (assetResponse.ok) {
        await cache.put(url, assetResponse);
      }
      // One optional file failing must never block offline support.
    }),
  );
}

/** If the offline page is missing (install happened with bad internet), fix it later. */
async function ensureOfflinePage() {
  try {
    const cache = await caches.open(SHELL_CACHE);

    if (await cache.match(OFFLINE_URL)) return;

    await cacheOfflineAssets(cache);
  } catch {
    // Try again on the next successful page load.
  }
}

/* ── Strategies ──────────────────────────────────────────────────────── */

/** Hashed files: if we have it, use it. Otherwise download once and keep it. */
async function cacheFirst(event) {
  const cached = await caches.match(event.request);

  if (cached) return cached;

  const response = await fetch(event.request);

  if (isCacheable(response)) {
    const copy = response.clone();

    event.waitUntil(
      caches
        .open(RUNTIME_CACHE)
        .then((cache) => cache.put(event.request, copy))
        .then(() => trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES))
        .catch(() => {}),
    );
  }

  return response;
}

/** Icons, images, fonts: answer instantly from cache, update in the background. */
async function staleWhileRevalidate(event) {
  const cached = await caches.match(event.request);

  const refresh = fetch(event.request)
    .then(async (response) => {
      if (isCacheable(response)) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(event.request, response.clone());
        await trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }

  const fresh = await refresh;

  return fresh || Response.error();
}

/** Pages: always try the network first. Offline page only when there is no internet. */
async function handleNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    const response = preloaded || (await fetch(event.request));

    if (response.ok) {
      event.waitUntil(ensureOfflinePage());
    }

    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match(OFFLINE_URL);

    return (
      offline ||
      new Response('You are offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

/* ── Lifecycle ───────────────────────────────────────────────────────── */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cacheOfflineAssets(cache))
      .catch(() => {
        // Keep installation non-blocking if the network disappears mid-install.
      }),
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Remove our old caches (v3 and earlier), never anyone else's.
      const names = await caches.keys();

      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith('aurowater-') && !CURRENT_CACHES.includes(name),
          )
          .map((name) => caches.delete(name)),
      );

      // Start page requests before the service worker finishes waking up.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => {});
      }

      await self.clients.claim();
    })(),
  );
});

/* ── Fetch routing ───────────────────────────────────────────────────── */

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return; // video / partial downloads

  const url = new URL(request.url);

  // Pages
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Other websites (Supabase, analytics, maps) and our own API: do not touch.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Hashed build files (JS, CSS, fonts from next/font)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event));
    return;
  }

  // Icons, images, optimized images, fonts
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/image') ||
    /\.(?:png|jpe?g|webp|avif|svg|woff2)$/i.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(event));
  }
});








// const CACHE_NAME = 'aurowater-offline-v3';
// const OFFLINE_URL = '/offline';

// async function cacheOfflineAssets(cache) {
//   const response = await fetch(OFFLINE_URL, { cache: 'no-store' });
//   if (!response.ok) {
//     throw new Error('Unable to cache the offline page.');
//   }

//   await cache.put(OFFLINE_URL, response.clone());

//   const html = await response.text();
//   const urls = new Set([
//     '/icons/icon-192x192.png',
//     '/splash-logo.svg',
//   ]);
//   const assetPattern = /(?:src|href)="([^"]+)"/g;

//   for (const match of html.matchAll(assetPattern)) {
//     const url = match[1];

//     if (url.startsWith('/_next/static/') || url.startsWith('/icons/')) {
//       urls.add(url);
//     }
//   }

//   await Promise.all(
//     [...urls].map(async (url) => {
//       try {
//         const assetResponse = await fetch(url, { cache: 'no-store' });

//         if (assetResponse.ok) {
//           await cache.put(url, assetResponse);
//         }
//       } catch {
//         // One optional asset must not prevent offline support from installing.
//       }
//     }),
//   );
// }

// self.addEventListener('install', (event) => {
//   event.waitUntil(
//     caches
//       .open(CACHE_NAME)
//       .then((cache) => cacheOfflineAssets(cache))
//       .catch(() => {
//         // Keep installation non-blocking if the network disappears mid-install.
//       }),
//   );

//   self.skipWaiting();
// });

// self.addEventListener('activate', (event) => {
//   event.waitUntil(
//     caches
//       .keys()
//       .then((cacheNames) =>
//         Promise.all(
//           cacheNames
//             .filter((cacheName) => cacheName !== CACHE_NAME)
//             .map((cacheName) => caches.delete(cacheName)),
//         ),
//       ),
//   );

//   self.clients.claim();
// });

// self.addEventListener('fetch', (event) => {
//   if (event.request.method !== 'GET') {
//     return;
//   }

//   const requestUrl = new URL(event.request.url);

//   if (
//     requestUrl.origin === self.location.origin &&
//     (requestUrl.pathname.startsWith('/_next/static/') ||
//       requestUrl.pathname.startsWith('/icons/'))
//   ) {
//     event.respondWith(
//       caches.match(event.request).then((cachedResponse) => {
//         if (cachedResponse) {
//           return cachedResponse;
//         }

//         return fetch(event.request).then((response) => {
//           if (response.ok) {
//             const copy = response.clone();
//             void caches.open(CACHE_NAME).then((cache) => {
//               void cache.put(event.request, copy);
//             });
//           }

//           return response;
//         });
//       }),
//     );

//     return;
//   }

//   if (event.request.mode !== 'navigate') {
//     return;
//   }

//   event.respondWith(
//     fetch(event.request).catch(() =>
//       caches.match(OFFLINE_URL).then((response) => {
//         if (response) {
//           return response;
//         }

//         return new Response('You are offline.', {
//           status: 503,
//           headers: {
//             'Content-Type': 'text/plain; charset=utf-8',
//           },
//         });
//       }),
//     ),
//   );
// });
