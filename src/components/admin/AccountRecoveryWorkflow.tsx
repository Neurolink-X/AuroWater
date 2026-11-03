'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getToken } from '@/lib/api-client';
import { requestJson } from '@/lib/account-recovery/http';
import type { RecoveryRequest, RecoveryAudit } from '@/lib/account-recovery/shared';
import { OWNERSHIP_METHODS, RECOVERY_WORKFLOWS, workflowState } from '@/lib/account-recovery/workflow';
import type { RecoveryCategory } from '@/lib/account-recovery/shared';

type Action = 'propose_account_link' | 'approve_account_link' | 'verify_identity' | 'verify_remedy' | 'confirm_offline';
type Props = { row: RecoveryRequest; onUpdated: () => void };
const actions: { value: Action; label: string }[] = [
  { value: 'propose_account_link', label: '1 · Propose verified account link' },
  { value: 'approve_account_link', label: '2 · Approve link (another admin)' },
  { value: 'verify_identity', label: '3 · Record independent ownership verification' },
  { value: 'verify_remedy', label: '4 · Verify actual corrective action' },
  { value: 'confirm_offline', label: '5 · Record customer confirmation (independent admin)' },
];

export default function AccountRecoveryWorkflow({ row, onUpdated }: Props) {
  const [audit, setAudit] = useState<RecoveryAudit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action>('verify_identity');
  const [method, setMethod] = useState<string>(OWNERSHIP_METHODS[0].value);
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const category = row.category as RecoveryCategory;
  const workflow = RECOVERY_WORKFLOWS[category] ?? RECOVERY_WORKFLOWS.other;
  const progress = useMemo(() => workflowState(audit ?? []), [audit]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Admin session expired.');
      const res = await requestJson<RecoveryAudit[]>(`/api/admin/account-recovery?request_id=${encodeURIComponent(row.id)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', retries: 1,
      });
      setAudit(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setAudit(null);
      toast.error(e instanceof Error ? e.message : 'Could not verify the recovery audit.');
    } finally { setLoading(false); }
  }, [row.id]);

  useEffect(() => { void reload(); }, [reload]);

  const submit = async () => {
    if (busy || note.trim().length < 40 || !audit) return;
    if (!window.confirm('Confirm the evidence is genuine and you are authorized to perform this recovery step?')) return;
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Admin session expired.');
      const result = await requestJson<{ message: string }>('/api/admin/account-recovery/workflow', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: row.id, action, method,
          ...(action === 'propose_account_link' || action === 'approve_account_link' ? { target_user_id: target.trim() } : {}),
          note: note.trim(),
        }),
      });
      toast.success(result.data?.message || 'Recovery step recorded.');
      setNote('');
      await reload();
      onUpdated();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Recovery action failed.'); }
    finally { setBusy(false); }
  };

  return (
    <section className="mt-4 space-y-3 rounded-2xl border border-cyan-400/25 bg-slate-900/80 p-4 text-slate-100" aria-label="Secure recovery workflow">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-cyan-200">{workflow.title}</h3>
        <button type="button" onClick={() => void reload()} disabled={busy || loading} className="text-xs font-semibold text-cyan-200 underline disabled:opacity-50">Refresh evidence</button>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-300">
        {workflow.steps.map(step => <li key={step}>{step}</li>)}
      </ol>
      <p className="text-xs leading-5 text-amber-200">{workflow.actionHelp}</p>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {([
          ['Identity', progress.identity],
          ['Remedy', progress.remedy],
          ['Customer', progress.confirmation],
        ] as const).map(([label, done]) => (
          <div key={label} className="rounded-lg border border-white/10 p-2">
            <p className="font-semibold">{label}</p>
            <p className={done ? 'text-emerald-300' : 'text-amber-300'}>{loading ? 'Checking…' : done ? 'Recorded' : 'Required'}</p>
          </div>
        ))}
      </div>
      {!row.user_id && <p className="text-xs text-amber-200">No account linked: two different administrators must verify and approve the exact customer account ID before proceeding. Never trust the submitted email alone.</p>}
      <label className="block text-xs font-semibold">Recovery action
        <select value={action} onChange={e => setAction(e.target.value as Action)} disabled={busy} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-sm text-white">
          {actions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      {(action === 'propose_account_link' || action === 'approve_account_link') && (
        <label className="block text-xs font-semibold">Original customer account UUID
          <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Customer user ID, not requester email" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-sm text-white" />
        </label>
      )}
      {action !== 'verify_remedy' && <label className="block text-xs font-semibold">Independent evidence / contact method
        <select value={method} onChange={e => setMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-sm text-white">
          {OWNERSHIP_METHODS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>}
      <label className="block text-xs font-semibold">Evidence and result (at least 40 characters; no passwords, tokens, OTPs or personal identity documents)
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={900}
          className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-sm text-white"
          placeholder="Document independent checks and actual outcome, not a generic 'verified' note." />
      </label>
      <button type="button" disabled={busy || loading || !audit || note.trim().length < 40} onClick={() => void submit()}
        className="w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">
        {busy ? 'Recording evidence…' : 'Record verified recovery step'}
      </button>
      <p className="text-xs text-slate-400">Closure remains blocked until all three evidence stages exist. A password-reset email alone is not proof of a recovered account.</p>
      {progress.ready && <p className="text-xs font-bold text-emerald-300">Verification stages recorded. Review the audit and confirm accurate completion before marking Resolved.</p>}
    </section>
  );
}
