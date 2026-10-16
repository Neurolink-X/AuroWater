'use client';

import { Suspense, memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
const UPI_SUFFIXES = ['@ybl', '@oksbi', '@paytm', '@okaxis', '@upi'] as const;
const SUCCESS_PATH = '/register/pro/success';

const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile numbers
const UPI_RE = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/i;
const ACCOUNT_RE = /^\d{9,18}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

type Kind = 'supplier' | 'technician';

/** Set to true once /api/applications accepts a `role` field. Until then the role only shapes the UI and presets. */
const SEND_ROLE = false;

type RoleId = 'can' | 'tanker' | 'plumber' | 'borewell' | 'tank' | 'ro';
const ROLE_IDS = ['can', 'tanker', 'plumber', 'borewell', 'tank', 'ro'] as const;

type RoleDef = {
  kind: Kind; label: string; icon: string; blurb: string; needs: string;
  unit: string; qty: number; qtyMax: number; qtyStep: number; price: number; priceMax: number;
  vehicle?: string; cans?: number; skills?: string[];
};

/** Each role maps onto an existing application type, so the API payload stays valid. */
const ROLES: Record<RoleId, RoleDef> = {
  can: { kind: 'supplier', label: 'Water can delivery', icon: '💧', blurb: 'Deliver water cans to homes, shops and offices near you.', needs: 'A cycle, bike or auto, and a UPI ID', unit: 'can', qty: 30, qtyMax: 200, qtyStep: 5, price: 40, priceMax: 1000, vehicle: 'Bike', cans: 20 },
  tanker: { kind: 'supplier', label: 'Water tanker', icon: '🚚', blurb: 'Supply bulk water to societies, building sites and businesses.', needs: 'A mini-truck or tanker, and a UPI ID', unit: 'trip', qty: 4, qtyMax: 30, qtyStep: 1, price: 800, priceMax: 20000, vehicle: 'Mini-truck', cans: 100 },
  plumber: { kind: 'technician', label: 'Plumber', icon: '🔧', blurb: 'Fix leaks, fit pipes and taps, and handle bathroom and kitchen work.', needs: 'Just your skills and experience', unit: 'job', qty: 4, qtyMax: 20, qtyStep: 1, price: 400, priceMax: 20000, skills: ['Plumbing'] },
  borewell: { kind: 'technician', label: 'Borewell and boring', icon: '⛏️', blurb: 'Drill and service borewells and handle pump and motor work.', needs: 'Your boring skills and experience', unit: 'job', qty: 1, qtyMax: 5, qtyStep: 1, price: 5000, priceMax: 100000, skills: ['Boring'] },
  tank: { kind: 'technician', label: 'Tank cleaning', icon: '🧽', blurb: 'Clean and maintain overhead and underground water tanks.', needs: 'Your maintenance skills and experience', unit: 'job', qty: 3, qtyMax: 15, qtyStep: 1, price: 600, priceMax: 20000, skills: ['Maintenance'] },
  ro: { kind: 'technician', label: 'RO install and service', icon: '🚰', blurb: 'Install, repair and service RO water purifiers.', needs: 'Your RO skills and experience', unit: 'job', qty: 4, qtyMax: 20, qtyStep: 1, price: 500, priceMax: 20000, skills: ['RO Install'] },
};
const FEATURED_ROLE: RoleId = 'plumber'; // needs no vehicle and no payout details, so it is the quickest to start

/* ───────────────────────── Validation (unchanged behaviour) ───────────────────────── */

const baseShape = {
  full_name: z.string().trim().min(2, 'Enter your full name').max(80, 'Name is too long'),
  phone: z.string().regex(PHONE_RE, 'Enter a valid 10-digit mobile number'),
  city: z.enum(SERVICE_CITIES, { message: 'Choose your city' }),
  role: z.enum(ROLE_IDS),
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
  role: RoleId;
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

const defaultsFor = (role: RoleId): FormValues => {
  const r = ROLES[role];
  return r.kind === 'supplier'
    ? { type: 'supplier', role, full_name: '', phone: '', city: SERVICE_CITIES[0], vehicle_type: r.vehicle, cans_capacity: r.cans, upi_id: '', bank_account: '', ifsc: '' }
    : { type: 'technician', role, full_name: '', phone: '', city: SERVICE_CITIES[0], skills: r.skills, experience_years: 1 };
};

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
const draftKey = (role: RoleId) => `aurotap:pro-draft:${role}`;

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
    { q: 'Who can apply?', a: `Water can and tanker suppliers with a vehicle, plus plumbers, borewell and boring crews, tank cleaners and RO technicians, in ${SERVICE_CITIES.slice(0, -1).join(', ')} and ${SERVICE_CITIES[SERVICE_CITIES.length - 1]}.` },
    { q: 'Which role should I choose?', a: 'Pick the work you already do. Water can and tanker roles need a vehicle and a UPI ID. Plumber, borewell, tank cleaning and RO roles need no vehicle: only your skills and experience.' },
    { q: 'How long does review take?', a: 'We review applications within 24 hours and contact you to verify your details.' },
    { q: 'What do I need to apply?', a: 'Your mobile number, your city, and a UPI ID for payouts. A bank account and IFSC are optional.' },
    { q: 'How do I get paid?', a: 'Your earnings appear in the supplier portal. Request a payout there and our team settles it to the UPI ID or bank account you gave us. Requests are processed by our team, so they are not instant.' },
    { q: 'How do tiers work?', a: `You start as ${first.label} and move up as you complete orders. Each tier lowers your commission (from ${first.commission}% to ${last.commission}% at ${last.label}) and widens your delivery zone.` },
    { q: 'How are orders assigned?', a: 'Orders go to online partners whose delivery zone covers the customer and who have the stock to deliver. You can go online or offline whenever you like from the portal.' },
  ];
}

/* ───────────────────────── Neumorphic design tokens ─────────────────────────
   Base surface #E3EDF6 (pale water). Light source top-left:
   dark shadow #B7C8D9, highlight #FFFFFF. Accent: deep aqua. */

const RAISED = 'shadow-[9px_9px_18px_#b7c8d9,-9px_-9px_18px_#ffffff]';
const RAISED_SM = 'shadow-[5px_5px_10px_#b7c8d9,-5px_-5px_10px_#ffffff]';
const INSET = 'shadow-[inset_5px_5px_10px_#b7c8d9,inset_-5px_-5px_10px_#ffffff]';
const PRESS = 'active:shadow-[inset_4px_4px_8px_#b7c8d9,inset_-4px_-4px_8px_#ffffff]';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/40';

const INPUT = `w-full min-h-[48px] rounded-2xl border-0 bg-[#E3EDF6] ${INSET} px-4 py-3 text-base font-medium text-slate-800 placeholder:text-slate-400 outline-none transition focus:ring-4 focus:ring-sky-500/30 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rose-400/70`;
const CARD = `rounded-3xl bg-[#E3EDF6] ${RAISED}`;
const EYEBROW = 'text-sm font-bold text-sky-700';
const H2 = 'mt-2 text-3xl font-extrabold tracking-tight text-[#0B2A4A]';
const BTN = `inline-flex min-h-[52px] items-center justify-center rounded-2xl font-extrabold transition ${FOCUS}`;
const BTN_PRIMARY = `${BTN} bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-[6px_6px_14px_#b7c8d9,-6px_-6px_14px_#ffffff] hover:brightness-110 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60`;
const BTN_SOFT = `${BTN} bg-[#E3EDF6] text-slate-700 ${RAISED_SM} ${PRESS}`;

/* ───────────────────────── Page ───────────────────────── */

export default function RegisterProPage() {
  // useSearchParams must sit under Suspense or the production build fails.
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#E3EDF6]" aria-busy="true" />}>
      <RegisterPro />
    </Suspense>
  );
}

