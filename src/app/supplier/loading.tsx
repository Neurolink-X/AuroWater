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
      aria-label="Loading supplier workspace"
      className="min-h-screen bg-slate-50"
    >
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">

          {/* Supplier navigation */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-5 rounded-3xl bg-[#003049] p-5 shadow-xl">
              <div className="flex items-center gap-3 border-b border-white/10 pb-5">
                <div className="h-11 w-11 animate-pulse rounded-xl bg-white/15" />
                <div className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-white/15" />
                  <div className="h-2.5 w-16 animate-pulse rounded bg-white/10" />
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-white/10 p-4">
                <div className="h-3 w-20 animate-pulse rounded bg-white/15" />
                <div className="mt-3 h-4 w-32 animate-pulse rounded bg-white/15" />
                <div className="mt-3 h-6 w-28 animate-pulse rounded-full bg-white/10" />
              </div>

              <div className="mt-5 space-y-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex h-11 items-center gap-3 rounded-2xl px-4"
                  >
                    <div className="h-7 w-7 animate-pulse rounded-lg bg-white/10" />
                    <div
                      className="h-3 animate-pulse rounded bg-white/10"
                      style={{ width: `${55 + (i % 3) * 15}px` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Main workspace */}
          <section className="lg:col-span-9 space-y-5">

            {/* Mobile / desktop header */}
            <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <SkeletonSubheading width={110} />
                  <div className="mt-2">
                    <SkeletonHeading width={210} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <SkeletonButton width={42} height={42} />
                  <SkeletonButton width={42} height={42} />
                </div>
              </div>
            </header>

            {/* AuroTap identity / partner hero */}
            <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2A9D8F] to-[#003049] p-6 shadow-xl">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <SkeletonBoxLight width={120} />
                  <div className="mt-3">
                    <SkeletonBoxLight width={230} height={34} />
                  </div>
                  <div className="mt-3">
                    <SkeletonBoxLight width={280} />
                  </div>
                </div>

                <div className="flex gap-3">
                  <SkeletonBoxLight width={82} height={40} />
                  <SkeletonBoxLight width={72} height={72} />
                </div>
              </div>
            </section>

            {/* KPI */}
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonStatCard key={i} />
              ))}
            </section>

            {/* Orders */}
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div>
                  <SkeletonHeading width={125} />
                  <div className="mt-2">
                    <SkeletonSubheading width={190} />
                  </div>
                </div>

                <SkeletonButton width={72} height={32} />
              </div>

              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonOrderRow key={i} />
              ))}
            </section>

            {/* Operational cards */}
            <section className="grid gap-4 md:grid-cols-2">
              <SkeletonCard height={180} />
              <SkeletonCard height={180} />
            </section>

            {/* Footer activity */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <SkeletonHeading width={150} />

              <div className="mt-5 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-9 w-9 animate-pulse rounded-xl bg-blue-50" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-blue-100" />
                      <div className="h-2.5 w-1/3 animate-pulse rounded bg-blue-50" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>
        </div>
      </div>

      <span className="sr-only">
        Loading your AuroWater supplier workspace…
      </span>
    </main>
  );
}

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
      className="animate-pulse rounded-lg bg-white/15"
      style={{ width, height }}
    />
  );
}
