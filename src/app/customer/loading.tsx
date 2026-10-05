import {
  SkeletonHeading,
  SkeletonSubheading,
  SkeletonButton,
  SkeletonOrderRow,
  SkeletonStatStrip,
  SkeletonServiceGrid,
  SkeletonWelcomeCard,
} from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <main
      role="status"
      aria-label="Loading your AuroWater dashboard"
      className="min-h-screen bg-[#F0F6FF]"
    >
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-blue-100 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-blue-100" />
            <div className="hidden space-y-2 sm:block">
              <div className="h-3 w-24 animate-pulse rounded bg-blue-100" />
              <div className="h-2.5 w-16 animate-pulse rounded bg-blue-50" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-9 w-9 animate-pulse rounded-xl bg-blue-50" />
            <div className="h-9 w-9 animate-pulse rounded-xl bg-blue-50" />
            <div className="h-9 w-9 animate-pulse rounded-full bg-blue-100" />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5 pb-20 sm:space-y-6 sm:px-6 sm:py-7">
        {/* Welcome / Hero */}
        <SkeletonWelcomeCard />

        {/* Quick overview */}
        <section>
          <div className="mb-3">
            <SkeletonHeading width={150} />
          </div>

          <SkeletonStatStrip cols={4} />
        </section>

        {/* Services */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <SkeletonHeading width={130} />
            <SkeletonButton width={70} height={30} />
          </div>

          <SkeletonServiceGrid
            cols={6}
            items={6}
          />
        </section>

        {/* Current / recent orders */}
        <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-blue-50 px-4 py-4 sm:px-5">
            <div>
              <SkeletonHeading width={125} />
              <div className="mt-2">
                <SkeletonSubheading width={180} />
              </div>
            </div>

            <SkeletonButton width={70} height={32} />
          </div>

          <div>
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonOrderRow key={index} />
            ))}
          </div>
        </section>

        {/* Bottom quick-action cards */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            <SkeletonHeading width={150} />

            <div className="mt-3">
              <SkeletonSubheading width="75%" />
            </div>

            <div className="mt-5">
              <SkeletonButton width={120} height={40} />
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
            <SkeletonHeading width={135} />

            <div className="mt-3">
              <SkeletonSubheading width="70%" />
            </div>

            <div className="mt-5">
              <SkeletonButton width={120} height={40} />
            </div>
          </div>
        </section>
      </div>

      {/* Screen-reader announcement */}
      <span className="sr-only">
        Loading your AuroWater dashboard…
      </span>
    </main>
  );
}
