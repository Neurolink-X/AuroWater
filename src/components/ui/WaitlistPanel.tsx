'use client';

import { useState } from 'react';
import { isCityUuid } from '@/lib/cities';

type Props = {
  cityName: string;
  cityId: string | null;
  role: 'customer' | 'seller' | 'agent';
  source?: 'register' | 'homepage' | 'book' | 'book-zone';
  defaultName?: string;
  defaultPhone?: string;
  onClose?: () => void;
};

export default function WaitlistPanel({
  cityName, cityId, role, source = 'register', defaultName = '', defaultPhone = '', onClose,
}: Props) {
  const [form, setForm] = useState({
    name: defaultName, phone: defaultPhone, email: '', area: '', pincode: '', business_name: '', message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const isSeller = role === 'seller';
  const isAgent = role === 'agent';
  const isBooking = source === 'book' || source === 'book-zone';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!/^[6-9]\d{9}$/.test(form.phone)) return setError('Enter a valid 10-digit Indian mobile number');
    if (form.name.trim().length < 2) return setError('Enter your name');
    if (isBooking && form.area.trim().length < 2) return setError('Enter your area or sector so we can map local demand');
    if (form.pincode && !/^[1-9]\d{5}$/.test(form.pincode)) return setError('Enter a valid 6-digit PIN code');

    setSubmitting(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_id: isCityUuid(cityId) ? cityId : null,
          custom_city: isCityUuid(cityId) ? undefined : cityName.trim(),
          name: form.name.trim(),
          phone: form.phone,
          email: form.email.trim() || null,
          area: form.area.trim() || null,
          pincode: form.pincode || null,
          role,
          business_name: form.business_name.trim() || null,
          message: form.message.trim() || null,
          source,
        }),
      });
      const data = (await res.json()) as { error?: string; success?: boolean; message?: string };
      if (!res.ok) throw new Error(data.error && data.error.length < 160 ? data.error : 'Unable to join the waitlist. Please try again.');
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-6 text-center sm:p-8" role="status">
        <div className="mb-3 text-3xl" aria-hidden="true">✓</div>
        <h3 className="text-lg font-bold text-white">You&apos;re on the list!</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          We&apos;ll notify <span className="font-semibold text-white">{form.phone}</span> when AuroTap launches in{' '}
          <span className="font-semibold text-cyan-300">{cityName}</span>
          {form.area.trim() ? <> around <span className="font-semibold text-white">{form.area.trim()}</span></> : null}.
        </p>
        {form.pincode ? <p className="mt-1 text-xs text-slate-400">PIN code: {form.pincode}</p> : null}
        {(isSeller || isAgent) ? <p className="mt-3 text-xs text-emerald-300">You&apos;ll be among the first to onboard in {cityName}.</p> : null}
        {onClose ? <button type="button" onClick={onClose} className="mt-4 text-xs text-slate-400 hover:text-white">← Go back</button> : null}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-cyan-400/20 bg-[#0A1628] p-4 shadow-lg sm:p-6" aria-labelledby="waitlist-panel-title">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-300">{isBooking ? 'Local launch updates' : 'Expansion updates'}</p>
          <h3 id="waitlist-panel-title" className="mt-1 text-lg font-bold text-white">
            {cityName} — {role === 'customer' ? 'Join the waitlist' : 'Launch AuroTap here'}
          </h3>
          <p className="mt-1 text-sm leading-5 text-slate-300">
            {role === 'customer'
              ? `Tell us your locality so we can understand demand in ${cityName}. We will contact you when service launches.`
              : `Want to ${isSeller ? 'supply' : 'deliver'} water in ${cityName}? Share your details and we will contact you.`}
          </p>
        </div>
        {onClose ? <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close">✕</button> : null}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-semibold text-slate-200">
          Full name
          <input required autoComplete="name" maxLength={100} value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Your full name"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-[#10243B] px-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-200">
          Mobile number
          <input required type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit mobile"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-[#10243B] px-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-200">
          Area / sector {isBooking ? <span className="text-cyan-300">(required)</span> : <span className="font-normal text-slate-400">(optional)</span>}
          <input required={isBooking} autoComplete="address-level3" maxLength={120} minLength={isBooking ? 2 : undefined}
            value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} placeholder="e.g. Sector 73, Barra, Indirapuram"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-[#10243B] px-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-200">
          PIN code <span className="font-normal text-slate-400">(optional)</span>
          <input inputMode="numeric" autoComplete="postal-code" pattern="[1-9][0-9]{5}" maxLength={6} value={form.pincode}
            onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="6-digit PIN code"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-[#10243B] px-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-200 sm:col-span-2">
          Email <span className="font-normal text-slate-400">(optional)</span>
          <input type="email" autoComplete="email" maxLength={254} value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@example.com"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-[#10243B] px-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" />
        </label>
        {isSeller ? (
          <label className="grid gap-1.5 text-xs font-semibold text-slate-200 sm:col-span-2">
            Business / shop name <span className="font-normal text-slate-400">(optional)</span>
            <input maxLength={200} value={form.business_name} onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
              placeholder="Business / shop name" className="min-h-11 w-full rounded-xl border border-white/10 bg-[#10243B] px-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" />
          </label>
        ) : null}
        <label className="grid gap-1.5 text-xs font-semibold text-slate-200 sm:col-span-2">
          Anything else? <span className="font-normal text-slate-400">(optional)</span>
          <textarea maxLength={500} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            rows={2} placeholder="Tell us what service you need or when you would like us to launch."
            className="w-full resize-y rounded-xl border border-white/10 bg-[#10243B] px-3 py-2.5 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" />
        </label>
        {error ? <p role="alert" className="text-sm text-rose-300 sm:col-span-2">{error}</p> : null}
        <div className="sm:col-span-2">
          <button type="submit" disabled={submitting}
            className="min-h-12 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? 'Submitting…' : `Notify me when AuroTap launches in ${cityName}`}
          </button>
          <p className="mt-2 text-center text-[11px] leading-5 text-slate-400">Waitlist only — this does not create a booking or guarantee service availability.</p>
        </div>
      </form>
    </section>
  );
}
