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

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

const CITIES = [
  'Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj', 'Agra', 'Meerut',
  'Bareilly', 'Aligarh', 'Mathura', 'Delhi', 'Noida', 'Ghaziabad',
] as const;
type City = (typeof CITIES)[number];

const SKILLS = ['Plumbing', 'RO Service', 'Borewell', 'Motor Repair', 'Water Tanker', 'Tank Cleaning'] as const;
const FLEET_TYPES = ['Tanker', 'Equipment', 'Both'] as const;
type Fleet = (typeof FLEET_TYPES)[number];

type Role = 'customer' | 'technician' | 'supplier';

const ROLES: Record<
  Role,
  {
    title: string;
    hint: string;
    Icon: LucideIcon;
    dest: string;
    cta: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    panelTitle: string;
    panelText: string;
    benefits: string[];
    note?: string;
  }
> = {
  customer: {
    title: 'Customer',
    hint: 'Order water and services',
    Icon: User,
    dest: '/customer/home',
    cta: 'Create customer account',
    nameLabel: 'Full name',
    namePlaceholder: 'Your full name',
    emailLabel: 'Email address',
    emailPlaceholder: 'you@example.com',
    panelTitle: 'Water delivered when you need it.',
    panelText: 'Order 20L RO water and book plumbers, RO care and tank cleaning from one account.',
    benefits: [
      'Order water from nearby suppliers',
      'Book plumbing and water services',
      'Track orders and service status',
    ],
  },
  technician: {
    title: 'Technician',
    hint: 'Get service jobs',
    Icon: Wrench,
    dest: '/technician/dashboard',
    cta: 'Create technician account',
    nameLabel: 'Full name',
    namePlaceholder: 'Your professional name',
    emailLabel: 'Email address',
    emailPlaceholder: 'you@example.com',
    panelTitle: 'Build your service business with AuroTap.',
    panelText: 'Join the professional network and receive service requests in the cities you work in.',
    benefits: [
      'Get relevant service requests',
      'Manage your professional profile',
      'Build a trusted service history',
    ],
    note: 'Professional verification may be required before you can accept service jobs.',
  },
  supplier: {
    title: 'Supplier',
    hint: 'Deliver water',
    Icon: Truck,
    dest: '/supplier/dashboard',
    cta: 'Create supplier account',
    nameLabel: 'Owner or contact person',
    namePlaceholder: 'Owner or authorised person',
    emailLabel: 'Business email',
    emailPlaceholder: 'business@example.com',
    panelTitle: 'Grow your water delivery business.',
    panelText: 'Bring your water delivery operation onto one structured platform.',
    benefits: [
      'Receive customer delivery orders',
      'Manage your business information',
      'Build a trusted supplier presence',
    ],
    note: 'Supplier activation may require business and operational verification.',
  },
};

const ROLE_ORDER: Role[] = ['customer', 'technician', 'supplier'];

