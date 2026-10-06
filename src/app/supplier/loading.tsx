import {
  SkeletonHeading,
  SkeletonSubheading,
  SkeletonButton,
  SkeletonCard,
  SkeletonStatCard,
  SkeletonOrderRow,
} from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Loading AuroWater supplier workspace"
      className="min-h-screen bg-slate-50"
    >
      {/* Screen-reader loading state */}
      <span className="sr-only">
        Loading your AuroWater supplier workspace. Please wait.
      </span>

      <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 sm:py-5 lg:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)] xl:gap-6">

          {/* ============================================================
              SUPPLIER SIDEBAR
          ============================================================ */}
          <aside
            aria-hidden="true"
            className="hidden lg:block"
          >
            <div className="sticky top-5 overflow-hidden rounded-[28px] bg-[#003049] shadow-[0_20px_60px_rgba(0,48,73,0.16)]">
              
              {/* Brand */}
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/10" />

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded-full bg-white/15" />
                    <div className="h-2.5 w-16 animate-pulse rounded-full bg-white/10" />
                  </div>
                </div>
              </div>

              {/* Supplier status */}
              <div className="p-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                  <div className="h-2.5 w-20 animate-pulse rounded-full bg-white/10" />

                  <div className="mt-3 h-4 w-32 animate-pulse rounded-full bg-white/15" />

                  <div className="mt-4 h-7 w-24 animate-pulse rounded-full bg-white/10" />
                </div>

                {/* Navigation */}
                <nav className="mt-5 space-y-1.5">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex h-11 items-center gap-3 rounded-2xl px-3"
                    >
                      <div className="h-8 w-8 animate-pulse rounded-xl bg-white/[0.08]" />

                      <div
                        className="h-3 animate-pulse rounded-full bg-white/[0.08]"
                        style={{
                          width: `${65 + (index % 4) * 18}px`,
                        }}
                      />
                    </div>
                  ))}
                </nav>
              </div>

              {/* Sidebar footer */}
              <div className="border-t border-white/10 p-5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 animate-pulse rounded-xl bg-white/10" />

                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 w-20 animate-pulse rounded-full bg-white/10" />
                    <div className="h-2 w-28 animate-pulse rounded-full bg-white/[0.07]" />
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* ============================================================
              MAIN SUPPLIER WORKSPACE
          ============================================================ */}
          <section className="min-w-0 space-y-5">

            {/* ==========================================================
                HEADER
            ========================================================== */}
            <header className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)] sm:p-5">
              <div className="flex items-center justify-between gap-4">

                <div className="min-w-0">
                  <SkeletonSubheading width={120} />

                  <div className="mt-2">
                    <SkeletonHeading width={220} />
                  </div>

                  <div className="mt-2">
                    <div className="h-2.5 w-48 animate-pulse rounded-full bg-slate-100" />
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <SkeletonButton width={42} height={42} />
                  <SkeletonButton width={42} height={42} />
                </div>
              </div>
            </header>

            {/* ==========================================================
                SUPPLIER PARTNER HERO
            ========================================================== */}
            <section
              aria-hidden="true"
              className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#2A9D8F] via-[#16766E] to-[#003049] p-5 shadow-[0_20px_50px_rgba(0,48,73,0.16)] sm:p-7"
            >
              {/* Decorative background */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/[0.06]" />
              <div className="pointer-events-none absolute -bottom-24 right-20 h-48 w-48 rounded-full bg-white/[0.04]" />

              <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

                <div className="min-w-0">
                  <SkeletonBoxLight width={120} />

                  <div className="mt-3">
                    <SkeletonBoxLight
                      width="min(100%, 280px)"
                      height={34}
                    />
                  </div>

                  <div className="mt-3">
                    <SkeletonBoxLight
                      width="min(100%, 360px)"
                      height={13}
                    />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <SkeletonBoxLight width={100} height={30} />
                    <SkeletonBoxLight width={120} height={30} />
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <SkeletonBoxLight width={88} height={42} />

                  <div className="h-[72px] w-[72px] animate-pulse rounded-2xl bg-white/10" />
                </div>
              </div>
            </section>

            {/* ==========================================================
                KPI GRID
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
                OPERATIONAL OVERVIEW
            ========================================================== */}
            <section
              aria-hidden="true"
              className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]"
            >
              {/* Orders */}
              <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm">

                <div className="flex items-center justify-between gap-4 border-b border-slate-100 p-5">
                  <div>
                    <SkeletonHeading width={135} />

                    <div className="mt-2">
                      <SkeletonSubheading width={205} />
                    </div>
                  </div>

                  <SkeletonButton width={76} height={34} />
                </div>

                <div>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <SkeletonOrderRow key={index} />
                  ))}
                </div>
              </div>

              {/* Order status */}
              <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
                <SkeletonHeading width={145} />

                <div className="mt-2">
                  <SkeletonSubheading width={175} />
                </div>

                <div className="mt-6 flex items-center justify-center">
                  <div className="relative h-40 w-40">
                    <div className="absolute inset-0 animate-pulse rounded-full border-[18px] border-slate-100" />

                    <div className="absolute inset-7 animate-pulse rounded-full bg-slate-50" />
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-100" />
                        <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100" />
                      </div>

                      <div className="h-3 w-10 animate-pulse rounded-full bg-slate-100" />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ==========================================================
                SUPPLIER OPERATIONS
            ========================================================== */}
            <section
              aria-hidden="true"
              className="grid gap-4 md:grid-cols-2"
            >
              <SkeletonCard height={190} />
              <SkeletonCard height={190} />
            </section>

            {/* ==========================================================
                RECENT ACTIVITY
            ========================================================== */}
            <section
              aria-hidden="true"
              className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
            >
              <div className="flex items-center justify-between">
                <SkeletonHeading width={155} />
                <SkeletonButton width={60} height={30} />
              </div>

              <div className="mt-6 divide-y divide-slate-100">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />

                    <div className="min-w-0 flex-1 space-y-2">
                      <div
                        className="h-3 animate-pulse rounded-full bg-slate-100"
                        style={{
                          width: `${55 + (index % 3) * 15}%`,
                        }}
                      />

                      <div className="h-2.5 w-24 animate-pulse rounded-full bg-slate-50" />
                    </div>

                    <div className="h-2.5 w-12 animate-pulse rounded-full bg-slate-100" />
                  </div>
                ))}
              </div>
            </section>

          </section>
        </div>
      </div>
    </main>
  );
}

/* ================================================================
   HERO SKELETON
================================================================ */

function SkeletonBoxLight({
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
