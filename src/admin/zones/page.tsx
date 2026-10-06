'use client';

/* This component intentionally hydrates browser state after mount. */
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/api-client';

type ZoneStatus = 'AVAILABLE' | 'LIMITED' | 'TEMPORARILY_UNAVAILABLE' | 'COMING_SOON';

type Zone = {
  id: string;
  city: string;
  name: string;
  status: ZoneStatus;
  pincodes: string[] | null;
  is_catch_all: boolean;
  supplier_count: number;
};

type Metric = {
  zone_id: string;
  orders: number;
  orders_today: number;
  orders_week: number;
  completion_rate: number | null;
  cancellation_rate: number | null;
  avg_order_value: number | null;
  avg_response_min: number | null;
  repeat_rate: number | null;
  revenue: number;
  suppliers: number;
  suppliers_online: number;
};

type SupplierRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  status: string | null;
  assigned: boolean;
};

const STATUS: Record<ZoneStatus, { label: string; dot: string; ring: string }> = {
  AVAILABLE: { label: 'Available', dot: 'bg-emerald-500', ring: 'ring-emerald-200 bg-emerald-50 text-emerald-800' },
  LIMITED: { label: 'Limited', dot: 'bg-amber-500', ring: 'ring-amber-200 bg-amber-50 text-amber-800' },
  TEMPORARILY_UNAVAILABLE: { label: 'Temporarily unavailable', dot: 'bg-rose-500', ring: 'ring-rose-200 bg-rose-50 text-rose-800' },
  COMING_SOON: { label: 'Coming soon', dot: 'bg-slate-400', ring: 'ring-slate-200 bg-slate-50 text-slate-700' },
};

type CallResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number };

async function call<T>(path: string, init?: RequestInit): Promise<CallResult<T>> {
  try {
    const token = await getToken();
    if (!token) return { ok: false, error: 'Please sign in again.', status: 401 };
    const res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
    });
    const json = (await res.json().catch(() => null)) as { data?: T; error?: string } | null;
    if (!res.ok) return { ok: false, error: json?.error ?? `Request failed (${res.status})`, status: res.status };
    return { ok: true, data: json?.data as T };
  } catch {
    return { ok: false, error: 'Network error. Please try again.', status: 0 };
  }
}

