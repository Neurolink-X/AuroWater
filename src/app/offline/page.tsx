'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import RetryButton from './RetryButton';

export default function OfflinePage() {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : false,
  );

  useEffect(() => {
    const updateTime = () => setCurrentTime(new Date());
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const clock = window.setInterval(updateTime, 1000);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.clearInterval(clock);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const dateLabel = currentTime.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <main className="min-h-screen bg-[#0A1628] px-5 py-16 text-white">
      <section className="mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <img src="/aurotap-192x192.png" alt="AuroWater" className="h-12 w-12 rounded-xl" />
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
          {isOnline ? 'Back online' : 'Offline mode'}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
          You&apos;re currently offline
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-white/60">
          Some features may be unavailable until your internet connection is restored.
        </p>

        <p className="mt-2 text-xs text-white/40">
          {dateLabel}
        </p>
      </section>

      <div className="mx-auto mt-5 flex w-full max-w-sm flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <RetryButton />

        <Link
          href="/"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0A1628] sm:w-auto"
        >
          Go to AuroWater
        </Link>
      </div>
    </main>
  );
}
