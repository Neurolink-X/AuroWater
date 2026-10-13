/** Streams in instantly while a supplier page loads. Light skeleton that matches the shell. */
function Bar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-emerald-900/[0.06] motion-reduce:animate-none ${className}`} />;
}

export default function SupplierLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-3 py-6 sm:px-6 lg:px-8" role="status" aria-busy="true" aria-label="Loading">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Bar className="h-4 w-28" />
        <Bar className="mt-3 h-9 w-64 max-w-full" />
        <Bar className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Bar className="h-9 w-9 rounded-xl" />
            <Bar className="mt-4 h-3 w-20" />
            <Bar className="mt-2 h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Bar className="h-4 w-40" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bar key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading your supplier portal</span>
    </div>
  );
}





// export default function SupplierDashboardLoading() {
//   const shimmer: React.CSSProperties = {
//     background:
//       'linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.10) 50%,rgba(255,255,255,0.06) 75%)',
//     backgroundSize: '200% 100%',
//     animation: 'auro-shimmer 1.4s ease-in-out infinite',
//     borderRadius: 12,
//   };

//   return (
//     <div
//       role="status"
//       aria-busy="true"
//       aria-label="Loading supplier dashboard"
//       style={{
//         minHeight: '100vh',
//         background: 'linear-gradient(160deg,#060C17 0%,#070A12 50%,#060E18 100%)',
//         padding: 'clamp(20px,4vw,32px) clamp(16px,4vw,24px)',
//       }}
//     >
//       <style>{`@keyframes auro-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
//       <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 24 }}>
//         <div style={{ ...shimmer, height: 60 }} />
//         <div style={{ ...shimmer, height: 34, width: 280 }} />
//         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
//           {Array.from({ length: 6 }).map((_, i) => (
//             <div key={i} style={{ ...shimmer, height: 108, borderRadius: 16 }} />
//           ))}
//         </div>
//         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
//           {Array.from({ length: 3 }).map((_, i) => (
//             <div key={i} style={{ ...shimmer, height: 240, borderRadius: 16 }} />
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }
