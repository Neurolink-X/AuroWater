export default function SupplierDashboardLoading() {
  const shimmer: React.CSSProperties = {
    background:
      'linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.10) 50%,rgba(255,255,255,0.06) 75%)',
    backgroundSize: '200% 100%',
    animation: 'auro-shimmer 1.4s ease-in-out infinite',
    borderRadius: 12,
  };

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading supplier dashboard"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg,#060C17 0%,#070A12 50%,#060E18 100%)',
        padding: 'clamp(20px,4vw,32px) clamp(16px,4vw,24px)',
      }}
    >
      <style>{`@keyframes auro-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gap: 24 }}>
        <div style={{ ...shimmer, height: 60 }} />
        <div style={{ ...shimmer, height: 34, width: 280 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ ...shimmer, height: 108, borderRadius: 16 }} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ ...shimmer, height: 240, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
