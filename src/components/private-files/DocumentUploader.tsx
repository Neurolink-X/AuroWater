// PATH: src/components/private-files/DocumentUploader.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { HttpError } from '@/lib/account-recovery/http';
import {
  deleteMyFile, getSignedFileUrl, listMyFiles, shrinkImageIfNeeded, uploadPrivateFile, validateClientFile,
  type SlotInfo, type UserFile,
} from '@/lib/private-file-client';
import { MAX_PRIVATE_FILE_BYTES, REVIEW_GATED_CATEGORIES, formatBytes } from '@/lib/private-file-validation';

const BADGE: Record<string, { text: string; cls: string }> = {
  pending: { text: 'Under review', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  approved: { text: 'Approved', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  rejected: { text: 'Needs attention', cls: 'bg-rose-50 text-rose-800 ring-rose-200' },
};

function SlotCard({ info, latest, onChanged }: { info: SlotInfo; latest?: UserFile; onChanged: () => Promise<void> }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const upload = async (picked: File | undefined) => {
    if (!picked || busy) return;
    setError(null);
    const file = await shrinkImageIfNeeded(picked);
    const problem = await validateClientFile(file);
    if (problem) { setError(problem); return; }
    setBusy(true); setProgress(0);
    abort.current = new AbortController();
    try {
      await uploadPrivateFile({ file, category: info.category, slot: info.slot, onProgress: setProgress, signal: abort.current.signal });
      toast.success(`${info.label} uploaded. We’ll review it shortly.`);
      await onChanged();
    } catch (e) {
      if (e instanceof DOMException) return;
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally { setBusy(false); setProgress(null); if (input.current) input.current.value = ''; }
  };

  const view = async () => {
    try { const { url } = await getSignedFileUrl(latest!.id); window.open(url, '_blank', 'noopener,noreferrer'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not open the file.'); }
  };
  const remove = async () => {
    if (!latest || !window.confirm('Remove this document?')) return;
    setBusy(true);
    try { await deleteMyFile(latest.id); toast.success('Document removed.'); await onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove the document.'); }
    finally { setBusy(false); }
  };

  const badge = latest ? BADGE[latest.review_status] ?? BADGE.pending : null;
  const canView = latest && (latest.review_status === 'approved' || !REVIEW_GATED_CATEGORIES.includes(latest.category));
  const locked = latest?.review_status === 'approved';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-slate-900">{info.label}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{info.hint}</p>
        </div>
        {badge && <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${badge.cls}`}>{badge.text}</span>}
      </div>

      {latest && (
        <p className="mt-3 truncate text-sm text-slate-700">
          {latest.original_name} <span className="text-slate-400">· {formatBytes(latest.size_bytes)} · {new Date(latest.created_at).toLocaleDateString('en-IN')}</span>
        </p>
      )}
      {latest?.review_status === 'rejected' && latest.review_note && (
        <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><strong>Reason:</strong> {latest.review_note}</p>
      )}

      {!locked && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files[0]); }}
          className={`mt-4 rounded-xl border-2 border-dashed p-4 text-center transition ${drag ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
          <input ref={input} id={`file-${info.slot}`} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => void upload(e.target.files?.[0])} disabled={busy} />
          <label htmlFor={`file-${info.slot}`} className={`cursor-pointer text-sm font-bold text-emerald-700 hover:underline ${busy ? 'pointer-events-none opacity-50' : ''}`}>
            {latest ? 'Replace file' : 'Choose a file'}
          </label>
          <span className="text-sm text-slate-500"> or drag it here</span>
          <p className="mt-1 text-xs text-slate-400">JPG, PNG, WebP or PDF · up to {formatBytes(MAX_PRIVATE_FILE_BYTES)}</p>
          {progress !== null && (
            <div className="mt-3" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>
              <button type="button" onClick={() => abort.current?.abort()} className="mt-1 text-xs font-bold text-slate-500 underline">Cancel</button>
            </div>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}

      {latest && (
        <div className="mt-3 flex gap-4 text-sm font-bold">
          {canView && <button type="button" onClick={() => void view()} className="text-sky-700 hover:underline">View</button>}
          {!locked && <button type="button" onClick={() => void remove()} disabled={busy} className="text-rose-700 hover:underline disabled:opacity-50">Remove</button>}
        </div>
      )}
    </article>
  );
}

export default function DocumentUploader() {
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await listMyFiles();
      setSlots(d.slots); setFiles(d.files); setLoadError(null);
    } catch (e) { setLoadError(e instanceof HttpError || e instanceof Error ? e.message : 'Could not load your documents.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <p className="py-10 text-center text-slate-500">Loading your documents…</p>;
  if (loadError) return (
    <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
      {loadError} <button onClick={() => { setLoading(true); void load(); }} className="font-bold underline">Try again</button>
    </div>
  );
  if (slots.length === 0) return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No documents are required for your account type.</p>;

  const latestBySlot = new Map<string, UserFile>();
  for (const f of files) if (f.document_slot && !latestBySlot.has(f.document_slot)) latestBySlot.set(f.document_slot, f); // list is newest-first
  const approved = slots.filter((s) => latestBySlot.get(s.slot)?.review_status === 'approved').length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between text-sm font-bold text-slate-700">
          <span>Verification progress</span><span>{approved} of {slots.length} approved</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(approved / slots.length) * 100}%` }} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {slots.map((s) => <SlotCard key={s.slot} info={s} latest={latestBySlot.get(s.slot)} onChanged={load} />)}
      </div>
    </div>
  );
}
