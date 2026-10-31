/** Route-level loading boundary displays instantly during booking navigation. */
export default function BookLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8" aria-busy="true" aria-label="Loading booking">
      <div className="h-8 w-44 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-6 h-28 animate-pulse rounded-2xl bg-slate-100" />
      <div className="mt-4 h-48 animate-pulse rounded-2xl bg-slate-100" />
      <span className="sr-only">Loading booking options</span>
    </main>
  );
}