const TRUST = ['Secure signup', 'Address check before every booking', 'Support on WhatsApp and email'];

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
  return {
    message: err instanceof Error ? err.message : 'Could not create your account. Please try again.',
    duplicate: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function RegisterClient() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);

  const [role, setRole] = useState<Role>('customer');
  const [values, setValues] = useState<Values>(INITIAL);
  const [terms, setTerms] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [serviceCities, setServiceCities] = useState<string[]>([]);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<{ message: string; duplicate: boolean } | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);

  const cfg = ROLES[role];

  // One-time read of ?role= and ?returnTo=; focus the first field on desktop only
  // (autofocus on mobile would pop the keyboard and hide the page).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRole(parseRole(params.get('role')));
    setReturnTo(referralReturnPath(params.get('returnTo')));
    if (window.matchMedia('(min-width: 1024px)').matches) {
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('input[name="businessName"], input[name="fullName"]')?.focus(),
      );
    }
  }, []);

  // Warm the post-signup destination so the redirect feels instant.
  useEffect(() => {
    router.prefetch(cfg.dest);
  }, [router, cfg.dest]);

  const errors = useMemo(() => validate(role, values, terms), [role, values, terms]);
  const err = (k: FieldKey) => (submitted || touched[k] ? errors[k] : undefined);
  const blur = (k: FieldKey) => () => setTouched((c) => (c[k] ? c : { ...c, [k]: true }));
  const set = (k: keyof Values) => (v: string) => {
    setValues((c) => ({ ...c, [k]: v }));
    setFormError(null);
  };

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

  const toggle = (list: string[], setList: (l: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const finish = async (reg: RegisterResult) => {
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
    router.replace(result.profile.role === 'customer' && returnTo ? returnTo : cfg.dest);
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
    setLoading(true);

    const name = values.fullName.trim();
    const business = values.businessName.trim();

    /*
     * NOTE: technician `skills` and `serviceCities` are collected below but are NOT sent,
     * exactly like the previous version, because authRegister has no fields for them.
     * Add them here once the API accepts them.
     */
    const payload: RegisterPayload = {
      email: values.email.trim().toLowerCase(),
      password: values.password,
      full_name: role === 'supplier' ? `${business} (${name})` : name,
      phone: values.phone,
      role,
      city: values.city as City,
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
      await finish(await authRegister(payload));
      // Success: keep the button locked while the redirect happens.
    } catch (e) {
      const info = describeError(e);
      setFormError(info);
      toast.error(info.message);
      submitting.current = false;
      setLoading(false);
    }
  };

  const supplierId = values.phone.length === 10 ? `${values.phone}@aurotap` : null;
  const rules = [
    { ok: values.password.length >= 8, label: '8+ characters' },
    { ok: /[0-9]/.test(values.password), label: 'One number' },
  ];

  return (
    <main className="min-h-screen bg-white text-slate-900 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel (desktop) */}
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
          <h2 className="text-4xl font-extrabold leading-[1.1] tracking-tight xl:text-5xl">{cfg.panelTitle}</h2>
          <p className="mt-5 text-base leading-7 text-slate-300">{cfg.panelText}</p>
          <ul className="mt-8 space-y-3">
            {cfg.benefits.map((b) => (
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
          {TRUST.map((t) => (
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
          <p className="mt-2 text-[15px] leading-6 text-slate-600">Choose how you want to use AuroTap.</p>

          <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-6">
            {/* Role selector: native radios, so keyboard and screen readers work for free */}
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

            <div className="mt-6 grid gap-x-4 gap-y-4 sm:grid-cols-2">
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
                label={cfg.nameLabel}
                name="fullName"
                value={values.fullName}
                onChange={set('fullName')}
                onBlur={blur('fullName')}
                error={err('fullName')}
                placeholder={cfg.namePlaceholder}
                autoComplete="name"
                autoCapitalize="words"
              />

              <PhoneField
                value={values.phone}
                onChange={(v) => set('phone')(sanitizePhone(v))}
                onBlur={blur('phone')}
                error={err('phone')}
                hint={role === 'supplier' && supplierId ? `Your AuroTap ID: ${supplierId}` : undefined}
              />

              <TextField
                span2
                label={cfg.emailLabel}
                name="email"
                type="email"
                value={values.email}
                onChange={set('email')}
                onBlur={blur('email')}
                error={err('email')}
                hint={role === 'customer' ? undefined : 'This will be your login email.'}
                placeholder={cfg.emailPlaceholder}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
              />

              <SelectField
                label={role === 'supplier' ? 'Operating city' : role === 'technician' ? 'Primary city' : 'City'}
                name="city"
                value={values.city}
                onChange={set('city')}
                onBlur={blur('city')}
                error={err('city')}
                placeholder="Select your city"
                options={CITIES}
              />

              {role === 'supplier' ? (
                <SelectField
                  label="Fleet type"
                  name="fleetType"
                  value={values.fleetType}
                  onChange={set('fleetType')}
                  options={FLEET_TYPES}
                />
              ) : (
                <div className="hidden sm:block" aria-hidden="true" />
              )}

              {role === 'supplier' && (
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
              )}

              {role === 'technician' && (
                <>
                  <ChipGroup
                    label="Your skills"
                    items={SKILLS}
                    selected={skills}
                    onToggle={(i) => toggle(skills, setSkills, i)}
                  />
                  <ChipGroup
                    label="Cities you serve"
                    items={CITIES}
                    selected={serviceCities}
                    onToggle={(i) => toggle(serviceCities, setServiceCities, i)}
                  />
                </>
              )}

              <PasswordField
                value={values.password}
                onChange={set('password')}
                onBlur={blur('password')}
                error={err('password')}
                show={showPassword}
                onToggle={() => setShowPassword((s) => !s)}
                rules={rules}
              />
            </div>

            <TermsCheckbox
              checked={terms}
              onChange={(v) => {
                setTerms(v);
                setTouched((c) => ({ ...c, terms: true }));
              }}
              error={err('terms')}
            />

            {cfg.note ? (
              <p className="mt-4 flex gap-2 rounded-xl bg-sky-50 px-3.5 py-3 text-xs leading-5 text-sky-900">
                <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {cfg.note}
              </p>
            ) : null}

            {formError ? (
              <div role="alert" className="mt-4 flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
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
              className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-base font-extrabold text-[#081321] shadow-[0_10px_24px_rgba(14,165,233,0.25)] transition hover:from-sky-400 hover:to-cyan-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Creating your account…
                </>
              ) : (
                <>
                  {cfg.cta}
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Form primitives                                                            */
/* -------------------------------------------------------------------------- */

function inputClass(error?: string) {
  return [
    'mt-1.5 h-12 w-full rounded-xl border bg-white px-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4',
    error
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
      : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100',
  ].join(' ');
}

function Field({
  id,
  label,
  optional,
  error,
  hint,
  span2,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  span2?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : undefined}>
      <label htmlFor={id} className="text-sm font-bold text-slate-800">
        {label}
        {optional ? <span className="font-normal text-slate-500"> (optional)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="mt-1.5 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 break-all text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function TextField({
  label, name, value, onChange, onBlur, error, hint, span2, optional, type = 'text',
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
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'numeric';
  autoCapitalize?: string;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error} hint={hint} span2={span2} optional={optional}>
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
  value, onChange, onBlur, error, hint,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <Field id={id} label="Mobile number" error={error} hint={hint}>
      <div
        className={[
          'mt-1.5 flex h-12 overflow-hidden rounded-xl border bg-white transition focus-within:ring-4',
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
          aria-describedby={error || hint ? `${id}-msg` : undefined}
        />
      </div>
    </Field>
  );
}

function SelectField({
  label, name, value, onChange, onBlur, error, placeholder, options,
}: {
  label: string;
  name: FieldKey;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  options: readonly string[];
}) {
  const id = useId();
  return (
    <Field id={id} label={label} error={error}>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={inputClass(error)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-msg` : undefined}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

function PasswordField({
  value, onChange, onBlur, error, show, onToggle, rules,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
  show: boolean;
  onToggle: () => void;
  rules: { ok: boolean; label: string }[];
}) {
  const id = useId();
  return (
    <Field id={id} label="Password" error={error} span2>
      <div className="relative">
        <input
          id={id}
          name="password"
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
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
          className="absolute right-1 top-[calc(0.375rem+0.25rem)] grid size-10 place-items-center rounded-lg text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
        >
          {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
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

function ChipGroup({
  label, items, selected, onToggle,
}: {
  label: string;
  items: readonly string[];
  selected: string[];
  onToggle: (item: string) => void;
}) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-bold text-slate-800">
        {label} <span className="font-normal text-slate-500">(optional, select all that apply)</span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => {
          const on = selected.includes(item);
          return (
            <button
              key={item}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(item)}
              className={[
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100',
                on
                  ? 'border-sky-500 bg-sky-50 text-sky-800'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-sky-300',
              ].join(' ')}
            >
              {on ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
              {item}
            </button>
          );
        })}
      </div>
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
    <div className="mt-4">
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
