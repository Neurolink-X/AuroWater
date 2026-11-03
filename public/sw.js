/* eslint-disable no-restricted-globals */
/**
 * AuroTap PWA asset caches, v5.
 * - Network-first HTML and zero interception of API/auth/third-party calls.
 * - Immutable Next.js build files: bounded static cache.
 * - Public images/icons: bounded stale-while-revalidate cache.
 * - The offline shell lives in a separate protected cache.
 * - Only caches with our exact prefix are ever retired.
 */
const VERSION = 'v5';
const SHELL_CACHE = `aurowater-shell-${VERSION}`;
const STATIC_CACHE = `aurowater-static-${VERSION}`;
const IMAGE_CACHE = `aurowater-images-${VERSION}`;
// Retain the previous deployment's hashed assets for open tabs during upgrade.
const PREVIOUS_ASSET_CACHE = 'aurowater-runtime-v4';
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE, PREVIOUS_ASSET_CACHE];
const OFFLINE_URL = '/offline';
const STATIC_LIMIT = 100;
const IMAGE_LIMIT = 40;
const MAX_IMAGE_CONTENT_LENGTH = 700 * 1024; // oversized images may use HTTP cache, not CacheStorage
const CORE_ASSETS = ['/icons/icon-192x192.png', '/aurotap-mark.svg', '/splash-logo.svg'];
let maintenanceRunning = false;
let lastMaintenance = 0;

function cacheable(response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return false;
  const control = response.headers.get('cache-control') || '';
  return !/(?:no-store|private)/i.test(control) && !response.headers.has('set-cookie');
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // Cache keys retain insertion order. Remove oldest entries, keep newest.
  await Promise.allSettled(keys.slice(0, keys.length - maxEntries).map(key => cache.delete(key)));
}

async function maintainRuntimeCaches(force = false) {
  const now = Date.now();
  if (maintenanceRunning || (!force && now - lastMaintenance < 6 * 60 * 60 * 1000)) return;
  maintenanceRunning = true;
  try {
    const names = await caches.keys();
    await Promise.all([
      names.includes(STATIC_CACHE) ? trimCache(STATIC_CACHE, STATIC_LIMIT) : Promise.resolve(),
      names.includes(IMAGE_CACHE) ? trimCache(IMAGE_CACHE, IMAGE_LIMIT) : Promise.resolve(),
    ]);
    lastMaintenance = now;
  } catch {
    // Cache cleanup is a progressive enhancement, never break a request.
  } finally {
    maintenanceRunning = false;
  }
}

async function storeBounded(name, request, response, limit) {
  try {
    const cache = await caches.open(name);
    await cache.put(request, response);
    await trimCache(name, limit);
  } catch {
    // Quota/private mode: skip optional cache writes. Never delete user data.
    await maintainRuntimeCaches(true).catch(() => {});
  }
}

async function cacheOfflineAssets(cache) {
  const response = await fetch(OFFLINE_URL, {cache: 'no-store'});
  if (!response.ok) throw new Error('Offline page unavailable');
  await cache.put(OFFLINE_URL, response.clone());
  const html = await response.text();
  const paths = new Set(CORE_ASSETS);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = match[1];
    if (url.startsWith('/_next/static/') || url.startsWith('/icons/')) paths.add(url);
  }
  await Promise.allSettled([...paths].map(async path => {
    const result = await fetch(path, {cache: 'no-store'});
    if (result.ok) await cache.put(path, result);
  }));
}

async function ensureOfflinePage() {
  try {
    const cache = await caches.open(SHELL_CACHE);
    if (!await cache.match(OFFLINE_URL)) await cacheOfflineAssets(cache);
  } catch { /* best effort, no application delay */ }
}

async function cacheFirst(event) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  // Older open tabs might still request a previous Next.js build chunk.
  const previous = await caches.match(event.request);
  if (previous) return previous;
  const response = await fetch(event.request);
  if (cacheable(response)) {
    event.waitUntil(storeBounded(STATIC_CACHE, event.request, response.clone(), STATIC_LIMIT));
  }
  return response;
}

async function publicImage(event) {
  const cache = await caches.open(IMAGE_CACHE);
  const hit = await cache.match(event.request);
  const updating = fetch(event.request).then(async response => {
    const length = Number(response.headers.get('content-length') || 0);
    if (cacheable(response) && (!Number.isFinite(length) || length <= MAX_IMAGE_CONTENT_LENGTH)) {
      await storeBounded(IMAGE_CACHE, event.request, response.clone(), IMAGE_LIMIT);
    }
    return response;
  }).catch(() => null);
  if (hit) {
    event.waitUntil(updating);
    return hit;
  }
  return (await updating) || Response.error();
}

async function navigation(event) {
  try {
    const response = (await event.preloadResponse) || (await fetch(event.request));
    if (response.ok) event.waitUntil(ensureOfflinePage());
    return response;
  } catch {
    const shell = await caches.open(SHELL_CACHE);
    return (await shell.match(OFFLINE_URL)) || new Response('You are offline.', {
      status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'},
    });
  }
}

function isPublicAsset(url) {
  if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/images/')) return true;
  if (/^\/(?:aurotap-mark|splash-logo)\.svg$/.test(url.pathname)) return true;
  if (url.pathname === '/_next/image') {
    const raw = url.searchParams.get('url') || '';
    // Never store Supabase signed images or arbitrary private remote content.
    return raw.startsWith('/images/') || raw.startsWith('/icons/');
  }
  return false;
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cacheOfflineAssets).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.allSettled(names
      .filter(name => name.startsWith('aurowater-') && !CURRENT_CACHES.includes(name))
      .map(name => caches.delete(name)));
    await maintainRuntimeCaches(true);
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable().catch(() => {});
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range') ||
      request.headers.has('authorization')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(navigation(event));
    return;
  }
  // APIs and authentication must be fresh; no request interception.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event));
  } else if (isPublicAsset(url)) {
    event.respondWith(publicImage(event));
  }
});


/**
 * Browser/OS-delivered push works when the PWA tab is closed (permission
 * permitting). This handler never fetches a private API or caches user data.
 */
function safePushPath(value) {
  try {
    const url = new URL(String(value || '/'), self.location.origin);
    if (url.origin !== self.location.origin || url.username || url.password) return '/';
    if (!/^\/(?:customer|supplier|technician|admin)(?:\/|$)/.test(url.pathname)) return '/';
    return url.pathname + url.search;
  } catch {
    return '/';
  }
}

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* generic fallback */ }
  const title = typeof data.title === 'string' ? data.title.slice(0, 80) : 'AuroTap update';
  const body = typeof data.body === 'string' ? data.body.slice(0, 160) : 'Open AuroTap to view your update.';
  const tag = typeof data.tag === 'string' ? data.tag.slice(0, 100) : 'aurotap-update';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { url: safePushPath(data.url) },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = safePushPath(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const url = new URL(target, self.location.origin);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== url.origin) continue;
      try {
        await client.navigate(url.href);
        await client.focus();
        return;
      } catch { /* fallback to a new PWA window */ }
    }
    await self.clients.openWindow(url.href);
  })());
});
