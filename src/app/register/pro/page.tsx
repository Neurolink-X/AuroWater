'use client';

import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { MILESTONE_TIERS, type MilestoneTier } from '@/lib/milestone-constants';
import { useAuth } from '@/hooks/useAuth';

/* ───────────────────────── Content & constants ───────────────────────── */

const BRAND = 'AuroTap';
const DELIVERY_DAYS = 26; // working days per month used by the earnings estimator

const SERVICE_CITIES = [
  'Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj', 'Agra', 'Meerut',
  'Bareilly', 'Aligarh', 'Mathura', 'Delhi', 'Noida', 'Ghaziabad',
] as const;
const VEHICLES = ['Cycle', 'Bike', 'Auto', 'Mini-truck'] as const;
const SKILLS = ['Plumbing', 'RO Install', 'Boring', 'Maintenance'] as const;

const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile numbers
const UPI_RE = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/i;
const ACCOUNT_RE = /^\d{9,18}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

type Kind = 'supplier' | 'technician';

/* ───────────────────────── Validation ───────────────────────── */

const baseShape = {
  full_name: z.string().trim().min(2, 'Enter your full name').max(80, 'Name is too long'),
  phone: z.string().regex(PHONE_RE, 'Enter a valid 10-digit mobile number'),
  city: z.enum(SERVICE_CITIES, { message: 'Choose your city' }),
};

const supplierSchema = z
  .object({
    ...baseShape,
    type: z.literal('supplier'),
    vehicle_type: z.enum(VEHICLES, { message: 'Choose your vehicle' }),
    cans_capacity: z.number({ message: 'Enter how many cans you can carry' }).int('Use a whole number').min(1, 'At least 1 can').max(500, 'That looks too high'),
    upi_id: z.string().trim().regex(UPI_RE, 'Enter a valid UPI ID, for example name@bank'),
    bank_account: z.string().trim().refine((v) => !v || ACCOUNT_RE.test(v), 'Account numbers have 9 to 18 digits'),
    ifsc: z.string().trim().toUpperCase().refine((v) => !v || IFSC_RE.test(v), 'Enter a valid IFSC, for example HDFC0001234'),
  })
  .refine((v) => Boolean(v.bank_account) === Boolean(v.ifsc), {
    path: ['ifsc'],
    message: 'Add both account number and IFSC, or leave both empty',
  });

const technicianSchema = z.object({
  ...baseShape,
  type: z.literal('technician'),
  skills: z.array(z.enum(SKILLS)).min(1, 'Pick at least one skill'),
  experience_years: z.number({ message: 'Enter your experience' }).int('Use a whole number').min(0, 'Cannot be negative').max(60, 'That looks too high'),
});

type SupplierPayload = z.infer<typeof supplierSchema>;
type TechnicianPayload = z.infer<typeof technicianSchema>;
type Payload = SupplierPayload | TechnicianPayload;

/** One flat shape for the shared form; each kind uses only its own fields. */
type FormValues = {
  type: Kind;
  full_name: string;
  phone: string;
  city: string;
  vehicle_type?: string;
  cans_capacity?: number;
  upi_id?: string;
  bank_account?: string;
  ifsc?: string;
  skills?: string[];
  experience_years?: number;
};

const defaultsFor = (kind: Kind): FormValues =>
  kind === 'supplier'
    ? { type: 'supplier', full_name: '', phone: '', city: SERVICE_CITIES[0], vehicle_type: 'Bike', cans_capacity: 20, upi_id: '', bank_account: '', ifsc: '' }
    : { type: 'technician', full_name: '', phone: '', city: SERVICE_CITIES[0], skills: ['Plumbing'], experience_years: 1 };

type StepDef = { title: string; hint: string; fields: (keyof FormValues)[] };
const STEPS: Record<Kind, StepDef[]> = {
  supplier: [
    { title: 'About you', hint: 'So we can reach you', fields: ['full_name', 'phone', 'city'] },
    { title: 'Your vehicle', hint: 'How you deliver', fields: ['vehicle_type', 'cans_capacity'] },
    { title: 'Payouts', hint: 'Where we send your earnings', fields: ['upi_id', 'bank_account', 'ifsc'] },
  ],
  technician: [
    { title: 'About you', hint: 'So we can reach you', fields: ['full_name', 'phone', 'city'] },
    { title: 'Your skills', hint: 'What you can fix', fields: ['skills', 'experience_years'] },
  ],
};

/** Saved on this device only, and never includes payout details. */
const DRAFT_FIELDS: (keyof FormValues)[] = ['full_name', 'phone', 'city', 'vehicle_type', 'cans_capacity', 'skills', 'experience_years'];
const draftKey = (kind: Kind) => `aurotap:pro-draft:${kind}`;

/* ───────────────────────── Tiers (all marketing numbers come from here) ───────────────────────── */

