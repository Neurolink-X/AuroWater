'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getToken } from '@/lib/api-client';

type Reward = {
  id: string;
  reward_type: 'discount_25' | 'free_water_can';
  reward_status: 'available' | 'reserved' | 'redeemed' | 'void';
  qualifying_order_id: string;
  created_at: string;
  redeemed_at: string | null;
};

type ReferralData = {
  referral_code: string | null;
  has_referred_by: boolean;
  invited_count: number;
  qualified_count: number;
  rewards: Reward[];
  rewards_available: number;
};

const rewardTitle = (type: Reward['reward_type']) =>
  type === 'free_water_can' ? 'Free standard RO water can' : '25% off one standard RO water can';

const rewardStatus = (status: Reward['reward_status']) => ({
  available: 'Ready to use',
  reserved: 'Reserved for an order',
  redeemed: 'Used',
  void: 'Unavailable',
}[status]);

export default function CustomerReferralsPage() {
  const { hydrated, isLoggedIn, isCustomer, session } = useAuth();
  const searchParams = useSearchParams();
  const queryCode = searchParams.get('code') ?? '';
  const [data, setData] = useState<ReferralData | null>(null);
  const [code, setCode] = useState(queryCode.toUpperCase());
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setCode(queryCode.toUpperCase()), [queryCode]);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/customer/referrals', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message ?? 'Could not load referrals.');
      setData(result.data ?? result);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load referrals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hydrated && isLoggedIn && isCustomer) void load();
  }, [hydrated, isLoggedIn, isCustomer, load]);

  useEffect(() => {
    if (hydrated && !isLoggedIn) {
      const returnTo = `/customer/referrals${queryCode ? `?code=${encodeURIComponent(queryCode)}` : ''}`;
      window.location.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [hydrated, isLoggedIn, queryCode]);

  const inviteUrl = useMemo(() => {
    if (!data?.referral_code) return '';
    return `https://www.aurotap.in/customer/referrals?code=${encodeURIComponent(data.referral_code)}`;
  }, [data?.referral_code]);

  const applyCode = async () => {
    if (!code.trim()) return;
    setApplying(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again to apply this code.');
      const response = await fetch('/api/customer/referrals', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message ?? 'Could not apply this referral code.');
      toast.success('Referral code applied! Invite a friend and start earning rewards.');
      setCode('');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not apply this referral code.';
      setError(message);
      toast.error(message);
    } finally {
      setApplying(false);
    }
  };

  const shareInvite = async () => {
    if (!inviteUrl || !data?.referral_code) return;
    const text = `Try AuroTap for water-can delivery and home water services. Use my referral code ${data.referral_code}. After your first completed and paid booking, I can earn rewards: ${inviteUrl}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join me on AuroTap', text, url: inviteUrl });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Invite copied. Share it with your friends.');
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(text);
        toast.success('Invite copied. Share it with your friends.');
      } catch {
        toast.error('Could not share automatically. Copy your referral code instead.');
      }
    }
  };

  const copyCode = async () => {
    if (!data?.referral_code) return;
    try {
      await navigator.clipboard.writeText(data.referral_code);
      toast.success('Referral code copied.');
    } catch {
      toast.info(`Your referral code is ${data.referral_code}`);
    }
  };

  if (!hydrated || !isLoggedIn || !isCustomer) {
    return <main className="mx-auto max-w-3xl p-6 text-slate-600">Loading your referral rewards…</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/customer/home" className="text-sm font-bold text-sky-700 hover:underline">← Back to dashboard</Link>

        <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-sky-800 p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-200">AuroTap Rewards</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Invite friends. Earn water rewards.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-100">जब आपका दोस्त पहली बुकिंग पूरी करके भुगतान कर देगा, तब आपका referral reward qualify होगा। हर referral के लिए 25% off और 5 अलग-अलग qualifying addresses पर एक free standard RO can का reward।</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3">
              <p className="text-xs text-sky-100">Successful referrals</p>
              <p className="text-2xl font-black">{data?.qualified_count ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3">
              <p className="text-xs text-sky-100">Rewards available</p>
              <p className="text-2xl font-black">{data?.rewards_available ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3">
              <p className="text-xs text-sky-100">Next free can</p>
              <p className="text-2xl font-black">{5 - ((data?.qualified_count ?? 0) % 5)} more</p>
            </div>
          </div>
        </header>

        {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}

        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-black">Your invite code</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Share this with friends and family. Your code stays the same.</p>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-sky-300 bg-sky-50 p-3">
              <span className="flex-1 font-mono text-xl font-black tracking-wider text-sky-900">{loading ? 'Loading…' : data?.referral_code ?? 'Code unavailable'}</span>
              <button type="button" onClick={() => void copyCode()} disabled={!data?.referral_code} className="min-h-10 rounded-xl bg-white px-3 text-sm font-bold text-sky-800 shadow-sm disabled:opacity-50">Copy</button>
            </div>
            <button type="button" onClick={() => void shareInvite()} disabled={!inviteUrl} className="mt-3 min-h-12 w-full rounded-2xl bg-sky-700 px-4 font-extrabold text-white hover:bg-sky-800 disabled:opacity-50">Share invite link</button>
            <p className="mt-2 text-xs leading-5 text-slate-500">Reward is issued only after the referred customer’s first booking is completed and paid. Same-address repeat accounts do not count.</p>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-black">Have a friend’s code?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Apply it before placing your first booking. A code can only be linked once.</p>
            <label htmlFor="referral-code" className="mt-4 block text-sm font-bold text-slate-700">Referral code</label>
            <input id="referral-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={32} autoCapitalize="characters" placeholder="AT-ABC123" className="mt-1 min-h-12 w-full rounded-xl border border-slate-300 px-4 font-mono text-base uppercase outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100" />
            <button type="button" onClick={() => void applyCode()} disabled={applying || !code.trim() || data?.has_referred_by} className="mt-3 min-h-12 w-full rounded-2xl bg-slate-900 px-4 font-extrabold text-white hover:bg-slate-800 disabled:opacity-50">{applying ? 'Applying…' : data?.has_referred_by ? 'Referral already applied' : 'Apply code'}</button>
            {data?.has_referred_by ? <p className="mt-2 text-xs text-emerald-700">A referral code is already linked to your account.</p> : null}
          </article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Your rewards</h2>
              <p className="mt-1 text-sm text-slate-600">Rewards unlock after a friend’s first completed and paid booking.</p>
            </div>
            <button type="button" onClick={() => void load()} className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold hover:bg-slate-50">Refresh</button>
          </div>
          {loading ? <p className="mt-5 text-sm text-slate-500">Loading rewards…</p> : data?.rewards.length ? (
            <ul className="mt-4 divide-y divide-slate-100">
              {data.rewards.map((reward) => (
                <li key={reward.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold">{rewardTitle(reward.reward_type)}</p>
                    <p className="mt-1 text-xs text-slate-500">Qualified {new Date(reward.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-black ${reward.reward_status === 'available' ? 'bg-emerald-100 text-emerald-800' : reward.reward_status === 'redeemed' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>{rewardStatus(reward.reward_status)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">No rewards yet. Share your code and your first reward will unlock after a friend completes and pays for their first booking.</p>}
        </section>

        <p className="text-xs leading-5 text-slate-500">Referral rewards are personal, non-transferable and limited to one qualification per customer and physical address. AuroTap may void rewards linked to fraudulent, cancelled or refunded orders. Rewards are valid for standard one-time RO water-can orders only; chilled cans and subscriptions are excluded.</p>
      </div>
    </main>
  );
}
