'use client';

import { useEffect } from 'react';

export default function SupplierDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[supplier] dashboard crashed:', error);
  }, [error]);

  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'linear-gradient(160deg,#060C17 0%,#070A12 50%,#060E18 100%)',
        color: '#F0F4FF',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          background: 'rgba(255,255,255,0.03)',
          border: '1.5px solid rgba(248,113,113,0.25)',
          borderRadius: 20,
          padding: '36px 28px',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Dashboard could not load</h1>
        <p style={{ margin: '10px 0 22px', fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.5)' }}>
          Something went wrong while loading your orders. Your data is safe. Please try again.
        </p>
        {error.digest && (
          <p style={{ margin: '0 0 18px', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            Reference: {error.digest}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              flex: 1,
              minHeight: 44,
              border: 'none',
              borderRadius: 11,
              background: 'linear-gradient(135deg,#0D9B6C,#059652)',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Try again
          </button>
          <a
            href="/auth/login"
            style={{
              flex: 1,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 11,
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Sign in again
          </a>
        </div>
      </div>
    </div>
  );
}
