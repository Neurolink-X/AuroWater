'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';

import { MILESTONE_TIERS, type MilestoneTier } from '@/lib/milestone-constants';
import { useAuth } from '@/hooks/useAuth';

const UP_CITIES = [
  'Kanpur',
  'Gorakhpur',
  'Lucknow',
  'Varanasi',
  'Prayagraj',
  'Agra',
  'Meerut',
  'Bareilly',
  'Aligarh',
  'Mathura',
  'Delhi',
  'Noida',
  'Ghaziabad',
] as const;

const baseSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  city: z.enum(UP_CITIES, { message: 'City is required' }),
});

const supplierSchema = baseSchema.extend({
  type: z.literal('supplier'),
  vehicle_type: z.enum(['Cycle', 'Bike', 'Auto', 'Mini-truck'], { message: 'Vehicle type is required' }),
  cans_capacity: z.coerce.number().int().min(1, 'Capacity is required'),
  upi_id: z.string().min(3, 'UPI ID is required'),
  bank_account: z.string().optional(),
  ifsc: z.string().optional(),
});

const technicianSchema = baseSchema.extend({
  type: z.literal('technician'),
  skills: z.array(z.enum(['Plumbing', 'RO Install', 'Boring', 'Maintenance'])).min(1, 'Pick at least 1 skill'),
  experience_years: z.coerce.number().int().min(0, 'Experience is required'),
});

type SupplierForm = z.infer<typeof supplierSchema>;
type TechnicianForm = z.infer<typeof technicianSchema>;
type ProForm = SupplierForm | TechnicianForm;

function tierRows(): Array<{
  tier: MilestoneTier;
  orders: number;
  radius: number;
  commission: number;
  bonus: number;
  label: string;
}> {
  const tiers: MilestoneTier[] = ['starter', 'bronze', 'silver', 'gold', 'platinum'];
  return tiers.map((t) => ({
    tier: t,
    orders: MILESTONE_TIERS[t].min,
    radius: MILESTONE_TIERS[t].radius,
    commission: MILESTONE_TIERS[t].commission,
    bonus: Number(MILESTONE_TIERS[t].bonus ?? 0),
    label: MILESTONE_TIERS[t].label,
  }));
}

