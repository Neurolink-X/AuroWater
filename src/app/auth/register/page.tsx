'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ApiError,
  authRegister,
  profileToSession,
  type LoginResult,
} from '@/lib/api-client';
import { writeSession } from '@/hooks/useAuth';
import { setAuthGateCookies } from '@/lib/auth/client-gate-cookies';

const SERVICE_CITIES = [
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

type City = (typeof SERVICE_CITIES)[number];

type Role = 'customer' | 'technician' | 'supplier';

const SKILLS = [
  'Plumbing',
  'RO Service',
  'Borewell',
  'Motor Repair',
  'Water Tanker',
  'Tank Cleaning',
] as const;

const FLEET_TYPES = ['Tanker', 'Equipment', 'Both'] as const;

function detectInitialRole(): Role {
  if (typeof window === 'undefined') {
    return 'customer';
  }

  const role = new URLSearchParams(window.location.search)
    .get('role')
    ?.toLowerCase();

  if (role === 'technician' || role === 'plumber') {
    return 'technician';
  }

  if (role === 'supplier' || role === 'supply') {
    return 'supplier';
  }

  return 'customer';
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function passwordScore(password: string) {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const lengthOk = password.length >= 8;

  return (
    (lengthOk ? 1 : 0) +
    (hasNumber ? 1 : 0) +
    (hasSymbol ? 1 : 0) +
    (hasLower && hasUpper ? 1 : 0)
  );
}

function passwordLabel(score: number) {
  if (score <= 1) return 'Weak';
  if (score === 2) return 'Fair';
  if (score === 3) return 'Good';
  return 'Strong';
}

const customerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name.'),
    email: z.string().trim().email('Enter a valid email address.'),
    phone: z
      .string()
      .regex(/^\d{10}$/, 'Enter exactly 10 digits.'),
    city: z
      .string()
      .refine(
        (value) =>
          (SERVICE_CITIES as readonly string[]).includes(value),
        'Select your city.'
      ),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .regex(/[0-9]/, 'Password must contain at least one number.'),
    confirmPassword: z.string(),
    terms: z.boolean().refine(
      (value) => value,
      'Please accept the Terms and Privacy Policy.'
    ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

const professionalSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z
    .string()
    .regex(/^\d{10}$/, 'Enter exactly 10 digits.'),
  city: z
    .string()
    .refine(
      (value) =>
        (SERVICE_CITIES as readonly string[]).includes(value),
      'Select your city.'
    ),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[0-9]/, 'Password must contain at least one number.'),
  confirmPassword: z.string(),
  terms: z.boolean().refine(
    (value) => value,
    'Please accept the Terms and Privacy Policy.'
  ),
});

type FieldErrors = Record<string, string>;

