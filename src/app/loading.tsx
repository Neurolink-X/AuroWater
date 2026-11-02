/**
 * Compact, accessible route-transition skeleton.
 * Keeps the persistent app chrome visible, avoids another splash screen,
 * and delays its reveal so quick navigations do not flash.
 */
const css = `
.aw-route-skeleton { animation:aw-route-show .16s ease-out .22s both; }
.aw-route-shimmer {position:relative;overflow:hidden;background:#e2e8f0}
.aw-route-shimmer::after {content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);transform:translateX(-100%);animation:aw-route-sweep 1.5s ease-in-out infinite}
@keyframes aw-route-show {from{opacity:0;visibility:hidden}to{opacity:1;visibility:visible}}
@keyframes aw-route-sweep {to{transform:translateX(100%)}}
@media(prefers-reduced-motion:reduce){.aw-route-shimmer::after{animation:none;display:none}}
`;
export default function Loading() {
  return (
    <section role="status" aria-label="Opening page" aria-busy="true" className="aw-route-skeleton mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
      <style>{css}</style>
      <span className="sr-only">Opening page…</span>
      <div className="mb-5 flex items-center gap-3">
        <div className="aw-route-shimmer h-9 w-9 shrink-0 rounded-xl" aria-hidden="true" />
        <div className="aw-route-shimmer h-5 w-40 rounded-lg" aria-hidden="true" />
      </div>
      <div className="aw-route-shimmer mb-4 h-28 rounded-2xl sm:h-36" aria-hidden="true" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
        <div className="aw-route-shimmer h-20 rounded-xl" />
        <div className="aw-route-shimmer h-20 rounded-xl" />
        <div className="aw-route-shimmer h-20 rounded-xl" />
        <div className="aw-route-shimmer h-20 rounded-xl" />
      </div>
    </section>
  );
}