function RegisterPro() {
  const router = useRouter();
  const sp = useSearchParams();
  const { hydrated, isLoggedIn } = useAuth();
  const [showBar, setShowBar] = useState(false);

  const roleParam = (sp.get('role') ?? '').toLowerCase();
  const legacyType = (sp.get('type') ?? '').toLowerCase(); // keeps old ?type= links working
  const role: RoleId = (ROLE_IDS as readonly string[]).includes(roleParam) ? (roleParam as RoleId) : legacyType === 'technician' ? 'plumber' : 'can';
  const kind: Kind = ROLES[role].kind;
  const loginHref = `/auth/login?returnTo=${encodeURIComponent(`/register/pro?role=${role}`)}`;

  const rows = useMemo(() => tierRows(), []);
  const faqs = useMemo(() => buildFaqs(rows), [rows]);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const maxRadius = Math.max(...rows.map((r) => r.radius));
  const maxBonus = Math.max(...rows.map((r) => r.bonus));

  // Warm the success route so the redirect after submit feels instant.
  useEffect(() => { router.prefetch(SUCCESS_PATH); }, [router]);

  // Show a sticky "Apply" bar on mobile while the form is off-screen.
  useEffect(() => {
    const el = document.getElementById('apply');
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

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
          body: JSON.stringify(SEND_ROLE ? values : Object.fromEntries(Object.entries(values).filter(([k]) => k !== 'role'))),
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
        router.push(id ? `${SUCCESS_PATH}?id=${encodeURIComponent(id)}` : SUCCESS_PATH);
        return true;
      } catch (e) {
        const timedOut = e instanceof DOMException && e.name === 'TimeoutError';
        toast.error(timedOut ? 'This is taking too long. Check your connection and try again.' : 'Could not submit your application. Please try again.');
        return false;
      }
    },
    [isLoggedIn, loginHref, router],
  );

  const shareHref = `https://wa.me/?text=${encodeURIComponent(`Earn with ${BRAND} as a water supplier, tanker, plumber, borewell, tank cleaning or RO partner. Apply here: https://${typeof window !== 'undefined' ? window.location.host : ''}/register/pro`)}`;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#E3EDF6] text-slate-600 [scroll-behavior:smooth]">
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

      <main className="relative mx-auto max-w-6xl px-4 pb-28 pt-8 sm:pt-12 lg:pb-20">
        {/* Hero + application */}
        <section className="grid min-w-0 grid-cols-1 items-start gap-8 sm:gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
          <div className="min-w-0 aw-rise">
            <span className={`inline-flex items-center gap-2 rounded-full bg-[#E3EDF6] px-4 py-2 ${EYEBROW} ${INSET}`}>
              <span aria-hidden className="aw-pulse h-2 w-2 rounded-full bg-sky-500" />
              Now onboarding six kinds of partners in {SERVICE_CITIES.length} cities
            </span>
            <h1 className="mt-5 text-[clamp(2.25rem,6vw,4rem)] font-extrabold leading-[1.04] tracking-[-0.035em] text-[#0B2A4A]">
              Every water job, one platform. Earn more as you grow.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              Join {BRAND} as a water can supplier, tanker owner, plumber, borewell crew, tank cleaner or RO technician. Get steady orders near you, keep more of every delivery as you grow, and get paid to your own UPI or bank account.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#apply" className={`${BTN_PRIMARY} px-7 lg:hidden`}>Apply now</a>
              <a href="#earn" className={`${BTN_SOFT} px-6`}>Estimate my earnings</a>
              <a href={shareHref} target="_blank" rel="noopener noreferrer" className={`${BTN_SOFT} px-6`}>Share on WhatsApp</a>
            </div>

            <ul className="mt-9 grid gap-4 sm:grid-cols-3">
              <Stat value={`${first.commission}% → ${last.commission}%`} label="Commission as you grow" />
              <Stat value={`${maxRadius} km`} label="Largest delivery zone" />
              <Stat value={maxBonus ? `Up to ${inr(maxBonus)}` : 'Bonuses'} label="Milestone bonuses" />
            </ul>

            <ul className="mt-8 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              {[
                'Repeat customers are remembered, so good service brings them back to you',
                'Go online or offline whenever you like',
                'Orders arrive only if they are inside your zone and you have stock',
                'Payouts go to the UPI ID or bank account you choose',
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#E3EDF6] text-[10px] font-black text-sky-700 shadow-[2px_2px_4px_#b7c8d9,-2px_-2px_4px_#ffffff]`}>✓</span>
                  {t}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <p className="text-sm font-bold text-slate-700">Available in</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {SERVICE_CITIES.map((c) => (
                  <li key={c} className="rounded-xl bg-[#E3EDF6] px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-[3px_3px_6px_#b7c8d9,-3px_-3px_6px_#ffffff]">{c}</li>
                ))}
              </ul>
            </div>
          </div>

          <div id="apply" className="min-w-0 scroll-mt-6 lg:sticky lg:top-6">
            <ApplicationCard kind={kind} role={role} ready={hydrated} signedIn={isLoggedIn} loginHref={loginHref} onSubmit={submitApplication} />
          </div>
        </section>

        <RoleShowcase role={role} />
        <HowItWorks />
        <TierLadder rows={rows} />
        <Estimator key={role} rows={rows} role={role} />

        {/* FAQ */}
        <section aria-labelledby="faq-h" className="aw-defer mt-20">
          <p className={EYEBROW}>Questions</p>
          <h2 id="faq-h" className={H2}>Before you apply</h2>
          <div className="mt-6 grid gap-4">
            {faqs.map((f) => (
              <details key={f.q} className={`group ${CARD} px-5 py-4 sm:px-6 open:shadow-[inset_5px_5px_10px_#b7c8d9,inset_-5px_-5px_10px_#ffffff]`}>
                <summary className={`flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 rounded-xl font-bold text-[#0B2A4A] ${FOCUS} [&::-webkit-details-marker]:hidden`}>
                  {f.q}
                  <span aria-hidden className="text-xl text-sky-700 transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="mt-14 text-center text-sm text-slate-500">
          Need help?{' '}
          <Link href="/contact" className="font-semibold text-sky-700 underline underline-offset-4">Contact support</Link>
        </p>
      </main>

      {/* Mobile sticky CTA, only while the form is out of view */}
      <div
        aria-hidden={!showBar}
        className={`fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 transition duration-300 lg:hidden ${showBar ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'}`}
      >
        <a href="#apply" tabIndex={showBar ? 0 : -1} className={`${BTN_PRIMARY} w-full`}>Apply: {ROLES[role].label}</a>
      </div>
    </div>
  );
}

/* ───────────────────────── Sections ───────────────────────── */

/** Light, GPU-friendly water backdrop: two drifting waves, transform-only animation, no blur filters. */
const Backdrop = memo(function Backdrop() {
  return (
    <>
      <style>{`
        @keyframes aw-wave{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
        @keyframes aw-rise{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:none}}
        @keyframes aw-pulse{0%,100%{box-shadow:0 0 0 0 rgba(14,165,233,.5)}50%{box-shadow:0 0 0 6px rgba(14,165,233,0)}}
        .aw-wave{animation:aw-wave 22s linear infinite;will-change:transform}
        .aw-wave.slow{animation-duration:34s;animation-direction:reverse}
        .aw-rise{animation:aw-rise .6s cubic-bezier(.22,1,.36,1) both}
        .aw-pulse{animation:aw-pulse 2.4s ease-in-out infinite}
        .aw-defer{content-visibility:auto;contain-intrinsic-size:auto 520px}
        @media (prefers-reduced-motion:reduce){.aw-wave,.aw-rise,.aw-pulse{animation:none}html{scroll-behavior:auto}}
      `}</style>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[360px] overflow-hidden">
        {(['', 'slow'] as const).map((cls, i) => (
          <svg key={i} viewBox="0 0 1440 120" preserveAspectRatio="none" className={`aw-wave ${cls} absolute left-0 top-0 h-[120px] w-[200%] ${i ? 'opacity-60' : 'opacity-90'}`} style={{ top: i * 26 }}>
            <path d="M0 60 C 180 10 360 110 540 60 S 900 10 1080 60 S 1260 110 1440 60 V0 H0 Z" fill={i ? '#D3E4F2' : '#EAF3FA'} />
            <path d="M1440 60 C 1620 10 1800 110 1980 60 S 2340 10 2520 60 S 2700 110 2880 60 V0 H1440 Z" fill={i ? '#D3E4F2' : '#EAF3FA'} />
          </svg>
        ))}
      </div>
    </>
  );
});

const Stat = memo(function Stat({ value, label }: { value: string; label: string }) {
  return (
    <li className={`${CARD} px-4 py-4`}>
      <p className="text-xl font-extrabold tracking-tight text-[#0B2A4A]">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
    </li>
  );
});

const RoleShowcase = memo(function RoleShowcase({ role }: { role: RoleId }) {
  const goApply = () => document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <section aria-labelledby="roles-h" className="aw-defer mt-20">
      <p className={EYEBROW}>Choose your work</p>
      <h2 id="roles-h" className={H2}>Six ways to earn with {BRAND}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">Pick the one that matches what you already do. The form adjusts to your choice.</p>
      <ul className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_IDS.map((id) => {
          const r = ROLES[id];
          const on = id === role;
          return (
            <li key={id} className="relative">
              {id === FEATURED_ROLE && (
                <span className="absolute -top-3 right-4 z-10 rounded-full bg-gradient-to-br from-teal-500 to-sky-600 px-3 py-1 text-xs font-bold text-white shadow-[3px_3px_8px_#b7c8d9]">Easiest to start</span>
              )}
              <Link
                href={`/register/pro?role=${id}`}
                scroll={false}
                replace
                prefetch
                onClick={goApply}
                aria-current={on ? 'true' : undefined}
                className={`flex h-full flex-col rounded-3xl bg-[#E3EDF6] p-5 transition ${FOCUS} ${on ? INSET : `${RAISED} hover:-translate-y-0.5`}`}
              >
                <span aria-hidden className={`grid h-12 w-12 place-items-center rounded-2xl bg-[#E3EDF6] text-2xl ${on ? RAISED_SM : INSET}`}>{r.icon}</span>
                <span className="mt-4 text-lg font-extrabold text-[#0B2A4A]">{r.label}</span>
                <span className="mt-1 text-sm leading-6 text-slate-600">{r.blurb}</span>
                <span className="mt-3 text-xs font-semibold text-slate-500">You need: {r.needs}</span>
                <span className="mt-4 text-sm font-bold text-sky-700">{on ? 'Selected' : 'Apply for this'}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
});

const HowItWorks = memo(function HowItWorks() {
  const items = [
    { t: 'Apply', d: 'Fill a short form in about two minutes. Your draft saves on this device.' },
    { t: 'Get verified', d: 'We review within 24 hours and contact you on WhatsApp.' },
    { t: 'Go online and earn', d: 'Open the portal, go online, and receive orders inside your zone.' },
  ];
  return (
    <section aria-labelledby="how-h" className="aw-defer mt-20">
      <p className={EYEBROW}>How it works</p>
      <h2 id="how-h" className={H2}>From form to first order</h2>
      <ol className="mt-6 grid gap-5 md:grid-cols-3">
        {items.map((it, i) => (
          <li key={it.t} className={`${CARD} flex gap-4 p-5`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#E3EDF6] font-extrabold text-sky-700 ${INSET}`}>{i + 1}</span>
            <div>
              <p className="font-extrabold text-[#0B2A4A]">{it.t}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{it.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
});

const TierLadder = memo(function TierLadder({ rows }: { rows: TierRow[] }) {
  return (
    <section aria-labelledby="tiers-h" className="aw-defer mt-20">
      <p className={EYEBROW}>Milestones</p>
      <h2 id="tiers-h" className={H2}>Every delivery moves you up</h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">Complete orders to unlock a wider delivery zone, a lower commission and milestone bonuses.</p>
      <ol className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map((r, i) => (
          <li key={r.tier} className={`${CARD} relative p-5`}>
            <span className="text-xs font-bold text-sky-700">Step {i + 1}</span>
            <p className="mt-1 text-lg font-extrabold text-[#0B2A4A]">{r.label}</p>
            <p className="text-xs text-slate-500">{r.orders === 0 ? 'Start here' : `${r.orders}+ orders`}</p>
            <dl className={`mt-4 space-y-2 rounded-2xl bg-[#E3EDF6] p-3 text-sm ${INSET}`}>
              <div className="flex justify-between"><dt className="text-slate-500">Zone</dt><dd className="font-bold text-[#0B2A4A]">{r.radius} km</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Commission</dt><dd className="font-bold text-[#0B2A4A]">{r.commission}%</dd></div>
              {r.bonus > 0 && <div className="flex justify-between"><dt className="text-slate-500">Bonus</dt><dd className="font-bold text-teal-700">{inr(r.bonus)}</dd></div>}
            </dl>
          </li>
        ))}
      </ol>
    </section>
  );
});

function Estimator({ rows, role }: { rows: TierRow[]; role: RoleId }) {
  const r = ROLES[role];
  const [qty, setQty] = useState(r.qty);
  const [price, setPrice] = useState(r.price);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const plural = `${r.unit}s`;

  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  const monthly = qty * safePrice * DELIVERY_DAYS;
  const take = (commission: number) => monthly * (1 - commission / 100);
  const gain = take(last.commission) - take(first.commission);
  const topNet = Math.max(take(last.commission), 1);
  const daysToTop = last.orders > 0 ? Math.ceil(last.orders / Math.max(qty, 1)) : 0;
  const pct = r.qtyMax > r.qtyStep ? ((qty - r.qtyStep) / (r.qtyMax - r.qtyStep)) * 100 : 100;

  return (
    <section id="earn" aria-labelledby="calc-h" className="aw-defer mt-20 scroll-mt-6">
      <div className={`${CARD} grid gap-8 p-6 sm:p-8 lg:grid-cols-2`}>
        <div>
          <p className={EYEBROW}>Earnings estimator · {r.label}</p>
          <h2 id="calc-h" className={H2}>See what growing is worth</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">Enter your own numbers. This is an estimate based on the commission for each tier, not a promise of orders.</p>

          <label htmlFor="calc-qty" className="mt-6 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm font-bold text-[#0B2A4A]">
            {r.unit === 'can' ? 'Cans delivered' : r.unit === 'trip' ? 'Tanker trips' : 'Jobs completed'} per day <span className="text-sky-700">{qty}</span>
          </label>
          <input
            id="calc-qty" type="range" min={r.qtyStep} max={r.qtyMax} step={r.qtyStep} value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            style={{ background: `linear-gradient(90deg,#0ea5e9 ${pct}%,#cfdeeb ${pct}%)` }}
            className={`mt-3 h-3 w-full cursor-pointer appearance-none rounded-full ${INSET} accent-sky-600 ${FOCUS}`}
          />

          <label htmlFor="calc-price" className="mt-6 block text-sm font-bold text-[#0B2A4A]">Your price per {r.unit} (₹)</label>
          <input id="calc-price" type="number" inputMode="decimal" min={1} max={r.priceMax} value={Number.isFinite(price) ? price : ''} onChange={(e) => setPrice(e.target.valueAsNumber)} className={`${INPUT} mt-2 max-w-[180px]`} />
        </div>

        <div className={`rounded-2xl bg-[#E3EDF6] p-6 ${INSET}`} aria-live="polite">
          <p className="text-sm font-bold text-slate-500">Monthly, after commission ({DELIVERY_DAYS} working days)</p>

          <ul className="mt-4 space-y-3">
            {rows.map((t) => {
              const v = take(t.commission);
              return (
                <li key={t.tier}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="text-slate-600">{t.label} <span className="text-slate-400">({t.commission}%)</span></span>
                    <span className={`font-extrabold ${t === last ? 'text-teal-700' : 'text-[#0B2A4A]'}`}>{inr(v)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#cfdeeb]">
                    <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-500 transition-[width] duration-500 ease-out" style={{ width: `${Math.min(100, (v / topNet) * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-5 rounded-xl bg-teal-500/10 px-4 py-3 text-sm font-semibold text-teal-800">
            {gain > 0 ? `${inr(gain)} more every month at ${last.label}, on the same work.` : 'Enter a price to see the difference.'}
          </p>
          {daysToTop > 0 && (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              At {qty} {qty === 1 ? r.unit : plural} a day, you would reach {last.label} ({last.orders}+ orders) in about {daysToTop} working {daysToTop === 1 ? 'day' : 'days'}.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Application form ───────────────────────── */

function ApplicationCard({
  kind, role, ready, signedIn, loginHref, onSubmit,
}: {
  kind: Kind;
  role: RoleId;
  ready: boolean;
  signedIn: boolean;
  loginHref: string;
  onSubmit: (v: Payload) => Promise<boolean>;
}) {
  const r = ROLES[role];
  return (
    <div className={`rounded-[32px] bg-[#E3EDF6] p-5 sm:p-7 ${RAISED}`}>
      <nav aria-label="Choose your work" className={`flex gap-1 overflow-x-auto rounded-2xl bg-[#E3EDF6] p-1.5 ${INSET} [scrollbar-width:none]`}>
        {ROLE_IDS.map((id) => (
          <Link
            key={id}
            href={`/register/pro?role=${id}`}
            scroll={false}
            replace
            prefetch
            aria-current={role === id ? 'page' : undefined}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition ${FOCUS} ${role === id ? 'bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-[3px_3px_8px_#b7c8d9]' : 'text-slate-600 hover:text-sky-700'}`}
          >
            <span aria-hidden>{ROLES[id].icon}</span>
            {ROLES[id].label}
          </Link>
        ))}
      </nav>
      <h2 className="mt-5 text-xl font-extrabold text-[#0B2A4A]">{r.label} application</h2>
      <p className="mt-1 text-sm text-slate-500">
        {ready && !signedIn ? (
          <>It takes about two minutes. You will sign in at the end. <Link href={loginHref} className="font-semibold text-sky-700 underline underline-offset-4">Sign in now</Link></>
        ) : (
          'It takes about two minutes. We review within 24 hours.'
        )}
      </p>
      <p className="mt-1 text-xs text-slate-500">You need: {r.needs}.</p>
      <ApplicationForm key={role} kind={kind} role={role} ready={ready} onSubmit={onSubmit} />
    </div>
  );
}

function ApplicationForm({ kind, role, ready, onSubmit }: { kind: Kind; role: RoleId; ready: boolean; onSubmit: (v: Payload) => Promise<boolean> }) {
  const steps = STEPS[kind];
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const uid = useId();

  const resolver = zodResolver(kind === 'supplier' ? supplierSchema : technicianSchema) as unknown as Resolver<FormValues>;
  const form = useForm<FormValues>({ resolver, defaultValues: defaultsFor(role), mode: 'onTouched' });
  const { register, formState: { errors, isSubmitting }, setValue, watch, trigger, reset } = form;

  // Restore a saved draft (non-sensitive fields only) after the first paint.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(role));
      if (raw) { reset({ ...defaultsFor(role), ...(JSON.parse(raw) as Partial<FormValues>) }); setSaved(true); }
    } catch { /* storage unavailable or corrupt: start fresh */ }
  }, [role, reset]);

  // Save a draft as the user types.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = watch((values) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const draft: Partial<FormValues> = {};
          for (const f of DRAFT_FIELDS) if (values[f] !== undefined) (draft as Record<string, unknown>)[f] = values[f];
          localStorage.setItem(draftKey(role), JSON.stringify(draft));
          setSaved(true);
        } catch { /* ignore */ }
      }, 500);
    });
    return () => { clearTimeout(timer); sub.unsubscribe(); };
  }, [role, watch]);

  // Move focus to the new step heading so screen-reader and keyboard users know where they are.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [step]);

  const isLast = step === steps.length - 1;
  const current = steps[step];
  const percent = Math.round(((step + 1) / steps.length) * 100);

  const next = async () => {
    if (await trigger(current.fields as never)) {
      try { navigator.vibrate?.(10); } catch { /* not supported */ }
      setStep((s) => Math.min(s + 1, steps.length - 1));
    }
  };

  const submit = form.handleSubmit(async (values) => {
    const ok = await onSubmit(values as unknown as Payload);
    if (ok) { try { localStorage.removeItem(draftKey(role)); } catch { /* ignore */ } }
  });

  const clearDraft = () => {
    try { localStorage.removeItem(draftKey(role)); } catch { /* ignore */ }
    reset(defaultsFor(role));
    setStep(0);
    setSaved(false);
    toast.info('Draft cleared.');
  };

  const err = (name: keyof FormValues) => errors[name]?.message as string | undefined;
  const id = (name: string) => `${uid}-${name}`;
  const a11y = (name: keyof FormValues) => ({ id: id(name), 'aria-invalid': err(name) ? true : undefined, 'aria-describedby': err(name) ? `${id(name)}-err` : undefined });

  const phoneReg = register('phone');
  const skills = watch('skills') ?? [];
  const cans = Number(watch('cans_capacity')) || 0;
  const upi = watch('upi_id') ?? '';
  const setCans = (n: number) => setValue('cans_capacity', Math.min(500, Math.max(1, n)), { shouldValidate: true, shouldDirty: true });
  const setUpiSuffix = (suffix: string) => setValue('upi_id', upi.split('@')[0] + suffix, { shouldValidate: true, shouldDirty: true });

  return (
    <form
      noValidate
      className="mt-6"
      onSubmit={(e) => {
        if (!isLast) { e.preventDefault(); void next(); return; } // Enter advances instead of submitting early
        void submit(e);
      }}
    >
      {/* Progress: a water-filled channel */}
      <div className={`h-3 overflow-hidden rounded-full bg-[#E3EDF6] ${INSET}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Application progress">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-600 transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <ol className="mt-2 flex gap-2" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s.title} aria-current={i === step ? 'step' : undefined} className={`flex-1 text-xs font-bold ${i === step ? 'text-sky-700' : 'text-slate-400'}`}>{s.title}</li>
        ))}
      </ol>

      <h3 ref={headingRef} tabIndex={-1} className="mt-6 text-lg font-bold text-[#0B2A4A] outline-none">
        {current.title} <span className="font-medium text-slate-500">· {current.hint}</span>
      </h3>

      <div className="mt-4 grid gap-5">
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
                {SERVICE_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </>
        )}

        {kind === 'supplier' && step === 1 && (
          <>
            <Field label="Vehicle" htmlFor={id('vehicle_type')} error={err('vehicle_type')}>
              <select {...register('vehicle_type')} {...a11y('vehicle_type')} className={INPUT}>
                {VEHICLES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Cans you can carry" htmlFor={id('cans_capacity')} error={err('cans_capacity')} hint={role === 'tanker' ? 'About 20 L per can, so 1,000 L is 50' : undefined}>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Fewer cans" onClick={() => setCans(cans - 5)} className={`${BTN_SOFT} h-12 w-12 shrink-0 text-xl`}>−</button>
                <input type="number" min={1} max={500} inputMode="numeric" {...register('cans_capacity', { valueAsNumber: true })} {...a11y('cans_capacity')} className={`${INPUT} text-center`} />
                <button type="button" aria-label="More cans" onClick={() => setCans(cans + 5)} className={`${BTN_SOFT} h-12 w-12 shrink-0 text-xl`}>+</button>
              </div>
            </Field>
          </>
        )}

        {kind === 'supplier' && step === 2 && (
          <>
            <Field label="UPI ID" htmlFor={id('upi_id')} error={err('upi_id')} hint="Payouts are sent here">
              <input {...register('upi_id')} {...a11y('upi_id')} className={INPUT} autoComplete="off" autoCapitalize="none" placeholder="name@bank" />
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Quick UPI handles">
                {UPI_SUFFIXES.map((s) => (
                  <button key={s} type="button" onClick={() => setUpiSuffix(s)} className={`${BTN_SOFT} min-h-[36px] rounded-xl px-3 text-xs ${upi.endsWith(s) ? 'text-sky-700' : ''}`}>{s}</button>
                ))}
              </div>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
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
              <legend className="mb-3 text-sm font-bold text-slate-700">Skills</legend>
              <div className="grid grid-cols-2 gap-3">
                {SKILLS.map((s) => {
                  const on = skills.includes(s);
                  return (
                    <label key={s} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl bg-[#E3EDF6] px-4 text-sm font-semibold transition focus-within:ring-4 focus-within:ring-sky-500/40 ${on ? `${INSET} text-sky-700` : `${RAISED_SM} text-slate-600`}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        className="h-4 w-4 accent-sky-600"
                        onChange={(e) => setValue('skills', e.target.checked ? [...skills, s] : skills.filter((x) => x !== s), { shouldValidate: true, shouldDirty: true })}
                      />
                      {s}
                    </label>
                  );
                })}
              </div>
              {err('skills') && <p id={`${id('skills')}-err`} role="alert" className="mt-2 text-sm font-semibold text-rose-600">{err('skills')}</p>}
            </fieldset>
            <Field label="Years of experience" htmlFor={id('experience_years')} error={err('experience_years')}>
              <input type="number" min={0} max={60} inputMode="numeric" {...register('experience_years', { valueAsNumber: true })} {...a11y('experience_years')} className={INPUT} />
            </Field>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-7 flex gap-3">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className={`${BTN_SOFT} px-6`}>
            Back
          </button>
        )}
        <button type="submit" disabled={isSubmitting || (isLast && !ready)} className={`${BTN_PRIMARY} flex-1`}>
          {isSubmitting ? 'Submitting…' : isLast ? 'Submit application' : 'Continue'}
        </button>
      </div>
      <div className="mt-4 text-center text-xs text-slate-500" aria-live="polite">
        <p>
          {saved ? 'Draft saved on this device. ' : ''}By submitting you agree to be contacted on WhatsApp for verification.
        </p>
        {saved && (
          <button type="button" onClick={clearDraft} className={`mt-2 rounded-lg px-2 py-1 font-semibold text-sky-700 underline underline-offset-4 ${FOCUS}`}>
            Clear saved draft
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 flex items-baseline justify-between gap-3 text-sm font-bold text-slate-700">
        {label}
        {hint && <span className="text-xs font-medium text-slate-500">{hint}</span>}
      </label>
      {children}
      {error && <p id={`${htmlFor}-err`} role="alert" className="mt-2 text-sm font-semibold text-rose-600">{error}</p>}
    </div>
  );
}









// 'use client';

// import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
// import type { ReactNode } from 'react';
// import Link from 'next/link';
// import { useRouter, useSearchParams } from 'next/navigation';
// import { toast } from 'sonner';
// import { z } from 'zod';
// import { useForm } from 'react-hook-form';
// import type { Resolver } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';

// import { MILESTONE_TIERS, type MilestoneTier } from '@/lib/milestone-constants';
// import { useAuth } from '@/hooks/useAuth';

// /* ───────────────────────── Content & constants ───────────────────────── */

// const BRAND = 'AuroTap';
// const DELIVERY_DAYS = 26; // working days per month used by the earnings estimator

// const SERVICE_CITIES = [
//   'Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj', 'Agra', 'Meerut',
//   'Bareilly', 'Aligarh', 'Mathura', 'Delhi', 'Noida', 'Ghaziabad',
// ] as const;
// const VEHICLES = ['Cycle', 'Bike', 'Auto', 'Mini-truck'] as const;
// const SKILLS = ['Plumbing', 'RO Install', 'Boring', 'Maintenance'] as const;

// const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile numbers
// const UPI_RE = /^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/i;
// const ACCOUNT_RE = /^\d{9,18}$/;
// const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// type Kind = 'supplier' | 'technician';

// /* ───────────────────────── Validation ───────────────────────── */

// const baseShape = {
//   full_name: z.string().trim().min(2, 'Enter your full name').max(80, 'Name is too long'),
//   phone: z.string().regex(PHONE_RE, 'Enter a valid 10-digit mobile number'),
//   city: z.enum(SERVICE_CITIES, { message: 'Choose your city' }),
// };

// const supplierSchema = z
//   .object({
//     ...baseShape,
//     type: z.literal('supplier'),
//     vehicle_type: z.enum(VEHICLES, { message: 'Choose your vehicle' }),
//     cans_capacity: z.number({ message: 'Enter how many cans you can carry' }).int('Use a whole number').min(1, 'At least 1 can').max(500, 'That looks too high'),
//     upi_id: z.string().trim().regex(UPI_RE, 'Enter a valid UPI ID, for example name@bank'),
//     bank_account: z.string().trim().refine((v) => !v || ACCOUNT_RE.test(v), 'Account numbers have 9 to 18 digits'),
//     ifsc: z.string().trim().toUpperCase().refine((v) => !v || IFSC_RE.test(v), 'Enter a valid IFSC, for example HDFC0001234'),
//   })
//   .refine((v) => Boolean(v.bank_account) === Boolean(v.ifsc), {
//     path: ['ifsc'],
//     message: 'Add both account number and IFSC, or leave both empty',
//   });

// const technicianSchema = z.object({
//   ...baseShape,
//   type: z.literal('technician'),
//   skills: z.array(z.enum(SKILLS)).min(1, 'Pick at least one skill'),
//   experience_years: z.number({ message: 'Enter your experience' }).int('Use a whole number').min(0, 'Cannot be negative').max(60, 'That looks too high'),
// });

// type SupplierPayload = z.infer<typeof supplierSchema>;
// type TechnicianPayload = z.infer<typeof technicianSchema>;
// type Payload = SupplierPayload | TechnicianPayload;

// /** One flat shape for the shared form; each kind uses only its own fields. */
// type FormValues = {
//   type: Kind;
//   full_name: string;
//   phone: string;
//   city: string;
//   vehicle_type?: string;
//   cans_capacity?: number;
//   upi_id?: string;
//   bank_account?: string;
//   ifsc?: string;
//   skills?: string[];
//   experience_years?: number;
// };

// const defaultsFor = (kind: Kind): FormValues =>
//   kind === 'supplier'
//     ? { type: 'supplier', full_name: '', phone: '', city: SERVICE_CITIES[0], vehicle_type: 'Bike', cans_capacity: 20, upi_id: '', bank_account: '', ifsc: '' }
//     : { type: 'technician', full_name: '', phone: '', city: SERVICE_CITIES[0], skills: ['Plumbing'], experience_years: 1 };

// type StepDef = { title: string; hint: string; fields: (keyof FormValues)[] };
// const STEPS: Record<Kind, StepDef[]> = {
//   supplier: [
//     { title: 'About you', hint: 'So we can reach you', fields: ['full_name', 'phone', 'city'] },
//     { title: 'Your vehicle', hint: 'How you deliver', fields: ['vehicle_type', 'cans_capacity'] },
//     { title: 'Payouts', hint: 'Where we send your earnings', fields: ['upi_id', 'bank_account', 'ifsc'] },
//   ],
//   technician: [
//     { title: 'About you', hint: 'So we can reach you', fields: ['full_name', 'phone', 'city'] },
//     { title: 'Your skills', hint: 'What you can fix', fields: ['skills', 'experience_years'] },
//   ],
// };

// /** Saved on this device only, and never includes payout details. */
// const DRAFT_FIELDS: (keyof FormValues)[] = ['full_name', 'phone', 'city', 'vehicle_type', 'cans_capacity', 'skills', 'experience_years'];
// const draftKey = (kind: Kind) => `aurotap:pro-draft:${kind}`;

// /* ───────────────────────── Tiers (all marketing numbers come from here) ───────────────────────── */

// function tierRows() {
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
// type TierRow = ReturnType<typeof tierRows>[number];

// const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

// function buildFaqs(rows: TierRow[]) {
//   const first = rows[0];
//   const last = rows[rows.length - 1];
//   return [
//     { q: 'Who can apply?', a: `Water delivery partners with a vehicle, and plumbing or RO technicians, in ${SERVICE_CITIES.slice(0, -1).join(', ')} and ${SERVICE_CITIES[SERVICE_CITIES.length - 1]}.` },
//     { q: 'How long does review take?', a: 'We review applications within 24 hours and contact you to verify your details.' },
//     { q: 'What do I need to apply?', a: 'Your mobile number, your city, and a UPI ID for payouts. A bank account and IFSC are optional.' },
//     { q: 'How do I get paid?', a: 'Your earnings appear in the supplier portal. Request a payout there and our team settles it to the UPI ID or bank account you gave us. Requests are processed by our team, so they are not instant.' },
//     { q: 'How do tiers work?', a: `You start as ${first.label} and move up as you complete orders. Each tier lowers your commission (from ${first.commission}% to ${last.commission}% at ${last.label}) and widens your delivery zone.` },
//     { q: 'How are orders assigned?', a: 'Orders go to online partners whose delivery zone covers the customer and who have the stock to deliver. You can go online or offline whenever you like from the portal.' },
//   ];
// }

// /* ───────────────────────── Shared styles ───────────────────────── */

// const INPUT =
//   'w-full min-h-[48px] rounded-xl border border-white/[.14] bg-white/[.06] px-4 py-3 text-base font-medium text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/70 focus:ring-4 focus:ring-cyan-300/15 aria-[invalid=true]:border-rose-400/70';
// const CARD = 'rounded-3xl border border-white/10 bg-white/[.035]';
// const EYEBROW = 'text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/90';

// /* ───────────────────────── Page ───────────────────────── */

// export default function RegisterProPage() {
//   // useSearchParams must sit under Suspense or the production build fails.
//   return (
//     <Suspense fallback={<div className="min-h-screen bg-[#050B18]" aria-busy="true" />}>
//       <RegisterPro />
//     </Suspense>
//   );
// }

// function RegisterPro() {
//   const router = useRouter();
//   const sp = useSearchParams();
//   const { hydrated, isLoggedIn } = useAuth();

//   const kind: Kind = (sp.get('type') ?? '').toLowerCase() === 'technician' ? 'technician' : 'supplier';
//   const loginHref = `/auth/login?returnTo=${encodeURIComponent(`/register/pro?type=${kind}`)}`;

//   const rows = useMemo(() => tierRows(), []);
//   const faqs = useMemo(() => buildFaqs(rows), [rows]);
//   const first = rows[0];
//   const last = rows[rows.length - 1];
//   const maxRadius = Math.max(...rows.map((r) => r.radius));
//   const maxBonus = Math.max(...rows.map((r) => r.bonus));

//   /** Returns true when the application was accepted. */
//   const submitApplication = useCallback(
//     async (values: Payload): Promise<boolean> => {
//       if (!isLoggedIn) {
//         toast.info('Sign in to submit. Your details are saved on this device.');
//         router.push(loginHref);
//         return false;
//       }
//       try {
//         const res = await fetch('/api/applications', {
//           method: 'POST',
//           credentials: 'include',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify(values),
//           signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? AbortSignal.timeout(20_000) : undefined,
//         });
//         const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; data?: { id?: string } | null };
//         if (res.status === 401) {
//           router.push(loginHref);
//           return false;
//         }
//         if (!res.ok || json?.success === false) {
//           toast.error(json?.error ?? 'Could not submit your application. Please try again.');
//           return false;
//         }
//         toast.success('Application submitted. We will contact you within 24 hours.');
//         const id = json.data?.id;
//         router.push(id ? `/register/pro/success?id=${encodeURIComponent(id)}` : '/register/pro/success');
//         return true;
//       } catch (e) {
//         const timedOut = e instanceof DOMException && e.name === 'TimeoutError';
//         toast.error(timedOut ? 'This is taking too long. Check your connection and try again.' : 'Could not submit your application. Please try again.');
//         return false;
//       }
//     },
//     [isLoggedIn, loginHref, router],
//   );

//   return (
//     <div className="relative min-h-screen overflow-x-hidden bg-[#192A68] text-slate-200">
//       <Backdrop />
//       <script
//         type="application/ld+json"
//         // "<" is escaped so the JSON can never close the script tag.
//         dangerouslySetInnerHTML={{
//           __html: JSON.stringify({
//             '@context': 'https://schema.org',
//             '@type': 'FAQPage',
//             mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
//           }).replace(/</g, '\\u003c'),
//         }}
//       />

//       <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-8 sm:pt-12">
//         {/* Hero + application */}
//         <section className="grid items-start gap-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-12">
//           <div>
//             <p className={EYEBROW}>Partner with {BRAND}</p>
//             <h1 className="mt-4 text-[clamp(2.25rem,6vw,4.1rem)] font-extrabold leading-[1.03] tracking-[-0.035em] text-white">
//               Deliver water. Fix pipes. <span className="bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">Earn more every month.</span>
//             </h1>
//             <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
//               Join {BRAND} as a water delivery supplier or a plumbing and RO technician. Get steady orders near you, keep more of every delivery as you grow, and get paid to your own UPI or bank account.
//             </p>

//             <a href="#apply" className="mt-7 inline-flex min-h-[48px] items-center rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-500 px-6 font-bold text-[#04121f] shadow-[0_12px_36px_rgba(56,189,248,.28)] transition hover:brightness-110 lg:hidden">
//               Apply now
//             </a>

//             <ul className="mt-8 grid gap-3 sm:grid-cols-3">
//               <Stat value={`${first.commission}% → ${last.commission}%`} label="Commission as you grow" />
//               <Stat value={`${maxRadius} km`} label="Largest delivery zone" />
//               <Stat value={maxBonus ? `Up to ${inr(maxBonus)}` : 'Bonuses'} label="Milestone bonuses" />
//             </ul>

//             <ul className="mt-6 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
//               {[
//                 'Repeat customers are remembered, so good service brings them back to you',
//                 'Go online or offline whenever you like',
//                 'Orders arrive only if they are inside your zone and you have stock',
//                 'Payouts go to the UPI ID or bank account you choose',
//               ].map((t) => (
//                 <li key={t} className="flex gap-3">
//                   <span aria-hidden className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />
//                   {t}
//                 </li>
//               ))}
//             </ul>
//           </div>

//           <div id="apply" className="scroll-mt-6 lg:sticky lg:top-6">
//             <ApplicationCard
//               kind={kind}
//               ready={hydrated}
//               signedIn={isLoggedIn}
//               loginHref={loginHref}
//               onSubmit={submitApplication}
//             />
//           </div>
//         </section>

//         <TierLadder rows={rows} />
//         <Estimator rows={rows} />

//         {/* FAQ */}
//         <section aria-labelledby="faq-h" className="mt-16">
//           <p className={EYEBROW}>Questions</p>
//           <h2 id="faq-h" className="mt-3 text-3xl font-extrabold tracking-tight text-white">Before you apply</h2>
//           <div className="mt-6 divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/[.035]">
//             {faqs.map((f) => (
//               <details key={f.q} className="group px-5 py-4 sm:px-6">
//                 <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 font-bold text-white [&::-webkit-details-marker]:hidden">
//                   {f.q}
//                   <span aria-hidden className="text-cyan-300 transition group-open:rotate-45">+</span>
//                 </summary>
//                 <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">{f.a}</p>
//               </details>
//             ))}
//           </div>
//         </section>

//         <p className="mt-12 text-center text-sm text-slate-400">
//           Need help?{' '}
//           <Link href="/contact" className="font-semibold text-cyan-300 underline underline-offset-4">Contact support</Link>
//         </p>
//       </main>
//     </div>
//   );
// }

// /* ───────────────────────── Sections ───────────────────────── */

// function Backdrop() {
//   return (
//     <>
//       <style>{`
//         @keyframes aw-drift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(24px,-18px,0)}}
//         .aw-blob{animation:aw-drift 14s ease-in-out infinite}
//         @media (prefers-reduced-motion:reduce){.aw-blob{animation:none}}
//       `}</style>
//       <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[640px] overflow-hidden">
//         <div className="aw-blob absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-sky-500/20 blur-[110px]" />
//         <div className="aw-blob absolute -right-24 top-10 h-[380px] w-[380px] rounded-full bg-teal-400/15 blur-[110px] [animation-delay:-6s]" />
//       </div>
//     </>
//   );
// }

// function Stat({ value, label }: { value: string; label: string }) {
//   return (
//     <li className={`${CARD} px-4 py-4`}>
//       <p className="text-xl font-extrabold tracking-tight text-white">{value}</p>
//       <p className="mt-1 text-xs font-medium text-slate-400">{label}</p>
//     </li>
//   );
// }

// function TierLadder({ rows }: { rows: TierRow[] }) {
//   return (
//     <section aria-labelledby="tiers-h" className="mt-16">
//       <p className={EYEBROW}>Milestones</p>
//       <h2 id="tiers-h" className="mt-3 text-3xl font-extrabold tracking-tight text-white">Every delivery moves you up</h2>
//       <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">Complete orders to unlock a wider delivery zone, a lower commission and milestone bonuses.</p>
//       <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
//         {rows.map((r, i) => (
//           <li key={r.tier} className={`${CARD} relative p-5`}>
//             <span className="text-xs font-bold text-cyan-300">Step {i + 1}</span>
//             <p className="mt-1 text-lg font-extrabold text-white">{r.label}</p>
//             <p className="text-xs text-slate-400">{r.orders === 0 ? 'Start here' : `${r.orders}+ orders`}</p>
//             <dl className="mt-4 space-y-2 text-sm">
//               <div className="flex justify-between"><dt className="text-slate-400">Zone</dt><dd className="font-bold text-white">{r.radius} km</dd></div>
//               <div className="flex justify-between"><dt className="text-slate-400">Commission</dt><dd className="font-bold text-white">{r.commission}%</dd></div>
//               {r.bonus > 0 && <div className="flex justify-between"><dt className="text-slate-400">Bonus</dt><dd className="font-bold text-teal-300">{inr(r.bonus)}</dd></div>}
//             </dl>
//           </li>
//         ))}
//       </ol>
//     </section>
//   );
// }

// function Estimator({ rows }: { rows: TierRow[] }) {
//   const [cans, setCans] = useState(30);
//   const [price, setPrice] = useState(40);
//   const first = rows[0];
//   const last = rows[rows.length - 1];

//   const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
//   const monthly = cans * safePrice * DELIVERY_DAYS;
//   const take = (commission: number) => monthly * (1 - commission / 100);
//   const gain = take(last.commission) - take(first.commission);

//   return (
//     <section aria-labelledby="calc-h" className="mt-16">
//       <div className={`${CARD} grid gap-8 p-6 sm:p-8 lg:grid-cols-2`}>
//         <div>
//           <p className={EYEBROW}>Earnings estimator</p>
//           <h2 id="calc-h" className="mt-3 text-3xl font-extrabold tracking-tight text-white">See what growing is worth</h2>
//           <p className="mt-2 text-sm leading-7 text-slate-300">Enter your own numbers. This is an estimate based on the commission for each tier, not a promise of orders.</p>

//           <label htmlFor="calc-cans" className="mt-6 flex justify-between text-sm font-bold text-white">
//             Cans delivered per day <span className="text-cyan-300">{cans}</span>
//           </label>
//           <input id="calc-cans" type="range" min={5} max={200} step={5} value={cans} onChange={(e) => setCans(Number(e.target.value))} className="mt-2 h-2 w-full cursor-pointer accent-cyan-300" />

//           <label htmlFor="calc-price" className="mt-6 block text-sm font-bold text-white">Your price per can (₹)</label>
//           <input id="calc-price" type="number" inputMode="decimal" min={1} max={1000} value={Number.isFinite(price) ? price : ''} onChange={(e) => setPrice(e.target.valueAsNumber)} className={`${INPUT} mt-2 max-w-[180px]`} />
//         </div>

//         <div className="rounded-2xl border border-white/10 bg-[#07162B] p-6" aria-live="polite">
//           <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Monthly, after commission ({DELIVERY_DAYS} delivery days)</p>
//           <dl className="mt-4 space-y-4">
//             <div className="flex items-baseline justify-between"><dt className="text-sm text-slate-300">As {first.label} ({first.commission}%)</dt><dd className="text-2xl font-extrabold text-white">{inr(take(first.commission))}</dd></div>
//             <div className="flex items-baseline justify-between"><dt className="text-sm text-slate-300">As {last.label} ({last.commission}%)</dt><dd className="text-2xl font-extrabold text-teal-300">{inr(take(last.commission))}</dd></div>
//           </dl>
//           <p className="mt-5 rounded-xl bg-teal-400/10 px-4 py-3 text-sm font-semibold text-teal-200">
//             {gain > 0 ? `${inr(gain)} more every month at ${last.label}, on the same deliveries.` : 'Enter a price to see the difference.'}
//           </p>
//         </div>
//       </div>
//     </section>
//   );
// }

// /* ───────────────────────── Application form ───────────────────────── */

// function ApplicationCard({
//   kind, ready, signedIn, loginHref, onSubmit,
// }: {
//   kind: Kind;
//   ready: boolean;
//   signedIn: boolean;
//   loginHref: string;
//   onSubmit: (v: Payload) => Promise<boolean>;
// }) {
//   const tab = (k: Kind, label: string) => (
//     <Link
//       href={`/register/pro?type=${k}`}
//       scroll={false}
//       replace
//       aria-current={kind === k ? 'page' : undefined}
//       className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-4 text-sm font-bold transition ${kind === k ? 'bg-sky-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}
//     >
//       {label}
//     </Link>
//   );

//   return (
//     <div className="rounded-[28px] border border-white/10 bg-[#0B1322]/95 p-5 shadow-[0_30px_90px_rgba(0,0,0,.35)] sm:p-7">
//       <nav aria-label="Application type" className="flex gap-1 rounded-2xl border border-white/10 bg-white/[.04] p-1">
//         {tab('supplier', 'Water supplier')}
//         {tab('technician', 'Technician')}
//       </nav>
//       <h2 className="mt-5 text-xl font-extrabold text-white">{kind === 'supplier' ? 'Supplier application' : 'Technician application'}</h2>
//       <p className="mt-1 text-sm text-slate-400">
//         {ready && !signedIn ? (
//           <>It takes about two minutes. You will sign in at the end. <Link href={loginHref} className="font-semibold text-cyan-300 underline underline-offset-4">Sign in now</Link></>
//         ) : (
//           'It takes about two minutes. We review within 24 hours.'
//         )}
//       </p>
//       <ApplicationForm key={kind} kind={kind} ready={ready} onSubmit={onSubmit} />
//     </div>
//   );
// }

// function ApplicationForm({ kind, ready, onSubmit }: { kind: Kind; ready: boolean; onSubmit: (v: Payload) => Promise<boolean> }) {
//   const steps = STEPS[kind];
//   const [step, setStep] = useState(0);
//   const [saved, setSaved] = useState(false);
//   const headingRef = useRef<HTMLHeadingElement>(null);
//   const firstRender = useRef(true);
//   const uid = useId();

//   const resolver = zodResolver(kind === 'supplier' ? supplierSchema : technicianSchema) as unknown as Resolver<FormValues>;
//   const form = useForm<FormValues>({ resolver, defaultValues: defaultsFor(kind), mode: 'onTouched' });
//   const { register, formState: { errors, isSubmitting }, setValue, watch, trigger, reset } = form;

//   // Restore a saved draft (non-sensitive fields only) after the first paint.
//   useEffect(() => {
//     try {
//       const raw = localStorage.getItem(draftKey(kind));
//       if (raw) reset({ ...defaultsFor(kind), ...(JSON.parse(raw) as Partial<FormValues>) });
//     } catch { /* storage unavailable or corrupt: start fresh */ }
//   }, [kind, reset]);

//   // Save a draft as the user types.
//   useEffect(() => {
//     let timer: ReturnType<typeof setTimeout> | undefined;
//     const sub = watch((values) => {
//       clearTimeout(timer);
//       timer = setTimeout(() => {
//         try {
//           const draft: Partial<FormValues> = {};
//           for (const f of DRAFT_FIELDS) if (values[f] !== undefined) (draft as Record<string, unknown>)[f] = values[f];
//           localStorage.setItem(draftKey(kind), JSON.stringify(draft));
//           setSaved(true);
//         } catch { /* ignore */ }
//       }, 500);
//     });
//     return () => { clearTimeout(timer); sub.unsubscribe(); };
//   }, [kind, watch]);

//   // Move focus to the new step heading so screen-reader and keyboard users know where they are.
//   useEffect(() => {
//     if (firstRender.current) { firstRender.current = false; return; }
//     headingRef.current?.focus();
//   }, [step]);

//   const isLast = step === steps.length - 1;
//   const current = steps[step];

//   const next = async () => {
//     if (await trigger(current.fields as never)) setStep((s) => Math.min(s + 1, steps.length - 1));
//   };

//   const submit = form.handleSubmit(async (values) => {
//     const ok = await onSubmit(values as unknown as Payload);
//     if (ok) { try { localStorage.removeItem(draftKey(kind)); } catch { /* ignore */ } }
//   });

//   const err = (name: keyof FormValues) => errors[name]?.message as string | undefined;
//   const id = (name: string) => `${uid}-${name}`;
//   const a11y = (name: keyof FormValues) => ({ id: id(name), 'aria-invalid': err(name) ? true : undefined, 'aria-describedby': err(name) ? `${id(name)}-err` : undefined });

//   const phoneReg = register('phone');
//   const skills = watch('skills') ?? [];

//   return (
//     <form
//       noValidate
//       className="mt-6"
//       onSubmit={(e) => {
//         if (!isLast) { e.preventDefault(); void next(); return; } // Enter advances instead of submitting early
//         void submit(e);
//       }}
//     >
//       {/* Progress */}
//       <ol className="flex gap-2" aria-label="Progress">
//         {steps.map((s, i) => (
//           <li key={s.title} aria-current={i === step ? 'step' : undefined} className="flex-1">
//             <div className={`h-1.5 rounded-full transition-colors ${i <= step ? 'bg-cyan-300' : 'bg-white/10'}`} />
//             <span className={`mt-2 block text-[11px] font-bold uppercase tracking-wider ${i === step ? 'text-cyan-300' : 'text-slate-500'}`}>{s.title}</span>
//           </li>
//         ))}
//       </ol>

//       <h3 ref={headingRef} tabIndex={-1} className="mt-6 text-lg font-bold text-white outline-none">
//         {current.title} <span className="font-medium text-slate-400">· {current.hint}</span>
//       </h3>

//       <div className="mt-4 grid gap-4">
//         {step === 0 && (
//           <>
//             <Field label="Full name" htmlFor={id('full_name')} error={err('full_name')}>
//               <input {...register('full_name')} {...a11y('full_name')} className={INPUT} autoComplete="name" placeholder="Your name" />
//             </Field>
//             <Field label="Mobile number" htmlFor={id('phone')} error={err('phone')} hint="We verify on WhatsApp">
//               <input
//                 {...phoneReg}
//                 {...a11y('phone')}
//                 className={INPUT}
//                 inputMode="numeric"
//                 autoComplete="tel-national"
//                 placeholder="10-digit mobile number"
//                 maxLength={10}
//                 onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); return phoneReg.onChange(e); }}
//               />
//             </Field>
//             <Field label="City" htmlFor={id('city')} error={err('city')}>
//               <select {...register('city')} {...a11y('city')} className={INPUT}>
//                 {SERVICE_CITIES.map((c) => <option key={c} value={c} className="text-black">{c}</option>)}
//               </select>
//             </Field>
//           </>
//         )}

//         {kind === 'supplier' && step === 1 && (
//           <>
//             <Field label="Vehicle" htmlFor={id('vehicle_type')} error={err('vehicle_type')}>
//               <select {...register('vehicle_type')} {...a11y('vehicle_type')} className={INPUT}>
//                 {VEHICLES.map((v) => <option key={v} value={v} className="text-black">{v}</option>)}
//               </select>
//             </Field>
//             <Field label="Cans you can carry" htmlFor={id('cans_capacity')} error={err('cans_capacity')}>
//               <input type="number" min={1} max={500} inputMode="numeric" {...register('cans_capacity', { valueAsNumber: true })} {...a11y('cans_capacity')} className={INPUT} />
//             </Field>
//           </>
//         )}

//         {kind === 'supplier' && step === 2 && (
//           <>
//             <Field label="UPI ID" htmlFor={id('upi_id')} error={err('upi_id')} hint="Payouts are sent here">
//               <input {...register('upi_id')} {...a11y('upi_id')} className={INPUT} autoComplete="off" autoCapitalize="none" placeholder="name@bank" />
//             </Field>
//             <div className="grid gap-4 sm:grid-cols-2">
//               <Field label="Bank account (optional)" htmlFor={id('bank_account')} error={err('bank_account')}>
//                 <input {...register('bank_account')} {...a11y('bank_account')} className={INPUT} autoComplete="off" inputMode="numeric" placeholder="Account number" />
//               </Field>
//               <Field label="IFSC (optional)" htmlFor={id('ifsc')} error={err('ifsc')}>
//                 <input {...register('ifsc')} {...a11y('ifsc')} className={`${INPUT} uppercase`} autoComplete="off" autoCapitalize="characters" maxLength={11} placeholder="HDFC0001234" />
//               </Field>
//             </div>
//             <p className="text-xs leading-5 text-slate-500">Payout details are never saved in your browser draft.</p>
//           </>
//         )}

//         {kind === 'technician' && step === 1 && (
//           <>
//             <fieldset aria-describedby={err('skills') ? `${id('skills')}-err` : undefined}>
//               <legend className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Skills</legend>
//               <div className="grid grid-cols-2 gap-2">
//                 {SKILLS.map((s) => {
//                   const on = skills.includes(s);
//                   return (
//                     <label key={s} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-4 text-sm font-semibold transition ${on ? 'border-cyan-300/60 bg-cyan-300/10 text-white' : 'border-white/[.14] bg-white/[.04] text-slate-300'}`}>
//                       <input
//                         type="checkbox"
//                         checked={on}
//                         className="h-4 w-4 accent-cyan-300"
//                         onChange={(e) => setValue('skills', e.target.checked ? [...skills, s] : skills.filter((x) => x !== s), { shouldValidate: true, shouldDirty: true })}
//                       />
//                       {s}
//                     </label>
//                   );
//                 })}
//               </div>
//               {err('skills') && <p id={`${id('skills')}-err`} role="alert" className="mt-2 text-sm font-semibold text-rose-300">{err('skills')}</p>}
//             </fieldset>
//             <Field label="Years of experience" htmlFor={id('experience_years')} error={err('experience_years')}>
//               <input type="number" min={0} max={60} inputMode="numeric" {...register('experience_years', { valueAsNumber: true })} {...a11y('experience_years')} className={INPUT} />
//             </Field>
//           </>
//         )}
//       </div>

//       {/* Actions */}
//       <div className="mt-6 flex gap-3">
//         {step > 0 && (
//           <button type="button" onClick={() => setStep((s) => s - 1)} className="min-h-[52px] rounded-2xl border border-white/15 px-5 font-bold text-slate-200 transition hover:bg-white/5">
//             Back
//           </button>
//         )}
//         <button
//           type="submit"
//           disabled={isSubmitting || (isLast && !ready)}
//           className="min-h-[52px] flex-1 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-600 font-extrabold text-[#04121f] shadow-[0_12px_32px_rgba(37,99,235,.3)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
//         >
//           {isSubmitting ? 'Submitting…' : isLast ? 'Submit application' : 'Continue'}
//         </button>
//       </div>
//       <p className="mt-3 text-center text-xs text-slate-500" aria-live="polite">
//         {saved ? 'Draft saved on this device. ' : ''}By submitting you agree to be contacted on WhatsApp for verification.
//       </p>
//     </form>
//   );
// }

// function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode }) {
//   return (
//     <div>
//       <label htmlFor={htmlFor} className="mb-2 flex items-baseline justify-between gap-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
//         {label}
//         {hint && <span className="text-[11px] font-medium normal-case tracking-normal text-slate-500">{hint}</span>}
//       </label>
//       {children}
//       {error && <p id={`${htmlFor}-err`} role="alert" className="mt-2 text-sm font-semibold text-rose-300">{error}</p>}
//     </div>
//   );
// }
