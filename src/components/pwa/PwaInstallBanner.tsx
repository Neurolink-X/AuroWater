'use client';

/* This component intentionally hydrates browser state after mount. */
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { safeGet, safeSet } from '@/lib/storage';

const DISMISS_KEY = 'aw_pwa_install_dismissed';
const VISIT_KEY = 'aw_pwa_visits';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (safeGet(DISMISS_KEY) === '1') return;
    const visits = Number(safeGet(VISIT_KEY) ?? '0') + 1;
    safeSet(VISIT_KEY, String(visits));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (visits >= 2) setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    if (visits >= 2) setShow(true);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Install AuroWater"
      className="fixed bottom-20 left-4 right-4 z-[70] mx-auto max-w-md rounded-2xl border border-cyan-400/30 bg-[#0A1628] p-4 text-white shadow-2xl sm:bottom-6"
    >
      <p className="font-syne text-sm font-extrabold">Install AuroWater for faster ordering!</p>
      <p className="mt-1 text-xs text-white/60">Add to your home screen — works offline for recent pages.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-extrabold text-slate-950"
          onClick={async () => {
            if (deferred) {
              await deferred.prompt();
              setShow(false);
            } else {
              toast('Use your browser menu → Add to Home Screen');
            }
          }}
        >
          Install
        </button>
        <button
          type="button"
          className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/80"
          onClick={() => {
            safeSet(DISMISS_KEY, '1');
            setShow(false);
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

