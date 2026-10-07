'use client';

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
    second: '2-digit',
  });

  const dateLabel = currentTime.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0A1628] px-6 py-10 text-center text-white"
      role="main"
    >
      <div className="relative flex h-28 w-28 items-center justify-center" aria-hidden="true">
        <span className="absolute h-28 w-28 animate-ping rounded-full bg-cyan-400/10 motion-reduce:animate-none" />
        <span className="absolute h-20 w-20 rounded-full border border-cyan-300/20 bg-cyan-400/5" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-600 text-3xl shadow-xl shadow-cyan-500/20">
          💧
        </span>
      </div>

      <h1 className="mt-5 font-[Syne] text-3xl font-black tracking-tight sm:text-4xl">
        You&apos;re offline
      </h1>

      <p className="mt-3 max-w-md text-sm leading-6 text-white/65 sm:text-base">
        Your connection is currently unavailable. When you&apos;re back online,
        tap Try again to continue safely.
      </p>

      <div
        className="mt-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold"
        aria-live="polite"
      >
        <span
          className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}
          aria-hidden="true"
        />
        {isOnline ? 'Connection restored' : 'Waiting for connection'}
      </div>

      <section
        className="mt-6 w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-4 shadow-2xl shadow-black/10"
        aria-label="Current device time"
      >
        <p className="font-mono text-2xl font-bold tracking-wider text-cyan-200 tabular-nums">
          {timeLabel}
        </p>
        <p className="mt-1 text-xs font-medium text-white/45">
          {dateLabel}
        </p>
      </section>

      <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
        <RetryButton />

        <a
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0A1628]"
        >
          Go to AuroWater
        </a>
      </div>

      <div className="mt-9 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
          While offline
        </p>

        <ul className="mt-3 space-y-2 text-sm leading-6 text-white/60">
          <li>• Check your Wi-Fi or mobile data.</li>
          <li>• Make sure airplane mode is turned off.</li>
          <li>• Retry once your connection is restored.</li>
        </ul>
      </div>

      <p className="mt-7 max-w-sm text-xs leading-5 text-white/35">
        AuroWater · Reliable water delivery and essential home services.
      </p>
    </main>
  );
}
