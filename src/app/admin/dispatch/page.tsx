'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, adminDispatchDiagnose, adminDispatchRetry, getToken } from '@/lib/api-client';

export default function AdminDispatchPage() {
  const [orderId, setOrderId] = useState('');
  const [report, setReport] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'diagnose' | 'retry' | 'reconfirm' | null>(null);
  const [newSlotIst, setNewSlotIst] = useState('');
  const [customerConfirmed, setCustomerConfirmed] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('orderId')?.trim();
    if (!ref) return;
    const frame = window.requestAnimationFrame(() => setOrderId(ref));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function runDiagnosis() {
    setBusy('diagnose');
    setError('');
    setReport(null);
    try {
      setReport(await adminDispatchDiagnose(orderId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load dispatch diagnosis. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function reconfirmSlot() {
    if (!orderId.trim() || !newSlotIst || !customerConfirmed) return;
    if (!window.confirm('Customer explicitly confirmed this revised IST time? This changes the order schedule, resets failed retry state and notifies the customer. It does NOT assign a supplier.')) return;
    setBusy('reconfirm');
    setError('');
    setSavedMessage('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in as admin again.');
      const res = await fetch('/api/admin/dispatch/reconfirm', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, slotIst: newSlotIst, customerConfirmed }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || payload?.message || 'Could not confirm schedule.');
      setSavedMessage('Revised delivery schedule saved. Customer was notified. Run Diagnose, then Retry dispatch.');
      setCustomerConfirmed(false);
      setReport(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Schedule confirmation failed.');
    } finally {
      setBusy(null);
    }
  }

  async function retryDispatch() {
    if (!window.confirm('Run the normal dispatch attempt for this order now? This may assign a supplier and send notifications.')) return;
    setBusy('retry');
    setError('');
    setReport(null);
    try {
      setReport(await adminDispatchRetry(orderId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not run dispatch. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">AuroTap Operations</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Supplier dispatch diagnosis</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Inspect why a water-can order has not been assigned. Diagnosis is read-only; retry is a separate action.
          </p>
        </header>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/admin/dispatch-queue"
            className="inline-flex min-h-11 items-center rounded-xl border border-cyan-400 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-400/20">
            Open Queue Management (ON/OFF and health)
          </Link>
          <Link href="/admin/order-health"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10">
            Review overdue orders
          </Link>
        </div>

        <section className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <label htmlFor="order-id" className="block text-sm font-medium text-slate-200">Order reference or UUID</label>
          <input
            id="order-id"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-3 font-mono text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            placeholder="AW-38489240, #AW-38489240 or UUID"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runDiagnosis}
              disabled={busy !== null || !orderId.trim()}
              className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'diagnose' ? 'Checking…' : 'Diagnose order'}
            </button>
            <button
              type="button"
              onClick={retryDispatch}
              disabled={busy !== null || !orderId.trim()}
              className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'retry' ? 'Running dispatch…' : 'Retry dispatch'}
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            Retry runs the existing protected dispatch logic. It does not bypass supplier eligibility or stock reservation. If a retry times out, diagnose the order before trying again: a timeout does not prove the assignment failed.
          </p>
        </section>

        <section className="mt-5 rounded-2xl border border-amber-300/40 bg-amber-950/30 p-5">
          <h2 className="text-lg font-bold text-amber-100">Customer-confirmed schedule recovery</h2>
          <p className="mt-2 text-sm text-amber-100/80">For supplier declines, exhausted retries or a missed appointment: call the customer, agree a new time, then record it here. This resets the failed-search counter but does not auto-assign a supplier.</p>
          <label htmlFor="recovery-slot" className="mt-4 block text-sm font-medium text-white">New delivery date and time (IST)</label>
          <input id="recovery-slot" type="datetime-local" value={newSlotIst}
            onChange={e => setNewSlotIst(e.target.value)}
            className="mt-2 block w-full max-w-sm rounded-lg border border-slate-600 bg-slate-900 p-3 text-white" />
          <label className="mt-4 flex items-start gap-3 text-sm text-white">
            <input type="checkbox" className="mt-1" checked={customerConfirmed} onChange={e => setCustomerConfirmed(e.target.checked)} />
            I have contacted the customer and they agreed to this exact revised delivery time.
          </label>
          <button type="button" disabled={busy !== null || !customerConfirmed || !newSlotIst || !orderId.trim()}
            onClick={() => void reconfirmSlot()}
            className="mt-4 rounded-xl border border-amber-300 bg-amber-400 px-4 py-2.5 font-bold text-slate-950 disabled:opacity-40">
            {busy === 'reconfirm' ? 'Saving…' : 'Save confirmed slot and reset failed retries'}
          </button>
          {savedMessage && <p role="status" className="mt-3 text-sm font-semibold text-emerald-300">{savedMessage}</p>}
        </section>

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            <strong>Request failed:</strong> {error}
          </div>
        )}

        {report !== null && (
          <section className="mt-5 rounded-2xl border border-white/10 bg-slate-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Result</h2>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(JSON.stringify(report, null, 2))}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/5"
              >
                Copy JSON
              </button>
            </div>
            <pre className="mt-4 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/30 p-4 text-xs leading-5 text-slate-200">{JSON.stringify(report, null, 2)}</pre>
          </section>
        )}
      </div>
    </main>
  );
}
