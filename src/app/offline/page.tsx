export default function OfflinePage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-[#0A1628] px-6 text-center text-white"
      role="main"
    >
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-4xl"
        aria-hidden="true"
      >
        📡
      </div>

      <h1 className="mt-6 font-[Syne] text-3xl font-black tracking-tight">
        You&apos;re offline
      </h1>

      <p className="mt-3 max-w-md text-sm leading-6 text-white/60 sm:text-base">
        Your internet connection appears to be unavailable.
        Check your connection and try again when you&apos;re
        back online.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-500 px-6 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-[#0A1628]"
        >
          Try again
        </button>

        <a
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0A1628]"
        >
          Go to AuroWater
        </a>
      </div>

      <div className="mt-10 max-w-md rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left">
        <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">
          While offline
        </p>

        <ul className="mt-3 space-y-2 text-sm leading-6 text-white/60">
          <li>• Check your Wi-Fi or mobile data.</li>
          <li>• Make sure airplane mode is turned off.</li>
          <li>• Retry once your connection is restored.</li>
        </ul>
      </div>

      <p className="mt-8 text-xs text-white/35">
        AuroWater · Water &amp; essential home services
      </p>
    </main>
  );
}
