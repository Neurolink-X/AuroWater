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
      aria-busy="true"
      aria-label="Loading AuroWater technician workspace"
      className="min-h-screen bg-slate-50"
    >
      <span className="sr-only">
        Loading your AuroWater technician workspace. Please wait.
      </span>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 sm:py-5 lg:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:gap-6">

          {/* ============================================================
              TECHNICIAN NAVIGATION
          ============================================================ */}
          <aside
            aria-hidden="true"
            className="hidden lg:block"
          >
            <div className="sticky top-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">

              {/* Identity */}
              <div className="border-b border-slate-100 p-5">
                <div className="flex items-center gap-3">

                  <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-emerald-50" />

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
                    <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-50" />
                  </div>

                </div>
              </div>

              {/* Availability */}
              <div className="p-5 pb-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">

                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-200" />

                    <div className="h-3 w-20 animate-pulse rounded-full bg-emerald-100" />
                  </div>

                  <div className="mt-3 h-2.5 w-32 animate-pulse rounded-full bg-emerald-100" />

                  <div className="mt-4 h-8 w-full animate-pulse rounded-xl bg-white/70" />
                </div>
              </div>

              {/* Navigation */}
              <nav className="space-y-1.5 p-5 pt-2">

                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex h-11 items-center gap-3 rounded-2xl px-3"
                  >
                    <div className="h-8 w-8 shrink-0 animate-pulse rounded-xl bg-slate-50" />

                    <div
                      className="h-3 animate-pulse rounded-full bg-slate-100"
                      style={{
                        width: `${62 + (index % 4) * 18}px`,
                      }}
                    />
                  </div>
                ))}

              </nav>

              {/* Footer */}
              <div className="border-t border-slate-100 p-5">

                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-50" />

                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-100" />
                    <div className="h-2 w-28 animate-pulse rounded-full bg-slate-50" />
                  </div>
                </div>

              </div>
            </div>
          </aside>

          {/* ============================================================
              MAIN WORKSPACE
          ============================================================ */}
          <section className="min-w-0 space-y-5">

            {/* ==========================================================
                HEADER
            ========================================================== */}
            <header className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:p-5">

              <div className="flex items-center justify-between gap-4">

                <div className="min-w-0">

                  <SkeletonSubheading width={115} />

                  <div className="mt-2">
                    <SkeletonHeading width={230} />
                  </div>

                  <div className="mt-2">
                    <SkeletonSubheading width={270} />
                  </div>

                </div>

                <div className="flex shrink-0 gap-2">
                  <SkeletonButton width={42} height={42} />
                  <SkeletonButton width={42} height={42} />
                </div>

              </div>
            </header>

            {/* ==========================================================
                AVAILABILITY / OPERATING STATUS HERO
            ========================================================== */}
            <section
              aria-hidden="true"
              className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#0D9B6C] via-[#087F60] to-[#003049] p-5 shadow-[0_20px_55px_rgba(0,48,73,0.16)] sm:p-7"
            >

              {/* Decorative depth */}
              <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.06]" />

              <div className="pointer-events-none absolute -bottom-28 right-24 h-52 w-52 rounded-full bg-white/[0.04]" />

              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

                <div className="min-w-0">

                  <SkeletonWhite width={125} />

                  <div className="mt-3">
                    <SkeletonWhite
                      width="min(100%, 250px)"
                      height={32}
                    />
                  </div>

                  <div className="mt-3">
                    <SkeletonWhite
                      width="min(100%, 360px)"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <SkeletonWhite width={104} height={30} />
                    <SkeletonWhite width={126} height={30} />
                  </div>

                </div>

                <div className="flex shrink-0 items-center gap-3">

                  <SkeletonWhite
                    width={124}
                    height={44}
                  />

                  <div className="h-[72px] w-[72px] animate-pulse rounded-2xl bg-white/10" />

                </div>

              </div>
            </section>

            {/* ==========================================================
                KPI COMMAND CENTER
            ========================================================== */}
            <section
              aria-hidden="true"
              className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonStatCard key={index} />
              ))}
            </section>

            {/* ==========================================================
                TODAY'S OPERATIONAL OVERVIEW
            ========================================================== */}
            <section
              aria-hidden="true"
              className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]"
            >

              {/* Priority jobs */}
              <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm">

                <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">

                  <div>
                    <SkeletonHeading width={155} />

                    <div className="mt-2">
                      <SkeletonSubheading width={235} />
                    </div>
                  </div>

                  <SkeletonButton width={78} height={34} />

                </div>

                <div className="space-y-3 p-4 sm:p-5">

                  {Array.from({ length: 3 }).map((_, index) => (
                    <JobSkeleton key={index} />
                  ))}

                </div>
              </div>

              {/* Today's performance */}
              <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">

                <SkeletonHeading width={155} />

                <div className="mt-2">
                  <SkeletonSubheading width={185} />
                </div>

                {/* Chart */}
                <div className="mt-6 flex h-44 items-end gap-2 rounded-2xl bg-slate-50 p-5">

                  {Array.from({ length: 7 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex flex-1 items-end"
                    >
                      <div
                        className="w-full animate-pulse rounded-t-lg bg-slate-200"
                        style={{
                          height: `${35 + (index % 5) * 12}%`,
                        }}
                      />
                    </div>
                  ))}

                </div>

                <div className="mt-4 flex items-center justify-between">

                  <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100" />

                  <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />

                </div>

              </div>

            </section>

            {/* ==========================================================
                JOB ACTIVITY + EARNINGS
            ========================================================== */}
            <section
              aria-hidden="true"
              className="grid gap-4 md:grid-cols-2"
            >

              {/* Activity */}
              <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">

                <div className="flex items-center justify-between">
                  <SkeletonHeading width={135} />
                  <SkeletonButton width={62} height={30} />
                </div>

                <div className="mt-5 divide-y divide-slate-100">

                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"
                    >

                      <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-blue-50" />

                      <div className="min-w-0 flex-1 space-y-2">
                        <div
                          className="h-3 animate-pulse rounded-full bg-slate-100"
                          style={{
                            width: `${58 + (index % 3) * 12}%`,
                          }}
                        />

                        <div className="h-2.5 w-28 animate-pulse rounded-full bg-slate-50" />
                      </div>

                      <div className="h-3 w-12 animate-pulse rounded-full bg-slate-100" />

                    </div>
                  ))}

                </div>

              </div>

              {/* Earnings */}
              <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">

                <div className="flex items-center justify-between">
                  <div>
                    <SkeletonHeading width={120} />

                    <div className="mt-2">
                      <SkeletonSubheading width={150} />
                    </div>
                  </div>

                  <SkeletonButton width={68} height={30} />
                </div>

                <div className="mt-5 rounded-2xl bg-slate-50 p-5">

                  <div className="h-8 w-36 animate-pulse rounded-lg bg-slate-200" />

                  <div className="mt-3 h-3 w-28 animate-pulse rounded-full bg-slate-100" />

                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-100" />
                    <div className="mt-2 h-4 w-20 animate-pulse rounded bg-slate-200" />
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="h-2.5 w-16 animate-pulse rounded-full bg-slate-100" />
                    <div className="mt-2 h-4 w-20 animate-pulse rounded bg-slate-200" />
                  </div>

                </div>

              </div>

            </section>

            {/* ==========================================================
                AVAILABILITY SCHEDULE
            ========================================================== */}
            <section
              aria-hidden="true"
              className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
            >

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <SkeletonHeading width={150} />

                  <div className="mt-2">
                    <SkeletonSubheading width={245} />
                  </div>
                </div>

                <SkeletonButton width={105} height={36} />

              </div>

              <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-7">

                {Array.from({ length: 7 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="mx-auto h-2.5 w-10 animate-pulse rounded-full bg-slate-100" />

                    <div className="mx-auto mt-3 h-5 w-12 animate-pulse rounded-lg bg-slate-200" />
                  </div>
                ))}

              </div>

            </section>

            {/* ==========================================================
                VERIFICATION + PROFILE
            ========================================================== */}
            <section
              aria-hidden="true"
              className="grid gap-4 md:grid-cols-2"
            >

              <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <SkeletonHeading width={145} />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-amber-50" />
                </div>

                <div className="mt-5 space-y-3">

                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3"
                    >
                      <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-50" />

                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
                        <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-slate-50" />
                      </div>

                      <div className="h-3 w-12 animate-pulse rounded-full bg-slate-100" />
                    </div>
                  ))}

                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
                <SkeletonHeading width={125} />

                <div className="mt-5 flex items-center gap-4">

                  <div className="h-16 w-16 shrink-0 animate-pulse rounded-2xl bg-slate-100" />

                  <div className="flex-1 space-y-3">
                    <div className="h-3 w-32 animate-pulse rounded-full bg-slate-100" />
                    <div className="h-2.5 w-44 animate-pulse rounded-full bg-slate-50" />
                    <div className="h-8 w-24 animate-pulse rounded-xl bg-slate-100" />
                  </div>

                </div>
              </div>

            </section>

          </section>
        </div>
      </div>
    </main>
  );
}

/* =================================================================
   JOB SKELETON
================================================================= */

function JobSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

        <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-emerald-50" />

        <div className="min-w-0 flex-1 space-y-2.5">

          <div className="h-4 w-2/3 animate-pulse rounded-full bg-slate-100" />

          <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-50" />

          <div className="flex flex-wrap gap-2">
            <div className="h-5 w-16 animate-pulse rounded-full bg-emerald-50" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-slate-50" />
          </div>

        </div>

        <div className="space-y-2 sm:text-right">
          <div className="ml-auto h-4 w-16 animate-pulse rounded-full bg-slate-100" />
          <div className="ml-auto h-3 w-24 animate-pulse rounded-full bg-slate-50" />
        </div>

        <SkeletonButton
          width={92}
          height={40}
        />

      </div>
    </div>
  );
}

/* =================================================================
   HERO SKELETON
================================================================= */

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
      className="animate-pulse rounded-xl bg-white/15"
      style={{
        width,
        height,
      }}
    />
  );
}
