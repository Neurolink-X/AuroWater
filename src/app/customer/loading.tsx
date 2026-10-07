export default function Loading() {
  return (
    <main
      role="status"
      aria-label="Loading your AuroTap order"
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8">
        {/* Top navigation skeleton */}
        <div className="flex items-center justify-between gap-3">
          <div className="h-10 w-24 animate-pulse rounded-full bg-white shadow-sm ring-1 ring-slate-200" />
          <div className="h-10 w-32 animate-pulse rounded-full bg-white shadow-sm ring-1 ring-slate-200" />
        </div>

        {/* Status hero skeleton */}
        <section className="mt-5 overflow-hidden rounded-[2rem] bg-[#071A2E] p-5 shadow-xl shadow-slate-900/10 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-4">
              <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-white/10" />
              <div className="min-w-0 space-y-3">
                <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                <div className="h-7 w-52 max-w-[70vw] animate-pulse rounded-lg bg-white/15" />
                <div className="h-3 w-64 max-w-[78vw] animate-pulse rounded bg-white/10" />
              </div>
            </div>
            <div className="hidden h-8 w-20 animate-pulse rounded-full bg-white/10 sm:block" />
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="h-20 animate-pulse rounded-2xl bg-white/[0.06]" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/[0.06]" />
            <div className="h-20 animate-pulse rounded-2xl bg-white/[0.06]" />
          </div>
        </section>

        {/* Order journey skeleton */}
        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-7 grid gap-5 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 sm:block">
                <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-slate-200 sm:mx-auto" />
                <div className="mt-0 space-y-2 sm:mt-3 sm:text-center">
                  <div className="h-3 w-20 animate-pulse rounded bg-slate-200 sm:mx-auto" />
                  <div className="h-2.5 w-14 animate-pulse rounded bg-slate-100 sm:mx-auto" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Two-column detail skeleton */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-5 flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
            <div className="mt-6 h-11 w-32 animate-pulse rounded-xl bg-slate-100" />
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
            <div className="mt-5 space-y-4">
              <div className="flex justify-between">
                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="h-px bg-slate-100" />
              <div className="flex justify-between">
                <div className="h-5 w-16 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </section>
        </div>

        {/* Address skeleton */}
        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-4 w-3/4 max-w-md animate-pulse rounded bg-slate-100" />
          <div className="mt-5 h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
        </section>

        {/* Actions skeleton */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="h-12 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-12 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-12 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </div>

      <span className="sr-only">
        Loading your order details…
      </span>
    </main>
  );
}
