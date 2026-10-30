// PATH: src/app/admin/verification/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/api-client';
import { isAbort, requestJson } from '@/lib/account-recovery/http';
import { getSignedFileUrl } from '@/lib/private-file-client';
import { DOCUMENT_SLOTS, REVIEW_STATUSES, formatBytes, type ReviewStatus } from '@/lib/private-file-validation';

type Applicant = {
  id: string; full_name: string | null; email: string | null; phone: string | null; role: string; status: string | null;
  verification_status: string | null; business_name: string | null; city: string | null;
};
type QueueFile = {
  id: string; owner_user_id: string; document_slot: keyof typeof DOCUMENT_SLOTS; original_name: string; content_type: string;
  size_bytes: number; review_status: ReviewStatus; review_note: string | null; created_at: string; reviewed_at: string | null; applicant: Applicant;
};
type Counts = Partial<Record<ReviewStatus, number | null>>;
type Preview = { url: string; type: string };

const REFRESH_MS = 45_000;
const authed = async () => {
  const token = await getToken();
  if (!token) throw new Error('Please sign in again.');
  return { Authorization: `Bearer ${token}` };
};
const waiting = (iso: string) => {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  return { label: h < 1 ? `${Math.round(h * 60)}m` : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`, late: h >= 24 };
};

export default function AdminVerificationPage() {
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [role, setRole] = useState('all');
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<QueueFile[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Record<string, string | undefined>>({}); // file id -> reason draft
  const [previews, setPreviews] = useState<Record<string, Preview | undefined>>({});
  const ctrl = useRef<AbortController | null>(null);

  const load = useCallback(async (silent = false) => {
    ctrl.current?.abort();
    const c = new AbortController(); ctrl.current = c;
    if (!silent) setLoading(true);
    try {
      const json = await requestJson<{ files: QueueFile[]; counts: Counts }>(`/api/admin/verification?status=${status}`, {
        headers: await authed(), cache: 'no-store', signal: c.signal, retries: 2,
      });
      if (c.signal.aborted) return;
      setFiles(json.data?.files ?? []); setCounts(json.data?.counts ?? {});
    } catch (e) {
      if (!isAbort(e)) toast.error(e instanceof Error ? e.message : 'Could not load the queue.');
    } finally { if (ctrl.current === c) setLoading(false); }
  }, [status]);

  useEffect(() => { void load(); return () => ctrl.current?.abort(); }, [load]);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void load(true); };
    const t = setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [load]);

  const decide = async (f: QueueFile, decision: 'approved' | 'rejected') => {
    const note = (rejecting[f.id] ?? '').trim();
    if (decision === 'rejected' && !note) { toast.error('Add a short reason so the applicant knows what to fix.'); return; }
    setBusy(f.id);
    try {
      await requestJson('/api/admin/verification', {
        method: 'PATCH', headers: { ...(await authed()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: f.id, decision, note: note || undefined }),
      });
      toast.success(decision === 'approved' ? 'Document approved.' : 'Document rejected.');
      setRejecting((o) => ({ ...o, [f.id]: undefined })); setPreviews((o) => ({ ...o, [f.id]: undefined }));
      await load(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the review.');
      void load(true); // e.g. 409 STALE: resync
    } finally { setBusy(null); }
  };

  const togglePreview = async (f: QueueFile) => {
    if (previews[f.id]) { setPreviews((o) => ({ ...o, [f.id]: undefined })); return; }
    try {
      const d = await getSignedFileUrl(f.id);
      setPreviews((o) => ({ ...o, [f.id]: { url: d.url, type: f.content_type } }));
      setTimeout(() => setPreviews((o) => ({ ...o, [f.id]: undefined })), 55_000); // signed URL expires at 60s
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not open the document.'); }
  };

  const downloadFile = async (f: QueueFile) => {
    try {
      const d = await getSignedFileUrl(f.id, 'attachment');
      const link = document.createElement('a');
      link.href = d.url;
      link.download = f.original_name;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not download the document.');
    }
  };

  // Group documents by applicant so an admin reviews a whole person at once.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, { applicant: Applicant; files: QueueFile[] }>();
    for (const f of files) {
      const a = f.applicant;
      if (role !== 'all' && a.role !== role) continue;
      if (q && !`${a.full_name} ${a.email} ${a.phone} ${a.business_name} ${a.city}`.toLowerCase().includes(q)) continue;
      (map.get(a.id) ?? map.set(a.id, { applicant: a, files: [] }).get(a.id)!).files.push(f);
    }
    return [...map.values()];
  }, [files, role, query]);

  return (
    <main className="space-y-6 text-white">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Trust &amp; safety</p>
          <h1 className="mt-2 text-2xl font-black">Document Verification</h1>
          <p className="mt-1 text-sm text-slate-400">Oldest first. Every view and decision is audit-logged.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50">{loading ? 'Refreshing…' : 'Refresh'}</button>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="tablist">
        {REVIEW_STATUSES.map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
            className={`rounded-xl px-4 py-2 text-sm font-bold capitalize ${status === s ? 'bg-cyan-400 text-slate-950' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
            {s}{typeof counts[s] === 'number' && <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">{counts[s]}</span>}
          </button>
        ))}
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" className="ml-auto rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm">
          <option value="all">All roles</option><option value="technician">Technician</option><option value="plumber">Plumber</option><option value="supplier">Supplier</option>
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Search name, email, phone, city…" aria-label="Search applicants"
          className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm placeholder:text-slate-500 sm:w-72" />
      </div>

      {loading ? <p className="py-12 text-center text-slate-400">Loading queue…</p>
        : groups.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">Nothing {status} right now. 🎉</div>
        : <section className="grid gap-4">{groups.map(({ applicant: a, files: fs }) => (
          <article key={a.id} className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-extrabold">{a.full_name || 'Unnamed applicant'} <span className="ml-2 rounded-md bg-white/10 px-2 py-0.5 text-xs font-bold capitalize text-cyan-200">{a.role}</span></h2>
                <p className="text-sm text-slate-300">{[a.email, a.phone, a.city, a.business_name].filter(Boolean).join(' · ')}</p>
              </div>
              <span className="text-xs text-slate-400">Profile: {a.verification_status ?? 'unknown'}</span>
            </div>

            <ul className="mt-4 space-y-3">{fs.map((f) => {
              const w = waiting(f.created_at); const p = previews[f.id]; const reject = rejecting[f.id];
              return (
                <li key={f.id} className="rounded-xl bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{DOCUMENT_SLOTS[f.document_slot]?.label ?? f.document_slot}</p>
                      <p className="text-xs text-slate-400">{f.original_name} · {formatBytes(f.size_bytes)} · <span className={w.late && f.review_status === 'pending' ? 'font-bold text-amber-300' : ''}>waiting {w.label}</span></p>
                    </div>
                    <div className="flex gap-2"><button onClick={() => void togglePreview(f)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-white/5">{p ? 'Hide preview' : 'Preview'}</button><button onClick={() => void downloadFile(f)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/5">Download</button></div>
                  </div>

                  {p && (p.type === 'application/pdf'
                    ? <iframe src={p.url} title={f.original_name} className="mt-3 h-96 w-full rounded-lg bg-white" />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={p.url} alt={f.original_name} className="mt-3 max-h-96 rounded-lg" />)}

                  {f.review_status !== 'pending' && (
                    <p className="mt-2 text-xs text-slate-400">Reviewed {f.reviewed_at ? new Date(f.reviewed_at).toLocaleString('en-IN') : ''}{f.review_note ? ` · “${f.review_note}”` : ''}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    {reject !== undefined ? (
                      <>
                        <input value={reject} onChange={(e) => setRejecting((o) => ({ ...o, [f.id]: e.target.value }))} maxLength={500} autoFocus
                          placeholder="Reason shown to the applicant (e.g. photo is blurry)" aria-label="Rejection reason"
                          className="min-w-[14rem] flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm placeholder:text-slate-500" />
                        <button onClick={() => void decide(f, 'rejected')} disabled={busy === f.id} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-black disabled:opacity-50">Confirm reject</button>
                        <button onClick={() => setRejecting((o) => ({ ...o, [f.id]: undefined }))} className="rounded-lg px-3 py-2 text-sm text-slate-300">Cancel</button>
                      </>
                    ) : (
                      <>
                        {f.review_status !== 'approved' && <button onClick={() => void decide(f, 'approved')} disabled={busy === f.id} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50">{busy === f.id ? 'Saving…' : 'Approve'}</button>}
                        {f.review_status !== 'rejected' && <button onClick={() => setRejecting((o) => ({ ...o, [f.id]: '' }))} disabled={busy === f.id} className="rounded-lg border border-rose-400/40 px-4 py-2 text-sm font-bold text-rose-300 disabled:opacity-50">Reject…</button>}
                      </>
                    )}
                  </div>
                </li>
              );
            })}</ul>
          </article>
        ))}</section>}
    </main>
  );
}








// 'use client';

// import { useCallback, useEffect, useMemo, useState } from 'react';
// import { toast } from 'sonner';

// type Role = 'supplier' | 'technician' | 'plumber';
// type Status = 'pending' | 'approved' | 'rejected';
// type Applicant = { id: string; full_name: string | null; email: string | null; phone: string | null; role: Role; status: string | null; verification_status: string | null; business_name: string | null; city: string | null };
// type ReviewFile = { id: string; owner_user_id: string; document_slot: string; category: string; original_name: string; content_type: string; size_bytes: number; review_status: Status; review_note: string | null; created_at: string; reviewed_at: string | null; applicant: Applicant };
// const ROLE_LABEL: Record<Role, string> = { supplier: 'Suppliers', technician: 'Technicians', plumber: 'Plumbers' };
// const SLOT_LABEL: Record<string, string> = { aadhaar_front: 'Identity · Front', aadhaar_back: 'Identity · Back', profile_photo: 'Profile photo', skill_certificate: 'Skill / experience proof', business_certificate: 'Business certificate (optional)' };
// const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// export default function AdminVerificationCenterPage() {
//   const [files, setFiles] = useState<ReviewFile[]>([]);
//   const [role, setRole] = useState<Role>('supplier');
//   const [filter, setFilter] = useState<'all' | Status>('pending');
//   const [query, setQuery] = useState('');
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [selected, setSelected] = useState<ReviewFile | null>(null);
//   const [previewUrl, setPreviewUrl] = useState<string | null>(null);
//   const [previewBusy, setPreviewBusy] = useState(false);
//   const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
//   const [note, setNote] = useState('');
//   const [saving, setSaving] = useState(false);

//   const load = useCallback(async (quiet = false) => {
//     quiet ? setRefreshing(true) : setLoading(true);
//     try {
//       const response = await fetch('/api/admin/verification', { cache: 'no-store' });
//       const payload = await response.json().catch(() => ({}));
//       if (!response.ok) throw new Error(payload?.error || 'Could not load verification queue.');
//       setFiles(Array.isArray(payload?.data?.files) ? payload.data.files : []);
//     } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load verification queue.'); }
//     finally { setLoading(false); setRefreshing(false); }
//   }, []);
//   useEffect(() => { void load(); }, [load]);

//   const roleFiles = useMemo(() => files.filter(file => file.applicant.role === role), [files, role]);
//   const visible = useMemo(() => {
//     const q = query.trim().toLowerCase();
//     return roleFiles.filter(file => (filter === 'all' || file.review_status === filter) &&
//       (!q || [file.applicant.full_name, file.applicant.business_name, file.applicant.email, file.applicant.phone, file.owner_user_id, file.original_name].some(value => String(value ?? '').toLowerCase().includes(q))));
//   }, [roleFiles, filter, query]);
//   const counts = useMemo(() => ({
//     pending: roleFiles.filter(file => file.review_status === 'pending').length,
//     approved: roleFiles.filter(file => file.review_status === 'approved').length,
//     rejected: roleFiles.filter(file => file.review_status === 'rejected').length,
//   }), [roleFiles]);

//   const closePreview = () => { setSelected(null); setPreviewUrl(null); setDecision(null); setNote(''); };
//   const openPreview = async (file: ReviewFile) => {
//     setSelected(file); setPreviewUrl(null); setPreviewBusy(true); setDecision(null); setNote('');
//     try {
//       const response = await fetch(`/api/files/${encodeURIComponent(file.id)}`, { cache: 'no-store' });
//       const payload = await response.json().catch(() => ({}));
//       if (!response.ok || !payload?.data?.url) throw new Error(payload?.error || 'Secure preview unavailable.');
//       setPreviewUrl(payload.data.url);
//     } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not open document.'); }
//     finally { setPreviewBusy(false); }
//   };
//   const saveReview = async () => {
//     if (!selected || !decision || saving) return;
//     if (decision === 'rejected' && !note.trim()) { toast.error('Add a rejection reason.'); return; }
//     setSaving(true);
//     try {
//       const response = await fetch('/api/admin/verification', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_id: selected.id, decision, note: note.trim() }) });
//       const payload = await response.json().catch(() => ({}));
//       if (!response.ok) throw new Error(payload?.error || 'Could not save review.');
//       toast.success(decision === 'approved' ? 'Document approved.' : 'Document rejected.');
//       closePreview(); await load(true);
//     } catch (error) { toast.error(error instanceof Error ? error.message : 'Review failed.'); }
//     finally { setSaving(false); }
//   };

//   return <div className="mx-auto w-full max-w-7xl space-y-6 text-slate-100">
//     <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
//       <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Trust & safety · Admin</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Verification Center</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">One review workspace for supplier, technician and plumber applications. Each role keeps its own document rules and approval process.</p></div>
//       <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50">{refreshing ? 'Refreshing…' : 'Refresh queue'}</button>
//     </header>
//     <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Applicant role tabs">
//       {(['supplier','technician','plumber'] as const).map(key => <button key={key} type="button" onClick={() => { setRole(key); setFilter('pending'); setQuery(''); closePreview(); }} aria-pressed={role === key} className={`rounded-2xl border p-4 text-left transition ${role === key ? 'border-cyan-300/40 bg-cyan-300/10' : 'border-white/10 bg-white/[.04] hover:bg-white/[.07]'}`}><span className="text-sm font-semibold text-white">{ROLE_LABEL[key]}</span><span className="mt-2 block text-2xl font-bold tabular-nums text-white">{files.filter(file => file.applicant.role === key && file.review_status === 'pending').length}</span><span className="text-xs text-slate-400">Pending documents</span></button>)}
//     </section>
//     <section className="rounded-2xl border border-white/10 bg-slate-900/70">
//       <div className="border-b border-white/10 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-white">{ROLE_LABEL[role]} review</h2><p className="mt-1 text-xs text-slate-400">{role === 'supplier' ? 'Business certificate is optional; missing certificates do not block supplier approval.' : 'Review identity, profile and relevant skill / experience evidence.'}</p></div><span className="text-xs text-slate-500">{roleFiles.length} documents loaded</span></div>
//         <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2" role="group" aria-label="Filter review status">{(['pending','all','approved','rejected'] as const).map(key => <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key} className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize ${filter === key ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/30' : 'text-slate-400 hover:bg-white/5'}`}>{key === 'all' ? 'All' : key}{key !== 'all' ? ` · ${counts[key]}` : ''}</button>)}</div><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, phone, email or file" aria-label="Search applicants" className="min-h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 sm:max-w-sm" /></div>
//       </div>
//       {loading ? <div className="space-y-3 p-5">{[1,2,3].map(n => <div key={n} className="h-20 animate-pulse rounded-xl bg-white/5" />)}</div> : visible.length === 0 ? <div className="px-6 py-16 text-center"><p className="font-semibold text-white">No documents in this view</p><p className="mt-1 text-sm text-slate-500">{filter === 'pending' ? 'New uploads will appear here when available.' : 'Try another filter or search term.'}</p></div> : <div className="divide-y divide-white/5">{visible.map(file => <article key={file.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-semibold text-white">{file.applicant.full_name || file.applicant.business_name || 'Applicant'}</p><p className="mt-1 text-xs text-slate-400">{file.applicant.business_name ? `${file.applicant.business_name} · ` : ''}{file.applicant.city || 'Location not provided'} · {file.applicant.phone || file.applicant.email || file.owner_user_id}</p><p className="mt-2 text-sm text-slate-200">{SLOT_LABEL[file.document_slot] || file.document_slot}</p><p className="mt-1 truncate text-xs text-slate-500">{file.original_name} · {formatBytes(file.size_bytes)} · {new Date(file.created_at).toLocaleString('en-IN')}</p>{file.review_note && <p className="mt-1 text-xs text-rose-300">Review note: {file.review_note}</p>}</div><div className="flex shrink-0 items-center gap-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${file.review_status === 'approved' ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-300/20' : file.review_status === 'rejected' ? 'bg-rose-500/10 text-rose-200 ring-rose-300/20' : 'bg-amber-500/10 text-amber-200 ring-amber-300/20'}`}>{file.review_status}</span><button type="button" onClick={() => void openPreview(file)} className="min-h-9 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/15">Review</button></div></article>)}</div>}
//       <footer className="border-t border-white/10 px-4 py-3 text-xs text-slate-500">Private previews expire after 60 seconds. All review decisions are audit logged.</footer>
//     </section>
//     {selected && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) closePreview(); }}><section role="dialog" aria-modal="true" aria-labelledby="review-title" className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-slate-950 shadow-2xl sm:rounded-2xl">
//       <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Secure document preview</p><h2 id="review-title" className="mt-1 truncate text-lg font-bold text-white">{SLOT_LABEL[selected.document_slot] || selected.document_slot} · {selected.original_name}</h2><p className="mt-1 text-xs text-slate-500">{selected.applicant.full_name || selected.applicant.business_name || selected.owner_user_id} · {ROLE_LABEL[selected.applicant.role]}</p></div><button type="button" onClick={closePreview} disabled={saving} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/10" aria-label="Close preview">✕</button></header>
//       <div className="min-h-48 flex-1 overflow-auto bg-slate-900 p-3 sm:p-5">{previewBusy ? <div className="flex min-h-64 items-center justify-center text-sm text-slate-400">Opening secure preview…</div> : previewUrl ? selected.content_type === 'application/pdf' ? <iframe title={`Preview of ${selected.original_name}`} src={previewUrl} className="h-[55dvh] min-h-64 w-full rounded-xl bg-white" /> : <img src={previewUrl} alt={`Uploaded ${SLOT_LABEL[selected.document_slot] || 'document'}`} className="mx-auto max-h-[55dvh] max-w-full rounded-xl object-contain" /> : <p className="py-12 text-center text-sm text-slate-400">Preview could not be loaded. Close and retry.</p>}</div>
//       <footer className="space-y-3 border-t border-white/10 p-4">{selected.review_status === 'pending' ? <><div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => { setDecision('approved'); setNote(''); }} className={`min-h-10 flex-1 rounded-xl border px-4 text-sm font-semibold ${decision === 'approved' ? 'border-emerald-300/50 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-300'}`}>Approve document</button><button type="button" onClick={() => { setDecision('rejected'); setNote(''); }} className={`min-h-10 flex-1 rounded-xl border px-4 text-sm font-semibold ${decision === 'rejected' ? 'border-rose-300/50 bg-rose-400/15 text-rose-200' : 'border-white/10 bg-white/5 text-slate-300'}`}>Reject document</button></div>{decision === 'rejected' && <label className="block text-sm text-slate-300">Reason for rejection<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" placeholder="Explain what needs correction…" /></label>}{decision && <div className="flex justify-end"><button type="button" onClick={() => void saveReview()} disabled={saving || (decision === 'rejected' && !note.trim())} className="min-h-10 rounded-xl bg-cyan-500 px-5 text-sm font-bold text-slate-950 disabled:opacity-50">{saving ? 'Saving…' : 'Confirm decision'}</button></div>}</> : <p className="text-sm text-slate-400">This document has already been {selected.review_status}. The decision remains in the audit trail.</p>}</footer>
//     </section></div>}
//   </div>;
// }
