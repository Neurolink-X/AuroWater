'use client';

import React, { useEffect, useState } from 'react';
import { safeGet, safeSet } from '@/lib/storage';

const PREF_KEY = 'aw_cookie_prefs';

type Prefs = { essential: true; analytics: boolean };

export default function CookiesClient() {
  const [prefs, setPrefs] = useState<Prefs>({ essential: true, analytics: false });

  useEffect(() => {
    const raw = safeGet(PREF_KEY);
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as Partial<Prefs>;
      setPrefs({ essential: true, analytics: Boolean(p.analytics) });
    } catch {
      /* ignore */
    }
  }, []);

  const save = (next: Prefs) => {
    setPrefs(next);
    safeSet(PREF_KEY, JSON.stringify(next));
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-slate-800">
      <h1 className="font-[Syne] text-3xl font-black text-[#0A1628]">Cookie policy</h1>
      <p className="mt-4 text-slate-600">
        We use a small set of cookies and similar storage so AuroWater works on your phone. We do not use third-party advertising cookies.
      </p>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Type</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="px-4 py-3 font-mono text-xs">aw_session / aw_role</td>
              <td className="px-4 py-3">Keep you signed in on this device</td>
              <td className="px-4 py-3">Session / 7 days</td>
              <td className="px-4 py-3">Essential</td>
            </tr>
            <tr className="border-t">
              <td className="px-4 py-3 font-mono text-xs">aurowater_session</td>
              <td className="px-4 py-3">Dashboard session cache</td>
              <td className="px-4 py-3">Until logout</td>
              <td className="px-4 py-3">Essential</td>
            </tr>
            <tr className="border-t">
              <td className="px-4 py-3 font-mono text-xs">aw_cookie_prefs</td>
              <td className="px-4 py-3">Stores this preference</td>
              <td className="px-4 py-3">1 year</td>
              <td className="px-4 py-3">Essential</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold">Preferences</h2>
        <label className="mt-4 flex items-center justify-between gap-4 text-sm">
          <span>Essential (always on)</span>
          <input type="checkbox" checked disabled className="h-4 w-4" />
        </label>
        <label className="mt-3 flex items-center justify-between gap-4 text-sm">
          <span>Analytics (optional)</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-cyan-600"
            checked={prefs.analytics}
            onChange={(e) => save({ essential: true, analytics: e.target.checked })}
          />
        </label>
      </div>
    </div>
  );
}
