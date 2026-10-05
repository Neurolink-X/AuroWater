export default function AdminLoading() {
  return (
    <div
      className="relative min-h-[calc(100vh-4rem)] overflow-hidden"
      role="status"
      aria-label="Loading AuroWater admin control center"
    >
      {/* Ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-80 w-80 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl space-y-6">
        {/* =====================================================
            HEADER
           ===================================================== */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="h-7 w-52 animate-pulse rounded-lg bg-white/10 sm:h-8 sm:w-64" />

              <div className="h-3.5 w-72 max-w-full animate-pulse rounded bg-white/5 sm:w-96" />

              <div className="flex items-center gap-2 pt-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400/60" />
                <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
              </div>
            </div>

            <div className="flex gap-2">
              <div className="h-10 w-24 animate-pulse rounded-xl bg-white/5" />
              <div className="h-10 w-28 animate-pulse rounded-xl bg-white/5" />
            </div>
          </div>
        </section>

        {/* =====================================================
            QUICK ACTIONS
           ===================================================== */}
        <section>
          <div className="mb-3 h-3 w-28 animate-pulse rounded bg-white/5" />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-14 animate-pulse rounded-xl border border-white/10 bg-white/[0.035]"
              />
            ))}
          </div>
        </section>

        {/* =====================================================
            KPI CARDS
           ===================================================== */}
        <section>
          <div className="mb-3 h-3 w-24 animate-pulse rounded bg-white/5" />

          <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="relative h-32 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="h-9 w-9 animate-pulse rounded-xl bg-white/10" />
                  <div className="h-3 w-12 animate-pulse rounded bg-white/5" />
                </div>

                <div className="mt-5 h-7 w-24 animate-pulse rounded-lg bg-white/10" />

                <div className="mt-2 h-3 w-32 animate-pulse rounded bg-white/5" />
              </div>
            ))}
          </div>
        </section>

        {/* =====================================================
            ANALYTICS / OPERATIONS
           ===================================================== */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="min-h-[280px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.035] p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-5 w-36 rounded bg-white/10" />
                <div className="mt-2 h-3 w-52 rounded bg-white/5" />
              </div>

              <div className="h-9 w-24 rounded-lg bg-white/5" />
            </div>

            {/* Fake chart */}
            <div className="mt-8 flex h-44 items-end gap-2">
              {[42, 65, 48, 78, 56, 88, 68, 96, 72, 84, 62, 76].map(
                (height, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded-t-lg bg-white/[0.07]"
                    style={{ height: `${height}%` }}
                  />
                ),
              )}
            </div>
          </div>

          <div className="min-h-[280px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="h-5 w-32 rounded bg-white/10" />
            <div className="mt-2 h-3 w-44 rounded bg-white/5" />

            <div className="mt-8 space-y-5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index}>
                  <div className="flex justify-between">
                    <div className="h-3 w-20 rounded bg-white/5" />
                    <div className="h-3 w-10 rounded bg-white/5" />
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-white/[0.08]"
                      style={{
                        width: `${35 + index * 15}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =====================================================
            RECENT ACTIVITY / TABLE
           ===================================================== */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
          <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-5">
            <div>
              <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
              <div className="mt-2 h-3 w-48 animate-pulse rounded bg-white/5" />
            </div>

            <div className="h-9 w-20 animate-pulse rounded-lg bg-white/5" />
          </div>

          {/* Desktop/tablet rows */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-5 gap-4 border-b border-white/5 px-5 py-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-3 animate-pulse rounded bg-white/5"
                />
              ))}
            </div>

            <div className="divide-y divide-white/5">
              {Array.from({ length: 5 }).map((_, row) => (
                <div
                  key={row}
                  className="grid grid-cols-5 items-center gap-4 px-5 py-4"
                >
                  {Array.from({ length: 5 }).map((_, column) => (
                    <div
                      key={column}
                      className={`h-4 animate-pulse rounded bg-white/[0.055] ${
                        column === 0
                          ? 'w-28'
                          : column === 4
                            ? 'w-16'
                            : 'w-20'
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile rows */}
          <div className="divide-y divide-white/5 sm:hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-28 animate-pulse rounded bg-white/[0.08]" />
                  <div className="h-4 w-16 animate-pulse rounded bg-white/5" />
                </div>

                <div className="h-3 w-40 animate-pulse rounded bg-white/5" />

                <div className="flex justify-between">
                  <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =====================================================
            FOOTER STATUS
           ===================================================== */}
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />

          <span className="text-xs text-slate-500">
            Loading AuroWater Control Center…
          </span>
        </div>
      </div>

      <span className="sr-only">
        Loading dashboard data, analytics, orders, users and
        operational metrics…
      </span>
    </div>
  );
}