function tierRows() {
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
type TierRow = ReturnType<typeof tierRows>[number];

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

function buildFaqs(rows: TierRow[]) {
  const first = rows[0];
  const last = rows[rows.length - 1];
  return [
    { q: 'Who can apply?', a: `Water delivery partners with a vehicle, and plumbing or RO technicians, in ${SERVICE_CITIES.slice(0, -1).join(', ')} and ${SERVICE_CITIES[SERVICE_CITIES.length - 1]}.` },
    { q: 'How long does review take?', a: 'We review applications within 24 hours and contact you to verify your details.' },
    { q: 'What do I need to apply?', a: 'Your mobile number, your city, and a UPI ID for payouts. A bank account and IFSC are optional.' },
    { q: 'How do I get paid?', a: 'Your earnings appear in the supplier portal. Request a payout there and our team settles it to the UPI ID or bank account you gave us. Requests are processed by our team, so they are not instant.' },
    { q: 'How do tiers work?', a: `You start as ${first.label} and move up as you complete orders. Each tier lowers your commission (from ${first.commission}% to ${last.commission}% at ${last.label}) and widens your delivery zone.` },
    { q: 'How are orders assigned?', a: 'Orders go to online partners whose delivery zone covers the customer and who have the stock to deliver. You can go online or offline whenever you like from the portal.' },
  ];
}

/* ───────────────────────── Shared styles ───────────────────────── */

const INPUT =
  'w-full min-h-[48px] rounded-xl border border-white/[.14] bg-white/[.06] px-4 py-3 text-base font-medium text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/70 focus:ring-4 focus:ring-cyan-300/15 aria-[invalid=true]:border-rose-400/70';
const CARD = 'rounded-3xl border border-white/10 bg-white/[.035]';
const EYEBROW = 'text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/90';

/* ───────────────────────── Page ───────────────────────── */

export default function RegisterProPage() {
  // useSearchParams must sit under Suspense or the production build fails.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F7FF]" aria-busy="true" />}>
      <RegisterPro />
    </Suspense>
  );
}

