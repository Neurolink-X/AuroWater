'use client';

import { useEffect } from 'react';

type RouteGroup = 'customer' | 'supplier' | 'technician' | 'admin' | 'public';
function routeGroup(path: string): RouteGroup {
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/supplier') || path.startsWith('/seller')) return 'supplier';
  if (path.startsWith('/technician') || path.startsWith('/agent')) return 'technician';
  if (path.startsWith('/customer')) return 'customer';
  return 'public';
}

/** Low-overhead, privacy-safe mobile scroll-stall sampling.
 * Samples ONLY long tasks overlapping an actual scroll; no selectors,
 * paths, IDs, session data, or touch coordinates leave the browser.
 */
export default function ScrollStallReporter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || Math.random() > 0.1 ||
        !('PerformanceObserver' in window) || !navigator.sendBeacon ||
        !window.matchMedia('(pointer: coarse)').matches) return;

    const supported = PerformanceObserver.supportedEntryTypes?.includes('longtask');
    if (!supported) return;
    let lastScroll = -Infinity;
    let peakStall = 0;
    let count = 0;
    let lastReported = 0;
    const onScroll = () => { lastScroll = performance.now(); };
    const report = () => {
      if (!count || document.visibilityState === 'hidden' && !peakStall) return;
      if (Date.now() - lastReported < 30_000) return;
      const value = Math.min(60_000, Math.round(peakStall));
      peakStall = 0;
      count = 0;
      lastReported = Date.now();
      try {
        navigator.sendBeacon('/api/internal/telemetry/web-vitals',
          new Blob([JSON.stringify({
            kind: 'scroll', name: 'SCROLL_LONG_TASK', value,
            route_group: routeGroup(window.location.pathname),
          })], { type: 'application/json' }));
      } catch { /* Never interfere with scrolling. */ }
    };

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Only count long main-thread tasks adjacent to active user scrolling.
        if (entry.startTime > lastScroll + 600 || entry.startTime + entry.duration < lastScroll - 150) continue;
        count++;
        peakStall = Math.max(peakStall, entry.duration);
      }
      if (count >= 3) report();
    });
    try { observer.observe({ type: 'longtask', buffered: false }); }
    catch { return; }
    window.addEventListener('scroll', onScroll, { passive: true });
    const timer = window.setInterval(report, 30_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
      report();
    };
  }, []);
  return null;
}
