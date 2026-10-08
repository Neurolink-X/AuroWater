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

  const timeLabel = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const dateLabel = currentTime.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-[#0A1628] px-5 py-8 text-center text-white"
      role="main"
    >
      <div className="relative flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28">
        <span
          className="absolute h-24 w-24 animate-ping rounded-full bg-cyan-400/10 motion-reduce:animate-none sm:h-28 sm:w-28"
          aria-hidden="true"
        />
        <span
          className="absolute h-[5.5rem] w-[5.5rem] rounded-[1.75rem] border border-cyan-300/20 bg-white/[0.04] shadow-2xl shadow-cyan-950/30 sm:h-24 sm:w-24"
          aria-hidden="true"
        />
        <img
          src="/icons/icon-192x192.png"
          alt="AuroTap"
          width={192}
          height={192}
          className="relative h-20 w-20 rounded-[1.35rem] object-contain shadow-xl shadow-cyan-950/40 sm:h-24 sm:w-24"
        />
      </div>

      <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
        You&apos;re offline
      </h1>

      <p className="mt-2 max-w-sm text-sm leading-6 text-white/60 sm:text-base">
        Your connection is temporarily unavailable. Your AuroTap experience
        will be ready when you&apos;re connected again.
      </p>

      <div
        className="mt-4 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs font-semibold text-white/70"
        aria-live="polite"
      >
        <span
          className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}
          aria-hidden="true"
        />
        {isOnline ? 'Connection restored' : 'Waiting for connection'}
      </div>

      <section
        className="mt-4 rounded-2xl border border-white/10 bg-white/[0.045] px-6 py-3.5 shadow-xl shadow-black/10"
        aria-label="Current device time"
      >
        <p className="font-mono text-2xl font-bold tracking-wider text-cyan-200 tabular-nums">
          {timeLabel}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-white/40">
          {dateLabel}
        </p>
      </section>

      <div className="mt-5 flex w-full max-w-sm flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <RetryButton />

        <Link
          href="/"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0A1628] sm:w-auto"
        >
          Go to AuroWater
        </Link>
      </div>

      <section
        className="mt-6 w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left"
        aria-labelledby="offline-help"
      >
        <p
          id="offline-help"
          className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-300"
        >
          Quick check
        </p>

        <ul className="mt-2.5 space-y-1.5 text-xs leading-5 text-white/55 sm:text-sm">
          <li>• Check your Wi-Fi or mobile data.</li>
          <li>• Make sure airplane mode is turned off.</li>
          <li>• Retry when your connection is restored.</li>
        </ul>
      </section>

      <section
        className="mt-5 w-full max-w-sm rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.045] px-5 py-4"
        aria-label="AuroTap brand message"
      >
        <p className="text-sm font-bold leading-6 text-cyan-100">
          Water is essential. AuroTap is here when you need it.
        </p>
        <p className="mt-1 text-xs leading-5 text-white/40">
          We&apos;ll be here when you&apos;re back online.
        </p>
      </section>

      <p className="mt-5 max-w-sm text-[11px] leading-5 text-white/30">
        AuroWater · Reliable water delivery and essential home services.
      </p>
    </main>
  );
}
