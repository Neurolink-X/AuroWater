'use client';

import { useEffect } from 'react';
import { safeErrorPath, errorGroup } from '@/lib/observability/platform-errors';
import type { PlatformErrorCode } from '@/lib/observability/platform-errors';

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
    const lastDiagnostics = new Map<string, number>();
    let diagnosticsStart = Date.now(); let diagnosticsCount = 0;
    const diagnose = (code: PlatformErrorCode, path: string, status = 0) => {
      const now = Date.now();
      if (now - diagnosticsStart >= 60_000) { diagnosticsStart = now; diagnosticsCount = 0; lastDiagnostics.clear(); }
      const key = `${code}:${safeErrorPath(path)}:${status}`;
      if (diagnosticsCount >= 3 || lastDiagnostics.has(key)) return;
      diagnosticsCount++; lastDiagnostics.set(key, now);
      try {
        navigator.sendBeacon('/api/internal/telemetry/errors', new Blob([JSON.stringify({
          code, path: safeErrorPath(path), group: errorGroup(path), status, source: 'browser',
        })], {type:'application/json'}));
      } catch { /* Never interfere with the original operation. */ }
    };
    const send = (code: ErrorCode) => {
      const now = Date.now();
      if (now - windowStart >= 60_000) { windowStart = now; emitted = 0; }
      if (emitted >= 3 || now - (lastByCode.get(code) ?? 0) < 10_000) return;
      diagnose(code, window.location.pathname);
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

    // Observe settled results without reading bodies or changing requests/retries.
    const originalFetch = window.fetch;
    const observedFetch: typeof window.fetch = async (...args) => {
      let path = '';
      try {
        const input = args[0];
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin);
        if (url.origin === window.location.origin && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/internal/telemetry/')) path = url.pathname;
      } catch { /* Invalid requests retain native fetch behavior. */ }
      try {
        const response = await originalFetch.apply(window, args);
        if (path && response.status >= 500) diagnose('API_SERVER_ERROR', path, response.status);
        return response;
      } catch (error) {
        const signal = args[1]?.signal ?? (args[0] instanceof Request ? args[0].signal : undefined);
        if (path && !signal?.aborted && !(error instanceof DOMException && error.name === 'AbortError')) diagnose('NETWORK_ERROR', path);
        throw error;
      }
    };
    window.fetch = observedFetch;
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      if (window.fetch === observedFetch) window.fetch = originalFetch;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
