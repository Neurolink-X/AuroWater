'use client';

import React from 'react';

export default function RetryButton() {
  const handleRetry = (): void => {
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={handleRetry}
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-500 px-6 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-[#0A1628]"
    >
      Try again
    </button>
  );
}