const dash = (v: number | null, suffix = '') => (v === null || v === undefined ? '—' : `${v}${suffix}`);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function SupplierModal({ zone, onClose, onSaved }: { zone: Zone; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState<SupplierRow[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await call<{ suppliers: SupplierRow[] }>(`/api/admin/zones/${zone.id}/suppliers`);
      if (cancelled) return;
      if (!r.ok) {
        toast.error(r.error);
        onClose();
        return;
      }
      setRows(r.data.suppliers);
      setPicked(new Set(r.data.suppliers.filter((s) => s.assigned).map((s) => s.id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [zone.id, onClose]);

  const shown = (rows ?? []).filter((s) =>
    `${s.full_name ?? ''} ${s.phone ?? ''} ${s.city ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  const save = async () => {
    setSaving(true);
    const r = await call<{ added: number; removed: number }>(`/api/admin/zones/${zone.id}/suppliers`, {
      method: 'PUT',
      body: JSON.stringify({ supplier_ids: [...picked] }),
    });
    setSaving(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(`Saved (${r.data.added} added, ${r.data.removed} removed)`);
    onSaved();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-extrabold text-slate-900">Suppliers in {zone.name}</h3>
        <p className="text-sm text-slate-500">
          Tick the suppliers who cover this zone. A supplier with no zones ticked anywhere can take orders from any zone.
        </p>
        <input
          className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Search name, phone or city"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
          {rows === null ? (
            <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ) : shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No suppliers found.</p>
          ) : (
            shown.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={picked.has(s.id)}
                  onChange={(e) =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(s.id);
                      else next.delete(s.id);
                      return next;
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{s.full_name ?? 'Unnamed supplier'}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {[s.city, s.phone, s.status].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 font-semibold">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || rows === null}
            className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : `Save (${picked.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ZoneCard({
  zone,
  metric,
  onChanged,
  onSuppliers,
}: {
  zone: Zone;
  metric?: Metric;
  onChanged: () => void;
  onSuppliers: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pins, setPins] = useState((zone.pincodes ?? []).join(', '));
  const st = STATUS[zone.status];

  const patch = async (body: Record<string, unknown>, okMsg: string) => {
    setBusy(true);
    const r = await call<Zone>(`/api/admin/zones/${zone.id}`, { method: 'PUT', body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    toast.success(okMsg);
    onChanged();
    return true;
  };

  const savePins = async () => {
    const list = pins
      .split(/[\s,]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    await patch({ pincodes: list }, 'Pincodes saved');
  };

  const pinsChanged = pins.replace(/\s/g, '') !== (zone.pincodes ?? []).join(',');

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-slate-900">
            {zone.name}
            {zone.is_catch_all ? <span className="ml-2 text-xs font-semibold text-slate-400">(catch-all)</span> : null}
          </h3>
          <p className="text-xs text-slate-500">
            {zone.city} · {zone.supplier_count} mapped {zone.supplier_count === 1 ? 'supplier' : 'suppliers'}
          </p>
        </div>
        <label className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${st.dot}`} aria-hidden />
          <select
            value={zone.status}
            disabled={busy}
            onChange={(e) => void patch({ status: e.target.value }, `${zone.name} is now ${STATUS[e.target.value as ZoneStatus].label}`)}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ring-inset ${st.ring}`}
            aria-label={`Status of ${zone.name}`}
          >
            {(Object.keys(STATUS) as ZoneStatus[]).map((k) => (
              <option key={k} value={k}>
                {STATUS[k].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Orders (30d)" value={String(metric?.orders ?? 0)} />
        <Stat label="Today / week" value={`${metric?.orders_today ?? 0} / ${metric?.orders_week ?? 0}`} />
        <Stat label="Completion" value={dash(metric?.completion_rate ?? null, '%')} />
        <Stat label="Cancelled" value={dash(metric?.cancellation_rate ?? null, '%')} />
        <Stat label="Avg response" value={dash(metric?.avg_response_min ?? null, ' min')} />
        <Stat label="Repeat rate" value={dash(metric?.repeat_rate ?? null, '%')} />
        <Stat label="Avg order" value={metric?.avg_order_value != null ? `₹${metric.avg_order_value}` : '—'} />
        <Stat label="Suppliers online" value={`${metric?.suppliers_online ?? 0} / ${metric?.suppliers ?? zone.supplier_count}`} />
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        {!zone.is_catch_all ? (
          <div className="min-w-[220px] flex-1">
            <label className="text-xs font-semibold text-slate-500" htmlFor={`pins-${zone.id}`}>
              Pincodes (comma separated)
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id={`pins-${zone.id}`}
                value={pins}
                onChange={(e) => setPins(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="208017, 208025"
              />
              {pinsChanged ? (
                <button
                  type="button"
                  onClick={() => void savePins()}
                  disabled={busy}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Save
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="flex-1 text-xs text-slate-500">Catch-all: applies to any address in {zone.city} not matched by another zone.</p>
        )}
        <button
          type="button"
          onClick={onSuppliers}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Assign suppliers
        </button>
      </div>
    </article>
  );
}

export default function AdminZonesPage() {
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [metrics, setMetrics] = useState<Map<string, Metric>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [modalZone, setModalZone] = useState<Zone | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ city: '', name: '', pincodes: '' });

  const load = useCallback(async () => {
    const [z, m] = await Promise.all([
      call<Zone[]>('/api/admin/zones'),
      call<Metric[]>('/api/admin/zones/metrics?days=30'),
    ]);
    if (!z.ok) {
      setError(z.status === 403 ? 'Admin access required.' : z.error);
      setZones([]);
      return;
    }
    setError(null);
    setZones(z.data);
    if (m.ok) setMetrics(new Map(m.data.map((x) => [x.zone_id, x])));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byCity = useMemo(() => {
    const map = new Map<string, Zone[]>();
    for (const z of zones ?? []) {
      if (!map.has(z.city)) map.set(z.city, []);
      map.get(z.city)!.push(z);
    }
    for (const list of map.values()) list.sort((a, b) => (metrics.get(b.id)?.orders ?? 0) - (metrics.get(a.id)?.orders ?? 0));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [zones, metrics]);

  const addZone = async (e: React.FormEvent) => {
    e.preventDefault();
    const pincodes = form.pincodes.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
    setAdding(true);
    const r = await call<Zone>('/api/admin/zones', {
      method: 'POST',
      body: JSON.stringify({ city: form.city, name: form.name, pincodes, status: 'COMING_SOON' }),
    });
    setAdding(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success('Zone created as Coming soon');
    setForm({ city: '', name: '', pincodes: '' });
    void load();
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Service zones</h1>
        <p className="mt-1 text-sm text-slate-500">
          Open or close an area instantly. Changes apply to new bookings right away, with no deployment.
        </p>
      </header>

      {error ? (
        <div className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 p-5 text-center">
          <p className="font-semibold text-rose-800">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-3 rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white">
            Try again
          </button>
        </div>
      ) : null}

      <form onSubmit={(e) => void addZone(e)} className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="font-extrabold text-slate-900">Add a zone</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <input required placeholder="City (e.g. Kanpur)" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input required placeholder="Zone name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input placeholder="Pincodes (208017, 208025)" value={form.pincodes} onChange={(e) => setForm({ ...form, pincodes: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button type="submit" disabled={adding} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {adding ? 'Adding…' : '+ Add zone'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">New zones start as Coming soon. Switch to Available when you have enough suppliers.</p>
      </form>

      {zones === null ? (
        <div className="mt-6 space-y-3" aria-busy="true">
          <div className="h-36 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-36 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : (
        byCity.map(([city, list]) => (
          <section key={city} className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-slate-900">
              {city}
              <span className="text-sm font-semibold text-slate-400">
                {list.filter((z) => z.status === 'AVAILABLE').length} of {list.length} available
              </span>
            </h2>
            <div className="space-y-3">
              {list.map((z) => (
                <ZoneCard key={z.id} zone={z} metric={metrics.get(z.id)} onChanged={() => void load()} onSuppliers={() => setModalZone(z)} />
              ))}
            </div>
          </section>
        ))
      )}

      {modalZone ? (
        <SupplierModal zone={modalZone} onClose={() => setModalZone(null)} onSaved={() => void load()} />
      ) : null}
    </div>
  );
}