function RegisterPro() {
  const router = useRouter();
  const sp = useSearchParams();
  const { hydrated, isLoggedIn } = useAuth();

  const kind: Kind = (sp.get('type') ?? '').toLowerCase() === 'technician' ? 'technician' : 'supplier';
  const loginHref = `/auth/login?returnTo=${encodeURIComponent(`/register/pro?type=${kind}`)}`;

  const rows = useMemo(() => tierRows(), []);
  const faqs = useMemo(() => buildFaqs(rows), [rows]);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const maxRadius = Math.max(...rows.map((r) => r.radius));
  const maxBonus = Math.max(...rows.map((r) => r.bonus));

  /** Returns true when the application was accepted. */
  const submitApplication = useCallback(
    async (values: Payload): Promise<boolean> => {
      if (!isLoggedIn) {
        toast.info('Sign in to submit. Your details are saved on this device.');
        router.push(loginHref);
        return false;
      }
      try {
        const res = await fetch('/api/applications', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
          signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(20_000) : undefined,
        });
        const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; data?: { id?: string } | null };
        if (res.status === 401) {
          router.push(loginHref);
          return false;
        }
        if (!res.ok || json?.success === false) {
          toast.error(json?.error ?? 'Could not submit your application. Please try again.');
          return false;
        }
        toast.success('Application submitted. We will contact you within 24 hours.');
        const id = json.data?.id;
        router.push(id ? `/register/pro/success?id=${encodeURIComponent(id)}` : '/register/pro/success');
        return true;
      } catch (e) {
        const timedOut = e instanceof DOMException && e.name === 'TimeoutError';
        toast.error(timedOut ? 'This is taking too long. Check your connection and try again.' : 'Could not submit your application. Please try again.');
        return false;
      }
    },
    [isLoggedIn, loginHref, router],
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#192A68] text-slate-200">
      <Backdrop />
      <script
        type="application/ld+json"
        // "<" is escaped so the JSON can never close the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          }).replace(/</g, '\\u003c'),
        }}
      />

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-8 sm:pt-12">
        {/* Hero + application */}
        <section className="grid items-start gap-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-12">
          <div>
            <p className={EYEBROW}>Partner with {BRAND}</p>
            <h1 className="mt-4 text-[clamp(2.25rem,6vw,4.1rem)] font-extrabold leading-[1.03] tracking-[-0.035em] text-white">
              Deliver water. Fix pipes. <span className="bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">Earn more every month.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Join {BRAND} as a water delivery supplier or a plumbing and RO technician. Get steady orders near you, keep more of every delivery as you grow, and get paid to your own UPI or bank account.
            </p>

            <a href="#apply" className="mt-7 inline-flex min-h-[48px] items-center rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-500 px-6 font-bold text-[#04121f] shadow-[0_12px_36px_rgba(56,189,248,.28)] transition hover:brightness-110 lg:hidden">
              Apply now
            </a>

            <ul className="mt-8 grid gap-3 sm:grid-cols-3">
              <Stat value={`${first.commission}% → ${last.commission}%`} label="Commission as you grow" />
              <Stat value={`${maxRadius} km`} label="Largest delivery zone" />
              <Stat value={maxBonus ? `Up to ${inr(maxBonus)}` : 'Bonuses'} label="Milestone bonuses" />
            </ul>

            <ul className="mt-6 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              {[
                'Repeat customers are remembered, so good service brings them back to you',
                'Go online or offline whenever you like',
                'Orders arrive only if they are inside your zone and you have stock',
                'Payouts go to the UPI ID or bank account you choose',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div id="apply" className="scroll-mt-6 lg:sticky lg:top-6">
            <ApplicationCard
              kind={kind}
              ready={hydrated}
              signedIn={isLoggedIn}
              loginHref={loginHref}
              onSubmit={submitApplication}
            />
          </div>
        </section>

        <TierLadder rows={rows} />
        <Estimator rows={rows} />

        {/* FAQ */}
        <section aria-labelledby="faq-h" className="mt-16">
          <p className={EYEBROW}>Questions</p>
          <h2 id="faq-h" className="mt-3 text-3xl font-extrabold tracking-tight text-white">Before you apply</h2>
          <div className="mt-6 divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/[.035]">
            {faqs.map((f) => (
              <details key={f.q} className="group px-5 py-4 sm:px-6">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 font-bold text-white [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="text-cyan-300 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-12 text-center text-sm text-slate-400">
          Need help?{' '}
          <Link href="/contact" className="font-semibold text-cyan-300 underline underline-offset-4">Contact support</Link>
        </p>
      </main>
    </div>
  );
}

/* ───────────────────────── Sections ───────────────────────── */

function Backdrop() {
  return (
    <>
      <style>{`
        @keyframes aw-drift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(24px,-18px,0)}}
        .aw-blob{animation:aw-drift 14s ease-in-out infinite}
        @media (prefers-reduced-motion:reduce){.aw-blob{animation:none}}
      `}</style>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[640px] overflow-hidden">
        <div className="aw-blob absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-sky-500/20 blur-[110px]" />
        <div className="aw-blob absolute -right-24 top-10 h-[380px] w-[380px] rounded-full bg-teal-400/15 blur-[110px] [animation-delay:-6s]" />
      </div>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <li className={`${CARD} px-4 py-4`}>
      <p className="text-xl font-extrabold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-400">{label}</p>
    </li>
  );
}

function TierLadder({ rows }: { rows: TierRow[] }) {
  return (
    <section aria-labelledby="tiers-h" className="mt-16">
      <p className={EYEBROW}>Milestones</p>
      <h2 id="tiers-h" className="mt-3 text-3xl font-extrabold tracking-tight text-white">Every delivery moves you up</h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">Complete orders to unlock a wider delivery zone, a lower commission and milestone bonuses.</p>
      <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map((r, i) => (
          <li key={r.tier} className={`${CARD} relative p-5`}>
            <span className="text-xs font-bold text-cyan-300">Step {i + 1}</span>
            <p className="mt-1 text-lg font-extrabold text-white">{r.label}</p>
            <p className="text-xs text-slate-400">{r.orders === 0 ? 'Start here' : `${r.orders}+ orders`}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-400">Zone</dt><dd className="font-bold text-white">{r.radius} km</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Commission</dt><dd className="font-bold text-white">{r.commission}%</dd></div>
              {r.bonus > 0 && <div className="flex justify-between"><dt className="text-slate-400">Bonus</dt><dd className="font-bold text-teal-300">{inr(r.bonus)}</dd></div>}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Estimator({ rows }: { rows: TierRow[] }) {
  const [cans, setCans] = useState(30);
  const [price, setPrice] = useState(40);
  const first = rows[0];
  const last = rows[rows.length - 1];

  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  const monthly = cans * safePrice * DELIVERY_DAYS;
  const take = (commission: number) => monthly * (1 - commission / 100);
  const gain = take(last.commission) - take(first.commission);

  return (
    <section aria-labelledby="calc-h" className="mt-16">
      <div className={`${CARD} grid gap-8 p-6 sm:p-8 lg:grid-cols-2`}>
        <div>
          <p className={EYEBROW}>Earnings estimator</p>
          <h2 id="calc-h" className="mt-3 text-3xl font-extrabold tracking-tight text-white">See what growing is worth</h2>
          <p className="mt-2 text-sm leading-7 text-slate-300">Enter your own numbers. This is an estimate based on the commission for each tier, not a promise of orders.</p>

          <label htmlFor="calc-cans" className="mt-6 flex justify-between text-sm font-bold text-white">
            Cans delivered per day <span className="text-cyan-300">{cans}</span>
          </label>
          <input id="calc-cans" type="range" min={5} max={200} step={5} value={cans} onChange={(e) => setCans(Number(e.target.value))} className="mt-2 h-2 w-full cursor-pointer accent-cyan-300" />

          <label htmlFor="calc-price" className="mt-6 block text-sm font-bold text-white">Your price per can (₹)</label>
          <input id="calc-price" type="number" inputMode="decimal" min={1} max={1000} value={Number.isFinite(price) ? price : ''} onChange={(e) => setPrice(e.target.valueAsNumber)} className={`${INPUT} mt-2 max-w-[180px]`} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#07162B] p-6" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Monthly, after commission ({DELIVERY_DAYS} delivery days)</p>
          <dl className="mt-4 space-y-4">
            <div className="flex items-baseline justify-between"><dt className="text-sm text-slate-300">As {first.label} ({first.commission}%)</dt><dd className="text-2xl font-extrabold text-white">{inr(take(first.commission))}</dd></div>
            <div className="flex items-baseline justify-between"><dt className="text-sm text-slate-300">As {last.label} ({last.commission}%)</dt><dd className="text-2xl font-extrabold text-teal-300">{inr(take(last.commission))}</dd></div>
          </dl>
          <p className="mt-5 rounded-xl bg-teal-400/10 px-4 py-3 text-sm font-semibold text-teal-200">
            {gain > 0 ? `${inr(gain)} more every month at ${last.label}, on the same deliveries.` : 'Enter a price to see the difference.'}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Application form ───────────────────────── */

function ApplicationCard({
  kind, ready, signedIn, loginHref, onSubmit,
}: {
  kind: Kind;
  ready: boolean;
  signedIn: boolean;
  loginHref: string;
  onSubmit: (v: Payload) => Promise<boolean>;
}) {
  const tab = (k: Kind, label: string) => (
    <Link
      href={`/register/pro?type=${k}`}
      scroll={false}
      replace
      aria-current={kind === k ? 'page' : undefined}
      className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-4 text-sm font-bold transition ${kind === k ? 'bg-sky-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#0B1322]/95 p-5 shadow-[0_30px_90px_rgba(0,0,0,.35)] sm:p-7">
      <nav aria-label="Application type" className="flex gap-1 rounded-2xl border border-white/10 bg-white/[.04] p-1">
        {tab('supplier', 'Water supplier')}
        {tab('technician', 'Technician')}
      </nav>
      <h2 className="mt-5 text-xl font-extrabold text-white">{kind === 'supplier' ? 'Supplier application' : 'Technician application'}</h2>
      <p className="mt-1 text-sm text-slate-400">
        {ready && !signedIn ? (
          <>It takes about two minutes. You will sign in at the end. <Link href={loginHref} className="font-semibold text-cyan-300 underline underline-offset-4">Sign in now</Link></>
        ) : (
          'It takes about two minutes. We review within 24 hours.'
        )}
      </p>
      <ApplicationForm key={kind} kind={kind} ready={ready} onSubmit={onSubmit} />
    </div>
  );
}

function ApplicationForm({ kind, ready, onSubmit }: { kind: Kind; ready: boolean; onSubmit: (v: Payload) => Promise<boolean> }) {
  const steps = STEPS[kind];
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const uid = useId();

  const resolver = zodResolver(kind === 'supplier' ? supplierSchema : technicianSchema) as unknown as Resolver<FormValues>;
  const form = useForm<FormValues>({ resolver, defaultValues: defaultsFor(kind), mode: 'onTouched' });
  const { register, formState: { errors, isSubmitting }, setValue, watch, trigger, reset } = form;

  // Restore a saved draft (non-sensitive fields only) after the first paint.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(kind));
      if (raw) reset({ ...defaultsFor(kind), ...(JSON.parse(raw) as Partial<FormValues>) });
    } catch { /* storage unavailable or corrupt: start fresh */ }
  }, [kind, reset]);

  // Save a draft as the user types.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = watch((values) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const draft: Partial<FormValues> = {};
          for (const f of DRAFT_FIELDS) if (values[f] !== undefined) (draft as Record<string, unknown>)[f] = values[f];
          localStorage.setItem(draftKey(kind), JSON.stringify(draft));
          setSaved(true);
        } catch { /* ignore */ }
      }, 500);
    });
    return () => { clearTimeout(timer); sub.unsubscribe(); };
  }, [kind, watch]);

  // Move focus to the new step heading so screen-reader and keyboard users know where they are.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);

  const isLast = step === steps.length - 1;
  const current = steps[step];

  const next = async () => {
    if (await trigger(current.fields as never)) setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const submit = form.handleSubmit(async (values) => {
    const ok = await onSubmit(values as unknown as Payload);
    if (ok) { try { localStorage.removeItem(draftKey(kind)); } catch { /* ignore */ } }
  });

  const err = (name: keyof FormValues) => errors[name]?.message as string | undefined;
  const id = (name: string) => `${uid}-${name}`;
  const a11y = (name: keyof FormValues) => ({ id: id(name), 'aria-invalid': err(name) ? true : undefined, 'aria-describedby': err(name) ? `${id(name)}-err` : undefined });

  const phoneReg = register('phone');
  const skills = watch('skills') ?? [];

  return (
    <form
      noValidate
      className="mt-6"
      onSubmit={(e) => {
        if (!isLast) { e.preventDefault(); void next(); return; } // Enter advances instead of submitting early
        void submit(e);
      }}
    >
      {/* Progress */}
      <ol className="flex gap-2" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s.title} aria-current={i === step ? 'step' : undefined} className="flex-1">
            <div className={`h-1.5 rounded-full transition-colors ${i <= step ? 'bg-cyan-300' : 'bg-white/10'}`} />
            <span className={`mt-2 block text-[11px] font-bold uppercase tracking-wider ${i === step ? 'text-cyan-300' : 'text-slate-500'}`}>{s.title}</span>
          </li>
        ))}
      </ol>

      <h3 ref={headingRef} tabIndex={-1} className="mt-6 text-lg font-bold text-white outline-none">
        {current.title} <span className="font-medium text-slate-400">· {current.hint}</span>
      </h3>

      <div className="mt-4 grid gap-4">
        {step === 0 && (
          <>
            <Field label="Full name" htmlFor={id('full_name')} error={err('full_name')}>
              <input {...register('full_name')} {...a11y('full_name')} className={INPUT} autoComplete="name" placeholder="Your name" />
            </Field>
            <Field label="Mobile number" htmlFor={id('phone')} error={err('phone')} hint="We verify on WhatsApp">
              <input
                {...phoneReg}
                {...a11y('phone')}
                className={INPUT}
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="10-digit mobile number"
                maxLength={10}
                onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); return phoneReg.onChange(e); }}
              />
            </Field>
            <Field label="City" htmlFor={id('city')} error={err('city')}>
              <select {...register('city')} {...a11y('city')} className={INPUT}>
                {SERVICE_CITIES.map((c) => <option key={c} value={c} className="text-black">{c}</option>)}
              </select>
            </Field>
          </>
        )}

        {kind === 'supplier' && step === 1 && (
          <>
            <Field label="Vehicle" htmlFor={id('vehicle_type')} error={err('vehicle_type')}>
              <select {...register('vehicle_type')} {...a11y('vehicle_type')} className={INPUT}>
                {VEHICLES.map((v) => <option key={v} value={v} className="text-black">{v}</option>)}
              </select>
            </Field>
            <Field label="Cans you can carry" htmlFor={id('cans_capacity')} error={err('cans_capacity')}>
              <input type="number" min={1} max={500} inputMode="numeric" {...register('cans_capacity', { valueAsNumber: true })} {...a11y('cans_capacity')} className={INPUT} />
            </Field>
          </>
        )}

        {kind === 'supplier' && step === 2 && (
          <>
            <Field label="UPI ID" htmlFor={id('upi_id')} error={err('upi_id')} hint="Payouts are sent here">
              <input {...register('upi_id')} {...a11y('upi_id')} className={INPUT} autoComplete="off" autoCapitalize="none" placeholder="name@bank" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bank account (optional)" htmlFor={id('bank_account')} error={err('bank_account')}>
                <input {...register('bank_account')} {...a11y('bank_account')} className={INPUT} autoComplete="off" inputMode="numeric" placeholder="Account number" />
              </Field>
              <Field label="IFSC (optional)" htmlFor={id('ifsc')} error={err('ifsc')}>
                <input {...register('ifsc')} {...a11y('ifsc')} className={`${INPUT} uppercase`} autoComplete="off" autoCapitalize="characters" maxLength={11} placeholder="HDFC0001234" />
              </Field>
            </div>
            <p className="text-xs leading-5 text-slate-500">Payout details are never saved in your browser draft.</p>
          </>
        )}

        {kind === 'technician' && step === 1 && (
          <>
            <fieldset aria-describedby={err('skills') ? `${id('skills')}-err` : undefined}>
              <legend className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Skills</legend>
              <div className="grid grid-cols-2 gap-2">
                {SKILLS.map((s) => {
                  const on = skills.includes(s);
                  return (
                    <label key={s} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-4 text-sm font-semibold transition ${on ? 'border-cyan-300/60 bg-cyan-300/10 text-white' : 'border-white/[.14] bg-white/[.04] text-slate-300'}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        className="h-4 w-4 accent-cyan-300"
                        onChange={(e) => setValue('skills', e.target.checked ? [...skills, s] : skills.filter((x) => x !== s), { shouldValidate: true, shouldDirty: true })}
                      />
                      {s}
                    </label>
                  );
                })}
              </div>
              {err('skills') && <p id={`${id('skills')}-err`} role="alert" className="mt-2 text-sm font-semibold text-rose-300">{err('skills')}</p>}
            </fieldset>
            <Field label="Years of experience" htmlFor={id('experience_years')} error={err('experience_years')}>
              <input type="number" min={0} max={60} inputMode="numeric" {...register('experience_years', { valueAsNumber: true })} {...a11y('experience_years')} className={INPUT} />
            </Field>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="min-h-[52px] rounded-2xl border border-white/15 px-5 font-bold text-slate-200 transition hover:bg-white/5">
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting || (isLast && !ready)}
          className="min-h-[52px] flex-1 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-600 font-extrabold text-[#04121f] shadow-[0_12px_32px_rgba(37,99,235,.3)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Submitting…' : isLast ? 'Submit application' : 'Continue'}
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-slate-500" aria-live="polite">
        {saved ? 'Draft saved on this device. ' : ''}By submitting you agree to be contacted on WhatsApp for verification.
      </p>
    </form>
  );
}

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 flex items-baseline justify-between gap-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
        {label}
        {hint && <span className="text-[11px] font-medium normal-case tracking-normal text-slate-500">{hint}</span>}
      </label>
      {children}
      {error && <p id={`${htmlFor}-err`} role="alert" className="mt-2 text-sm font-semibold text-rose-300">{error}</p>}
    </div>
  );
}











