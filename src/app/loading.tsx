/**
 * Lightweight route transition fallback. RootChrome remains mounted.
 * Delayed appearance avoids flashes on fast navigations.
 * No image request, JavaScript, full-page skeleton or infinite spinner.
 */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none relative h-1 w-full overflow-hidden" aria-label="Opening page">
      <span className="sr-only">Opening page…</span>
      <div className="absolute inset-y-0 left-0 w-1/3 origin-left animate-pulse rounded-full bg-sky-500 motion-reduce:animate-none" />
    </div>
  );
}
