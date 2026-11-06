'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe wall clock for time-sensitive labels only.
 * Never use this to authorize orders, payments, booking slots or server deadlines.
 * Browser clock is untrusted; the server remains authoritative for business rules.
 */
export function useClientClock(intervalMs = 60_000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') update();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') update();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return now;
}
