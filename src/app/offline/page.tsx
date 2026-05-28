'use client';

import React from 'react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
        <div className="text-4xl mb-3" aria-hidden="true">
          Offline
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">You are offline</h1>
        <p className="text-slate-600 mt-2 text-sm">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

