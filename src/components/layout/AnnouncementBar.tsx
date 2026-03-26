'use client';

import React from 'react';

export default function AnnouncementBar() {
  const [dismissed, setDismissed] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      const d = localStorage.getItem('aurowater_bar_dismissed') === '1';
      setDismissed(d);
      setVisible(!d);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div
      className="announcement-bar fixed left-0 right-0 top-0 z-60 h-[40px] flex items-center justify-center px-4 text-white text-sm font-medium bg-gradient-to-r from-[#0D9B6C] to-[#38BDF8]"
      role="region"
      aria-label="Announcement"
    >
      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap">🎉 First 100 founding members get priority service —</span>
        <a href="/auth/register" className="font-bold underline decoration-white/70 hover:decoration-white">
          Claim Your Spot →
        </a>
      </div>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem('aurowater_bar_dismissed', '1');
          } catch {
            // ignore
          }
          setDismissed(true);
          setVisible(false);
        }}
        className="close-btn absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full hover:bg-white/10 transition-colors"
        aria-label="Dismiss announcement"
      >
        ✕
      </button>
    </div>
  );
}

