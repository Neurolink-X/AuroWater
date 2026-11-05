// PATH: same folder as page.tsx
'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Truck,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { ApiError, authRegister, profileToSession, type LoginResult } from '@/lib/api-client';
import { writeSession } from '@/hooks/useAuth';
import { setAuthGateCookies } from '@/lib/auth/client-gate-cookies';
import { referralReturnPath } from '@/lib/referrals/invite-paths';

import { CITIES, FLEET_TYPES, PANEL, SKILLS, type City, type Fleet } from './register-config';

/* -------------------------------------------------------------------------- */
/* Roles: only what genuinely differs (name, icon, destination). All copy is  */
/* shared, so every role sees the same message.                               */
/* -------------------------------------------------------------------------- */

type Role = 'customer' | 'technician' | 'supplier';

const ROLES: Record<Role, { title: string; hint: string; Icon: LucideIcon; dest: string }> = {
  customer: { title: 'Customer', hint: 'Order water and services', Icon: User, dest: '/customer/home' },
  technician: { title: 'Technician', hint: 'Get service jobs', Icon: Wrench, dest: '/technician/dashboard' },
  supplier: { title: 'Supplier', hint: 'Deliver water', Icon: Truck, dest: '/supplier/dashboard' },
};
const ROLE_ORDER: Role[] = ['customer', 'technician', 'supplier'];

/* -------------------------------------------------------------------------- */
/* Validation (plain functions: no schema library in this route's bundle)     */
/* -------------------------------------------------------------------------- */

interface Values {
  businessName: string;
  fullName: string;
  email: string;
  phone: string;
  city: City | '';
  password: string;
  gst: string;
  fleetType: Fleet;
}

type FieldKey = keyof Values | 'terms';
type Errors = Partial<Record<FieldKey, string>>;

