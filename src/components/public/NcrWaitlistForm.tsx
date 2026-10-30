'use client';

import { useState } from 'react';

const CITIES = ['Delhi', 'Noida', 'Greater Noida', 'Ghaziabad'] as const;

export default function NcrWaitlistForm() {
  const [city, setCity] = useState<(typeof CITIES)[number]>('Noida');
  const [area, setArea] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setMessage('');
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          custom_city: `${city} — ${area}`,
          custom_state: city === 'Delhi' ? 'Delhi' : 'Uttar Pradesh',
          name: 'NCR resident',
          email: email || null,
          phone: phone || null,
          role: 'customer',
          source: 'ncr',
          website,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Could not submit. Please try again.');
      setStatus('success');
      setMessage('Thank you! Your NCR expansion interest has been received.');
      setArea('');
      setEmail('');
      setPhone('');
      setWebsite('');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Could not submit. Please try again.');
    }
  }

  return (
    <section aria-labelledby="ncr-waitlist-title" className="rounded-3xl border border-cyan-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-wider text-cyan-800">Help us launch locally</p>
        <h2 id="ncr-waitlist-title" className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Get notified when AuroTap reaches your area</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Share your sector or neighbourhood and one way to contact you. This is an expression of interest, not a confirmed booking.</p>
      </div>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          City
          <select value={city} onChange={(e) => setCity(e.target.value as (typeof CITIES)[number])} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3" required>
            {CITIES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Sector / neighbourhood
          <input value={area} onChange={(e) => setArea(e.target.value)} maxLength={100} minLength={2} autoComplete="address-level3" placeholder="e.g. Sector 62, Indirapuram" className="min-h-11 rounded-xl border border-slate-300 px-3" required />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Email (optional if phone provided)
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" placeholder="name@example.com" className="min-h-11 rounded-xl border border-slate-300 px-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Phone (optional if email provided)
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} autoComplete="tel" placeholder="+91…" className="min-h-11 rounded-xl border border-slate-300 px-3" />
        </label>
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <label>Leave this field empty<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={status === 'sending'} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-cyan-800 px-5 py-3 font-bold text-white transition hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            {status === 'sending' ? 'Submitting…' : 'Notify me about the launch'}
          </button>
          <p role="status" aria-live="polite" className={`mt-3 text-sm ${status === 'error' ? 'text-red-700' : status === 'success' ? 'text-emerald-700' : 'text-slate-600'}`}>{message}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500">Please share only contact details you are comfortable providing. Your details are used to record interest in NCR availability; this does not activate service in your area.</p>
        </div>
      </form>
    </section>
  );
}
