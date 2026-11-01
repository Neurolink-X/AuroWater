// PATH: src/app/(public)/contact/track.ts
'use client';

type Analytics = { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

/** Fire-and-forget marketing events (Google Tag Manager dataLayer and/or gtag). Safe if neither is installed. */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  try {
    const w = window as unknown as Analytics;
    w.dataLayer?.push({ event: name, ...params });
    w.gtag?.('event', name, params);
  } catch { /* analytics must never break the page */ }
}
