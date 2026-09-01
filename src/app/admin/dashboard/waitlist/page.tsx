'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '@/lib/api-client';

type WaitlistRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: string;
  status: string;
  source: string | null;
  created_at: string;
  custom_city: string | null;
  business_name: string | null;
  city_name: string;
  city_status: string | null;
};

type RoleFilter = 'all' | 'customer' | 'seller' | 'agent';

export default function AdminWaitlistPage() {
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<RoleFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/waitlist', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      const json = (await res.json()) as { success?: boolean; data?: WaitlistRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load waitlist');
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load waitlist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => (role === 'all' ? rows : rows.filter((r) => r.role === role)),
    [rows, role]
  );

  const demand = useMemo(() => {
    const map = new Map<string, { city: string; n: number }>();
    for (const r of rows) {
      const city = r.city_name || 'Unknown';
      const cur = map.get(city) ?? { city, n: 0 };
      cur.n += 1;
      map.set(city, cur);
    }
    return [...map.values()].sort((a, b) => b.n - a.n);
  }, [rows]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white">City waitlist</h1>
          <p className="mt-1 text-sm text-slate-400">Demand by city. Use this when deciding where to launch next.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {demand.slice(0, 8).map((d) => (
          <div key={d.city} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs text-slate-400">{d.city}</p>
            <p className="mt-1 text-2xl font-black text-cyan-300">{d.n}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">signups</p>
          </div>
        ))}
        {!loading && demand.length === 0 ? (
          <p className="text-sm text-slate-400">No waitlist entries yet.</p>
        ) : null}
      </div>

      <div className="flex gap-2">
        {(['all', 'customer', 'seller', 'agent'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setRole(id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize ${
              role === id ? 'bg-cyan-500 text-slate-950' : 'bg-white/10 text-white'
            }`}
          >
            {id}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : null}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">When</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-3 py-2 text-white">
                  {r.city_name}
                  {r.business_name ? <span className="mt-0.5 block text-[10px] text-slate-500">{r.business_name}</span> : null}
                </td>
                <td className="px-3 py-2 text-white">{r.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-cyan-200">{r.phone}</td>
                <td className="px-3 py-2 capitalize text-slate-300">{r.role}</td>
                <td className="px-3 py-2 text-slate-400">{r.source ?? '—'}</td>
                <td className="px-3 py-2 text-slate-400">{new Date(r.created_at).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