// 'use client';

// import React from 'react';
// import Link from 'next/link';
// import { useRouter, useSearchParams } from 'next/navigation';
// import { toast } from 'sonner';
// import { z } from 'zod';
// import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import type { Resolver } from 'react-hook-form';

// import { MILESTONE_TIERS, type MilestoneTier } from '@/lib/milestone-constants';
// import { useAuth } from '@/hooks/useAuth';

// const UP_CITIES = [
//   'Kanpur',
//   'Gorakhpur',
//   'Lucknow',
//   'Varanasi',
//   'Prayagraj',
//   'Agra',
//   'Meerut',
//   'Bareilly',
//   'Aligarh',
//   'Mathura',
//   'Delhi',
//   'Noida',
//   'Ghaziabad',
// ] as const;

// const baseSchema = z.object({
//   full_name: z.string().min(2, 'Full name is required'),
//   phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
//   city: z.enum(UP_CITIES, { message: 'City is required' }),
// });

// const supplierSchema = baseSchema.extend({
//   type: z.literal('supplier'),
//   vehicle_type: z.enum(['Cycle', 'Bike', 'Auto', 'Mini-truck'], { message: 'Vehicle type is required' }),
//   cans_capacity: z.coerce.number().int().min(1, 'Capacity is required'),
//   upi_id: z.string().min(3, 'UPI ID is required'),
//   bank_account: z.string().optional(),
//   ifsc: z.string().optional(),
// });

