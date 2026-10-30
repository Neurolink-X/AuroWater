// PATH: src/app/account-help/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  LIMITS, RECOVERY_CATEGORIES, recoveryRequestSchema,
} from '@/lib/account-recovery/shared';
import { HttpError, requestJson } from '@/lib/account-recovery/http';

type Form = { name: string; email: string; phone: string; category: string; message: string; website: string };
type Field = keyof Form;
const EMPTY: Form = { name: '', email: '', phone: '', category: 'forgot_password', message: '', website: '' };
const FIELD_ORDER: Field[] = ['name', 'email', 'phone', 'category', 'message'];

const inputCls = (invalid: boolean) =>
  `mt-1 w-full rounded-xl border bg-white px-3 py-3 font-normal outline-none transition focus:ring-4 ${
    invalid ? 'border-rose-400 focus:ring-rose-500/15' : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/15'
  } disabled:bg-slate-100`;

function FieldShell({ id, label, error, hint, children }: {
  id: string; label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold">{label}</label>
      {children}
      {error ? <p id={`${id}-msg`} role="alert" className="mt-1 text-xs font-semibold text-rose-700">{error}</p>
        : hint ? <p id={`${id}-msg`} className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function AccountHelpPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [copied, setCopied] = useState(false);
  const inflight = useRef(false);

  // Prefill email when arriving from the password-recovery page (?email=...).
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('email');
    if (e) setForm((f) => ({ ...f, email: e.slice(0, LIMITS.emailMax) }));
  }, []);

  // Rate-limit countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const errors = useMemo(() => {
    const out: Partial<Record<Field, string>> = {};
    const parsed = recoveryRequestSchema.safeParse(form);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field | undefined;
        if (key && !out[key]) out[key] = issue.message;
      }
    }
    return out;
  }, [form]);

  const shown = (k: Field) => (touched[k] || attempted ? errors[k] : undefined);
  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const blur = (k: Field) => () => setTouched((t) => ({ ...t, [k]: true }));
  const aria = (k: Field) => ({
    id: `help-${k}`, 'aria-invalid': Boolean(shown(k)), 'aria-describedby': `help-${k}-msg`, onBlur: blur(k), disabled: busy,
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inflight.current || cooldown > 0) return; // double-submit guard
    setError(null);
    setAttempted(true);
    const firstBad = FIELD_ORDER.find((k) => errors[k]);
    if (firstBad) { document.getElementById(`help-${firstBad}`)?.focus(); return; }

    inflight.current = true;
    setBusy(true);
    try {
      const json = await requestJson<{ request?: { request_number?: number | string } }>('/api/account-recovery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      setResult(String(json.data?.request?.request_number ?? 'received'));
      setForm(EMPTY); setTouched({}); setAttempted(false);
    } catch (e) {
      if (e instanceof HttpError && e.status === 429) setCooldown(e.retryAfter ?? 60);
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  };

  const copyRef = async () => {
    try { await navigator.clipboard.writeText(`#${result}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-xl">
        <Link href="/auth/forgot-password" className="text-sm font-bold text-sky-700 hover:underline">← Back to password recovery</Link>
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">AuroTap account support</p>
          <h1 className="mt-2 text-3xl font-black">Need help restoring your account?</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Send a request even if you cannot sign in. Our team will verify ownership before making sensitive account changes.
          </p>

          {result ? (
            <div className="mt-6 rounded-2xl bg-emerald-50 p-5" role="status" aria-live="polite">
              <h2 className="font-black text-emerald-900">Request received</h2>
              <p className="mt-2 text-sm text-emerald-800">
                Reference <strong>#{result}</strong>. Keep this reference for follow-up. We will contact you using the details provided.
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-emerald-800">
                <button type="button" onClick={() => void copyRef()} className="underline">{copied ? 'Copied ✓' : 'Copy reference'}</button>
                <button type="button" onClick={() => setResult(null)} className="underline">Submit another request</button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4" noValidate>
              <FieldShell id="help-name" label="Full name" error={shown('name')}>
                <input {...aria('name')} required autoComplete="name" maxLength={LIMITS.nameMax} value={form.name} onChange={set('name')} className={inputCls(Boolean(shown('name')))} />
              </FieldShell>
              <FieldShell id="help-email" label="Contact email" error={shown('email')} hint="We’ll reply to this address.">
                <input {...aria('email')} required type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={LIMITS.emailMax} value={form.email} onChange={set('email')} className={inputCls(Boolean(shown('email')))} />
              </FieldShell>
              <FieldShell id="help-phone" label="Phone (optional)" error={shown('phone')}>
                <input {...aria('phone')} type="tel" inputMode="tel" autoComplete="tel" maxLength={LIMITS.phoneMax} value={form.phone} onChange={set('phone')} className={inputCls(Boolean(shown('phone')))} />
              </FieldShell>
              <FieldShell id="help-category" label="What do you need help with?" error={shown('category')}>
                <select {...aria('category')} value={form.category} onChange={set('category')} className={inputCls(Boolean(shown('category')))}>
                  {RECOVERY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </FieldShell>
              <FieldShell id="help-message" label="Describe the problem" error={shown('message')}
                hint={`${form.message.trim().length}/${LIMITS.messageMax} · Please do not include your password, OTP or reset link.`}>
                <textarea {...aria('message')} required rows={4} maxLength={LIMITS.messageMax} value={form.message} onChange={set('message')} className={inputCls(Boolean(shown('message')))} />
              </FieldShell>

              {/* Honeypot: invisible to people, tempting to bots. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
                <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label>
              </div>

              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}

              <button type="submit" disabled={busy || cooldown > 0}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-black text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? 'Submitting…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Submit secure support request'}
              </button>
              <p className="text-xs leading-5 text-slate-500">
                Submitting a request does not change your account or password. Ownership verification is required before any account changes.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}







// 'use client';

// import { useState } from 'react';
// import Link from 'next/link';

// const categories = [
//   ['forgot_password', 'Forgot password'], ['lost_email_access', 'I lost access to my registered email'],
//   ['change_email', 'Request registered email change'], ['account_blocked', 'Account blocked or suspended'],
//   ['account_access', 'Other login/access problem'], ['other', 'Other'],
// ];
// export default function AccountHelpPage() {
//   const [form, setForm] = useState({ name: '', email: '', phone: '', category: 'forgot_password', message: '' });
//   const [busy, setBusy] = useState(false);
//   const [result, setResult] = useState<string | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const submit = async (event: React.FormEvent) => {
//     event.preventDefault(); setError(null); setBusy(true);
//     try {
//       const res = await fetch('/api/account-recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
//       const json = await res.json();
//       if (!res.ok) throw new Error(json.error || 'Could not submit request.');
//       setResult(String(json.data?.request?.request_number ?? 'received'));
//       setForm({ name: '', email: '', phone: '', category: 'forgot_password', message: '' });
//     } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
//     finally { setBusy(false); }
//   };
//   return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900"><div className="mx-auto max-w-xl"><Link href="/auth/forgot-password" className="text-sm font-bold text-sky-700">← Back to password recovery</Link><div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8"><p className="text-xs font-black uppercase tracking-widest text-emerald-700">AuroTap account support</p><h1 className="mt-2 text-3xl font-black">Need help restoring your account?</h1><p className="mt-3 text-sm leading-6 text-slate-600">Send a request even if you cannot sign in. Our team will verify ownership before making sensitive account changes.</p>
//     {result ? <div className="mt-6 rounded-2xl bg-emerald-50 p-5"><h2 className="font-black text-emerald-900">Request received</h2><p className="mt-2 text-sm text-emerald-800">Reference #{result}. Keep this reference for follow-up. We will contact you using the details provided.</p><button onClick={() => setResult(null)} className="mt-4 text-sm font-bold text-emerald-800 underline">Submit another request</button></div> :
//     <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-bold">Full name<input required minLength={2} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" /></label><label className="block text-sm font-bold">Contact email<input required type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" /></label><label className="block text-sm font-bold">Phone (optional)<input type="tel" maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" /></label><label className="block text-sm font-bold">What do you need help with?<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm font-bold">Describe the problem<textarea required minLength={10} maxLength={2000} rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Please do not include your password, OTP or reset link." className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" /></label>{error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Submit secure support request'}</button><p className="text-xs leading-5 text-slate-500">Submitting a request does not change your account or password. Ownership verification is required before any account changes.</p></form>}</div></div></main>;
// }
