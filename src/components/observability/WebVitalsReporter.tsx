'use client';

import { useReportWebVitals } from 'next/web-vitals';

const SAMPLE_RATE = 0.2;

function routeGroup(pathname: string): 'customer' | 'supplier' | 'technician' | 'admin' | 'public' {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/supplier' || pathname.startsWith('/supplier/') || pathname.startsWith('/seller/')) return 'supplier';
  if (pathname === '/technician' || pathname.startsWith('/technician/') || pathname.startsWith('/agent/')) return 'technician';
  if (pathname === '/customer' || pathname.startsWith('/customer/')) return 'customer';
  return 'public';
}

/** Privacy-safe sampled Core Web Vitals. Never sends URL paths, IDs, query strings or user data. */
export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== 'production' || Math.random() > SAMPLE_RATE) return;
    if (typeof window === 'undefined' || !navigator.sendBeacon) return;

    const payload = {
      name: metric.name,
      value: Math.round(metric.value * 1000) / 1000,
      rating: metric.rating,
      route_group: routeGroup(window.location.pathname),
      navigation_type: metric.navigationType,
      timestamp: Date.now(),
    };

    try {
      const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('/api/internal/telemetry/web-vitals', body);
    } catch {
      // Telemetry must never affect navigation or the customer journey.
    }
  });

  return null;
}