// const technicianSchema = baseSchema.extend({
//   type: z.literal('technician'),
//   skills: z.array(z.enum(['Plumbing', 'RO Install', 'Boring', 'Maintenance'])).min(1, 'Pick at least 1 skill'),
//   experience_years: z.coerce.number().int().min(0, 'Experience is required'),
// });

// type SupplierForm = z.infer<typeof supplierSchema>;
// type TechnicianForm = z.infer<typeof technicianSchema>;
// type ProForm = SupplierForm | TechnicianForm;

// function tierRows(): Array<{
//   tier: MilestoneTier;
//   orders: number;
//   radius: number;
//   commission: number;
//   bonus: number;
//   label: string;
// }> {
//   const tiers: MilestoneTier[] = ['starter', 'bronze', 'silver', 'gold', 'platinum'];
//   return tiers.map((t) => ({
//     tier: t,
//     orders: MILESTONE_TIERS[t].min,
//     radius: MILESTONE_TIERS[t].radius,
//     commission: MILESTONE_TIERS[t].commission,
//     bonus: Number(MILESTONE_TIERS[t].bonus ?? 0),
//     label: MILESTONE_TIERS[t].label,
//   }));
// }

// export default function RegisterProPage() {
//   const router = useRouter();
//   const sp = useSearchParams();
//   const { hydrated, isLoggedIn } = useAuth();

