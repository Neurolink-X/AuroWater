/**
 * Minimal route-level streaming shell for the services directory.
 * Mirrors final card dimensions to limit cumulative layout shift.
 * No JavaScript, rotating loaders, or expensive animated gradients.
 */
const placeholders = Array.from({ length: 6 }, (_, index) => index);

export default function ServicesLoading() {
  return (
    <main aria-busy="true" aria-label="Loading services" className="min-h-screen bg-[#E4EDF7]">
      <section className="bg-slate-950 px-5 py-14 text-white sm:py-20">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="h-6 w-40 max-w-full rounded-full bg-slate-800" />
          <div className="h-11 w-full max-w-xl rounded-xl bg-slate-800" />
          <div className="h-5 w-full max-w-2xl rounded-lg bg-slate-800" />
          <div className="h-5 w-3/4 max-w-lg rounded-lg bg-slate-800" />
          <div className="flex flex-wrap gap-3 pt-3">
            <div className="h-12 w-40 rounded-full bg-sky-800" />
            <div className="h-12 w-36 rounded-full bg-slate-800" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap gap-3" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-10 w-24 rounded-full bg-slate-200" />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="h-8 w-48 rounded-lg bg-slate-200" aria-hidden="true" />
          <div className="h-5 w-24 rounded-lg bg-slate-200" aria-hidden="true" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {placeholders.map((item) => (
            <article key={item} className="overflow-hidden rounded-[28px] bg-white shadow-sm">
              <div className="m-3 aspect-[16/10] rounded-[18px] bg-slate-100 sm:aspect-[4/3]" />
              <div className="space-y-4 px-6 pb-7 pt-4">
                <div className="h-5 w-24 rounded-lg bg-slate-100" />
                <div className="h-7 w-3/4 rounded-lg bg-slate-200" />
                <div className="h-5 w-full rounded bg-slate-100" />
                <div className="h-5 w-5/6 rounded bg-slate-100" />
                <div className="h-10 w-full rounded-xl bg-slate-200" />
              </div>
            </article>
          ))}
        </div>
      </section>
      <span className="sr-only" role="status">Loading available services…</span>
    </main>
  );
}
