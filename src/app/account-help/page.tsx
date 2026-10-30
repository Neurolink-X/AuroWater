'use client';

import { useState } from 'react';
import Link from 'next/link';

const categories = [
  ['forgot_password', 'Forgot password'], ['lost_email_access', 'I lost access to my registered email'],
  ['change_email', 'Request registered email change'], ['account_blocked', 'Account blocked or suspended'],
  ['account_access', 'Other login/access problem'], ['other', 'Other'],
];
export default function AccountHelpPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', category: 'forgot_password', message: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setBusy(true);
    try {
      const res = await fetch('/api/account-recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not submit request.');
      setResult(String(json.data?.request?.request_number ?? 'received'));
      setForm({ name: '', email: '', phone: '', category: 'forgot_password', message: '' });
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900"><div className="mx-auto max-w-xl"><Link href="/auth/forgot-password" className="text-sm font-bold text-sky-700">← Back to password recovery</Link><div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8"><p className="text-xs font-black uppercase tracking-widest text-emerald-700">AuroTap account support</p><h1 className="mt-2 text-3xl font-black">Need help restoring your account?</h1><p className="mt-3 text-sm leading-6 text-slate-600">Send a request even if you cannot sign in. Our team will verify ownership before making sensitive account changes.</p>
    {result ? <div className="mt-6 rounded-2xl bg-emerald-50 p-5"><h2 className="font-black text-emerald-900">Request received</h2><p className="mt-2 text-sm text-emerald-800">Reference #{result}. Keep this reference for follow-up. We will contact you using the details provided.</p><button onClick={() => setResult(null)} className="mt-4 text-sm font-bold text-emerald-800 underline">Submit another request</button></div> :
    <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-bold">Full name<input required minLength={2} maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" /></label><label className="block text-sm font-bold">Contact email<input required type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" /></label><label className="block text-sm font-bold">Phone (optional)<input type="tel" maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" /></label><label className="block text-sm font-bold">What do you need help with?<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal">{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm font-bold">Describe the problem<textarea required minLength={10} maxLength={2000} rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Please do not include your password, OTP or reset link." className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal" /></label>{error && <p role="alert" className="text-sm font-semibold text-rose-700">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Submit secure support request'}</button><p className="text-xs leading-5 text-slate-500">Submitting a request does not change your account or password. Ownership verification is required before any account changes.</p></form>}</div></div></main>;
}