//   const typeParam = (sp.get('type') ?? 'supplier').toLowerCase();
//   const kind: ProForm['type'] = typeParam === 'technician' ? 'technician' : 'supplier';

//   const submitApplication = async (values: ProForm) => {
//     if (!isLoggedIn) {
//       router.push(`/auth/login?returnTo=${encodeURIComponent(`/register/pro?type=${kind}`)}`);
//       return;
//     }
//     try {
//       const res = await fetch('/api/applications', {
//         method: 'POST',
//         credentials: 'include',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(values),
//       });
//       const json = (await res.json()) as { success?: boolean; error?: string; data?: { id?: string } | null };
//       if (res.status === 401) {
//         router.push(`/auth/login?returnTo=${encodeURIComponent(`/register/pro?type=${kind}`)}`);
//         return;
//       }
//       if (!res.ok || json?.success === false) {
//         toast.error(json?.error ?? 'Could not submit application.');
//         return;
//       }
//       toast.success('Application submitted successfully.');
//       const applicationId = json.data?.id;
//       router.push(
//         applicationId
//           ? `/register/pro/success?id=${encodeURIComponent(applicationId)}`
//           : '/register/pro/success',
//       );
//     } catch (e: unknown) {
//       toast.error(e instanceof Error ? e.message : 'Could not submit application.');
//     }
//   };

//   return (
//     <div
//       className="min-h-screen overflow-x-hidden px-4 py-6 sm:py-10"
//       style={{
//         background:
//           'radial-gradient(circle at 10% 0%, rgba(14,165,233,.16), transparent 30%), radial-gradient(circle at 90% 10%, rgba(20,184,166,.12), transparent 28%), #050B18',
//         color: '#E5E7EB',
//       }}
//     >
//       <div className="mx-auto max-w-6xl">
//         <div className="overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-[#081D36] via-[#07162B] to-[#050B18] p-6 shadow-[0_30px_100px_rgba(0,0,0,.32)] sm:p-9 md:p-10">
//           <p className="text-xs font-bold tracking-[0.22em] uppercase text-sky-300/80">Partner with AuroWater</p>
//           <h1 className="mt-4 max-w-3xl text-[clamp(2.2rem,6vw,4rem)] font-black leading-[1.02] tracking-[-0.035em] aw-heading">
//             Grow your water business with AuroWater
//           </h1>
//           <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
//             Keep your customers. Earn more per delivery. Expand your area automatically.
//           </p>

//           <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
//             {[
//               '🔒 Your customers stay yours',
//               '📈 Commission drops from 8% → 4%',
//               '🗺 Unlock up to 20km delivery zone',
//             ].map((t) => (
//               <div key={t} className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3.5 text-sm font-bold text-slate-100 transition hover:border-cyan-300/20 hover:bg-white/[0.07]">
//                 {t}
//               </div>
//             ))}
//           </div>

//           <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
//             {[
//               { icon: '🔁', title: 'Repeat customers always assigned to you first' },
//               { icon: '🏅', title: 'Reach Bronze at 50 orders → unlock 8km zone + lower commission' },
//               { icon: '💰', title: 'Milestone bonuses: ₹500 at Gold, ₹1000 at Platinum' },
//             ].map((c) => (
//               <div key={c.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition hover:border-cyan-300/20 hover:bg-white/[0.05]">
//                 <div className="text-2xl">{c.icon}</div>
//                 <div className="mt-3 text-sm font-extrabold text-white">{c.title}</div>
//               </div>
//             ))}
//           </div>

