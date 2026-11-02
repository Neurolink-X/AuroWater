'use client';

import { useEffect } from 'react';

type RouteGroup = 'customer' | 'supplier' | 'technician' | 'admin' | 'public';
type ErrorCode = 'RUNTIME_ERROR' | 'UNHANDLED_REJECTION' | 'CHUNK_LOAD_ERROR';

function routeGroup(path: string): RouteGroup {
  if (path === '/admin' || path.startsWith('/admin/')) return 'admin';
  if (path === '/supplier' || path.startsWith('/supplier/') || path.startsWith('/seller/')) return 'supplier';
  if (path === '/technician' || path.startsWith('/technician/') || path.startsWith('/agent/')) return 'technician';
  if (path === '/customer' || path.startsWith('/customer/')) return 'customer';
  return 'public';
}

/** Classify locally. Never transmit an exception message, stack, URL or user input. */
function classify(message: string, fallback: ErrorCode): ErrorCode {
  return /chunkloaderror|loading chunk|failed to fetch dynamically imported module/i.test(message)
    ? 'CHUNK_LOAD_ERROR'
    : fallback;
}

/** Passive diagnostics. Never prevents browser errors or triggers unsafe reloads.
 * The server logs only bounded error codes + role, not PII or request data.
 */
export default function RuntimeErrorReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !navigator.sendBeacon) return;

    let windowStart = Date.now();
    let emitted = 0;
    const lastByCode = new Map<ErrorCode, number>();
    const send = (code: ErrorCode) => {
      const now = Date.now();
      if (now - windowStart >= 60_000) { windowStart = now; emitted = 0; }
      if (emitted >= 3 || now - (lastByCode.get(code) ?? 0) < 10_000) return;
      emitted++;
      lastByCode.set(code, now);
      try {
        navigator.sendBeacon('/api/internal/telemetry/web-vitals',
          new Blob([JSON.stringify({
            kind: 'runtime', name: code, value: 1,
            route_group: routeGroup(window.location.pathname),
          })], { type: 'application/json' }));
      } catch { /* Diagnostics must never break the application. */ }
    };

    const onError = (event: Event) => {
      // Ignore image/font resource errors; do not send resource URLs.
      if (!(event instanceof ErrorEvent)) return;
      send(classify(event.message || '', 'RUNTIME_ERROR'));
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : '';
      send(classify(message, 'UNHANDLED_REJECTION'));
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
