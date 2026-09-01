/** Lightweight route fallback — full wizard mounts client-side only. */
export default function BookLoading() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 bg-slate-50">
      <div
        className="h-10 w-10 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin"
        aria-hidden
      />
      <p className="text-sm font-medium text-slate-600">Loading booking…</p>
    </div>
  );
}
