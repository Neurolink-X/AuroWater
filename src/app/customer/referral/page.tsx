'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getToken } from '@/lib/api-client';
import { referralReturnPath } from '@/lib/referrals/invite-paths';

export default function CustomerSupplierInvitationPage() {
  const supplierId = useSearchParams().get('supplier');
  const { hydrated, isLoggedIn, isCustomer } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const invitePath = referralReturnPath(
    supplierId ? `/customer/referral?supplier=${encodeURIComponent(supplierId)}` : null
  );
  const loginHref = `/auth/login?returnTo=${encodeURIComponent(invitePath ?? '/customer/referral')}`;
  const registerHref = `/auth/register?role=customer&returnTo=${encodeURIComponent(invitePath ?? '/customer/referral')}`;

  async function confirm() {
    if (!invitePath || busy || !isCustomer) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session expired. Sign in and open this invitation again.');
      const res = await fetch('/api/customer/referral', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? json.message ?? 'Unable to confirm referral.');
      setMessage(json.data?.alreadyConfirmed
        ? 'This supplier is already linked to your account.'
        : 'Supplier referral confirmed. You can now book on AuroTap.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to confirm referral.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 text-slate-900">
      <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">AuroTap · Supplier invitation</p>
        <h1 className="mt-2 text-2xl font-extrabold">Your water supplier invited you</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Join AuroTap and confirm the supplier who introduced you before your first order.
          On eligible orders, that supplier gets priority for 90 days. You remain free to
          choose another supplier; stock, service area and availability always apply.
          No referral cashback or discount is promised for supplier invitations.
        </p>

        {!invitePath ? (
          <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-rose-800">
            This supplier invitation link is invalid. Ask your supplier to share a new link.
          </p>
        ) : !hydrated ? (
          <p role="status" className="mt-5 text-slate-600">Checking your account…</p>
        ) : !isLoggedIn ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href={registerHref} className="rounded-xl bg-emerald-700 px-5 py-3 text-center font-bold text-white">
              Create customer account
            </Link>
            <Link href={loginHref} className="rounded-xl border border-emerald-700 px-5 py-3 text-center font-bold text-emerald-800">
              Already registered? Sign in
            </Link>
            <p className="text-xs text-slate-500 sm:col-span-2">Your supplier invitation will remain available after sign-in.</p>
          </div>
        ) : !isCustomer ? (
          <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-amber-900">
            Supplier invitations can only be confirmed by customer accounts.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            <button type="button" disabled={busy || Boolean(message)} onClick={() => void confirm()}
              className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-60">
              {busy ? 'Confirming…' : message ? 'Referral confirmed' : 'Confirm supplier referral'}
            </button>
            {message && <Link href="/book" className="block text-center text-sm font-semibold text-emerald-800 underline">Book your first service</Link>}
          </div>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-rose-800">{error}</p>}
        {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-emerald-900">{message}</p>}
      </div>
    </main>
  );
}
