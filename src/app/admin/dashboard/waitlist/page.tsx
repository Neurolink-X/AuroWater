'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getToken } from '@/lib/api-client';

type WaitlistRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  status: string;
  source: string | null;
  message: string | null;
  created_at: string;
  custom_city: string | null;
  area: string | null;
  pincode: string | null;
  business_name: string | null;
  city_name: string;
  city_status: string | null;
};

type RoleFilter = 'all' | 'customer' | 'seller' | 'agent';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminWaitlistPage() {
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/waitlist', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
        cache: 'no-store',
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

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return rows.filter((r) => {
      if (role !== 'all' && r.role !== role) return false;
      if (!term) return true;
      return [r.name, r.phone, r.email, r.city_name, r.area, r.pincode, r.message, r.source]
        .some((value) => value?.toLocaleLowerCase().includes(term));
    });
  }, [rows, role, query]);

  const metrics = useMemo(() => ({
    total: rows.length,
    booking: rows.filter((r) => r.source === 'book' || r.source === 'book-zone').length,
    incomplete: rows.filter((r) => !r.area || !r.pincode).length,
    pending: rows.filter((r) => r.status === 'pending').length,
  }), [rows]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white">City & area waitlist</h1>
          <p className="mt-1 text-sm text-slate-400">Customer enquiries and locality-level demand in one place.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/5 disabled:opacity-50">
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['All registrations', metrics.total],
          ['Booking enquiries', metrics.booking],
          ['Pending follow-up', metrics.pending],
          ['Missing area / PIN', metrics.incomplete],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-black text-cyan-300">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" aria-label="Filter by role">
          {(['all', 'customer', 'seller', 'agent'] as const).map((id) => (
            <button key={id} type="button" onClick={() => setRole(id)}
              aria-pressed={role === id}
              className={`rounded-lg px-3 py-2 text-xs font-bold capitalize ${role === id ? 'bg-cyan-500 text-slate-950' : 'bg-white/10 text-white'}`}>
              {id}
            </button>
          ))}
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, city, area, PIN or message"
          aria-label="Search waitlist"
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400 sm:max-w-sm" />
      </div>

      {error ? <div role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</div> : null}
      {loading && rows.length === 0 ? <p className="text-sm text-slate-400">Loading enquiries…</p> : null}

      <div className="space-y-3">
        {filtered.map((r) => {
          const booking = r.source === 'book' || r.source === 'book-zone';
          return (
            <article key={r.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-white">{r.name}</h2>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${booking ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-slate-300'}`}>
                      {booking ? 'Booking enquiry' : (r.source || 'Waitlist')}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold capitalize text-slate-300">{r.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">
                    {[r.city_name, r.area, r.pincode].filter(Boolean).join(' · ') || 'Location details not provided'}
                  </p>
                  {r.business_name ? <p className="mt-1 text-xs text-slate-400">{r.business_name}</p> : null}
                </div>
                <p className="shrink-0 text-xs text-slate-500">{formatDate(r.created_at)}</p>
              </div>

              {r.message ? (
                <div className="mt-3 rounded-lg border border-cyan-400/10 bg-cyan-400/[0.04] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-200">Customer message</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{r.message}</p>
                </div>
              ) : <p className="mt-3 text-xs text-slate-500">No message provided.</p>}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                  {r.phone ? <span>Phone: <span className="font-mono text-cyan-200">{r.phone}</span></span> : null}
                  {r.email ? <span>Email: <span className="text-cyan-200">{r.email}</span></span> : null}
                  <span className="capitalize">Role: {r.role}</span>
                  {!r.area || !r.pincode ? <span className="text-amber-200">Address details incomplete</span> : null}
                </div>
                {r.phone ? <a href={`tel:${r.phone.replace(/[^0-9+]/g, '')}`}
                  className="rounded-lg border border-cyan-400/20 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-400/10">
                  Call customer
                </a> : null}
              </div>
            </article>
          );
        })}
        {!loading && filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">
            {rows.length === 0 ? 'No waitlist registrations found.' : 'No entries match your filters.'}
          </div>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">Showing the latest 200 registrations. Enquiry details are visible to authenticated admins only.</p>
    </div>
  );
}
