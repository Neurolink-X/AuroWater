export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A1628] px-6 text-center text-white">
      <p className="text-4xl" aria-hidden>
        📡
      </p>
      <h1 className="mt-4 font-[Syne] text-2xl font-black">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-white/60">Check your connection. We&apos;ll retry your last order when you&apos;re back online.</p>
      <a href="/" className="mt-8 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-extrabold text-slate-950">
        Try again
      </a>
    </div>
  );
}
