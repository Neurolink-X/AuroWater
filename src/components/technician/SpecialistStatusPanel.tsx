'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Specialty = { service_key: string; reviewed_at?: string | null };
type Blocked = { service_key: string; status: string };
type ApprovalState = {
  profile: { city: string | null; verification: string | null; active: boolean };
  approved: Specialty[];
  other_capabilities: Blocked[];
  application: { id: string; status: string; created_at: string; requested_role: string | null; rejection_note: string | null } | null;
};
const NAMES: Record<string, string> = {
  plumbing: 'Plumbing', borewell: 'Borewell / drilling',
  tank_cleaning: 'Water tank cleaning', ro_service: 'RO servicing',
  motor_pump: 'Motor pump repair', installation: 'Installation', maintenance: 'Maintenance',
};
const nameOf = (key: string) => NAMES[key] ?? key.replace(/_/g, ' ');
const statusColor = (s: string) => s === 'approved' ? 'text-emerald-700 bg-emerald-50' : s === 'suspended' || s === 'rejected' ? 'text-rose-700 bg-rose-50' : 'text-amber-800 bg-amber-50';

/** The server, never device-local skill checkboxes, decides what the worker may receive. */
export default function SpecialistStatusPanel({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<ApprovalState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch('/api/technician/specializations', { cache: 'no-store', credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json.error || 'Could not verify approved services.'));
      setState(json.data as ApprovalState);
      setError('');
    } catch (cause) {
      // Never present stale skills as approved following an authorization/network failure.
      setState(null);
      setError(cause instanceof Error ? cause.message : 'Service approval lookup failed.');
    } finally { setLoading(false); }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    const visible = () => { if (document.visibilityState === 'visible' && navigator.onLine) void reload(); };
    const online = () => { if (document.visibilityState === 'visible') void reload(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', online);
    return () => { document.removeEventListener('visibilitychange', visible); window.removeEventListener('online', online); };
  }, [enabled, reload]);

  if (!enabled) return null;

  const approved = state?.approved ?? [];
  const label = approved.length === 1 ? nameOf(approved[0].service_key) :
    approved.length > 1 ? 'Multi-service specialist' : 'Professional awaiting service approval';
  return (
    <section aria-label="Your approved service qualifications" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Verified service capabilities</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">{loading && !state ? 'Checking your qualifications…' : label}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {state ? `Operating city: ${state.profile.city || 'Not provided'} · Account ${state.profile.active ? 'active' : 'inactive'}` : 'Only Admin-approved service skills can receive bookings.'}
          </p>
        </div>
        <button onClick={() => void reload()} disabled={loading} type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
          {loading ? 'Checking…' : 'Refresh approvals'}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error} Your approvals could not be confirmed; try refreshing.</p>}
      {state && <>
        {approved.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {approved.map(s => <span key={s.service_key} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">{nameOf(s.service_key)} · Approved</span>)}
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            No approved specialization yet. You will not receive new borewell, tank cleaning, plumbing or RO assignments until Admin verifies the relevant skill and documents.
          </div>
        )}
        {!!state.other_capabilities.length && <div className="mt-3 flex flex-wrap gap-2">
          {state.other_capabilities.map(x => <span key={x.service_key} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusColor(x.status)}`}>{nameOf(x.service_key)} · {x.status}</span>)}
        </div>}
        {state.application && <p className="mt-3 text-sm text-slate-700">
          Registration: <strong className="capitalize">{state.application.status.replace(/_/g, ' ')}</strong>
          {state.application.requested_role && <> · Applied for {nameOf(state.application.requested_role === 'tank' ? 'tank_cleaning' : state.application.requested_role === 'plumber' ? 'plumbing' : state.application.requested_role)}</>}
          {state.application.rejection_note && <span className="block text-rose-700">Review note: {state.application.rejection_note}</span>}
        </p>}
      </>}
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/register/pro" className="font-semibold text-emerald-700 underline">Apply for a service</Link>
        <Link href="/technician/dashboard#documents" className="font-semibold text-emerald-700 underline">Verification documents</Link>
        <Link href="/technician/jobs" className="font-semibold text-emerald-700 underline">My assigned jobs</Link>
      </div>
      <p className="mt-3 text-xs text-slate-500">This panel reflects live server approvals, not editable profile preferences. The job queue only contains work assigned to your account.</p>
    </section>
  );
}
