/**
 * Streaming fallback for an individual service route.
 *
 * Keeps the same image aspect ratio and price-card structure as the finished
 * page to prevent layout jumps. No timers, shimmer GIFs, or client hydration:
 * route transitions can paint a lightweight shell while server rendering works.
 */
export default function ServiceDetailLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading service details"
      className="min-h-screen bg-[#E4EDF7] text-slate-900"
    >
      <section className="bg-slate-950 px-5 pb-14 pt-8 text-white sm:pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center gap-2" aria-hidden="true">
            <div className="h-4 w-14 rounded bg-slate-800" />
            <span className="text-slate-600">/</span>
            <div className="h-4 w-20 rounded bg-slate-800" />
            <span className="text-slate-600">/</span>
            <div className="h-4 w-28 rounded bg-slate-800" />
          </div>
          <div className="grid items-start gap-8 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5" aria-hidden="true">
              <div className="h-4 w-36 rounded bg-slate-800" />
              <div className="h-11 w-full max-w-md rounded-xl bg-slate-800" />
              <div className="h-7 w-3/4 max-w-sm rounded bg-slate-800" />
              <div className="space-y-3 pt-2">
                <div className="h-4 w-full max-w-lg rounded bg-slate-800" />
                <div className="h-4 w-5/6 max-w-lg rounded bg-slate-800" />
                <div className="h-4 w-2/3 max-w-lg rounded bg-slate-800" />
              </div>
              <div className="flex flex-wrap gap-3 pt-4">
                <div className="h-12 w-44 rounded-2xl bg-sky-800" />
                <div className="h-12 w-36 rounded-2xl bg-slate-800" />
              </div>
              <div className="space-y-3 pt-3">
                <div className="h-4 w-64 rounded bg-slate-800" />
                <div className="h-4 w-56 rounded bg-slate-800" />
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07]">
              <div className="aspect-[4/3] w-full bg-slate-800 sm:aspect-[16/11] lg:aspect-[4/3]" />
              <div className="space-y-4 p-7" aria-hidden="true">
                <div className="h-4 w-36 rounded bg-slate-800" />
                <div className="h-11 w-28 rounded-lg bg-slate-800" />
                <div className="h-4 w-52 rounded bg-slate-800" />
                <div className="h-px w-full bg-slate-700" />
                <div className="h-4 w-full max-w-xs rounded bg-slate-800" />
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-6xl space-y-5 px-5 py-12" aria-hidden="true">
        <div className="h-8 w-64 rounded-xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-32 rounded-3xl bg-slate-200" />
          ))}
        </div>
      </div>
      <span className="sr-only" role="status">Loading service information…</span>
    </main>
  );
}