//           <details className="mt-6 rounded-2xl border border-white/10 bg-white/5">
//             <summary className="cursor-pointer select-none px-5 py-4 font-bold text-white">
//               Milestones & rewards (tap to expand)
//             </summary>
//             <div className="px-5 pb-5 overflow-x-auto">
//               <table className="min-w-[620px] w-full text-sm">
//                 <thead>
//                   <tr className="text-left text-slate-300">
//                     <th className="py-2 pr-4">Tier</th>
//                     <th className="py-2 pr-4">Orders</th>
//                     <th className="py-2 pr-4">Zone</th>
//                     <th className="py-2 pr-4">Commission</th>
//                     <th className="py-2 pr-4">Bonus</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {tierRows().map((r) => (
//                     <tr key={r.tier} className="border-t border-white/10">
//                       <td className="py-2 pr-4 font-bold text-white">{r.label}</td>
//                       <td className="py-2 pr-4 text-slate-200">{r.orders}+</td>
//                       <td className="py-2 pr-4 text-slate-200">{r.radius}km</td>
//                       <td className="py-2 pr-4 text-slate-200">{r.commission}%</td>
//                       <td className="py-2 pr-4 text-slate-200">{r.bonus ? `₹${r.bonus.toLocaleString('en-IN')}` : '—'}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </details>
//         </div>

//         <div className="mt-7 overflow-hidden rounded-[28px] border border-white/10 bg-[#0B1322] p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] sm:p-7 md:p-8">
//           <div className="flex items-start justify-between flex-wrap gap-3">
//             <div>
//               <h2 className="text-xl font-extrabold text-white">
//                 {kind === 'supplier' ? 'Supplier application' : 'Technician application'}
//               </h2>
//               <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500 sm:text-sm">
//                 {hydrated && !isLoggedIn ? (
//                   <>
//                     You’ll be asked to sign in after you fill the form.
//                     <span className="ml-2">
//                       <Link href={`/auth/login?returnTo=${encodeURIComponent(`/register/pro?type=${kind}`)}`} className="underline font-semibold text-sky-300">
//                         Sign in
//                       </Link>
//                     </span>
//                   </>
//                 ) : (
//                   'Submit once. We review within 24 hours.'
//                 )}
//               </p>
//             </div>
//             <div className="flex gap-2">
//               <Link
//                 href="/register/pro?type=supplier"
//                 className={`rounded-xl px-4 py-2 text-sm font-bold border ${kind === 'supplier' ? 'bg-sky-600 text-white border-sky-400/30' : 'bg-transparent text-slate-200 border-white/10'}`}
//               >
//                 Supplier
//               </Link>
//               <Link
//                 href="/register/pro?type=technician"
//                 className={`rounded-xl px-4 py-2 text-sm font-bold border ${kind === 'technician' ? 'bg-sky-600 text-white border-sky-400/30' : 'bg-transparent text-slate-200 border-white/10'}`}
//               >
//                 Technician
//               </Link>
//             </div>
//           </div>

//           {kind === 'supplier' ? (
//             <SupplierFormView
//               key="supplier"
//               onSubmit={(v) => submitApplication(v)}
//             />
//           ) : (
//             <TechnicianFormView
//               key="technician"
//               onSubmit={(v) => submitApplication(v)}
//             />
//           )}

//           <style>{`
//             .aw-input{
//               width:100%;
//               background: rgba(255,255,255,0.06);
//               border: 1px solid rgba(255,255,255,0.12);
//               border-radius: 14px;
//               padding: 12px 14px;
//               color: #fff;
//               font-weight: 600;
//               outline: none;
//             }
//             .aw-input:focus{
//               border-color: rgba(56,189,248,0.7);
//               box-shadow: 0 0 0 3px rgba(56,189,248,0.15);
//             }
//           `}</style>
//         </div>

//         <p className="mt-8 text-center text-sm text-slate-300/80">
//           Need help?{' '}
//           <Link href="/contact" className="font-semibold text-sky-300 underline">
//             Contact support
//           </Link>
//         </p>
//       </div>
//     </div>
//   );
// }

// function Field({
//   label,
//   error,
//   children,
// }: {
//   label: string;
//   error?: string;
//   children: React.ReactNode;
// }) {
//   return (
//     <label className="block">
//       <div className="text-xs font-bold tracking-[0.18em] uppercase text-slate-300/80 mb-2">
//         {label}
//       </div>
//       {children}
//       {error ? <div className="mt-2 text-sm font-semibold text-rose-300">{error}</div> : null}
//     </label>
//   );
// }

// function SupplierFormView({ onSubmit }: { onSubmit: (v: SupplierForm) => Promise<void> }) {
//   const form = useForm<SupplierForm>({
//     resolver: zodResolver(supplierSchema) as unknown as Resolver<SupplierForm>,
//     defaultValues: {
//       type: 'supplier',
//       full_name: '',
//       phone: '',
//       city: UP_CITIES[0],
//       vehicle_type: 'Bike',
//       cans_capacity: 20,
//       upi_id: '',
//       bank_account: '',
//       ifsc: '',
//     },
//     mode: 'onBlur',
//   });

//   const submitting = form.formState.isSubmitting;

//   return (
//     <form className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={form.handleSubmit(onSubmit)}>
//       <input type="hidden" value="supplier" {...form.register('type')} />

//       <Field label="Full name" error={form.formState.errors.full_name?.message}>
//         <input className="aw-input" placeholder="Your name" {...form.register('full_name')} />
//       </Field>

//       <Field label="Phone" error={form.formState.errors.phone?.message}>
//         <input
//           className="aw-input"
//           inputMode="numeric"
//           placeholder="10-digit phone"
//           {...form.register('phone')}
//           onChange={(e) => form.setValue('phone', e.target.value.replace(/\D/g, '').slice(0, 10), { shouldValidate: true })}
//         />
//       </Field>