export default function RegisterProPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { hydrated, isLoggedIn } = useAuth();

  const typeParam = (sp.get('type') ?? 'supplier').toLowerCase();
  const kind: ProForm['type'] = typeParam === 'technician' ? 'technician' : 'supplier';

  const submitApplication = async (values: ProForm) => {
    if (!isLoggedIn) {
      router.push(`/auth/login?returnTo=${encodeURIComponent(`/register/pro?type=${kind}`)}`);
      return;
    }
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const json = (await res.json()) as { success?: boolean; error?: string; data?: unknown };
      if (res.status === 401) {
        router.push(`/auth/login?returnTo=${encodeURIComponent(`/register/pro?type=${kind}`)}`);
        return;
      }
      if (!res.ok || json?.success === false) {
        toast.error(json?.error ?? 'Could not submit application.');
        return;
      }
      toast.success("Application submitted! We'll review within 24 hours.");
      router.push('/register/pro/success');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not submit application.');
    }
  };

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: '#050B18', color: '#E5E7EB' }}>
      <div className="max-w-5xl mx-auto">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#071B33] to-[#050B18] p-8 md:p-10">
          <p className="text-xs font-bold tracking-[0.22em] uppercase text-sky-300/80">Partner with AuroWater</p>
          <h1 className="mt-3 text-[clamp(1.9rem,4.6vw,3rem)] font-extrabold aw-heading">
            Grow your water business with AuroWater
          </h1>
          <p className="mt-3 text-slate-200/80 max-w-2xl">
            Keep your customers. Earn more per delivery. Expand your area automatically.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              '🔒 Your customers stay yours',
              '📈 Commission drops from 8% → 4%',
              '🗺 Unlock up to 20km delivery zone',
            ].map((t) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold">
                {t}
              </div>
            ))}
          </div>

          <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: '🔁', title: 'Repeat customers always assigned to you first' },
              { icon: '🏅', title: 'Reach Bronze at 50 orders → unlock 8km zone + lower commission' },
              { icon: '💰', title: 'Milestone bonuses: ₹500 at Gold, ₹1000 at Platinum' },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-2xl">{c.icon}</div>
                <div className="mt-3 text-sm font-extrabold text-white">{c.title}</div>
              </div>
            ))}
          </div>

          <details className="mt-6 rounded-2xl border border-white/10 bg-white/5">
            <summary className="cursor-pointer select-none px-5 py-4 font-bold text-white">
              Milestones & rewards (tap to expand)
            </summary>
            <div className="px-5 pb-5 overflow-x-auto">
              <table className="min-w-[620px] w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-300">
                    <th className="py-2 pr-4">Tier</th>
                    <th className="py-2 pr-4">Orders</th>
                    <th className="py-2 pr-4">Zone</th>
                    <th className="py-2 pr-4">Commission</th>
                    <th className="py-2 pr-4">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {tierRows().map((r) => (
                    <tr key={r.tier} className="border-t border-white/10">
                      <td className="py-2 pr-4 font-bold text-white">{r.label}</td>
                      <td className="py-2 pr-4 text-slate-200">{r.orders}+</td>
                      <td className="py-2 pr-4 text-slate-200">{r.radius}km</td>
                      <td className="py-2 pr-4 text-slate-200">{r.commission}%</td>
                      <td className="py-2 pr-4 text-slate-200">{r.bonus ? `₹${r.bonus.toLocaleString('en-IN')}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-white">
                {kind === 'supplier' ? 'Supplier application' : 'Technician application'}
              </h2>
              <p className="text-sm text-slate-200/75 mt-1">
                {hydrated && !isLoggedIn ? (
                  <>
                    You’ll be asked to sign in after you fill the form.
                    <span className="ml-2">
                      <Link href={`/auth/login?returnTo=${encodeURIComponent(`/register/pro?type=${kind}`)}`} className="underline font-semibold text-sky-300">
                        Sign in
                      </Link>
                    </span>
                  </>
                ) : (
                  'Submit once. We review within 24 hours.'
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/register/pro?type=supplier"
                className={`rounded-xl px-4 py-2 text-sm font-bold border ${kind === 'supplier' ? 'bg-sky-600 text-white border-sky-400/30' : 'bg-transparent text-slate-200 border-white/10'}`}
              >
                Supplier
              </Link>
              <Link
                href="/register/pro?type=technician"
                className={`rounded-xl px-4 py-2 text-sm font-bold border ${kind === 'technician' ? 'bg-sky-600 text-white border-sky-400/30' : 'bg-transparent text-slate-200 border-white/10'}`}
              >
                Technician
              </Link>
            </div>
          </div>

          {kind === 'supplier' ? (
            <SupplierFormView
              key="supplier"
              onSubmit={(v) => submitApplication(v)}
            />
          ) : (
            <TechnicianFormView
              key="technician"
              onSubmit={(v) => submitApplication(v)}
            />
          )}

          <style>{`
            .aw-input{
              width:100%;
              background: rgba(255,255,255,0.06);
              border: 1px solid rgba(255,255,255,0.12);
              border-radius: 14px;
              padding: 12px 14px;
              color: #fff;
              font-weight: 600;
              outline: none;
            }
            .aw-input:focus{
              border-color: rgba(56,189,248,0.7);
              box-shadow: 0 0 0 3px rgba(56,189,248,0.15);
            }
          `}</style>
        </div>

        <p className="mt-8 text-center text-sm text-slate-300/80">
          Need help?{' '}
          <Link href="/contact" className="font-semibold text-sky-300 underline">
            Contact support
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs font-bold tracking-[0.18em] uppercase text-slate-300/80 mb-2">
        {label}
      </div>
      {children}
      {error ? <div className="mt-2 text-sm font-semibold text-rose-300">{error}</div> : null}
    </label>
  );
}

function SupplierFormView({ onSubmit }: { onSubmit: (v: SupplierForm) => Promise<void> }) {
  const form = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema) as unknown as Resolver<SupplierForm>,
    defaultValues: {
      type: 'supplier',
      full_name: '',
      phone: '',
      city: UP_CITIES[0],
      vehicle_type: 'Bike',
      cans_capacity: 20,
      upi_id: '',
      bank_account: '',
      ifsc: '',
    },
    mode: 'onBlur',
  });

  const submitting = form.formState.isSubmitting;

  return (
    <form className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <input type="hidden" value="supplier" {...form.register('type')} />

      <Field label="Full name" error={form.formState.errors.full_name?.message}>
        <input className="aw-input" placeholder="Your name" {...form.register('full_name')} />
      </Field>

      <Field label="Phone" error={form.formState.errors.phone?.message}>
        <input
          className="aw-input"
          inputMode="numeric"
          placeholder="10-digit phone"
          {...form.register('phone')}
          onChange={(e) => form.setValue('phone', e.target.value.replace(/\D/g, '').slice(0, 10), { shouldValidate: true })}
        />
      </Field>

      <Field label="City" error={form.formState.errors.city?.message}>
        <select className="aw-input" {...form.register('city')}>
          {UP_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Vehicle type" error={form.formState.errors.vehicle_type?.message}>
        <select className="aw-input" {...form.register('vehicle_type')}>
          {(['Cycle', 'Bike', 'Auto', 'Mini-truck'] as const).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Cans capacity" error={form.formState.errors.cans_capacity?.message}>
        <input className="aw-input" type="number" min={1} {...form.register('cans_capacity', { valueAsNumber: true })} />
      </Field>

      <Field label="UPI ID (for payouts)" error={form.formState.errors.upi_id?.message}>
        <input className="aw-input" placeholder="name@upi" {...form.register('upi_id')} />
      </Field>

      <Field label="Bank account (optional)" error={undefined}>
        <input className="aw-input" placeholder="Account number" {...form.register('bank_account')} />
      </Field>

      <Field label="IFSC (optional)" error={undefined}>
        <input className="aw-input" placeholder="IFSC" {...form.register('ifsc')} />
      </Field>

      <div className="md:col-span-2 mt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl py-4 font-extrabold text-white"
          style={{
            background: 'linear-gradient(135deg,#14B8A6,#2563EB)',
            boxShadow: '0 10px 30px rgba(37,99,235,0.25)',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
        <p className="mt-3 text-center text-xs text-slate-300/80">
          By submitting, you agree to be contacted on WhatsApp for verification.
        </p>
      </div>
    </form>
  );
}

function TechnicianFormView({ onSubmit }: { onSubmit: (v: TechnicianForm) => Promise<void> }) {
  const form = useForm<TechnicianForm>({
    resolver: zodResolver(technicianSchema) as unknown as Resolver<TechnicianForm>,
    defaultValues: {
      type: 'technician',
      full_name: '',
      phone: '',
      city: UP_CITIES[0],
      skills: ['Plumbing'],
      experience_years: 1,
    },
    mode: 'onBlur',
  });

  const submitting = form.formState.isSubmitting;
  const skills = form.watch('skills');

  return (
    <form className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <input type="hidden" value="technician" {...form.register('type')} />

      <Field label="Full name" error={form.formState.errors.full_name?.message}>
        <input className="aw-input" placeholder="Your name" {...form.register('full_name')} />
      </Field>

      <Field label="Phone" error={form.formState.errors.phone?.message}>
        <input
          className="aw-input"
          inputMode="numeric"
          placeholder="10-digit phone"
          {...form.register('phone')}
          onChange={(e) => form.setValue('phone', e.target.value.replace(/\D/g, '').slice(0, 10), { shouldValidate: true })}
        />
      </Field>

      <Field label="City" error={form.formState.errors.city?.message}>
        <select className="aw-input" {...form.register('city')}>
          {UP_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Skills" error={form.formState.errors.skills?.message}>
        <div className="grid grid-cols-2 gap-2">
          {(['Plumbing', 'RO Install', 'Boring', 'Maintenance'] as const).map((s) => {
            const checked = skills.includes(s);
            return (
              <label
                key={s}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 flex items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...skills, s] : skills.filter((x) => x !== s);
                    form.setValue('skills', next, { shouldValidate: true });
                  }}
                />
                {s}
              </label>
            );
          })}
        </div>
      </Field>

      <Field label="Experience (years)" error={form.formState.errors.experience_years?.message}>
        <input className="aw-input" type="number" min={0} {...form.register('experience_years', { valueAsNumber: true })} />
      </Field>

      <div className="md:col-span-2 mt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-2xl py-4 font-extrabold text-white"
          style={{
            background: 'linear-gradient(135deg,#14B8A6,#2563EB)',
            boxShadow: '0 10px 30px rgba(37,99,235,0.25)',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
        <p className="mt-3 text-center text-xs text-slate-300/80">
          By submitting, you agree to be contacted on WhatsApp for verification.
        </p>
      </div>
    </form>
  );
}
