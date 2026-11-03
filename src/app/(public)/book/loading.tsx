/** An immediate route-level skeleton while Next prepares the booking wizard. */
export default function BookLoading() {
  return (
    <main
      className="mx-auto min-h-[60vh] w-full max-w-3xl rounded-2xl bg-slate-50 px-4 py-8 text-slate-900 sm:px-6"
      aria-busy="true"
      aria-label="Loading booking"
      role="status"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none" />
        <p className="mt-2 text-sm font-semibold text-slate-700">
          Opening your booking options…
        </p>
        <div className="mt-6 h-28 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
        <div className="mt-4 h-40 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
        <div className="mt-4 h-12 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
      </div>
      <p className="mt-4 text-sm text-slate-700">
        Service availability, address and final price will be checked before confirmation.
      </p>
    </main>
  );
}
