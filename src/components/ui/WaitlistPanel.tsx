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
  cityName,
  cityId,
  role,
  source = 'register',
  defaultName = '',
  defaultPhone = '',
  onClose,
}: Props) {
  const [form, setForm] = useState({
    name: defaultName,
    phone: defaultPhone,
    email: '',
    business_name: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const isSeller = role === 'seller';
  const isAgent = role === 'agent';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    if (form.name.trim().length < 2) {
      setError('Enter your name');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_id: isCityUuid(cityId) ? cityId : null,
          custom_city: isCityUuid(cityId) ? undefined : cityName,
          name: form.name.trim(),
          phone: form.phone,
          email: form.email || null,
          role,
          business_name: form.business_name || null,
          message: form.message || null,
          source,
        }),
      });
      const data = (await res.json()) as { error?: string; success?: boolean; message?: string };
      if (!res.ok) {
  throw new Error(
    data.error && data.error.length < 160
      ? data.error
      : 'Unable to join the waitlist. Please try again.'
  );
}
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
        <div className="mb-3 text-4xl">🎉</div>
        <h3 className="mb-2 text-lg font-bold text-white">You&apos;re on the list!</h3>
        <p className="text-sm text-neutral-400">
          We&apos;ll notify <span className="font-medium text-white">{form.phone}</span> when AuroWater launches in{' '}
          <span className="font-medium text-cyan-400">{cityName}</span>.
        </p>
        {(isSeller || isAgent) && (
          <p className="mt-3 text-xs text-emerald-400">
            You&apos;ll be among the first to onboard in {cityName}.
          </p>
        )}
        {onClose ? (
          <button type="button" onClick={onClose} className="mt-4 text-xs text-neutral-400 hover:text-white">
            ← Go back
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-white">
            {cityName} — {role === 'customer' ? 'Join the waitlist' : 'Launch AuroWater here'}
          </h3>
          <p className="mt-1 text-xs text-neutral-400">
            {role === 'customer'
              ? `We're not delivering in ${cityName} yet. We'll WhatsApp you when we launch.`
              : `Want to ${isSeller ? 'supply' : 'deliver'} water in ${cityName}? We'll contact you to set up.`}
          </p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="shrink-0 text-neutral-500 hover:text-white" aria-label="Close">
            ✕
          </button>
        ) : null}
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Your full name"
          className="w-full rounded-xl border border-white/10 bg-[#0d1f35] px-4 py-3 text-sm text-white outline-none"
        />
        <input
          required
          type="tel"
          maxLength={10}
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
          placeholder="10-digit mobile"
          className="w-full rounded-xl border border-white/10 bg-[#0d1f35] px-4 py-3 text-sm text-white outline-none"
        />
        {isSeller ? (
          <input
            value={form.business_name}
            onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
            placeholder="Business / shop name (optional)"
            className="w-full rounded-xl border border-white/10 bg-[#0d1f35] px-4 py-3 text-sm text-white outline-none"
          />
        ) : null}
        <textarea
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          rows={2}
          placeholder="Optional note"
          className="w-full resize-none rounded-xl border border-white/10 bg-[#0d1f35] px-4 py-3 text-sm text-white outline-none"
        />
        {error ? <p className="px-1 text-xs text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Joining…' : `Join waitlist for ${cityName}`}
        </button>
      </form>
    </div>
  );
}