//       <Field label="City" error={form.formState.errors.city?.message}>
//         <select className="aw-input" {...form.register('city')}>
//           {UP_CITIES.map((c) => (
//             <option key={c} value={c}>
//               {c}
//             </option>
//           ))}
//         </select>
//       </Field>

//       <Field label="Vehicle type" error={form.formState.errors.vehicle_type?.message}>
//         <select className="aw-input" {...form.register('vehicle_type')}>
//           {(['Cycle', 'Bike', 'Auto', 'Mini-truck'] as const).map((v) => (
//             <option key={v} value={v}>
//               {v}
//             </option>
//           ))}
//         </select>
//       </Field>

//       <Field label="Cans capacity" error={form.formState.errors.cans_capacity?.message}>
//         <input className="aw-input" type="number" min={1} {...form.register('cans_capacity', { valueAsNumber: true })} />
//       </Field>

//       <Field label="UPI ID (for payouts)" error={form.formState.errors.upi_id?.message}>
//         <input className="aw-input" placeholder="name@upi" {...form.register('upi_id')} />
//       </Field>

//       <Field label="Bank account (optional)" error={undefined}>
//         <input className="aw-input" placeholder="Account number" {...form.register('bank_account')} />
//       </Field>

//       <Field label="IFSC (optional)" error={undefined}>
//         <input className="aw-input" placeholder="IFSC" {...form.register('ifsc')} />
//       </Field>

//       <div className="md:col-span-2 mt-2">
//         <button
//           type="submit"
//           disabled={submitting}
//           className="w-full rounded-2xl py-4 font-extrabold text-white"
//           style={{
//             background: 'linear-gradient(135deg,#67E8F9,#38BDF8 45%,#2563EB)',
//             boxShadow: '0 10px 30px rgba(37,99,235,0.25)',
//             opacity: submitting ? 0.7 : 1,
//           }}
//         >
//           {submitting ? 'Submitting…' : 'Submit application'}
//         </button>
//         <p className="mt-3 text-center text-xs text-slate-300/80">
//           By submitting, you agree to be contacted on WhatsApp for verification.
//         </p>
//       </div>
//     </form>
//   );
// }

// function TechnicianFormView({ onSubmit }: { onSubmit: (v: TechnicianForm) => Promise<void> }) {
//   const form = useForm<TechnicianForm>({
//     resolver: zodResolver(technicianSchema) as unknown as Resolver<TechnicianForm>,
//     defaultValues: {
//       type: 'technician',
//       full_name: '',
//       phone: '',
//       city: UP_CITIES[0],
//       skills: ['Plumbing'],
//       experience_years: 1,
//     },
//     mode: 'onBlur',
//   });

//   const submitting = form.formState.isSubmitting;
//   const skills = form.watch('skills');

//   return (
//     <form className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={form.handleSubmit(onSubmit)}>
//       <input type="hidden" value="technician" {...form.register('type')} />

//       <Field label="Full name" error={form.formState.errors.full_name?.message}>
//         <input className="aw-input" placeholder="Your name" {...form.register('full_name')} />
//       </Field>

//       <Field label="Phone" error={form.formState.errors.phone?.message}>
//         <input
//           className="aw-input"
//           inputMode="numeric"
//           placeholder="10-digit phone"
//           {...form.register('phone')}
//           onChange={(e) => form.setValue('phone', e.target.value.replace(/\D/g, '').slice(0, 10), { shouldValidate: true })}
//         />
//       </Field>

//       <Field label="City" error={form.formState.errors.city?.message}>
//         <select className="aw-input" {...form.register('city')}>
//           {UP_CITIES.map((c) => (
//             <option key={c} value={c}>
//               {c}
//             </option>
//           ))}
//         </select>
//       </Field>

//       <Field label="Skills" error={form.formState.errors.skills?.message}>
//         <div className="grid grid-cols-2 gap-2">
//           {(['Plumbing', 'RO Install', 'Boring', 'Maintenance'] as const).map((s) => {
//             const checked = skills.includes(s);
//             return (
//               <label
//                 key={s}
//                 className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 flex items-center gap-2"
//               >
//                 <input
//                   type="checkbox"
//                   checked={checked}
//                   onChange={(e) => {
//                     const next = e.target.checked ? [...skills, s] : skills.filter((x) => x !== s);
//                     form.setValue('skills', next, { shouldValidate: true });
//                   }}
//                 />
//                 {s}
//               </label>
//             );
//           })}
//         </div>
//       </Field>

//       <Field label="Experience (years)" error={form.formState.errors.experience_years?.message}>
//         <input className="aw-input" type="number" min={0} {...form.register('experience_years', { valueAsNumber: true })} />
//       </Field>

//       <div className="md:col-span-2 mt-2">
//         <button
//           type="submit"
//           disabled={submitting}
//           className="w-full rounded-2xl py-4 font-extrabold text-white"
//           style={{
//             background: 'linear-gradient(135deg,#14B8A6,#2563EB)',
//             boxShadow: '0 10px 30px rgba(37,99,235,0.25)',
//             opacity: submitting ? 0.7 : 1,
//           }}
//         >
//           {submitting ? 'Submitting…' : 'Submit application'}
//         </button>
//         <p className="mt-3 text-center text-xs text-slate-300/80">
//           By submitting, you agree to be contacted on WhatsApp for verification.
//         </p>
//       </div>
//     </form>
//   );
// }
