export default function AdminLoading() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-label="Loading admin control center"
    >
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-white/10" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-white/5" />
      </div>

      {/* KPI skeletons */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
          />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="h-80 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04] xl:col-span-2" />

        <div className="h-80 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-5 h-5 w-40 animate-pulse rounded bg-white/10" />

        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded-lg bg-white/5"
            />
          ))}
        </div>
      </div>

      <span className="sr-only">
        Loading AuroWater admin control center…
      </span>
    </div>
  );
}
