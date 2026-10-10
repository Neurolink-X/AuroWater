'use client';

import React, {
  Suspense,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import {
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
  Droplets,
} from 'lucide-react';

import {
  ApiError,
  authLogin,
  authResendConfirmation,
  profileToSession,
} from '@/lib/api-client';
import { writeSession } from '@/hooks/useAuth';
import { setAuthGateCookies } from '@/lib/auth/client-gate-cookies';
import { createClient } from '@/utils/supabase/client';

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const schema = z.object({
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters.'),
});

type FormValues = z.infer<typeof schema>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function dashboardFor(role: string) {
  if (role === 'admin') {
    return '/admin/dashboard';
  }

  if (role === 'supplier') {
    return '/supplier/dashboard';
  }

  if (role === 'technician') {
    return '/technician/dashboard';
  }

  return '/';
}

function safeReturnTo(raw: string | null) {
  if (!raw) {
    return null;
  }

  if (!raw.startsWith('/') || raw.startsWith('//')) {
    return null;
  }

  if (raw.startsWith('/auth')) {
    return null;
  }

  return raw;
}

function detectRoleFromEmail(email: string) {
  const value = email.toLowerCase().trim();

  if (value.startsWith('admin@')) {
    return 'admin';
  }

  if (
    value.startsWith('tech@') ||
    value.startsWith('technician@') ||
    value.startsWith('plumber@')
  ) {
    return 'technician';
  }

  if (
    value.startsWith('supplier@') ||
    value.startsWith('supply@')
  ) {
    return 'supplier';
  }

  return 'customer';
}

type RoleMeta = {
  label: string;
  description: string;
  icon: React.ReactNode;
};

const ROLE_META: Record<string, RoleMeta> = {
  customer: {
    label: 'Customer',
    description: 'Your customer account',
    icon: <Droplets className="h-4 w-4" />,
  },
  supplier: {
    label: 'Supplier',
    description: 'Supplier dashboard',
    icon: <Truck className="h-4 w-4" />,
  },
  technician: {
    label: 'Plumber',
    description: 'Technician dashboard',
    icon: <Wrench className="h-4 w-4" />,
  },
  admin: {
    label: 'Admin',
    description: 'Administration dashboard',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
};

/* -------------------------------------------------------------------------- */
/* Small components                                                           */
/* -------------------------------------------------------------------------- */

function Spinner() {
  return (
    <span
      className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
      aria-hidden="true"
    />
  );
}

function WaterDrop() {
  return (
    <div
      className="relative h-28 w-24 animate-[awFloat_4s_ease-in-out_infinite]"
      aria-hidden="true"
    >
      <div className="absolute left-1/2 top-1/2 h-20 w-16 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[65%_45%_65%_45%] bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-600 shadow-[0_18px_40px_rgba(14,165,233,0.35)]" />

      <div className="absolute left-[31%] top-[32%] h-7 w-3 rotate-[25deg] rounded-full bg-white/60 blur-[1px]" />

      <div className="absolute bottom-1 left-1/2 h-2 w-14 -translate-x-1/2 rounded-full bg-cyan-300/20 blur-md" />
    </div>
  );
}

function FieldIcon({
  type,
}: {
  type: 'email' | 'password';
}) {
  if (type === 'password') {
    return <LockKeyhole className="h-[18px] w-[18px]" />;
  }

  return <Mail className="h-[18px] w-[18px]" />;
}

/* -------------------------------------------------------------------------- */
/* Main login page                                                            */
/* -------------------------------------------------------------------------- */

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [values, setValues] = useState<FormValues>({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [err, setErr] =
    useState<string | null>(null);

  const [errCode, setErrCode] =
    useState<string | null>(null);

  const [resendBusy, setResendBusy] =
    useState(false);

  const [fieldErrors, setFieldErrors] =
    useState<Partial<FormValues>>({});

  const rolePreview = useMemo(
    () => detectRoleFromEmail(values.email),
    [values.email]
  );

  const roleMeta =
    ROLE_META[rolePreview] ??
    ROLE_META.customer;

  const urlError = searchParams.get('error');

  const displayedErr =
    err ??
    (urlError
      ? (() => {
          try {
            return decodeURIComponent(urlError);
          } catch {
            return urlError;
          }
        })()
      : null);

  function setField(
    key: keyof FormValues
  ) {
    return (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const nextValue = event.target.value;

      setValues((current) => ({
        ...current,
        [key]: nextValue,
      }));

      setFieldErrors((current) => ({
        ...current,
        [key]: undefined,
      }));

      setErr(null);
      setErrCode(null);
    };
  }


  async function onSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErr(null);
    setErrCode(null);
    setFieldErrors({});

    const parsed = schema.safeParse(values);

    if (!parsed.success) {
      const nextErrors: Partial<FormValues> = {};

      for (const issue of parsed.error.issues) {
        const key =
          issue.path[0] as keyof FormValues;

        if (
          key === 'email' ||
          key === 'password'
        ) {
          nextErrors[key] = issue.message;
        }
      }

      setFieldErrors(nextErrors);
      return;
    }

    setLoading(true);

    try {
      const result = await authLogin(
        parsed.data.email,
        parsed.data.password
      );

      const role =
        (result.profile.role as string) ||
        'customer';

      setAuthGateCookies(role);

      writeSession(
        profileToSession(result.profile, {
          access_token:
            result.access_token,
          refresh_token:
            result.refresh_token,
          expires_at:
            result.expires_at,
        })
      );

      toast.success('Welcome back! 👋');

      const sanitized = safeReturnTo(
        searchParams.get('returnTo')
      );

      const isBookRoute =
        sanitized === '/book' ||
        sanitized?.startsWith('/book?') ||
        sanitized?.startsWith('/book#');

      const destination =
        isBookRoute && role !== 'customer'
          ? dashboardFor(role)
          : sanitized ||
            (role === 'customer'
              ? '/'
              : dashboardFor(role));

      router.replace(destination);
    } catch (error: unknown) {
      let message =
        'Login failed. Please try again.';

      if (error instanceof ApiError) {
        if (error.status === 401) {
          message =
            'Incorrect email or password. Please try again.';
        } else if (error.status === 429) {
          message =
            'Too many attempts. Please wait 60 seconds and try again.';
        } else if (error.status >= 500) {
          message =
            'Server error. Please try again in a moment.';
        } else {
          message = error.message;
        }

        setErrCode(error.code ?? null);
      } else if (error instanceof Error) {
        message = error.message;
        setErrCode(null);
      } else {
        setErrCode(null);
      }

      setErr(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (
      resendBusy ||
      !values.email.trim()
    ) {
      return;
    }

    setResendBusy(true);

    try {
      await authResendConfirmation(
        values.email.trim()
      );

      toast.success(
        'Check your inbox — we sent a new confirmation link.'
      );
    } catch (error: unknown) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not resend confirmation email.';

      toast.error(message);
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      {/* ------------------------------------------------------------------ */}
      {/* Background                                                         */}
      {/* ------------------------------------------------------------------ */}

      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-400/5 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full items-center justify-center px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        <div className="w-full max-w-6xl overflow-hidden rounded-[24px] border border-white/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:rounded-[30px] lg:grid lg:grid-cols-[0.9fr_1.1fr]">
          {/* ================================================================ */}
          {/* LEFT / BRAND PANEL                                               */}
          {/* ================================================================ */}

          <section className="relative hidden min-h-[700px] overflow-hidden bg-[linear-gradient(145deg,#071426_0%,#0b203b_48%,#09233d_100%)] p-8 text-white sm:p-10 lg:flex lg:flex-col lg:justify-between xl:p-12">
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl"
              aria-hidden="true"
            />

            <div
              className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-blue-600/15 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative z-10">
              {/* Brand */}
              <Link
                href="/"
                className="inline-flex items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                aria-label="AuroWater home"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/10 bg-white/10 shadow-lg">
                  <Droplets className="h-6 w-6 text-cyan-300" />
                </span>

                <span>
                  <span className="block text-lg font-black tracking-tight">
                    AuroWater
                  </span>

                  <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                    Pure · Fast · Trusted
                  </span>
                </span>
              </Link>

              {/* Hero */}
              <div className="mt-12 xl:mt-16">
                <div className="flex justify-center">
                  <WaterDrop />
                </div>

                <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/80">
                  Water at your doorstep
                </p>

                <h1 className="mt-3 text-3xl font-black leading-[1.08] tracking-[-0.04em] xl:text-4xl">
                  Pure water,
                  <br />
                  delivered with care.
                </h1>

                <p className="mt-4 max-w-md text-sm leading-7 text-white/55">
                  Manage your water deliveries,
                  service bookings and account from
                  one simple place.
                </p>
              </div>

              {/* Trust points */}
              <div className="mt-9 space-y-3">
                {[
                  'Verified service partners',
                  'Simple and transparent booking',
                  'Support when you need it',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                      <Check className="h-4 w-4" />
                    </span>

                    <span className="text-sm font-medium text-white/70">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Role preview */}
            {values.email.includes('@') && (
              <div className="relative z-10 mt-8 rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                  Account detected
                </p>

                <div className="mt-2 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-cyan-200">
                    {roleMeta.icon}
                  </span>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">
                      {roleMeta.label}
                    </p>

                    <p className="truncate text-xs text-white/40">
                      {roleMeta.description}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ================================================================ */}
          {/* RIGHT / FORM PANEL                                                */}
          {/* ================================================================ */}

          <section className="flex min-h-[calc(100vh-2rem)] flex-col bg-white sm:min-h-0 lg:min-h-[700px]">
            {/* Mobile brand header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7 lg:hidden">
              <Link
                href="/"
                className="flex items-center gap-2.5"
                aria-label="AuroWater home"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-sm">
                  <Droplets className="h-5 w-5" />
                </span>

                <span className="text-base font-black tracking-tight text-slate-950">
                  AuroWater
                </span>
              </Link>

              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Secure login
              </span>
            </div>

            <div className="flex flex-1 items-center px-5 py-7 sm:px-8 sm:py-10 lg:px-10 xl:px-14">
              <div className="mx-auto w-full max-w-md">
                {/* Heading */}
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Welcome back
                  </div>

                  <h2 className="text-[28px] font-black tracking-[-0.04em] text-slate-950 sm:text-3xl">
                    Sign in to AuroWater
                  </h2>

                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    Access your bookings, orders and
                    service dashboard.
                  </p>
                </div>

                {/* Form */}
                <form
                  onSubmit={(event) => {
                    void onSubmit(event);
                  }}
                  noValidate
                  className="mt-7"
                >
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-[13px] font-bold text-slate-700"
                    >
                      Email address
                    </label>

                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <FieldIcon type="email" />
                      </span>

                      <input
                        id="email"
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="you@example.com"
                        value={values.email}
                        onChange={setField('email')}
                        disabled={loading}
                        aria-invalid={
                          fieldErrors.email
                            ? true
                            : undefined
                        }
                        aria-describedby={
                          fieldErrors.email
                            ? 'email-error'
                            : undefined
                        }
                        className={[
                          'aw-login-input h-[52px] w-full rounded-2xl border bg-white pl-11 pr-4 text-[15px] text-slate-950 outline-none transition',
                          'placeholder:text-slate-400',
                          'focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10',
                          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
                          fieldErrors.email
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                            : 'border-slate-200',
                        ].join(' ')}
                      />
                    </div>

                    {fieldErrors.email && (
                      <p
                        id="email-error"
                        role="alert"
                        className="mt-1.5 text-xs font-semibold text-red-600"
                      >
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label
                        htmlFor="password"
                        className="text-[13px] font-bold text-slate-700"
                      >
                        Password
                      </label>

                      <Link
                        href="/auth/forgot-password"
                        className="text-xs font-bold text-emerald-600 transition hover:text-emerald-700 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>

                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <FieldIcon type="password" />
                      </span>

                      <input
                        id="password"
                        name="password"
                        type={
                          showPassword
                            ? 'text'
                            : 'password'
                        }
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={values.password}
                        onChange={setField('password')}
                        disabled={loading}
                        aria-invalid={
                          fieldErrors.password
                            ? true
                            : undefined
                        }
                        aria-describedby={
                          fieldErrors.password
                            ? 'password-error'
                            : undefined
                        }
                        className={[
                          'aw-login-input h-[52px] w-full rounded-2xl border bg-white pl-11 pr-12 text-[15px] text-slate-950 outline-none transition',
                          'placeholder:text-slate-400',
                          'focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10',
                          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
                          fieldErrors.password
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                            : 'border-slate-200',
                        ].join(' ')}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (current) => !current
                          )
                        }
                        disabled={loading}
                        className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={
                          showPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff className="h-[18px] w-[18px]" />
                        ) : (
                          <Eye className="h-[18px] w-[18px]" />
                        )}
                      </button>
                    </div>

                    {fieldErrors.password && (
                      <p
                        id="password-error"
                        role="alert"
                        className="mt-1.5 text-xs font-semibold text-red-600"
                      >
                        {fieldErrors.password}
                      </p>
                    )}
                  </div>

                  {/* Error */}
                  {displayedErr && (
                    <div
                      role="alert"
                      className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4"
                    >
                      <p className="text-sm font-bold leading-5 text-red-800">
                        {displayedErr}
                      </p>

                      {errCode ===
                        'EMAIL_NOT_CONFIRMED' && (
                        <button
                          type="button"
                          disabled={
                            resendBusy ||
                            !values.email.trim()
                          }
                          onClick={() => {
                            void resendConfirmation();
                          }}
                          className="mt-2 text-xs font-bold text-emerald-700 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {resendBusy
                            ? 'Sending confirmation…'
                            : 'Resend confirmation email →'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className={[
                      'mt-6 flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-extrabold text-white',
                      'bg-gradient-to-r from-emerald-600 to-teal-500',
                      'shadow-[0_10px_28px_rgba(5,150,105,0.22)]',
                      'transition duration-200',
                      'hover:-translate-y-0.5 hover:from-emerald-700 hover:to-teal-600 hover:shadow-[0_14px_32px_rgba(5,150,105,0.28)]',
                      'active:translate-y-0',
                      'focus:outline-none focus:ring-4 focus:ring-emerald-500/20',
                      'disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none',
                    ].join(' ')}
                  >
                    {loading ? (
                      <>
                        <Spinner />
                        Signing you in…
                      </>
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>

                  {/* Security note */}
                  <div className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Secure account authentication
                  </div>

                  {/* Divider */}
                  <div className="my-7 flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-100" />

                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">
                      New to AuroWater?
                    </span>

                    <div className="h-px flex-1 bg-slate-100" />
                  </div>

                  {/* Main registration */}
                  <Link
                    href="/auth/register"
                    className="group flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                  >
                    Create a free account
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>

                  {/* Partner registration */}
                  <div className="mt-3 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
                    <Link
                      href="/auth/register?role=supplier"
                      className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                    >
                      <Truck className="h-4 w-4" />
                      Become a supplier
                    </Link>

                    <Link
                      href="/auth/register?role=technician"
                      className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 text-xs font-bold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 focus:outline-none focus:ring-4 focus:ring-violet-500/10"
                    >
                      <Wrench className="h-4 w-4" />
                      Join as plumber
                    </Link>
                  </div>

                  {/* Legal */}
                  <p className="mt-6 text-center text-[11px] leading-5 text-slate-400">
                    By signing in, you agree to our{' '}
                    <Link
                      href="/terms"
                      className="font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700"
                    >
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/privacy"
                      className="font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </form>
              </div>
            </div>

            {/* Bottom mobile reassurance */}
            <div className="border-t border-slate-100 px-5 py-4 text-center sm:px-8 lg:hidden">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Pure · Fast · Trusted
              </p>
            </div>
          </section>
        </div>
      </div>

      <style jsx global>{`
        @keyframes awFloat {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-8px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        .aw-login-input:-webkit-autofill,
        .aw-login-input:-webkit-autofill:hover,
        .aw-login-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #0f172a;
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300" />
            </div>

            <p className="mt-4 text-sm font-semibold text-white/50">
              Loading…
            </p>
          </div>
        </main>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}








// /* eslint-disable react/no-array-index-key */
// 'use client';

// import React, { Suspense, useMemo, useState } from 'react';
// import { z } from 'zod';
// import Link from 'next/link';
// import { useRouter, useSearchParams } from 'next/navigation';
// import { toast } from 'sonner';
// import { ApiError, authLogin, authResendConfirmation, profileToSession } from '@/lib/api-client';
// import { writeSession } from '@/hooks/useAuth';
// import { setAuthGateCookies } from '@/lib/auth/client-gate-cookies';
// import { createClient } from '@/lib/supabase/client';

// const schema = z.object({
//   email: z.string().email('Enter a valid email.'),
//   password: z.string().min(6, 'Password must be at least 6 characters.'),
// });

// type FormValues = z.infer<typeof schema>;

// type Role = 'customer' | 'technician' | 'supplier' | 'admin';

// function dashboardFor(role: string) {
//   if (role === 'admin') return '/admin/dashboard';
//   if (role === 'supplier') return '/supplier/dashboard';
//   if (role === 'technician') return '/technician/dashboard';
//   return '/customer/home';
// }

// function safeReturnTo(raw: string | null) {
//   if (!raw) return null;
//   if (!raw.startsWith('/') || raw.startsWith('//')) return null;
//   if (raw.startsWith('/auth')) return null;
//   return raw;
// }

// function detectRoleFromEmail(email: string): Role {
//   const e = email.toLowerCase().trim();
//   if (e.startsWith('admin@')) return 'admin';
//   if (e.startsWith('tech@') || e.startsWith('plumber@') || e.startsWith('technician@')) return 'technician';
//   if (e.startsWith('supplier@') || e.startsWith('supply@')) return 'supplier';
//   return 'customer';
// }

// function LoginPageInner() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const [values, setValues] = useState<FormValues>({ email: '', password: '' });
//   const [showPassword, setShowPassword] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [googleLoading, setGoogleLoading] = useState(false);
//   const [err, setErr] = useState<string | null>(null);
//   const [errCode, setErrCode] = useState<string | null>(null);
//   const [resendBusy, setResendBusy] = useState(false);

//   const rolePreview = useMemo(() => detectRoleFromEmail(values.email), [values.email]);

//   const urlError = searchParams.get('error');
//   const displayedErr =
//     err ??
//     (urlError
//       ? (() => {
//           try {
//             return decodeURIComponent(urlError);
//           } catch {
//             return urlError;
//           }
//         })()
//       : null);

//   const onGoogle = async () => {
//     setErr(null);
//     setGoogleLoading(true);
//     try {
//       const supabase = createClient();
//       const origin = window.location.origin;
//       const returnTo = searchParams.get('returnTo') || '';
//       const { error } = await supabase.auth.signInWithOAuth({
//         provider: 'google',
//         options: {
//           redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
//           queryParams: { prompt: 'select_account' },
//         },
//       });
//       if (error) {
//         setErr(error.message);
//         toast.error(error.message);
//       }
//     } catch (e: unknown) {
//       const msg = e instanceof Error ? e.message : 'Google sign-in failed.';
//       setErr(msg);
//       toast.error(msg);
//     } finally {
//       setGoogleLoading(false);
//     }
//   };

//   const onSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setErr(null);
//     setErrCode(null);
//     const parsed = schema.safeParse(values);
//     if (!parsed.success) {
//       setErr(parsed.error.issues[0]?.message || 'Invalid input.');
//       return;
//     }
//     setLoading(true);
//     try {
//       const result = await authLogin(parsed.data.email, parsed.data.password);
//       const role = (result.profile.role as Role) || 'customer';

//       setAuthGateCookies(role);
//       writeSession(
//         profileToSession(result.profile, {
//           access_token: result.access_token,
//           refresh_token: result.refresh_token,
//           expires_at: result.expires_at,
//         })
//       );

//       toast.success('Welcome back! 👋');

//       // 3) Give the browser a moment to flush cookies before redirect.
//       await new Promise((r) => setTimeout(r, 200));

//       // 4-5) Redirect to sanitized `returnTo` or the correct dashboard.
      
//      const sanitizedReturnTo = safeReturnTo(
//   searchParams.get('returnTo')
// );

// const isCustomerOnlyRoute =
//   sanitizedReturnTo === '/book' ||
//   sanitizedReturnTo?.startsWith('/book?') ||
//   sanitizedReturnTo?.startsWith('/book#');

// // const dest =
// //   isCustomerOnlyRoute && role !== 'customer'
// //     ? dashboardFor(role)
// //     : sanitizedReturnTo || dashboardFor(role);

//       const dest =
//   isCustomerOnlyRoute && role !== 'customer'
//     ? dashboardFor(role)
//     : sanitizedReturnTo || (role === 'customer' ? '/' : dashboardFor(role));

// router.replace(dest);
//     } catch (e: unknown) {
//       const msg =
//         e instanceof ApiError
//           ? e.status === 401
//             ? 'Invalid email or password'
//             : e.status === 429
//               ? 'Too many attempts — please wait 60 seconds'
//               : e.status >= 500
//                 ? 'Server error — please try again'
//                 : e.message // expected 400 → API message
//           : e instanceof Error
//             ? e.message
//             : 'Login failed. Please try again.';

//       setErr(msg);
//       setErrCode(e instanceof ApiError ? e.code ?? null : null);
//       toast.error(msg);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-slate-50">
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
//         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//           {/* LEFT */}
//           <div className="rounded-3xl bg-[#0F172A] text-white p-8 sm:p-10 relative overflow-hidden">
//             <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-cyan-500/10 blur-2xl" />
//             <div className="relative">
//               <div className="flex items-center justify-center">
//                 <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
//                   💧
//                 </div>
//               </div>
//               <h2 className="mt-6 text-3xl font-extrabold text-center">Welcome to AuroWater</h2>
//               <p className="mt-3 text-center text-white/70">Sign in to your account</p>

//               <ul className="mt-7 space-y-3 text-sm text-white/80">
//                 <li>◎ No app needed — order via WhatsApp too</li>
//                 <li>◎ Same-day delivery available</li>
//                 <li>◎ Verified plumbers on demand</li>
//               </ul>
//               <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
//                 Tip: Use <span className="text-white font-extrabold">{rolePreview ? `${rolePreview}@` : 'admin@'}</span> email prefix to preview role redirects.
//               </div>
//             </div>
//           </div>

//           {/* RIGHT */}
//           <div className="rounded-3xl bg-white border border-slate-100 shadow-card p-7 sm:p-8">
//             <h2 className="text-2xl font-extrabold text-[#0F1C18]">Sign In</h2>
//             <p className="text-slate-600 mt-2 text-sm">Access your dashboard instantly.</p>

//             <form onSubmit={onSubmit} className="mt-6 space-y-4">
//               <div>
//                 <label className="block text-sm font-semibold text-slate-700">Email</label>
//                 <input
//                   type="email"
//                   autoComplete="email"
//                   value={values.email}
//                   onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
//                   className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0D9B6C]"
//                   placeholder="you@company.com"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-semibold text-slate-700">Password</label>
//                 <div className="relative mt-2">
//                   <input
//                     type={showPassword ? 'text' : 'password'}
//                     autoComplete="current-password"
//                     value={values.password}
//                     onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
//                     className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-[#0D9B6C] pr-12"
//                     placeholder="••••••"
//                   />
//                   <button
//                     type="button"
//                     onClick={() => setShowPassword((s) => !s)}
//                     className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-lg text-slate-600 hover:bg-slate-50 font-extrabold"
//                     aria-label={showPassword ? 'Hide password' : 'Show password'}
//                   >
//                     {showPassword ? 'Hide' : 'Show'}
//                   </button>
//                 </div>
//               </div>

//               <div className="flex items-center justify-end">
//                 <Link href="/auth/forgot-password" className="text-sm font-extrabold text-[#0D9B6C] hover:underline">
//                   Forgot password?
//                 </Link>
//               </div>

//               {displayedErr ? (
//                 <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm font-semibold space-y-2">
//                   <p>{displayedErr}</p>
//                   {errCode === 'EMAIL_NOT_CONFIRMED' ? (
//                     <button
//                       type="button"
//                       disabled={resendBusy || !values.email.trim()}
//                       onClick={async () => {
//                         setResendBusy(true);
//                         try {
//                           await authResendConfirmation(values.email);
//                           toast.success('Check your inbox — we sent another confirmation link.');
//                         } catch (re: unknown) {
//                           const m =
//                             re instanceof ApiError ? re.message : re instanceof Error ? re.message : 'Could not resend';
//                           toast.error(m);
//                         } finally {
//                           setResendBusy(false);
//                         }
//                       }}
//                       className="text-[#0D9B6C] font-extrabold underline-offset-2 hover:underline disabled:opacity-50"
//                     >
//                       {resendBusy ? 'Sending…' : 'Resend confirmation email'}
//                     </button>
//                   ) : null}
//                 </div>
//               ) : null}

//               <button
//                 type="submit"
//                 disabled={loading}
//                 className="w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60"
//               >
//                 {loading ? (
//                   <span className="inline-flex items-center justify-center gap-2">
//                     <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
//                       <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" />
//                       <path d="M22 12a10 10 0 0 0-10-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
//                     </svg>
//                     Signing in…
//                   </span>
//                 ) : (
//                   'Sign In'
//                 )}
//               </button>

//               <div className="flex items-center gap-3 pt-2">
//                 <div className="h-px bg-slate-200 flex-1" />
//                 <div className="text-xs font-extrabold text-slate-500">or continue with</div>
//                 <div className="h-px bg-slate-200 flex-1" />
//               </div>

//               <button
//                 type="button"
//                 onClick={onGoogle}
//                 disabled={loading || googleLoading}
//                 className="w-full rounded-xl border border-slate-200 bg-white py-3 font-extrabold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-60"
//               >
//                 {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
//               </button>

//               <Link href="/auth/otp" className="block w-full rounded-xl border border-cyan-200 bg-cyan-50 py-3 text-center font-extrabold text-cyan-900 hover:bg-cyan-100">
//                 Sign in with OTP (SMS)
//               </Link>

//               <div className="text-sm text-slate-600 pt-2">
//                 Don&apos;t have an account?{' '}
//                 <Link href="/auth/register" className="text-[#0D9B6C] font-extrabold hover:underline">
//                   Register →
//                 </Link>
//               </div>

//               <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
//                 <Link href="/auth/register?role=supplier" className="rounded-xl border border-slate-200 py-3 font-extrabold text-slate-700 hover:bg-slate-50 transition text-center">
//                   🚛 Become a Supplier
//                 </Link>
//                 <Link href="/auth/register?role=technician" className="rounded-xl border border-slate-200 py-3 font-extrabold text-slate-700 hover:bg-slate-50 transition text-center">
//                   🔧 Join as Plumber
//                 </Link>
//               </div>
//             </form>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default function LoginPage() {
//   return (
//     <Suspense
//       fallback={
//         <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">Loading…</div>
//       }
//     >
//       <LoginPageInner />
//     </Suspense>
//   );
// }
