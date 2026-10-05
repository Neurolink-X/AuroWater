import {
  SkeletonHeading,
  SkeletonSubheading,
  SkeletonButton,
  SkeletonCard,
  SkeletonStatCard,
} from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <main
      role="status"
      aria-label="Loading technician workspace"
      className="min-h-screen bg-slate-50"
    >
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          {/* Technician navigation */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">

              <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                <div className="h-11 w-11 animate-pulse rounded-xl bg-emerald-50" />

                <div className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-2.5 w-16 animate-pulse rounded bg-slate-50" />
                </div>
              </div>

              {/* Online status */}
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-200" />
                  <div className="h-3 w-20 animate-pulse rounded bg-emerald-100" />
                </div>

                <div className="mt-3 h-2.5 w-28 animate-pulse rounded bg-emerald-100" />
              </div>

              <div className="mt-5 space-y-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex h-11 items-center gap-3 rounded-2xl px-3"
                  >
                    <div className="h-8 w-8 animate-pulse rounded-xl bg-slate-50" />
                    <div
                      className="h-3 animate-pulse rounded bg-slate-100"
                      style={{ width: `${60 + (i % 3) * 18}px` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Main technician workspace */}
          <section className="lg:col-span-9 space-y-5">

            {/* Header */}
            <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <SkeletonSubheading width={100} />

                  <div className="mt-2">
                    <SkeletonHeading width={220} />
                  </div>

                  <div className="mt-2">
                    <SkeletonSubheading width={260} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <SkeletonButton width={42} height={42} />
                  <SkeletonButton width={42} height={42} />
                </div>
              </div>
            </header>

            {/* Online / availability hero */}
            <section className="rounded-3xl bg-gradient-to-br from-[#0D9B6C] to-[#047857] p-6 shadow-xl">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <SkeletonWhite width={110} />
                  <div className="mt-3">
                    <SkeletonWhite width={230} height={30} />
                  </div>
                  <div className="mt-3">
                    <SkeletonWhite width={280} />
                  </div>
                </div>

                <SkeletonWhite width={120} height={44} />
              </div>
            </section>

            {/* Technician KPIs */}
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonStatCard key={i} />
              ))}
            </section>

            {/* Priority job queue */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

              <div className="flex items-center justify-between gap-3">
                <div>
                  <SkeletonHeading width={150} />

                  <div className="mt-2">
                    <SkeletonSubheading width={230} />
                  </div>
                </div>

                <SkeletonButton width={72} height={32} />
              </div>

              <div className="mt-5 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-100 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

                      <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-emerald-50" />

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-50" />

                        <div className="flex gap-2">
                          <div className="h-5 w-16 animate-pulse rounded-full bg-emerald-50" />
                          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-50" />
                        </div>
                      </div>

                      <div className="space-y-2 sm:text-right">
                        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-100" />
                        <div className="ml-auto h-3 w-20 animate-pulse rounded bg-slate-50" />
                      </div>

                      <SkeletonButton width={82} height={38} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* My jobs + earnings */}
            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <SkeletonHeading width={125} />

                <div className="mt-5 space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-10 w-10 animate-pulse rounded-xl bg-blue-50" />

                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                        <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-50" />
                      </div>

                      <div className="h-3 w-12 animate-pulse rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <SkeletonHeading width={110} />

                <div className="mt-5 h-36 animate-pulse rounded-2xl bg-slate-50" />

                <div className="mt-4 flex justify-between">
                  <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            </section>

            {/* Availability */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <SkeletonHeading width={140} />

                  <div className="mt-2">
                    <SkeletonSubheading width={230} />
                  </div>
                </div>

                <SkeletonButton width={100} height={36} />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-7">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-xl bg-slate-50"
                  />
                ))}
              </div>
            </section>

            {/* Verification / profile */}
            <section className="grid gap-4 md:grid-cols-2">
              <SkeletonCard height={150} />
              <SkeletonCard height={150} />
            </section>
          </section>
        </div>
      </div>

      <span className="sr-only">
        Loading your AuroWater technician workspace…
      </span>
    </main>
  );
}

function SkeletonWhite({
  width,
  height = 14,
}: {
  width: number | string;
  height?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse rounded-lg bg-white/15"
      style={{ width, height }}
    />
  );
}
