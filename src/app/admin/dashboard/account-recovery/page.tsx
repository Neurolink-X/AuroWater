// PATH: src/app/admin/account-recovery/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/api-client';
import { isAbort, requestJson } from '@/lib/account-recovery/http';
import {
  LIMITS, RECOVERY_STATUSES, categoryAdminLabel, firstIssue, isClosedStatus, reviewSchema, statusLabel,
  type RecoveryAudit, type RecoveryRequest, type RecoveryStatus, type StatusCounts,
} from '@/lib/account-recovery/shared';

type Draft = { status: string; note: string; verify: boolean };
const REFRESH_MS = 60_000;

async function authed(): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) throw new Error('Please sign in again.');
  return { Authorization: `Bearer ${token}` };
}

const ageOf = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return { label: `${mins}m`, hours: mins / 60 };
  if (mins < 1440) return { label: `${Math.round(mins / 60)}h`, hours: mins / 60 };
  return { label: `${Math.round(mins / 1440)}d`, hours: mins / 60 };
};

export default function AdminAccountRecoveryPage() {
  const [rows, setRows] = useState<RecoveryRequest[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({});
  const [status, setStatus] = useState<RecoveryStatus>('open');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [auditRows, setAuditRows] = useState<Record<string, RecoveryAudit[]>>({});
  const [auditOpen, setAuditOpen] = useState<Record<string, boolean>>({});
  const [auditLoading, setAuditLoading] = useState<string | null>(null);
  const loadCtrl = useRef<AbortController | null>(null);

  const draftOf = useCallback((row: RecoveryRequest): Draft =>
    drafts[row.id] ?? { status: row.status, note: row.admin_note ?? '', verify: false }, [drafts]);
  const patchDraft = (row: RecoveryRequest, p: Partial<Draft>) =>
    setDrafts((old) => ({ ...old, [row.id]: { ...draftOf(row), ...p } }));
  const isDirty = (row: RecoveryRequest) => {
    const d = drafts[row.id];
    return !!d && (d.status !== row.status || d.note !== (row.admin_note ?? '') || d.verify);
  };

  /** Loads the list + tab counts. Cancels any in-flight load so stale responses can never overwrite fresh ones. */
  const load = useCallback(async (silent = false) => {
    loadCtrl.current?.abort();
    const ctrl = new AbortController();
    loadCtrl.current = ctrl;
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const headers = await authed();
      const opts = { headers, cache: 'no-store' as const, signal: ctrl.signal, retries: 2 };
      const [list, summary] = await Promise.all([
        requestJson<RecoveryRequest[]>(`/api/admin/account-recovery?status=${status}`, opts),
        requestJson<StatusCounts>('/api/admin/account-recovery?summary=1', opts).catch(() => null), // counts are optional
      ]);
      if (ctrl.signal.aborted) return;
      setRows(Array.isArray(list.data) ? list.data : []);
      if (summary?.data) setCounts(summary.data);
    } catch (e) {
      if (isAbort(e)) return;
      toast.error(e instanceof Error ? e.message : 'Could not load requests.');
    } finally {
      if (loadCtrl.current === ctrl) { setLoading(false); setRefreshing(false); }
    }
  }, [status]);

  useEffect(() => { void load(); return () => loadCtrl.current?.abort(); }, [load]);

  // Auto-refresh while the tab is visible. Drafts live in separate state, so a refresh never wipes in-progress notes.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void load(true); };
    const t = setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [load]);

  // Warn before leaving with unsaved review changes.
  const anyDirty = rows.some(isDirty);
  useEffect(() => {
    if (!anyDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  });

  const fetchAudit = async (requestId: string) => {
    setAuditLoading(requestId);
    try {
      const json = await requestJson<RecoveryAudit[]>(
        `/api/admin/account-recovery?request_id=${encodeURIComponent(requestId)}`,
        { headers: await authed(), cache: 'no-store', retries: 2 },
      );
      setAuditRows((old) => ({ ...old, [requestId]: Array.isArray(json.data) ? json.data : [] }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load audit history.');
    } finally { setAuditLoading(null); }
  };

  const toggleAudit = (id: string) => {
    const open = !auditOpen[id];
    setAuditOpen((o) => ({ ...o, [id]: open }));
    if (open && !auditRows[id]) void fetchAudit(id);
  };

  const save = async (row: RecoveryRequest) => {
    const d = draftOf(row);
    const parsed = reviewSchema.safeParse({
      request_id: row.id, status: d.status, admin_note: d.note, verify_ownership: d.verify,
    });
    if (!parsed.success) { toast.error(firstIssue(parsed.error)); return; }
    if (d.status === 'resolved' && !row.ownership_verified_at && !d.verify) {
      toast.error('Confirm ownership was verified before resolving.'); return;
    }
    if (isClosedStatus(d.status) && !window.confirm(`Mark request #${row.request_number} as ${statusLabel(d.status)}? Closed requests cannot be reopened.`)) return;

    setBusy(row.id);
    try {
      await requestJson('/api/admin/account-recovery', {
        method: 'PATCH', headers: { ...(await authed()), 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      toast.success('Request updated and audit event recorded.');
      setDrafts((old) => { const { [row.id]: _gone, ...rest } = old; return rest; });
      setAuditRows((old) => { const { [row.id]: _gone, ...rest } = old; return rest; });
      await load(true);
      if (auditOpen[row.id]) void fetchAudit(row.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed.');
      void load(true); // someone else may have changed it: resync
    } finally { setBusy(null); }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.request_number} ${r.contact_name} ${r.contact_email} ${r.contact_phone ?? ''} ${r.message}`.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <main className="space-y-6 text-white">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Secure customer support</p>
          <h1 className="mt-2 text-2xl font-black">Account Help &amp; Recovery</h1>
          <p className="mt-1 text-sm text-slate-400">Review ownership evidence and track account-access requests without creating duplicate accounts.</p>
        </div>
        <button onClick={() => void load()} disabled={loading || refreshing}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50">
          {loading || refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Request status">
        {RECOVERY_STATUSES.map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
            className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${status === s ? 'bg-cyan-400 text-slate-950' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
            {statusLabel(s)}
            {typeof counts[s] === 'number' && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${status === s ? 'bg-slate-950/15' : 'bg-white/10'}`}>{counts[s]}</span>}
          </button>
        ))}
        <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" aria-label="Search requests"
          placeholder="Search name, email, #ref, message…"
          className="ml-auto w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 sm:w-72" />
      </div>

      {loading ? <p className="py-12 text-center text-slate-400">Loading requests…</p>
        : visible.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
            {query ? 'No requests match your search.' : `No ${statusLabel(status)} requests.`}
          </div>
        ) : (
          <section className="grid gap-4" aria-busy={refreshing}>
            {visible.map((row) => {
              const d = draftOf(row);
              const closed = isClosedStatus(row.status);
              const age = ageOf(row.created_at);
              const overdue = !closed && age.hours >= 24;
              const noteTooShort = d.verify && d.note.trim().length < LIMITS.noteMin;
              return (
                <article key={row.id} className={`rounded-2xl border bg-white/[.04] p-5 ${overdue ? 'border-amber-400/40' : 'border-white/10'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-cyan-300">Request #{row.request_number} · {new Date(row.created_at).toLocaleString('en-IN')} · <span className={overdue ? 'font-bold text-amber-300' : ''}>{age.label} old</span></p>
                      <h2 className="mt-1 text-lg font-extrabold">{row.contact_name}</h2>
                      <p className="text-sm text-slate-300">
                        <a href={`mailto:${row.contact_email}`} className="hover:underline">{row.contact_email}</a>
                        {row.contact_phone ? ` · ${row.contact_phone}` : ''}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-amber-200">{categoryAdminLabel(row.category)}</p>
                    </div>
                    <span className="rounded-lg border border-white/10 px-3 py-1 text-xs capitalize">{statusLabel(row.status)}</span>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-black/20 p-3 text-sm leading-6 text-slate-200">{row.message}</p>

                  <div className="mt-3">
                    <button onClick={() => toggleAudit(row.id)} disabled={auditLoading === row.id} aria-expanded={!!auditOpen[row.id]}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-white/5 disabled:opacity-50">
                      {auditLoading === row.id ? 'Loading history…' : auditOpen[row.id] ? 'Hide audit history' : 'View audit history'}
                    </button>
                    {auditOpen[row.id] && auditRows[row.id] && (
                      <ol className="mt-3 space-y-2 border-l border-white/10 pl-4">
                        {auditRows[row.id].map((ev) => (
                          <li key={ev.id} className="text-xs text-slate-300">
                            <p className="font-bold text-slate-100">{ev.action.replace(/_/g, ' ')}</p>
                            <p>{new Date(ev.created_at).toLocaleString('en-IN')} · {ev.actor_user_id || 'System / public request'}</p>
                            <p className="break-all text-slate-500">{JSON.stringify(ev.details)}</p>
                          </li>
                        ))}
                        {auditRows[row.id].length === 0 && <li className="text-xs text-slate-500">No audit events recorded.</li>}
                      </ol>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-slate-500">Linked account: {row.user_id || 'Not linked — verify identity before linking manually.'}</p>
                  {row.ownership_verified_at && <p className="mt-2 text-xs font-bold text-emerald-300">Ownership verified · {new Date(row.ownership_verified_at).toLocaleString('en-IN')}</p>}

                  {closed ? (
                    <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-400">
                      Closed {row.resolved_at ? new Date(row.resolved_at).toLocaleString('en-IN') : ''}. {row.admin_note ? `Note: ${row.admin_note}` : 'No note recorded.'}
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div>
                        <textarea value={d.note} onChange={(e) => patchDraft(row, { note: e.target.value })} maxLength={LIMITS.noteMax} rows={2}
                          aria-label={`Internal note for request ${row.request_number}`}
                          placeholder="Internal review note. Record how ownership was checked."
                          className="w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-slate-500" />
                        {noteTooShort && <p role="alert" className="mt-1 text-xs text-amber-300">Add at least {LIMITS.noteMin} characters describing how ownership was verified.</p>}
                      </div>
                      <div className="flex flex-col gap-2">
                        <select value={d.status} onChange={(e) => patchDraft(row, { status: e.target.value })} aria-label="Status"
                          className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">
                          {RECOVERY_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                        </select>
                        {!row.ownership_verified_at && (
                          <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input type="checkbox" checked={d.verify} onChange={(e) => patchDraft(row, { verify: e.target.checked })} /> Confirm ownership verified
                          </label>
                        )}
                        <button onClick={() => void save(row)} disabled={busy === row.id || !isDirty(row)}
                          className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50">
                          {busy === row.id ? 'Saving…' : isDirty(row) ? 'Save review' : 'No changes'}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}

      <aside className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100">
        <strong>Security rule:</strong> Never ask for passwords, OTPs or reset links. Do not change email/mobile or create another account from this queue. After ownership is independently verified, use the existing secure recovery process; keep the original Auth user ID and customer data.
      </aside>
    </main>
  );
}








// 'use client';

// import { useCallback, useEffect, useState } from 'react';
// import { toast } from 'sonner';
// import { getToken } from '@/lib/api-client';

// type RecoveryAudit = { id: number; actor_user_id: string | null; action: string; details: Record<string, unknown>; created_at: string };
// type RecoveryRequest = {
//   id: string; request_number: number; user_id: string | null; contact_name: string;
//   contact_email: string; contact_phone: string | null; category: string; message: string;
//   status: string; admin_note: string | null; ownership_verified_at: string | null; created_at: string;
// };
// const statuses = ['open', 'in_review', 'waiting_customer', 'resolved', 'rejected'];
// const labels: Record<string, string> = {
//   forgot_password: 'Forgot password', lost_email_access: 'Lost email access',
//   change_email: 'Change registered email', account_blocked: 'Account blocked',
//   account_access: 'Cannot access account', other: 'Other issue',
// };

// export default function AdminAccountRecoveryPage() {
//   const [rows, setRows] = useState<RecoveryRequest[]>([]);
//   const [status, setStatus] = useState('open');
//   const [loading, setLoading] = useState(true);
//   const [busy, setBusy] = useState<string | null>(null);
//   const [notes, setNotes] = useState<Record<string, string>>({});
//   const [verify, setVerify] = useState<Record<string, boolean>>({});
//   const [auditRows, setAuditRows] = useState<Record<string, RecoveryAudit[]>>({});
//   const [auditLoading, setAuditLoading] = useState<string | null>(null);

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const token = await getToken();
//       if (!token) throw new Error('Please sign in again.');
//       const res = await fetch(`/api/admin/account-recovery?status=${status}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
//       const json = await res.json();
//       if (!res.ok) throw new Error(json.error || 'Could not load requests.');
//       setRows(Array.isArray(json.data) ? json.data : []);
//     } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load requests.'); }
//     finally { setLoading(false); }
//   }, [status]);

//   useEffect(() => { void load(); }, [load]);

//   const loadAudit = async (requestId: string) => {
//     setAuditLoading(requestId);
//     try {
//       const token = await getToken();
//       if (!token) throw new Error('Please sign in again.');
//       const res = await fetch(`/api/admin/account-recovery?request_id=${encodeURIComponent(requestId)}`, {
//         headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
//       });
//       const json = await res.json();
//       if (!res.ok) throw new Error(json.error || 'Could not load audit history.');
//       setAuditRows((old) => ({ ...old, [requestId]: Array.isArray(json.data) ? json.data : [] }));
//     } catch (error) {
//       toast.error(error instanceof Error ? error.message : 'Could not load audit history.');
//     } finally { setAuditLoading(null); }
//   };

//   const update = async (row: RecoveryRequest) => {
//     setBusy(row.id);
//     try {
//       const token = await getToken();
//       if (!token) throw new Error('Please sign in again.');
//       const res = await fetch('/api/admin/account-recovery', {
//         method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
//         body: JSON.stringify({ request_id: row.id, status: row.status, admin_note: notes[row.id] ?? row.admin_note ?? '', verify_ownership: verify[row.id] === true }),
//       });
//       const json = await res.json();
//       if (!res.ok) throw new Error(json.error || 'Update failed.');
//       toast.success('Request updated and audit event recorded.');
//       setVerify((old) => ({ ...old, [row.id]: false }));
//       await load();
//     } catch (error) { toast.error(error instanceof Error ? error.message : 'Update failed.'); }
//     finally { setBusy(null); }
//   };

//   return <main className="space-y-6 text-white">
//     <header className="flex flex-wrap items-end justify-between gap-3">
//       <div><p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Secure customer support</p><h1 className="mt-2 text-2xl font-black">Account Help &amp; Recovery</h1><p className="mt-1 text-sm text-slate-400">Review ownership evidence and track account-access requests without creating duplicate accounts.</p></div>
//       <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50">{loading ? 'Refreshing…' : 'Refresh'}</button>
//     </header>
//     <div className="flex flex-wrap gap-2">{statuses.map((s) => <button key={s} onClick={() => setStatus(s)} className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${status === s ? 'bg-cyan-400 text-slate-950' : 'border border-white/10 bg-white/5 text-slate-300'}`}>{s.replace('_', ' ')}</button>)}</div>
//     {loading ? <p className="py-12 text-center text-slate-400">Loading requests…</p> : rows.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">No {status.replace('_', ' ')} requests.</div> :
//       <section className="grid gap-4">{rows.map((row) => <article key={row.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
//         <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-cyan-300">Request #{row.request_number} · {new Date(row.created_at).toLocaleString('en-IN')}</p><h2 className="mt-1 text-lg font-extrabold">{row.contact_name}</h2><p className="text-sm text-slate-300">{row.contact_email}{row.contact_phone ? ` · ${row.contact_phone}` : ''}</p><p className="mt-2 text-sm font-semibold text-amber-200">{labels[row.category] || row.category}</p></div><span className="rounded-lg border border-white/10 px-3 py-1 text-xs capitalize">{row.status.replace('_', ' ')}</span></div>
//         <p className="mt-4 whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-sm leading-6 text-slate-200">{row.message}</p>
//         <div className="mt-3">
//           <button onClick={() => void loadAudit(row.id)} disabled={auditLoading === row.id} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-white/5 disabled:opacity-50">
//             {auditLoading === row.id ? 'Loading history…' : 'View audit history'}
//           </button>
//           {auditRows[row.id] && <ol className="mt-3 space-y-2 border-l border-white/10 pl-4">
//             {auditRows[row.id].map((event) => <li key={event.id} className="text-xs text-slate-300">
//               <p className="font-bold text-slate-100">{event.action.replaceAll('_', ' ')}</p>
//               <p>{new Date(event.created_at).toLocaleString('en-IN')} · {event.actor_user_id || 'System / public request'}</p>
//               <p className="text-slate-500">{JSON.stringify(event.details)}</p>
//             </li>)}
//             {auditRows[row.id].length === 0 && <li className="text-xs text-slate-500">No audit events recorded.</li>}
//           </ol>}
//         </div>
//         <p className="mt-3 text-xs text-slate-500">Linked account: {row.user_id || 'Not linked — verify identity before linking manually.'}</p>
//         {row.ownership_verified_at && <p className="mt-2 text-xs font-bold text-emerald-300">Ownership verified · {new Date(row.ownership_verified_at).toLocaleString('en-IN')}</p>}
//         <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><textarea value={notes[row.id] ?? row.admin_note ?? ''} onChange={(e) => setNotes((old) => ({ ...old, [row.id]: e.target.value }))} maxLength={1000} rows={2} placeholder="Internal review note. Record how ownership was checked." className="w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-white placeholder:text-slate-500" />
//           <div className="flex flex-col gap-2"><select value={row.status} onChange={(e) => setRows((old) => old.map((item) => item.id === row.id ? { ...item, status: e.target.value } : item))} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white">{statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={verify[row.id] === true} onChange={(e) => setVerify((old) => ({ ...old, [row.id]: e.target.checked }))} /> Confirm ownership verified</label><button onClick={() => void update(row)} disabled={busy === row.id} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50">{busy === row.id ? 'Saving…' : 'Save review'}</button></div>
//         </div>
//       </article>)}</section>}
//     <aside className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm leading-6 text-amber-100"><strong>Security rule:</strong> Never ask for passwords, OTPs or reset links. Do not change email/mobile or create another account from this queue. After ownership is independently verified, use the existing secure recovery process; keep the original Auth user ID and customer data.</aside>
//   </main>;
// }