export default function RegisterPage() {
  const router = useRouter();

  const [role, setRole] = useState<Role>('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  /* Customer */
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerFullName, setCustomerFullName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] =
    useState<City>('Kanpur');
  const [customerPassword, setCustomerPassword] = useState('');
  const [customerConfirm, setCustomerConfirm] = useState('');
  const [customerTerms, setCustomerTerms] = useState(false);

  /* Technician */
  const [techEmail, setTechEmail] = useState('');
  const [techFullName, setTechFullName] = useState('');
  const [techPhone, setTechPhone] = useState('');
  const [techCity, setTechCity] = useState<City>('Kanpur');
  const [techPassword, setTechPassword] = useState('');
  const [techConfirm, setTechConfirm] = useState('');
  const [techTerms, setTechTerms] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    []
  );
  const [selectedTechCities, setSelectedTechCities] =
    useState<string[]>(['Kanpur']);

  /* Supplier */
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierBusinessName, setSupplierBusinessName] =
    useState('');
  const [supplierOwnerName, setSupplierOwnerName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierCity, setSupplierCity] =
    useState<City>('Kanpur');
  const [supplierGst, setSupplierGst] = useState('');
  const [supplierFleetType, setSupplierFleetType] =
    useState<(typeof FLEET_TYPES)[number]>('Tanker');
  const [supplierPassword, setSupplierPassword] = useState('');
  const [supplierConfirm, setSupplierConfirm] = useState('');
  const [supplierTerms, setSupplierTerms] = useState(false);

  useEffect(() => {
    const initialRole = detectInitialRole();
    setRole(initialRole);

    document.title =
      'Create Your AuroTap Account | Water Delivery & Home Services';

    const description =
      'Create your AuroTap account to order water, book home water services, or join as a verified technician or supplier.';

    let meta = document.querySelector(
      'meta[name="description"]'
    ) as HTMLMetaElement | null;

    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }

    meta.content = description;

    let robots = document.querySelector(
      'meta[name="robots"]'
    ) as HTMLMetaElement | null;

    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }

    robots.content = 'noindex,nofollow';
  }, []);

  const activePassword =
    role === 'customer'
      ? customerPassword
      : role === 'technician'
        ? techPassword
        : supplierPassword;

  const passwordScoreValue = useMemo(
    () => passwordScore(activePassword),
    [activePassword]
  );

  const passwordStrength = passwordLabel(passwordScoreValue);

  const supplierIdPreview = useMemo(() => {
    const phone = normalizePhone(supplierPhone);

    if (!phone) {
      return 'Your AuroTap ID';
    }

    return `${phone}@aurotap`;
  }, [supplierPhone]);

  const clearValidation = (field?: string) => {
    if (!field) {
      setFieldErrors({});
      setError(null);
      return;
    }

    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });

    setError(null);
  };

  const changeRole = (nextRole: Role) => {
    if (loading) return;

    setRole(nextRole);
    setError(null);
    setFieldErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const applyZodErrors = (
    result:
      | z.SafeParseSuccess<unknown>
      | z.SafeParseError<unknown>
  ) => {
    if (result.success) return;

    const nextErrors: FieldErrors = {};

    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? 'form');

      if (!nextErrors[key]) {
        nextErrors[key] = issue.message;
      }
    }

    setFieldErrors(nextErrors);
  };

  const finishRegistration = async (
    reg:
      | LoginResult
      | {
          needsEmailConfirmation: true;
          email: string;
          pending?: boolean;
        },
    destination: string
  ) => {
    if (
      'needsEmailConfirmation' in reg &&
      reg.needsEmailConfirmation
    ) {
      toast.success(
        'Account created. Please verify your email to continue.'
      );

      router.replace(
        `/auth/login?email=${encodeURIComponent(reg.email)}`
      );

      return;
    }

    const result = reg as LoginResult;

    writeSession(
      profileToSession(result.profile, {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at,
      })
    );

    setAuthGateCookies(result.profile.role);

    toast.success('Welcome to AuroTap!');

    await new Promise((resolve) => setTimeout(resolve, 150));

    router.replace(destination);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (loading) return;

    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      if (role === 'customer') {
        const phone = normalizePhone(customerPhone);

        const parsed = customerSchema.safeParse({
          fullName: customerFullName,
          email: customerEmail,
          phone,
          city: customerCity,
          password: customerPassword,
          confirmPassword: customerConfirm,
          terms: customerTerms,
        });

        if (!parsed.success) {
          applyZodErrors(parsed);
          throw new Error(
            parsed.error.issues[0]?.message ||
              'Please check the highlighted fields.'
          );
        }

        /*
         * IMPORTANT:
         * city is explicitly sent to the backend.
         * This fixes the previous "Enter your city" bug.
         */
        const reg = await authRegister({
          email: parsed.data.email,
          password: parsed.data.password,
          full_name: parsed.data.fullName,
          phone,
          role: 'customer',
          city: parsed.data.city,
        });

        await finishRegistration(reg, '/customer/home');
        return;
      }

      if (role === 'technician') {
        const phone = normalizePhone(techPhone);

        const parsed = professionalSchema.safeParse({
          fullName: techFullName,
          email: techEmail,
          phone,
          city: techCity,
          password: techPassword,
          confirmPassword: techConfirm,
          terms: techTerms,
        });

        if (!parsed.success) {
          applyZodErrors(parsed);
          throw new Error(
            parsed.error.issues[0]?.message ||
              'Please check the highlighted fields.'
          );
        }

        if (!selectedSkills.length) {
          setError('Select at least one professional skill.');
          throw new Error(
            'Select at least one professional skill.'
          );
        }

        if (!selectedTechCities.length) {
          setError('Select at least one service city.');
          throw new Error(
            'Select at least one service city.'
          );
        }

        /*
         * IMPORTANT:
         * city is explicitly sent to the backend.
         */
        const reg = await authRegister({
          email: parsed.data.email,
          password: parsed.data.password,
          full_name: parsed.data.fullName,
          phone,
          role: 'technician',
          city: parsed.data.city,
        });

        await finishRegistration(
          reg,
          '/technician/dashboard'
        );

        return;
      }

      const phone = normalizePhone(supplierPhone);

      const parsed = professionalSchema.safeParse({
        fullName: supplierOwnerName,
        email: supplierEmail,
        phone,
        city: supplierCity,
        password: supplierPassword,
        confirmPassword: supplierConfirm,
        terms: supplierTerms,
      });

      if (!parsed.success) {
        applyZodErrors(parsed);
        throw new Error(
          parsed.error.issues[0]?.message ||
            'Please check the highlighted fields.'
        );
      }

      if (!supplierBusinessName.trim()) {
        setFieldErrors({
          businessName: 'Enter your business name.',
        });

        throw new Error('Enter your business name.');
      }

      /*
       * IMPORTANT:
       * city + supplier onboarding information are explicitly
       * sent to the backend.
       */
      const reg = await authRegister({
        email: parsed.data.email,
        password: parsed.data.password,
        full_name: `${supplierBusinessName.trim()} (${parsed.data.fullName})`,
        phone,
        role: 'supplier',
        city: parsed.data.city,
        business_name: supplierBusinessName.trim(),
        business_type: 'Water Service Supplier',
        gst_number: supplierGst.trim() || undefined,
        vehicle_type: supplierFleetType,
      });

      await finishRegistration(
        reg,
        '/supplier/dashboard'
      );
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.status === 409
            ? err.message
            : err.status === 429
              ? 'Too many attempts. Please wait a moment and try again.'
              : err.status >= 500
                ? 'Our service is temporarily unavailable. Please try again.'
                : err.message
          : err instanceof Error
            ? err.message
            : 'Could not create your account. Please try again.';

      setError(message);

      if (!(err instanceof Error && err.message === message)) {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((current) =>
      current.includes(skill)
        ? current.filter((item) => item !== skill)
        : [...current, skill]
    );

    setError(null);
  };

  const toggleServiceCity = (city: string) => {
    setSelectedTechCities((current) =>
      current.includes(city)
        ? current.filter((item) => item !== city)
        : [...current, city]
    );

    setError(null);
  };

  const roleContent = {
    customer: {
      eyebrow: 'For customers',
      title: 'Water delivered when you need it.',
      description:
        'Create your account and get reliable water delivery and home water services from one place.',
      benefits: [
        'Order water from nearby suppliers',
        'Book plumbing & water services',
        'Track orders and service status',
      ],
    },
    technician: {
      eyebrow: 'For technicians',
      title: 'Build your service business with AuroTap.',
      description:
        'Join the professional network and receive service opportunities in the areas you serve.',
      benefits: [
        'Get relevant service opportunities',
        'Manage your professional profile',
        'Build a trusted service history',
      ],
    },
    supplier: {
      eyebrow: 'For suppliers',
      title: 'Grow your water delivery business.',
      description:
        'Bring your water delivery operation onto a structured digital platform.',
      benefits: [
        'Receive customer delivery orders',
        'Manage your business information',
        'Build a trusted supplier presence',
      ],
    },
  }[role];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto min-h-screen max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="grid min-h-[calc(100vh-2rem)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)] lg:grid-cols-[0.9fr_1.1fr]">
          {/* BRAND / BENEFITS */}
          <section className="relative overflow-hidden bg-[#071A16] px-5 py-7 text-white sm:px-8 sm:py-9 lg:px-10 lg:py-12">
            <div
              className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl"
              aria-hidden="true"
            />

            <div
              className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative z-10 flex h-full flex-col">
              <Link
                href="/"
                className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                aria-label="Go to AuroTap home"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-400 text-sm text-[#071A16]">
                  A
                </span>
                AuroTap
              </Link>

              <div className="mt-10 max-w-xl sm:mt-16">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                  {roleContent.eyebrow}
                </p>

                <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                  {roleContent.title}
                </h1>

                <p className="mt-5 max-w-lg text-sm leading-7 text-white/70 sm:text-base">
                  {roleContent.description}
                </p>
              </div>

              <div className="mt-8 grid gap-3">
                {roleContent.benefits.map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4"
                  >
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-sm text-emerald-300">
                      ✓
                    </span>

                    <span className="text-sm font-semibold leading-6 text-white/85">
                      {benefit}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-auto hidden pt-10 lg:block">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-sm font-bold text-white">
                    Built for real local service needs
                  </p>

                  <p className="mt-2 text-xs leading-6 text-white/55">
                    Your account helps AuroTap understand your role,
                    city and service requirements so the platform can
                    provide the right experience.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* FORM */}
          <section className="px-4 py-6 sm:px-8 sm:py-9 lg:px-12 lg:py-12">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-600">
                    Get started
                  </p>

                  <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    Create your account
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Choose how you want to use AuroTap.
                  </p>
                </div>

                <div className="hidden rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 sm:block">
                  Secure signup
                </div>
              </div>

              {/* ROLE SELECTOR */}
              <div
                className="mt-7 grid grid-cols-3 gap-2 sm:gap-3"
                role="tablist"
                aria-label="Choose account type"
              >
                <RoleButton
                  active={role === 'customer'}
                  title="Customer"
                  description="Order services"
                  icon="👤"
                  onClick={() => changeRole('customer')}
                />

                <RoleButton
                  active={role === 'technician'}
                  title="Technician"
                  description="Get service jobs"
                  icon="🔧"
                  onClick={() => changeRole('technician')}
                />

                <RoleButton
                  active={role === 'supplier'}
                  title="Supplier"
                  description="Deliver water"
                  icon="🚛"
                  onClick={() => changeRole('supplier')}
                />
              </div>

              <form
                onSubmit={onSubmit}
                className="mt-7 space-y-5"
                noValidate
              >
                {role === 'customer' && (
                  <>
                    <Field
                      label="Full name"
                      required
                      error={fieldErrors.fullName}
                    >
                      <input
                        value={customerFullName}
                        onChange={(event) => {
                          setCustomerFullName(event.target.value);
                          clearValidation('fullName');
                        }}
                        className={inputClass(
                          Boolean(fieldErrors.fullName)
                        )}
                        placeholder="Enter your full name"
                        autoComplete="name"
                        autoCapitalize="words"
                      />
                    </Field>

                    <Field
                      label="Email address"
                      required
                      error={fieldErrors.email}
                    >
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(event) => {
                          setCustomerEmail(event.target.value);
                          clearValidation('email');
                        }}
                        className={inputClass(
                          Boolean(fieldErrors.email)
                        )}
                        placeholder="you@example.com"
                        autoComplete="email"
                        inputMode="email"
                      />
                    </Field>

                    <Field
                      label="Mobile number"
                      required
                      error={fieldErrors.phone}
                    >
                      <PhoneInput
                        value={customerPhone}
                        onChange={(value) => {
                          setCustomerPhone(value);
                          clearValidation('phone');
                        }}
                        error={Boolean(fieldErrors.phone)}
                      />
                    </Field>

                    <Field
                      label="City"
                      required
                      error={fieldErrors.city}
                    >
                      <CitySelect
                        value={customerCity}
                        onChange={(value) => {
                          setCustomerCity(value);
                          clearValidation('city');
                        }}
                        error={Boolean(fieldErrors.city)}
                      />
                    </Field>

                    <PasswordField
                      label="Password"
                      value={customerPassword}
                      onChange={(value) => {
                        setCustomerPassword(value);
                        clearValidation('password');
                      }}
                      show={showPassword}
                      onToggle={() =>
                        setShowPassword((current) => !current)
                      }
                      error={fieldErrors.password}
                    />

                    <PasswordField
                      label="Confirm password"
                      value={customerConfirm}
                      onChange={(value) => {
                        setCustomerConfirm(value);
                        clearValidation('confirmPassword');
                      }}
                      show={showConfirmPassword}
                      onToggle={() =>
                        setShowConfirmPassword(
                          (current) => !current
                        )
                      }
                      error={fieldErrors.confirmPassword}
                    />

                    <TermsCheckbox
                      checked={customerTerms}
                      onChange={setCustomerTerms}
                      error={fieldErrors.terms}
                    />
                  </>
                )}

                {role === 'technician' && (
                  <>
                    <Field
                      label="Full name"
                      required
                      error={fieldErrors.fullName}
                    >
                      <input
                        value={techFullName}
                        onChange={(event) => {
                          setTechFullName(event.target.value);
                          clearValidation('fullName');
                        }}
                        className={inputClass(
                          Boolean(fieldErrors.fullName)
                        )}
                        placeholder="Your professional name"
                        autoComplete="name"
                      />
                    </Field>

                    <Field
                      label="Email address"
                      required
                      hint="This will be your login email."
                      error={fieldErrors.email}
                    >
                      <input
                        type="email"
                        value={techEmail}
                        onChange={(event) => {
                          setTechEmail(event.target.value);
                          clearValidation('email');
                        }}
                        className={inputClass(
                          Boolean(fieldErrors.email)
                        )}
                        placeholder="you@example.com"
                        autoComplete="email"
                        inputMode="email"
                      />
                    </Field>

                    <Field
                      label="Mobile number"
                      required
                      error={fieldErrors.phone}
                    >
                      <PhoneInput
                        value={techPhone}
                        onChange={(value) => {
                          setTechPhone(value);
                          clearValidation('phone');
                        }}
                        error={Boolean(fieldErrors.phone)}
                      />
                    </Field>

                    <Field
                      label="Primary city"
                      required
                      hint="Used for your professional profile."
                      error={fieldErrors.city}
                    >
                      <CitySelect
                        value={techCity}
                        onChange={(value) => {
                          setTechCity(value);
                          clearValidation('city');
                        }}
                        error={Boolean(fieldErrors.city)}
                      />
                    </Field>

                    <div>
                      <SectionLabel>
                        Professional skills
                      </SectionLabel>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {SKILLS.map((skill) => {
                          const active =
                            selectedSkills.includes(skill);

                          return (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => toggleSkill(skill)}
                              aria-pressed={active}
                              className={[
                                'rounded-full border px-3.5 py-2 text-sm font-bold transition',
                                active
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50',
                              ].join(' ')}
                            >
                              {active ? '✓ ' : ''}
                              {skill}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <SectionLabel>
                        Service cities
                      </SectionLabel>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {SERVICE_CITIES.map((city) => {
                          const active =
                            selectedTechCities.includes(city);

                          return (
                            <button
                              key={city}
                              type="button"
                              onClick={() =>
                                toggleServiceCity(city)
                              }
                              aria-pressed={active}
                              className={[
                                'rounded-full border px-3.5 py-2 text-sm font-bold transition',
                                active
                                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50/50',
                              ].join(' ')}
                            >
                              {active ? '✓ ' : ''}
                              {city}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <PasswordField
                      label="Password"
                      value={techPassword}
                      onChange={(value) => {
                        setTechPassword(value);
                        clearValidation('password');
                      }}
                      show={showPassword}
                      onToggle={() =>
                        setShowPassword((current) => !current)
                      }
                      error={fieldErrors.password}
                    />

                    <PasswordField
                      label="Confirm password"
                      value={techConfirm}
                      onChange={(value) => {
                        setTechConfirm(value);
                        clearValidation('confirmPassword');
                      }}
                      show={showConfirmPassword}
                      onToggle={() =>
                        setShowConfirmPassword(
                          (current) => !current
                        )
                      }
                      error={fieldErrors.confirmPassword}
                    />

                    <TermsCheckbox
                      checked={techTerms}
                      onChange={setTechTerms}
                      error={fieldErrors.terms}
                    />

                    <InfoBox>
                      Professional verification may be required
                      before you can accept service jobs.
                    </InfoBox>
                  </>
                )}

                {role === 'supplier' && (
                  <>
                    <Field
                      label="Business name"
                      required
                      error={fieldErrors.businessName}
                    >
                      <input
                        value={supplierBusinessName}
                        onChange={(event) => {
                          setSupplierBusinessName(
                            event.target.value
                          );
                          clearValidation('businessName');
                        }}
                        className={inputClass(
                          Boolean(fieldErrors.businessName)
                        )}
                        placeholder="Your water business name"
                        autoCapitalize="words"
                      />
                    </Field>

                    <Field
                      label="Owner / contact person"
                      required
                      error={fieldErrors.fullName}
                    >
                      <input
                        value={supplierOwnerName}
                        onChange={(event) => {
                          setSupplierOwnerName(event.target.value);
                          clearValidation('fullName');
                        }}
                        className={inputClass(
                          Boolean(fieldErrors.fullName)
                        )}
                        placeholder="Owner or authorized person"
                        autoComplete="name"
                      />
                    </Field>

                    <Field
                      label="Business email"
                      required
                      hint="This will be your login email."
                      error={fieldErrors.email}
                    >
                      <input
                        type="email"
                        value={supplierEmail}
                        onChange={(event) => {
                          setSupplierEmail(event.target.value);
                          clearValidation('email');
                        }}
                        className={inputClass(
                          Boolean(fieldErrors.email)
                        )}
                        placeholder="business@example.com"
                        autoComplete="email"
                        inputMode="email"
                      />
                    </Field>

                    <Field
                      label="Mobile number"
                      required
                      error={fieldErrors.phone}
                    >
                      <PhoneInput
                        value={supplierPhone}
                        onChange={(value) => {
                          setSupplierPhone(value);
                          clearValidation('phone');
                        }}
                        error={Boolean(fieldErrors.phone)}
                      />
                    </Field>

                    <Field
                      label="Operating city"
                      required
                      error={fieldErrors.city}
                    >
                      <CitySelect
                        value={supplierCity}
                        onChange={(value) => {
                          setSupplierCity(value);
                          clearValidation('city');
                        }}
                        error={Boolean(fieldErrors.city)}
                      />
                    </Field>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-black uppercase tracking-wide text-slate-500">
                        AuroTap supplier ID
                      </div>

                      <div className="mt-2 break-all text-sm font-black text-slate-900">
                        {supplierIdPreview}
                      </div>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Your final supplier identity may be confirmed
                        during onboarding.
                      </p>
                    </div>

                    <Field
                      label="GST number"
                      hint="Optional at initial signup."
                    >
                      <input
                        value={supplierGst}
                        onChange={(event) =>
                          setSupplierGst(
                            event.target.value
                              .toUpperCase()
                              .slice(0, 15)
                          )
                        }
                        className={inputClass(false)}
                        placeholder="Optional GSTIN"
                        autoCapitalize="characters"
                      />
                    </Field>

                    <Field label="Fleet / service type">
                      <select
                        value={supplierFleetType}
                        onChange={(event) =>
                          setSupplierFleetType(
                            event.target
                              .value as (typeof FLEET_TYPES)[number]
                          )
                        }
                        className={inputClass(false)}
                      >
                        {FLEET_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <PasswordField
                      label="Password"
                      value={supplierPassword}
                      onChange={(value) => {
                        setSupplierPassword(value);
                        clearValidation('password');
                      }}
                      show={showPassword}
                      onToggle={() =>
                        setShowPassword((current) => !current)
                      }
                      error={fieldErrors.password}
                    />

                    <PasswordField
                      label="Confirm password"
                      value={supplierConfirm}
                      onChange={(value) => {
                        setSupplierConfirm(value);
                        clearValidation('confirmPassword');
                      }}
                      show={showConfirmPassword}
                      onToggle={() =>
                        setShowConfirmPassword(
                          (current) => !current
                        )
                      }
                      error={fieldErrors.confirmPassword}
                    />

                    <TermsCheckbox
                      checked={supplierTerms}
                      onChange={setSupplierTerms}
                      error={fieldErrors.terms}
                    />

                    <InfoBox>
                      Supplier activation may require business and
                      operational verification.
                    </InfoBox>
                  </>
                )}

                {error ? (
                  <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-100"
                        aria-hidden="true"
                      >
                        !
                      </span>

                      <div>
                        <p>{error}</p>

                        <p className="mt-1 text-xs font-medium text-rose-600/80">
                          Check the highlighted information and try
                          again.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#0D9B6C] px-5 text-base font-black text-white shadow-[0_12px_30px_rgba(13,155,108,0.22)] transition hover:bg-[#087B56] focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span
                        className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                        aria-hidden="true"
                      />
                      Creating your account…
                    </>
                  ) : (
                    <>
                      Create {role === 'customer'
                        ? 'Customer'
                        : role === 'technician'
                          ? 'Technician'
                          : 'Supplier'}{' '}
                      Account
                    </>
                  )}
                </button>

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
                  <p className="text-sm text-slate-500">
                    Already have an account?
                  </p>

                  <Link
                    href="/auth/login"
                    className="font-black text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    Sign in →
                  </Link>
                </div>

                <p className="text-center text-xs leading-5 text-slate-400">
                  By creating an account, you agree to AuroTap&apos;s
                  Terms of Service and Privacy Policy.
                </p>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

function RoleButton({
  active,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'min-h-[104px] rounded-2xl border p-3 text-left transition sm:p-4',
        active
          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-xl"
          aria-hidden="true"
        >
          {icon}
        </span>

        {active ? (
          <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-[10px] font-black text-white">
            ✓
          </span>
        ) : null}
      </div>

      <div className="mt-3 text-xs font-black text-slate-900 sm:text-sm">
        {title}
      </div>

      <div className="mt-1 hidden text-[11px] leading-4 text-slate-500 sm:block">
        {description}
      </div>
    </button>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-black text-slate-800">
          {label}
          {required ? (
            <span className="ml-1 text-emerald-600">*</span>
          ) : null}
        </label>

        {hint ? (
          <span className="hidden text-xs text-slate-400 sm:block">
            {hint}
          </span>
        ) : null}
      </div>

      {children}

      {hint ? (
        <p className="mt-1 text-xs text-slate-400 sm:hidden">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-1.5 text-xs font-bold text-rose-600"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="text-sm font-black text-slate-800">
      {children}
      <span className="ml-2 text-xs font-medium text-slate-400">
        Select all that apply
      </span>
    </div>
  );
}

function PhoneInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error: boolean;
}) {
  return (
    <div
      className={[
        'mt-2 flex min-h-12 overflow-hidden rounded-xl border bg-white transition focus-within:ring-4',
        error
          ? 'border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-50'
          : 'border-slate-200 focus-within:border-emerald-500 focus-within:ring-emerald-50',
      ].join(' ')}
    >
      <div className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700">
        +91
      </div>

      <input
        value={value}
        onChange={(event) =>
          onChange(normalizePhone(event.target.value))
        }
        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm font-semibold outline-none"
        placeholder="10-digit mobile number"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={10}
        aria-invalid={error}
      />
    </div>
  );
}

function CitySelect({
  value,
  onChange,
  error,
}: {
  value: City;
  onChange: (value: City) => void;
  error: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value as City)
      }
      className={[
        'mt-2 min-h-12 w-full rounded-xl border bg-white px-3 py-3 text-sm font-semibold outline-none transition focus:ring-4',
        error
          ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
          : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-50',
      ].join(' ')}
      aria-invalid={error}
    >
      {SERVICE_CITIES.map((city) => (
        <option key={city} value={city}>
          {city}
        </option>
      ))}
    </select>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-black text-slate-800">
          {label}
          <span className="ml-1 text-emerald-600">*</span>
        </label>

        <button
          type="button"
          onClick={onToggle}
          className="text-xs font-black text-emerald-700 hover:text-emerald-800"
          aria-label={show ? `Hide ${label}` : `Show ${label}`}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>

      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass(Boolean(error))}
        placeholder="Minimum 8 characters"
        autoComplete={
          label.toLowerCase().includes('confirm')
            ? 'new-password'
            : 'new-password'
        }
        aria-invalid={Boolean(error)}
      />

      {label === 'Password' ? (
        <PasswordStrength password={value} />
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-1.5 text-xs font-bold text-rose-600"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PasswordStrength({
  password,
}: {
  password: string;
}) {
  const score = passwordScore(password);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
        <span>Strength</span>
        <span
          className={
            score >= 4
              ? 'text-emerald-600'
              : score >= 3
                ? 'text-blue-600'
                : score >= 2
                  ? 'text-amber-600'
                  : 'text-rose-600'
          }
        >
          {passwordLabel(score)}
        </span>
      </div>

      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={[
              'h-1.5 rounded-full',
              index < score
                ? score >= 4
                  ? 'bg-emerald-500'
                  : score === 3
                    ? 'bg-blue-500'
                    : score === 2
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                : 'bg-slate-200',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  );
}

function TermsCheckbox({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onChange(event.target.checked)
          }
          className="mt-1 h-4 w-4 accent-[#0D9B6C]"
        />

        <span className="text-xs font-medium leading-5 text-slate-600">
          I agree to the AuroTap{' '}
          <Link
            href="/terms"
            target="_blank"
            className="font-black text-emerald-700 hover:underline"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            target="_blank"
            className="font-black text-emerald-700 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      {error ? (
        <p className="mt-1.5 text-xs font-bold text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function InfoBox({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs font-medium leading-5 text-blue-700">
      <div className="flex items-start gap-2">
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-100 font-black"
          aria-hidden="true"
        >
          i
        </span>

        <span>{children}</span>
      </div>
    </div>
  );
}

function inputClass(error: boolean) {
  return [
    'mt-2 min-h-12 w-full rounded-xl border bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4',
    error
      ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-50',
  ].join(' ');
}