const INITIAL: Values = {
  businessName: '',
  fullName: '',
  email: '',
  phone: '',
  city: '',
  password: '',
  gst: '',
  fleetType: 'Tanker',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;
const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Accepts pasted "+91 98893 05803", "098893 05803" or plain digits. */
function sanitizePhone(raw: string) {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

function validate(role: Role, v: Values, terms: boolean): Errors {
  const e: Errors = {};
  if (role === 'supplier' && v.businessName.trim().length < 2) e.businessName = 'Enter your business name.';
  if (v.fullName.trim().length < 2) e.fullName = 'Enter your full name.';
  if (!EMAIL_RE.test(v.email.trim())) e.email = 'Enter a valid email address.';
  if (!PHONE_RE.test(v.phone)) e.phone = 'Enter a valid 10-digit mobile number.';
  if (!v.city) e.city = 'Select your city.';
  if (v.password.length < 8) e.password = 'Use at least 8 characters.';
  else if (!/[0-9]/.test(v.password)) e.password = 'Add at least one number.';
  if (role === 'supplier' && v.gst && !GST_RE.test(v.gst)) e.gst = 'Enter a valid 15-character GSTIN, or leave it blank.';
  if (!terms) e.terms = 'Please accept the Terms and Privacy Policy.';
  return e;
}

const REQUIRED: Record<Role, FieldKey[]> = {
  customer: ['fullName', 'phone', 'email', 'city', 'password', 'terms'],
  technician: ['fullName', 'phone', 'email', 'city', 'password', 'terms'],
  supplier: ['businessName', 'fullName', 'phone', 'email', 'city', 'password', 'terms'],
};

const TYPO_DOMAINS: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com',
  'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'yahho.com': 'yahoo.com', 'yaho.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com', 'outlok.com': 'outlook.com',
};

function suggestEmail(email: string): string | null {
  const [local, domain] = email.trim().toLowerCase().split('@');
  if (!local || !domain) return null;
  const fix = TYPO_DOMAINS[domain];
  return fix ? `${local}@${fix}` : null;
}

function parseRole(value: string | null): Role {
  const r = value?.toLowerCase();
  if (r === 'technician' || r === 'plumber') return 'technician';
  if (r === 'supplier' || r === 'supply') return 'supplier';
  return 'customer';
}

type RegisterPayload = Parameters<typeof authRegister>[0];
type RegisterResult = Awaited<ReturnType<typeof authRegister>>;

function describeError(err: unknown): { message: string; duplicate: boolean } {
  if (err instanceof ApiError) {
    if (err.status === 409) return { message: err.message, duplicate: true };
    if (err.status === 429) return { message: 'Too many attempts. Please wait a moment and try again.', duplicate: false };
    if (err.status >= 500) return { message: 'Our service is temporarily unavailable. Please try again.', duplicate: false };
    return { message: err.message, duplicate: false };
  }
  if (err instanceof TypeError) {
    return { message: 'Network problem. Check your connection and try again.', duplicate: false };
  }
  return {
    message: err instanceof Error ? err.message : 'Could not create your account. Please try again.',
    duplicate: false,
  };
}

type Stage = 'idle' | 'creating' | 'opening';

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function RegisterClient() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);

  const [role, setRole] = useState<Role>('customer');
  const [values, setValues] = useState<Values>(INITIAL);
  const [terms, setTerms] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [extraCities, setExtraCities] = useState<string[]>([]);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [slow, setSlow] = useState(false);
  const [formError, setFormError] = useState<{ message: string; duplicate: boolean } | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);

  const loading = stage !== 'idle';
  const dest = ROLES[role].dest;

  // One-time read of ?role= and ?returnTo= after first paint; focus the first field on desktop only
  // (autofocus on mobile would pop the keyboard and hide the page).
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      setRole(parseRole(params.get('role')));
      setReturnTo(referralReturnPath(params.get('returnTo')));
      if (window.matchMedia('(min-width: 1024px)').matches) {
        formRef.current?.querySelector<HTMLElement>('input[name="businessName"], input[name="fullName"]')?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Warm the post-signup destination so the redirect feels instant.
  useEffect(() => {
    router.prefetch(dest);
  }, [router, dest]);

  // If the server is slow, tell the user it is still working so they do not retry or leave.
  useEffect(() => {
    if (stage !== 'creating') return;
    const t = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(t);
  }, [stage]);

  useEffect(() => {
    if (formError) alertRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [formError]);

  const errors = useMemo(() => validate(role, values, terms), [role, values, terms]);
  const err = (k: FieldKey) => (submitted || touched[k] ? errors[k] : undefined);
  const blur = (k: FieldKey) => () => setTouched((c) => (c[k] ? c : { ...c, [k]: true }));
  const set = (k: keyof Values) => (v: string) => {
    setValues((c) => ({ ...c, [k]: v }));
    setFormError(null);
  };

  const required = REQUIRED[role];
  const done = required.filter((k) => !errors[k]).length;
  const emailSuggestion = !errors.email ? suggestEmail(values.email) : null;

  const customerReturn = role === 'customer' ? returnTo : null;
  const loginHref = customerReturn ? `/auth/login?returnTo=${encodeURIComponent(customerReturn)}` : '/auth/login';

  const changeRole = (next: Role) => {
    if (loading || next === role) return;
    setRole(next);
    setFormError(null);
    // Keep the URL shareable without triggering a navigation.
    const url = new URL(window.location.href);
    if (next === 'customer') url.searchParams.delete('role');
    else url.searchParams.set('role', next);
    window.history.replaceState(window.history.state, '', url);
  };

  const toggleIn = (list: string[], setList: (l: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  // Technician service cities: the primary city is always included and locked.
  const technicianCities = useMemo(
    () => Array.from(new Set([values.city, ...extraCities].filter(Boolean))) as string[],
    [values.city, extraCities],
  );

  const finish = async (reg: RegisterResult) => {
    setStage('opening');
    if ('needsEmailConfirmation' in reg && reg.needsEmailConfirmation) {
      toast.success('Account created. Please verify your email to continue.');
      const extra = customerReturn ? `&returnTo=${encodeURIComponent(customerReturn)}` : '';
      router.replace(`/auth/login?email=${encodeURIComponent(reg.email)}${extra}`);
      return;
    }
    const result = reg as LoginResult;
    writeSession(
      profileToSession(result.profile, {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at,
      }),
    );
    setAuthGateCookies(result.profile.role);
    toast.success('Welcome to AuroTap!');
    router.replace(result.profile.role === 'customer' && returnTo ? returnTo : dest);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;

    setSubmitted(true);
    setFormError(null);

    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }

    submitting.current = true;
    setSlow(false);
    setStage('creating');

    const name = values.fullName.trim();
    const business = values.businessName.trim();

    // Declared skills and operating cities are saved as unverified onboarding preferences.
    // They never grant a service capability or bypass administrator approval.
    const payload: RegisterPayload = {
      email: values.email.trim().toLowerCase(),
      password: values.password,
      full_name: role === 'supplier' ? `${business} (${name})` : name,
      phone: values.phone,
      role,
      city: values.city as City,
      ...(role === 'technician' ? { requested_skills: skills, requested_service_cities: technicianCities } : {}),
      ...(role === 'supplier'
        ? {
            business_name: business,
            business_type: 'Water Service Supplier',
            gst_number: values.gst.trim() || undefined,
            vehicle_type: values.fleetType,
          }
        : {}),
    };

    try {
      const t0 = performance.now();
      const reg = await authRegister(payload);
      if (process.env.NODE_ENV !== 'production') {
        // Dev-only timing: tells you whether the wait is the API call or the page after it.
        console.info(`[register] authRegister took ${Math.round(performance.now() - t0)}ms`);
      }
      await finish(reg);
      // Success: keep the button locked while the redirect happens.
    } catch (e) {
      const info = describeError(e);
      setFormError(info);
      toast.error(info.message);
      submitting.current = false;
      setStage('idle');
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel (desktop). Same message for every role. */}
      <aside
        className="relative hidden overflow-hidden bg-[#081321] p-10 text-white lg:flex lg:flex-col xl:p-14"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 60% 50% at 0% 0%, rgba(14,165,233,0.16), transparent 70%), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(16,185,129,0.08), transparent 70%)',
        }}
      >
        <Link href="/" aria-label="AuroTap home" className="inline-flex w-fit items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300">
          <Image src="/aurotap-mark.svg" width={36} height={36} alt="" priority className="size-9 rounded-xl bg-white/10 p-0.5" />
          <span className="text-xl font-extrabold tracking-tight">AuroTap</span>
        </Link>

        <div className="mt-auto max-w-md pb-10 pt-16">
          <p className="text-4xl font-extrabold leading-[1.1] tracking-tight xl:text-5xl">{PANEL.title}</p>
          <p className="mt-5 text-base leading-7 text-slate-300">{PANEL.text}</p>
          <ul className="mt-8 space-y-3">
            {PANEL.benefits.map((b) => (
              <li key={b} className="flex items-center gap-3 text-[15px] font-medium text-slate-100">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sky-400/15 text-sky-300">
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <ul className="space-y-2 border-t border-white/10 pt-6 text-sm text-slate-300">
          {PANEL.trust.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <ShieldCheck size={16} className="shrink-0 text-emerald-300" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </aside>

      {/* Form */}
      <section className="px-4 py-6 sm:px-6 lg:flex lg:items-center lg:py-10">
        <div className="mx-auto w-full max-w-xl">
          <div className="flex items-center">
            <Link href="/" aria-label="AuroTap home" className="inline-flex items-center gap-2 rounded-lg lg:hidden">
              <Image src="/aurotap-mark.svg" width={32} height={32} alt="" className="size-8 rounded-lg bg-[#081321] p-0.5" />
              <span className="text-lg font-extrabold tracking-tight">AuroTap</span>
            </Link>
            <p className="ml-auto text-sm text-slate-600">
              Have an account?{' '}
              <Link href={loginHref} className="font-bold text-sky-700 hover:text-sky-900 hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-slate-950">Create your AuroTap account</h1>
          <p className="mt-2 text-[15px] leading-6 text-slate-600">{PANEL.short}</p>

          {/* Progress */}
          <div
            className="mt-5"
            role="progressbar"
            aria-label="Form completion"
            aria-valuemin={0}
            aria-valuemax={required.length}
            aria-valuenow={done}
          >
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${(done / required.length) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {done === required.length ? 'All set. You can create your account.' : `${done} of ${required.length} required fields done`}
            </p>
          </div>

          <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-7 space-y-8">
            {/* 1. Role */}
            <Step n={1} title="I am a">
              <fieldset>
                <legend className="sr-only">Account type</legend>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {ROLE_ORDER.map((r) => {
                    const { Icon, title, hint } = ROLES[r];
                    return (
                      <label key={r} className="relative cursor-pointer">
                        <input
                          type="radio"
                          name="role"
                          value={r}
                          checked={role === r}
                          onChange={() => changeRole(r)}
                          className="peer sr-only"
                        />
                        <span className="flex h-full flex-col gap-2 rounded-2xl border border-slate-300 bg-white p-3 transition peer-checked:border-sky-500 peer-checked:bg-sky-50 peer-checked:ring-1 peer-checked:ring-sky-500 peer-focus-visible:ring-4 peer-focus-visible:ring-sky-200 hover:border-slate-400 sm:p-4">
                          <Icon size={20} className="text-sky-700" aria-hidden="true" />
                          <span className="text-sm font-bold text-slate-900">{title}</span>
                          <span className="hidden text-xs leading-4 text-slate-600 sm:block">{hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </Step>

            {/* 2. City: every city visible, one tap, same for all roles */}
            <Step n={2} title="Your city">
              <ChipGrid
                legend="Where are you based?"
                name="city"
                mode="single"
                items={CITIES}
                selected={values.city ? [values.city] : []}
                onToggle={(c) => set('city')(c)}
                onBlur={blur('city')}
                error={err('city')}
              />
              {role === 'technician' && (
                <ChipGrid
                  legend="Other cities you serve"
                  hint="Optional. Your city is always included."
                  name="serviceCities"
                  mode="multi"
                  items={CITIES}
                  selected={technicianCities}
                  locked={values.city || undefined}
                  onToggle={(c) => toggleIn(extraCities, setExtraCities, c)}
                />
              )}
            </Step>

            {/* 3. Details */}
            <Step n={3} title="Your details">
              <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                {role === 'supplier' && (
                  <TextField
                    span2
                    label="Business name"
                    name="businessName"
                    value={values.businessName}
                    onChange={set('businessName')}
                    onBlur={blur('businessName')}
                    error={err('businessName')}
                    placeholder="Your water business name"
                    autoComplete="organization"
                    autoCapitalize="words"
                  />
                )}

                <TextField
                  label="Full name"
                  name="fullName"
                  value={values.fullName}
                  onChange={set('fullName')}
                  onBlur={blur('fullName')}
                  error={err('fullName')}
                  placeholder="Your full name"
                  autoComplete="name"
                  autoCapitalize="words"
                />

                <PhoneField
                  value={values.phone}
                  onChange={(v) => set('phone')(sanitizePhone(v))}
                  onBlur={blur('phone')}
                  error={err('phone')}
                />

                <TextField
                  span2
                  label="Email address"
                  name="email"
                  type="email"
                  value={values.email}
                  onChange={set('email')}
                  onBlur={blur('email')}
                  error={err('email')}
                  hint="This will be your login email."
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  below={
                    emailSuggestion ? (
                      <button
                        type="button"
                        onClick={() => set('email')(emailSuggestion)}
                        className="mt-1 text-xs text-slate-600 hover:text-slate-900"
                      >
                        Did you mean <span className="font-bold text-sky-700 underline">{emailSuggestion}</span>?
                      </button>
                    ) : null
                  }
                />

                {role === 'technician' && (
                  <div className="sm:col-span-2">
                    <ChipGrid
                      legend="Your skills"
                      hint="Optional. Pick only work you can do. Verification may be needed before jobs."
                      name="skills"
                      mode="multi"
                      items={SKILLS}
                      selected={skills}
                      onToggle={(s) => toggleIn(skills, setSkills, s)}
                    />
                  </div>
                )}

                {role === 'supplier' && (
                  <>
                    <div className="sm:col-span-2">
                      <ChipGrid
                        legend="Fleet type"
                        name="fleetType"
                        mode="single"
                        items={FLEET_TYPES}
                        selected={[values.fleetType]}
                        onToggle={(f) => set('fleetType')(f)}
                      />
                    </div>
                    <TextField
                      span2
                      optional
                      label="GST number"
                      name="gst"
                      value={values.gst}
                      onChange={(v) => set('gst')(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))}
                      onBlur={blur('gst')}
                      error={err('gst')}
                      placeholder="15-character GSTIN"
                      autoCapitalize="characters"
                    />
                  </>
                )}
              </div>
            </Step>

            {/* 4. Security */}
            <Step n={4} title="Secure your account">
              <PasswordField
                value={values.password}
                onChange={set('password')}
                onBlur={() => {
                  blur('password')();
                  setCapsLock(false);
                }}
                onKeyUp={(e) => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
                error={err('password')}
                show={showPassword}
                onToggle={() => setShowPassword((s) => !s)}
                capsLock={capsLock}
                rules={[
                  { ok: values.password.length >= 8, label: '8+ characters' },
                  { ok: /[0-9]/.test(values.password), label: 'One number' },
                ]}
              />
              <TermsCheckbox
                checked={terms}
                onChange={(v) => {
                  setTerms(v);
                  setTouched((c) => ({ ...c, terms: true }));
                }}
                error={err('terms')}
              />
            </Step>

            <div>
              {formError ? (
                <div ref={alertRef} role="alert" className="mb-4 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">{formError.message}</p>
                    {formError.duplicate ? (
                      <Link href={loginHref} className="mt-1 inline-block font-bold underline">
                        Sign in instead
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-base font-extrabold text-[#081321] shadow-[0_10px_24px_rgba(14,165,233,0.25)] transition hover:from-sky-400 hover:to-cyan-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-80"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    {stage === 'opening' ? 'Account created. Redirecting…' : 'Creating your account…'}
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight size={18} aria-hidden="true" />
                  </>
                )}
              </button>

              <p role="status" aria-live="polite" className="mt-3 min-h-5 text-center text-xs text-slate-600">
                {stage === 'creating' && slow
                  ? 'Still working. This is taking longer than usual. Please keep this page open and do not tap again.'
                  : stage === 'opening'
                    ? 'Almost there. Loading your next screen.'
                    : ''}
              </p>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form primitives                                                            */
/* -------------------------------------------------------------------------- */

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="flex items-center gap-2.5 text-base font-extrabold text-slate-950">
        <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">
          {n}
        </span>
        {title}
      </h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function inputClass(error?: string) {
  return [
    'block h-12 w-full rounded-xl border bg-white px-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4',
    error
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
      : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100',
  ].join(' ');
}

function Field({
  id, label, optional, error, hint, span2, below, children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  span2?: boolean;
  below?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : undefined}>
      <label htmlFor={id} className="text-sm font-bold text-slate-800">
        {label}
        {optional ? <span className="font-normal text-slate-500"> (optional)</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-msg`} role="alert" className="mt-1.5 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {below}
    </div>
  );
}

function TextField({
  label, name, value, onChange, onBlur, error, hint, span2, optional, below, type = 'text',
  placeholder, autoComplete, inputMode, autoCapitalize,
}: {
  label: string;
  name: FieldKey;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
  hint?: string;
  span2?: boolean;
  optional?: boolean;
  below?: ReactNode;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'numeric';
  autoCapitalize?: string;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint} span2={span2} optional={optional} below={below}>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={inputClass(error)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        spellCheck={false}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
      />
    </Field>
  );
}

function PhoneField({
  value, onChange, onBlur, error,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
}) {
  const id = useId();
  return (
    <Field id={id} label="Mobile number" error={error}>
      <div
        className={[
          'flex h-12 overflow-hidden rounded-xl border bg-white transition focus-within:ring-4',
          error
            ? 'border-rose-400 focus-within:border-rose-500 focus-within:ring-rose-100'
            : 'border-slate-300 focus-within:border-sky-500 focus-within:ring-sky-100',
        ].join(' ')}
      >
        <span className="flex items-center border-r border-slate-300 bg-slate-50 px-3 text-sm font-bold text-slate-700">+91</span>
        <input
          id={id}
          name="phone"
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="min-w-0 flex-1 bg-transparent px-3 text-base text-slate-900 outline-none placeholder:text-slate-400"
          placeholder="10-digit number"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-msg` : undefined}
        />
      </div>
    </Field>
  );
}

function PasswordField({
  value, onChange, onBlur, onKeyUp, error, show, onToggle, capsLock, rules,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  error?: string;
  show: boolean;
  onToggle: () => void;
  capsLock: boolean;
  rules: { ok: boolean; label: string }[];
}) {
  const id = useId();
  return (
    <Field id={id} label="Password" error={error}>
      <div className="relative">
        <input
          id={id}
          name="password"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyUp={onKeyUp}
          className={`${inputClass(error)} pr-12`}
          placeholder="Create a password"
          autoComplete="new-password"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-msg` : undefined}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute right-1 top-1 grid size-10 place-items-center rounded-lg text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
        >
          {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {capsLock ? <p className="mt-1.5 text-xs font-semibold text-amber-700">Caps Lock is on.</p> : null}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {rules.map((r) => (
          <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.ok ? 'font-semibold text-emerald-700' : 'text-slate-500'}`}>
            <Check size={13} strokeWidth={r.ok ? 3 : 2} aria-hidden="true" />
            {r.label}
            <span className="sr-only">{r.ok ? ' (met)' : ' (not met yet)'}</span>
          </li>
        ))}
      </ul>
    </Field>
  );
}

/**
 * Every option visible as a tap target (no dropdown, no hidden panel).
 * Native radios/checkboxes underneath: keyboard, arrow keys and screen readers just work.
 */
function ChipGrid({
  legend, hint, name, mode, items, selected, onToggle, onBlur, error, locked,
}: {
  legend: string;
  hint?: string;
  name: string;
  mode: 'single' | 'multi';
  items: readonly string[];
  selected: string[];
  onToggle: (item: string) => void;
  onBlur?: () => void;
  error?: string;
  locked?: string;
}) {
  return (
    <fieldset onBlur={onBlur}>
      <legend className="text-sm font-bold text-slate-800">{legend}</legend>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => {
          const on = selected.includes(item);
          const isLocked = locked === item;
          return (
            <label key={item} className={`relative ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}>
              <input
                type={mode === 'single' ? 'radio' : 'checkbox'}
                name={name}
                value={item}
                checked={on}
                disabled={isLocked}
                onChange={() => onToggle(item)}
                aria-invalid={error ? true : undefined}
                className="peer sr-only"
              />
              <span
                className={[
                  'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition peer-focus-visible:ring-4 peer-focus-visible:ring-sky-200',
                  on
                    ? 'border-sky-500 bg-sky-50 text-sky-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300',
                ].join(' ')}
              >
                {on ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
                {item}
                {isLocked ? <span className="text-xs font-medium text-sky-700">Primary</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function TermsCheckbox({
  checked, onChange, error,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          name="terms"
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-msg` : undefined}
          className="mt-0.5 size-5 shrink-0 rounded accent-sky-600"
        />
        <label htmlFor={id} className="text-sm leading-5 text-slate-700">
          I agree to the AuroTap{' '}
          <Link href="/terms" target="_blank" rel="noopener" className="font-bold text-sky-700 hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" target="_blank" rel="noopener" className="font-bold text-sky-700 hover:underline">
            Privacy Policy
          </Link>
          .
        </label>
      </div>
      {error ? (
        <p id={`${id}-msg`} role="alert" className="mt-1.5 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
