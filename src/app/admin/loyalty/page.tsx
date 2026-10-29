'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getToken } from '@/lib/api-client';

type LoyaltySettings = {
  subscription_loyalty_enabled: boolean;
  subscription_loyalty_points_per_renewal: number;
  subscription_loyalty_points_per_reward: number;
  subscription_loyalty_streak_months: number;
  subscription_loyalty_streak_bonus_points: number;
  subscription_loyalty_points_per_rupee: number;
  subscription_loyalty_max_discount_percent: number;
  subscription_loyalty_plumbing_enabled: boolean;
  subscription_loyalty_tank_cleaning_enabled: boolean;
  subscription_loyalty_free_can_enabled: boolean;
  subscription_loyalty_service_discount_enabled: boolean;
};

const defaults: LoyaltySettings = {
  subscription_loyalty_enabled: true,
  subscription_loyalty_points_per_renewal: 100,
  subscription_loyalty_points_per_reward: 300,
  subscription_loyalty_streak_months: 3,
  subscription_loyalty_streak_bonus_points: 100,
  subscription_loyalty_points_per_rupee: 1,
  subscription_loyalty_max_discount_percent: 20,
  subscription_loyalty_plumbing_enabled: true,
  subscription_loyalty_tank_cleaning_enabled: true,
  subscription_loyalty_free_can_enabled: true,
  subscription_loyalty_service_discount_enabled: true,
};

type NumericLoyaltyKey = Exclude<keyof LoyaltySettings, 'subscription_loyalty_enabled' | 'subscription_loyalty_plumbing_enabled' | 'subscription_loyalty_tank_cleaning_enabled' | 'subscription_loyalty_free_can_enabled' | 'subscription_loyalty_service_discount_enabled'>;

const numericFields: Array<{ key: NumericLoyaltyKey; label: string; help: string; min: number; max: number }> = [
  { key: 'subscription_loyalty_points_per_renewal', label: 'Points per paid renewal', help: 'Granted once after a subscription delivery is completed and paid.', min: 1, max: 10000 },
  { key: 'subscription_loyalty_points_per_reward', label: 'Points per reward milestone', help: 'Default target: 300 points. This target is configurable.', min: 100, max: 10000 },
  { key: 'subscription_loyalty_streak_months', label: 'Monthly streak length', help: 'Consecutive calendar months with a paid renewal.', min: 2, max: 24 },
  { key: 'subscription_loyalty_streak_bonus_points', label: 'Streak bonus points', help: 'Awarded once when the customer reaches the configured streak.', min: 0, max: 10000 },
  { key: 'subscription_loyalty_points_per_rupee', label: 'Points per ₹1 discount', help: 'Points required per ₹1 of discount at checkout.', min: 1, max: 100 },
  { key: 'subscription_loyalty_max_discount_percent', label: 'Maximum eligible service discount', help: 'Cap for eligible plumbing and tank-cleaning orders.', min: 1, max: 50 },
];

async function request(method: 'GET' | 'PUT', body?: Record<string, unknown>) {
  const token = await getToken();
  if (!token) throw new Error('Please sign in again to manage loyalty settings.');
  const response = await fetch('/api/admin/settings', {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false || result.success === false) {
    throw new Error(result.error || 'Could not save loyalty settings.');
  }
  return result.data ?? result;
}

export default function AdminLoyaltyPage() {
  const [settings, setSettings] = useState<LoyaltySettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('GET') as Record<string, unknown>;
      setSettings(Object.fromEntries(Object.keys(defaults).map((key) => {
        const value = data[key];
        if (key.endsWith('_enabled')) return [key, value === undefined ? defaults[key as keyof LoyaltySettings] : value === true || value === 'true'];
        return [key, value === undefined ? defaults[key as keyof LoyaltySettings] : Number(value)];
      })) as LoyaltySettings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load loyalty settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await request('PUT', settings as unknown as Record<string, unknown>);
      toast.success('Loyalty settings saved.');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save settings.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/admin/settings" className="text-sm font-bold text-sky-700 hover:underline">← All admin settings</Link>
        <header className="rounded-3xl bg-gradient-to-br from-slate-950 to-sky-900 p-6 text-white sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-200">AuroTap · Admin control</p>
          <h1 className="mt-2 text-3xl font-black">Subscription loyalty</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-100">Manage the complete loyalty policy: renewal awards, streaks, free-can offers and service discounts. All redemption requests are revalidated server-side.</p>
        </header>
        {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="text-lg font-black">Program status</h2><p className="mt-1 text-sm text-slate-600">Pause new loyalty awards without changing existing balances.</p></div>
            <button type="button" disabled={loading} onClick={() => setSettings((old) => ({ ...old, subscription_loyalty_enabled: !old.subscription_loyalty_enabled }))} className={`rounded-full px-4 py-2 text-sm font-bold ${settings.subscription_loyalty_enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{settings.subscription_loyalty_enabled ? 'Enabled' : 'Paused'}</button>
          </div>
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-black">Redemption offers</h2>
          <p className="mt-1 text-sm text-slate-600">Pause either offer at any time. Pausing prevents new redemptions; it does not erase points or past orders.</p>
          {([
            ['subscription_loyalty_free_can_enabled', 'Free standard RO can', 'Redeem the configured reward milestone on one standard one-time can.'],
            ['subscription_loyalty_service_discount_enabled', 'Service discounts', 'Redeem points for plumbing or tank-cleaning discounts within the configured cap.'],
          ] as const).map(([key, label, help]) => <label key={key} className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
            <span><span className="block font-semibold">{label}</span><span className="mt-1 block text-xs text-slate-500">{help}</span></span>
            <input type="checkbox" checked={settings[key]} onChange={(event) => setSettings((old) => ({ ...old, [key]: event.target.checked }))} className="h-5 w-5 accent-sky-700" />
          </label>)}
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          {numericFields.map((field) => <label key={field.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="block text-sm font-bold">{field.label}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{field.help}</span>
            <input type="number" min={field.min} max={field.max} step="1" value={settings[field.key] as number} onChange={(event) => setSettings((old) => ({ ...old, [field.key]: Number(event.target.value) }))} className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 focus:border-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-700/20" />
          </label>)}
        </section>
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-black">Eligible services</h2>
          <p className="mt-1 text-sm text-slate-600">Choose which service categories can accept points. Redemption is validated again on the server.</p>
          {([
            ['subscription_loyalty_plumbing_enabled', 'Plumbing'],
            ['subscription_loyalty_tank_cleaning_enabled', 'Tank cleaning'],
          ] as const).map(([key, label]) => <label key={key} className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
            <span className="font-semibold">{label}</span>
            <input type="checkbox" checked={settings[key]} onChange={(event) => setSettings((old) => ({ ...old, [key]: event.target.checked }))} className="h-5 w-5 accent-sky-700" />
          </label>)}
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Changes are validated and audit-logged by the existing admin settings API.</p>
          <button type="button" disabled={loading || saving} onClick={() => void save()} className="min-h-12 rounded-2xl bg-sky-700 px-6 font-extrabold text-white hover:bg-sky-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save loyalty settings'}</button>
        </div>
      </div>
    </main>
  );
}
