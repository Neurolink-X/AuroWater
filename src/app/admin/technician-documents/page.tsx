'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type ReviewStatus = 'pending' | 'approved' | 'rejected';
type DocumentSlot = 'aadhaar_front' | 'aadhaar_back' | 'profile_photo' | 'skill_certificate';
interface ReviewFile {
  id: string;
  owner_user_id: string;
  document_slot: DocumentSlot;
  category: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  review_status: ReviewStatus;
  created_at: string;
}
const SLOT_LABEL: Record<DocumentSlot, string> = {
  aadhaar_front: 'Aadhaar · Front',
  aadhaar_back: 'Aadhaar · Back',
  profile_photo: 'Profile photo',
  skill_certificate: 'Skill certificate',
};
const STATUS_STYLE: Record<ReviewStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-800 ring-rose-200',
};
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function TechnicianDocumentReviewPage() {
  const [files, setFiles] = useState<ReviewFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | ReviewStatus>('pending');
  const [selected, setSelected] = useState<ReviewFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const response = await fetch('/api/admin/technician-documents', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Could not load technician documents.');
      setFiles(payload?.data?.files ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load review queue.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter((file) => (filter === 'all' || file.review_status === filter) &&
      (!q || file.owner_user_id.toLowerCase().includes(q) || file.original_name.toLowerCase().includes(q) || file.id.toLowerCase().includes(q)));
  }, [files, filter, query]);

  const counts = useMemo(() => ({
    pending: files.filter((file) => file.review_status === 'pending').length,
    approved: files.filter((file) => file.review_status === 'approved').length,
    rejected: files.filter((file) => file.review_status === 'rejected').length,
  }), [files]);

  const openPreview = async (file: ReviewFile) => {
    setSelected(file); setPreviewUrl(null); setPreviewBusy(true); setDecision(null); setNote('');
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(file.id)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.data?.url) throw new Error(payload?.error || 'Secure preview is unavailable.');
      setPreviewUrl(payload.data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open document.');
    } finally { setPreviewBusy(false); }
  };

  const saveReview = async () => {
    if (!selected || !decision || saving) return;
    if (decision === 'rejected' && !note.trim()) { toast.error('Add a rejection reason before continuing.'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/admin/technician-documents', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: selected.id, decision, note: note.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Could not save review decision.');
      toast.success(decision === 'approved' ? 'Document approved.' : 'Document rejected.');
      setSelected(null); setPreviewUrl(null); setDecision(null); setNote('');
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Review failed.');
    } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 text-slate-100">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">Trust & safety</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Technician verification</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Review identity and skill documents through time-limited private previews. Every decision is recorded in the audit log.</p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-50">
          <span aria-hidden="true">↻</span>{refreshing ? 'Refreshing…' : 'Refresh queue'}
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Review summary">
        {([
          ['Pending review', counts.pending, 'amber'],
          ['Approved documents', counts.approved, 'emerald'],
          ['Rejected documents', counts.rejected, 'rose'],
        ] as const).map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">{value}</p>
            <div className={`mt-3 h-1 w-12 rounded-full ${tone === 'amber' ? 'bg-amber-400' : tone === 'emerald' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter documents">
            {(['pending', 'all', 'approved', 'rejected'] as const).map((key) => (
              <button key={key} type="button" onClick={() => setFilter(key)} aria-pressed={filter === key} className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${filter === key ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{key === 'all' ? 'All documents' : key}</button>
            ))}
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search technician ID or filename" aria-label="Search technician ID or filename" className="min-h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 sm:max-w-xs" />
        </div>

        {loading ? <div className="space-y-3 p-5" aria-label="Loading review queue">{[1,2,3].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-white/5" />)}</div> :
          visible.length === 0 ? <div className="px-6 py-16 text-center"><p className="text-base font-semibold text-white">No documents found</p><p className="mt-1 text-sm text-slate-500">{filter === 'pending' ? 'New submissions will appear here.' : 'Try another filter or search term.'}</p></div> :
          <div className="divide-y divide-white/5">
            {visible.map((file) => (
              <article key={file.id} className="flex flex-col gap-3 p-4 transition hover:bg-white/[.025] sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/10 bg-cyan-300/5 text-lg" aria-hidden="true">▤</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{SLOT_LABEL[file.document_slot] ?? file.document_slot}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">{file.original_name} · {formatBytes(file.size_bytes)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Technician ID: <span className="font-mono">{file.owner_user_id}</span> · {new Date(file.created_at).toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${STATUS_STYLE[file.review_status] ?? STATUS_STYLE.pending}`}>{file.review_status}</span>
                  <button type="button" onClick={() => void openPreview(file)} className="min-h-9 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/15">Review document</button>
                </div>
              </article>
            ))}
          </div>}
        <footer className="border-t border-white/10 px-4 py-3 text-xs text-slate-500">Showing {visible.length} of up to 100 documents · Private files are never made public.</footer>
      </section>

      {selected && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) { setSelected(null); setPreviewUrl(null); } }}>
        <section role="dialog" aria-modal="true" aria-labelledby="review-title" className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-slate-950 shadow-2xl sm:rounded-2xl">
          <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Secure document preview</p><h2 id="review-title" className="mt-1 truncate text-lg font-bold text-white">{SLOT_LABEL[selected.document_slot]} · {selected.original_name}</h2><p className="mt-1 text-xs text-slate-500">Technician {selected.owner_user_id}</p></div>
            <button type="button" onClick={() => { setSelected(null); setPreviewUrl(null); }} disabled={saving} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close preview">✕</button>
          </header>
          <div className="min-h-48 flex-1 overflow-auto bg-slate-900 p-3 sm:p-5">
            {previewBusy ? <div className="flex min-h-64 items-center justify-center text-sm text-slate-400">Opening secure preview…</div> :
              previewUrl ? selected.content_type === 'application/pdf' ? <iframe title={`Preview of ${selected.original_name}`} src={previewUrl} className="h-[55dvh] min-h-64 w-full rounded-xl bg-white" /> : <img src={previewUrl} alt={`Uploaded ${SLOT_LABEL[selected.document_slot]}`} className="mx-auto max-h-[55dvh] max-w-full rounded-xl object-contain" /> :
              <p className="py-12 text-center text-sm text-slate-400">Preview could not be loaded. Close and retry.</p>}
          </div>
          <footer className="space-y-3 border-t border-white/10 p-4 sm:p-5">
            {selected.review_status === 'pending' ? <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => { setDecision('approved'); setNote(''); }} className={`min-h-10 flex-1 rounded-xl border px-4 text-sm font-semibold ${decision === 'approved' ? 'border-emerald-300/50 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>✓ Approve document</button>
                <button type="button" onClick={() => { setDecision('rejected'); setNote(''); }} className={`min-h-10 flex-1 rounded-xl border px-4 text-sm font-semibold ${decision === 'rejected' ? 'border-rose-300/50 bg-rose-400/15 text-rose-200' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>Reject document</button>
              </div>
              {decision === 'rejected' && <label className="block text-sm text-slate-300">Reason for rejection<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Explain what needs correction…" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white outline-none focus:border-rose-300/50" /></label>}
              {decision && <div className="flex justify-end"><button type="button" onClick={() => void saveReview()} disabled={saving || (decision === 'rejected' && !note.trim())} className="min-h-10 rounded-xl bg-cyan-500 px-5 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : 'Confirm decision'}</button></div>}
            </> : <p className="text-sm text-slate-400">This document has already been {selected.review_status}. Review decisions are retained in the audit trail.</p>}
          </footer>
        </section>
      </div>}
    </div>
  );
}
