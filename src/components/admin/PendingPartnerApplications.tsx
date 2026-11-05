'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';

type PartnerApplication = {
  id: string;
  user_id: string;
  type: 'technician' | 'supplier';
  status: string;
  created_at: string;
  payload: Record<string, unknown> | null;
  applicant: { full_name: string | null; email: string | null; phone: string | null; city: string | null; role: string; status: string } | null;
  approved_document_slots: string[];
  review_supported: boolean;
};
const DOCS = ['aadhaar_front', 'aadhaar_back', 'profile_photo'];
const textValue = (x: unknown) => typeof x === 'string' ? x : '';
const labelFor = (x: PartnerApplication) => textValue(x.payload?.role) || x.type;
const request = async (method: 'GET' | 'PATCH', body?: unknown) => {
  const token = await getToken();
  if (!token) throw new Error('Sign in again to review partner applications.');
  const response = await fetch('/api/admin/partner-applications', {
    method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not load partner applications.');
  return data.data as PartnerApplication[];
};

export default function PendingPartnerApplications({ roleFilter = 'ALL', search = '' }: { roleFilter?: string; search?: string }) {
  const [rows, setRows] = useState<PartnerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [reason, setReason] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await request('GET')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Request unavailable'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const filtered = useMemo(() => rows.filter(row => {
    const requested = row.type === 'technician' ? 'TECHNICIAN' : 'SUPPLIER';
    const roleMatches = roleFilter === 'ALL' || roleFilter === requested;
    const q = search.trim().toLowerCase();
    const p = row.payload ?? {};
    return roleMatches && (!q || [row.id, row.applicant?.full_name, row.applicant?.email, row.applicant?.phone,
      p.full_name, p.phone, p.city, p.working_area, p.business_name]
      .some(x => textValue(x).toLowerCase().includes(q)));
  }), [rows, roleFilter, search]);

  async function decide(app: PartnerApplication, decision: 'approved' | 'rejected') {
    if (!app.review_supported || busy) return;
    const note = reason[app.id]?.trim() ?? '';
    if (note.length < (decision === 'approved' ? 20 : 3)) { setError(decision === 'approved' ? 'Describe the actual identity and work-experience checks (20+ characters).' : 'Give a rejection reason (3+ characters).'); return; }
    if (decision === 'approved' && !DOCS.every(slot => app.approved_document_slots.includes(slot))) {
      setError('Aadhaar front, Aadhaar back and profile photo must all be approved before account activation.');
      return;
    }
    setBusy(app.id); setError('');
    try {
      await request('PATCH', { application_id: app.id, decision, note });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Review failed'); }
    finally { setBusy(''); }
  }

  return <section aria-label="Pending partner applications" className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-white">New professional applications <span className="text-cyan-300">({filtered.length})</span></h2>
        <p className="mt-1 text-sm text-slate-300">Supplier, plumber and technician requests appear here before account activation. Application approval and document verification are separate safety checks.</p>
      </div>
      <button type="button" onClick={() => void refresh()} disabled={loading || Boolean(busy)} className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {loading ? 'Loading…' : 'Refresh applications'}
      </button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-950/50 p-3 text-sm text-rose-100">{error}</p>}
    {!loading && !error && filtered.length === 0 && <p className="text-sm text-slate-300">No matching pending partner applications.</p>}
    <div className="grid gap-3">
      {filtered.map(app => {
        const p = app.payload ?? {};
        const docsOk = DOCS.every(slot => app.approved_document_slots.includes(slot));
        return <article key={app.id} className="space-y-3 rounded-xl border border-white/10 bg-slate-900/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-bold capitalize text-white">{textValue(p.full_name) || app.applicant?.full_name || 'Applicant'} — {labelFor(app).replaceAll('_', ' ')}</h3>
              <p className="text-xs text-slate-300">{textValue(p.city) || app.applicant?.city || 'City not provided'} · {new Date(app.created_at).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'})} IST</p>
              <p className="mt-1 text-xs text-slate-400">Account: {app.applicant?.role ?? 'not found'} · Application ID: {app.id}</p>
            </div>
            <span className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-bold text-amber-200">Pending review</span>
          </div>
          <p className="text-sm text-slate-300">Registered email: {app.applicant?.email || 'Not available'} · Contact: {textValue(p.phone) || app.applicant?.phone || 'Not available'}</p>
          <p className="text-sm text-slate-300">Area: {textValue(p.working_area) || textValue(p.business_address) || 'Not specified'} · PIN: {textValue(p.working_pincode) || textValue(p.pincode) || 'Not specified'}</p>
          {p.application_source === 'existing_technician_service_approval' && <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">
            <p className="font-bold">Existing technician · new service only (no new account)</p>
            <p className="mt-1">Requested service: {labelFor(app).replaceAll('_',' ')}</p>
            <p className="mt-1">Experience: {Number(p.experience_years ?? 0)} years</p>
            <p className="mt-2 whitespace-pre-wrap">{textValue(p.work_description) || 'No description supplied'}</p>
            <p className="mt-2 text-xs text-cyan-200">Verify trade experience and service coverage. Approving this review activates only the selected service.</p>
          </div>}
          {app.type === 'technician' ? <p className={`text-sm ${docsOk ? 'text-emerald-300' : 'text-amber-200'}`}>
            {docsOk ? 'Both sides of ID and the profile photo approved' : `Verified documents: ${DOCS.filter(slot => app.approved_document_slots.includes(slot)).length}/3 — awaiting verification`}
          </p> : <p className="text-sm text-amber-200">Supplier request: review supplier KYC and coverage separately. Technician approval must never be used.</p>}
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/verification" className="rounded-lg border border-cyan-400/40 px-3 py-2 text-sm font-semibold text-cyan-200">Review KYC documents</Link>
            {!app.review_supported ? <span className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-300">Supplier approval requires supplier-specific checks</span> : <>
              <input aria-label="Verified work experience/references (20+ characters) or rejection reason" value={reason[app.id] ?? ''}
                onChange={e => setReason(prev => ({...prev, [app.id]: e.target.value}))}
                maxLength={300} placeholder="Identity and experience checks (20+ characters) / rejection reason" className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-sm text-white" />
              <button type="button" disabled={!docsOk || Boolean(busy)} onClick={() => void decide(app, 'approved')}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Approve</button>
              <button type="button" disabled={Boolean(busy)} onClick={() => void decide(app, 'rejected')}
                className="rounded-lg border border-rose-400/50 px-3 py-2 text-sm font-semibold text-rose-200 disabled:opacity-40">Reject</button>
            </>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
