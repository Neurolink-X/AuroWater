/* eslint-disable react/no-array-index-key */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError, authRegister, profileToSession, type LoginResult } from '@/lib/api-client';
import { writeSession } from '@/hooks/useAuth';

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

type Role = 'customer' | 'technician' | 'supplier';

const skillsList = ['Plumbing', 'RO Service', 'Borewell', 'Motor Repair', 'Water Tanker', 'Tank Cleaning'] as const;
const serviceCityList = UP_CITIES;

function detectInitialRoleFromUrl(): Role {
  if (typeof window === 'undefined') return 'customer';
  const sp = new URLSearchParams(window.location.search);
  const raw = (sp.get('role') || '').toLowerCase();
  if (raw === 'technician' || raw === 'plumber') return 'technician';
  if (raw === 'supplier' || raw === 'supply') return 'supplier';
  return 'customer';
}

const basePasswordStrength = (password: string) => {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const lengthOk = password.length >= 8;

  const score = (lengthOk ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSymbol ? 1 : 0) + ((hasLower && hasUpper) ? 1 : 0);
  return score; // 0..4
};

function strengthLabel(score: number) {
  if (score <= 1) return { label: 'Weak', color: 'bg-rose-500' };
  if (score === 2) return { label: 'Fair', color: 'bg-amber-400' };
  if (score === 3) return { label: 'Good', color: 'bg-blue-500' };
  return { label: 'Strong', color: 'bg-emerald-500' };
}

const commonSchema = z.object({
  fullName: z.string().min(2, 'Full Name is required.'),
  phone: z
    .string()
    .min(10, 'Enter a valid phone number.')
    .max(15, 'Enter a valid phone number.')
    .refine((v) => /^[0-9]+$/.test(v.replace(/\D/g, '')), 'Phone must be digits.'),
  city: z.string().refine((v) => (UP_CITIES as readonly string[]).includes(v), 'City is required.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  confirmPassword: z.string().min(6, 'Confirm password must be at least 6 characters.'),
  terms: z.boolean().refine((v) => v === true, 'You must accept the Terms.'),
});

const customerExtraSchema = z.object({ fullName: z.string().min(2), phone: commonSchema.shape.phone, city: commonSchema.shape.city, password: commonSchema.shape.password, confirmPassword: commonSchema.shape.confirmPassword, terms: commonSchema.shape.terms });

/** Decision: Supabase Auth requires email — stricter rules than legacy mock flow. */
const customerRegisterSchema = z.object({
  fullName: z.string().min(2, 'Full name is required.'),
  email: z.string().email('Enter a valid email.'),
  phone: z
    .string()
    .refine((v) => /^\d{10}$/.test(v.replace(/\D/g, '').slice(0, 10)), 'Enter exactly 10 digits.'),
  city: z.string().refine((v) => (UP_CITIES as readonly string[]).includes(v), 'City is required.'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters.')
    .regex(/[0-9]/, 'Include at least one number.'),
  confirmPassword: z.string(),
  terms: z.boolean().refine((v) => v === true, 'Accept the Terms.'),
});

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>('customer');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Customer fields
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerFullName, setCustomerFullName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState<(typeof UP_CITIES)[number]>(UP_CITIES[0]);
  const [customerPassword, setCustomerPassword] = useState('');
  const [customerConfirm, setCustomerConfirm] = useState('');
  const [customerTerms, setCustomerTerms] = useState(false);

  // Technician fields
  const [techEmail, setTechEmail] = useState('');
  const [techFullName, setTechFullName] = useState('');
  const [techPhone, setTechPhone] = useState('');
  const [techCity, setTechCity] = useState<(typeof UP_CITIES)[number]>(UP_CITIES[0]);
  const [techPassword, setTechPassword] = useState('');
  const [techConfirm, setTechConfirm] = useState('');
  const [techTerms, setTechTerms] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedTechCities, setSelectedTechCities] = useState<string[]>([UP_CITIES[0]]);

  // Supplier fields
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierBusinessName, setSupplierBusinessName] = useState('');
  const [supplierOwnerName, setSupplierOwnerName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierCity, setSupplierCity] = useState<(typeof UP_CITIES)[number]>(UP_CITIES[0]);
  const [supplierGst, setSupplierGst] = useState('');
  const [supplierFleetType, setSupplierFleetType] = useState<'Tanker' | 'Equipment' | 'Both'>('Tanker');
  const [supplierPassword, setSupplierPassword] = useState('');
  const [supplierConfirm, setSupplierConfirm] = useState('');
  const [supplierTerms, setSupplierTerms] = useState(false);

  useEffect(() => {
    setRole(detectInitialRoleFromUrl());
  }, []);

  const passwordStrength = useMemo(() => {
    const pw = role === 'customer' ? customerPassword : role === 'technician' ? techPassword : supplierPassword;
    const score = basePasswordStrength(pw);
    return strengthLabel(score);
  }, [role, customerPassword, techPassword, supplierPassword]);

  const aurotapPreview = useMemo(() => {
    const phone = role === 'supplier' ? supplierPhone : '';
    const normalized = phone.replace(/\D/g, '').slice(0, 15);
    if (!normalized) return '';
    return `${normalized}@aurotap`;
  }, [role, supplierPhone]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setFieldErrors({});
    setLoading(true);

    try {
      if (role === 'customer') {
        const phone10 = customerPhone.replace(/\D/g, '').slice(0, 10);
        const parsed = customerRegisterSchema.safeParse({
          fullName: customerFullName,
          email: customerEmail.trim(),
          phone: phone10,
          city: customerCity,
          password: customerPassword,
          confirmPassword: customerConfirm,
          terms: customerTerms,
        });
        if (!parsed.success) {
          const fe: Record<string, string> = {};
          for (const iss of parsed.error.issues) {
            const k = String(iss.path[0] ?? 'form');
            if (!fe[k]) fe[k] = iss.message;
          }
          setFieldErrors(fe);
          throw new Error(parsed.error.issues[0]?.message || 'Check highlighted fields.');
        }
        if (customerPassword !== customerConfirm) {
          setFieldErrors((f) => ({ ...f, confirmPassword: 'Passwords do not match.' }));
          throw new Error('Passwords do not match.');
        }

        const reg = await authRegister({
          email: parsed.data.email,
          password: customerPassword,
          full_name: parsed.data.fullName.trim(),
          phone: phone10,
          role: 'customer',
        });

        if ('needsEmailConfirmation' in reg && reg.needsEmailConfirmation) {
          toast.success('Check your inbox to confirm your email, then sign in.');
          router.replace('/auth/login');
          return;
        }

        const ok = reg as LoginResult;
        writeSession(
          profileToSession(ok.profile, {
            access_token: ok.access_token,
            refresh_token: ok.refresh_token,
            expires_at: ok.expires_at,
          })
        );
        toast.success('Welcome to AuroWater!');
        router.replace('/customer/home');
        return;
      }

      if (role === 'technician') {
        const parsed = commonSchema.safeParse({
          fullName: techFullName,
          phone: techPhone,
          city: techCity,
          password: techPassword,
          confirmPassword: techConfirm,
          terms: techTerms,
        });
        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message || 'Invalid input.');
        }
        if (techPassword !== techConfirm) throw new Error('Passwords do not match.');
        if (!techEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(techEmail)) {
          throw new Error('Enter a valid email for your account.');
        }
        if (!selectedSkills.length) throw new Error('Please select at least 1 skill.');
        if (!selectedTechCities.length) throw new Error('Please select at least 1 service city.');

        const phone10 = techPhone.replace(/\D/g, '').slice(0, 10);
        const reg = await authRegister({
          email: techEmail.trim(),
          password: techPassword,
          full_name: techFullName.trim(),
          phone: phone10,
          role: 'technician',
        });

        if ('needsEmailConfirmation' in reg && reg.needsEmailConfirmation) {
          toast.success('Confirm your email, then sign in.');
          router.replace('/auth/login');
          return;
        }
        const ok = reg as LoginResult;
        writeSession(
          profileToSession(ok.profile, {
            access_token: ok.access_token,
            refresh_token: ok.refresh_token,
            expires_at: ok.expires_at,
          })
        );
        toast.success('Welcome to AuroWater!');
        router.replace('/technician/dashboard');
        return;
      }

      if (role === 'supplier') {
        const parsed = commonSchema.safeParse({
          fullName: supplierOwnerName,
          phone: supplierPhone,
          city: supplierCity,
          password: supplierPassword,
          confirmPassword: supplierConfirm,
          terms: supplierTerms,
        });
        if (!parsed.success) {
          throw new Error(parsed.error.issues[0]?.message || 'Invalid input.');
        }
        if (supplierPassword !== supplierConfirm) throw new Error('Passwords do not match.');
        if (!supplierEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplierEmail)) {
          throw new Error('Enter a valid business email.');
        }

        const phone10 = supplierPhone.replace(/\D/g, '').slice(0, 10);
        const reg = await authRegister({
          email: supplierEmail.trim(),
          password: supplierPassword,
          full_name: `${supplierBusinessName.trim()} (${supplierOwnerName.trim()})`,
          phone: phone10,
          role: 'supplier',
        });

        if ('needsEmailConfirmation' in reg && reg.needsEmailConfirmation) {
          toast.success('Confirm your email, then sign in.');
          router.replace('/auth/login');
          return;
        }
        const ok = reg as LoginResult;
        writeSession(
          profileToSession(ok.profile, {
            access_token: ok.access_token,
            refresh_token: ok.refresh_token,
            expires_at: ok.expires_at,
          })
        );
        toast.success('Welcome to AuroWater!');
        router.replace('/supplier/dashboard');
        return;
      }
    } catch (e: unknown) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Could not create account.';
      setErr(msg);
      if (e instanceof ApiError && (e.code === 'DB_NOT_READY' || e.code === 'SERVICE_ROLE_MISSING' || e.code === 'MISCONFIG_ENV')) {
        toast.error(msg, { duration: 12000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (s: string) => {
    setSelectedSkills((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const toggleServiceCity = (c: string) => {
    setSelectedTechCities((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT */}
          <div className="rounded-3xl bg-[#0F172A] text-white p-8 sm:p-10 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-cyan-500/10 blur-2xl" />
            <div className="relative">
              <h2 className="text-2xl font-extrabold">
                {role === 'customer' ? 'Start ordering water in 30 seconds' : role === 'technician' ? 'Join 180+ verified technicians earning daily' : 'Grow your water business with AuroTap'}
              </h2>
              <p className="mt-2 text-white/70 text-sm">
                Choose your role and create your account.
              </p>

              <ul className="mt-7 space-y-3 text-sm text-white/80">
                {role === 'customer' && (
                  <>
                    <li>✅ Order water + book plumbers anytime</li>
                    <li>✅ Real-time scheduling and tracking</li>
                    <li>✅ Cash/UPI on delivery</li>
                  </>
                )}
                {role === 'technician' && (
                  <>
                    <li>✅ Get job requests near your service areas</li>
                    <li>✅ Verified workflow and clear pricing</li>
                    <li>✅ Earn on your schedule</li>
                  </>
                )}
                {role === 'supplier' && (
                  <>
                    <li>✅ Receive direct customer orders</li>
                    <li>✅ Verified activation flow</li>
                    <li>✅ Manage fleet and deliveries</li>
                  </>
                )}
              </ul>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
                {role === 'technician' ? "You'll need to upload ID documents after registration." : role === 'supplier' ? "Supplier KYC approval is required before activation." : 'Keep your address updated for faster delivery.'}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="rounded-3xl bg-white border border-slate-100 shadow-card p-7 sm:p-8">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-2xl font-extrabold text-[#0F1C18]">Create Account</h2>
                <p className="text-slate-600 mt-2 text-sm">Choose role, enter details, and you’re in.</p>
              </div>
              <div className="text-xs text-slate-500">
                {role === 'supplier' && aurotapPreview ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                    Your AuroTap ID will be: <span className="font-extrabold text-[#0F1C18]">{aurotapPreview}</span>
                  </span>
                ) : null}
              </div>
            </div>

            {/* Role selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <RoleCard
                active={role === 'customer'}
                title="Customer"
                icon="👤"
                desc="Order water & plumber"
                onClick={() => setRole('customer')}
              />
              <RoleCard
                active={role === 'technician'}
                title="Technician"
                icon="🔧"
                desc="Earn on your schedule"
                onClick={() => setRole('technician')}
              />
              <RoleCard
                active={role === 'supplier'}
                title="Supplier"
                icon="🚛"
                desc="Deliver water & earn"
                onClick={() => setRole('supplier')}
              />
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {role === 'customer' && (
                <>
                  <Field label="Full Name*" error={fieldErrors.fullName}>
                    <input
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]"
                      value={customerFullName}
                      onChange={(e) => setCustomerFullName(e.target.value)}
                      autoComplete="name"
                    />
                  </Field>
                  <Field label="Email*" error={fieldErrors.email}>
                    <input
                      type="email"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </Field>
                  <Field label="Phone Number*" error={fieldErrors.phone}>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-extrabold text-slate-700">+91</span>
                      <input
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 focus:ring-2 focus:ring-[#0D9B6C]"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        inputMode="numeric"
                      />
                    </div>
                  </Field>
                  <Field label="City/Area*" error={fieldErrors.city}>
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value as (typeof UP_CITIES)[number])}
                    >
                      {UP_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Password*" error={fieldErrors.password}>
                    <input
                      type="password"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]"
                      value={customerPassword}
                      onChange={(e) => setCustomerPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                    <StrengthMeter password={customerPassword} />
                  </Field>
                  <Field label="Confirm Password*" error={fieldErrors.confirmPassword}>
                    <input
                      type="password"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]"
                      value={customerConfirm}
                      onChange={(e) => setCustomerConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                  </Field>
                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input type="checkbox" checked={customerTerms} onChange={(e) => setCustomerTerms(e.target.checked)} className="accent-[#0D9B6C] mt-1" />
                    <span className="leading-relaxed">
                      I agree to Terms of Service and Privacy Policy
                    </span>
                  </label>
                </>
              )}

              {role === 'technician' && (
                <>
                  <Field label="Full Name*">
                    <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]" value={techFullName} onChange={(e) => setTechFullName(e.target.value)} />
                  </Field>
                  <Field label="Email* (login)">
                    <input
                      type="email"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]"
                      value={techEmail}
                      onChange={(e) => setTechEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </Field>
                  <Field label="Phone Number*">
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-extrabold text-slate-700">+91</span>
                      <input className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 focus:ring-2 focus:ring-[#0D9B6C]" value={techPhone} onChange={(e) => setTechPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" />
                    </div>
                  </Field>
                  <Field label="City/Area*">
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]"
                      value={techCity}
                      onChange={(e) => setTechCity(e.target.value as (typeof UP_CITIES)[number])}
                    >
                      {UP_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Password*">
                    <input type="password" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]" value={techPassword} onChange={(e) => setTechPassword(e.target.value)} />
                    <StrengthMeter password={techPassword} />
                  </Field>
                  <Field label="Confirm Password*">
                    <input type="password" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]" value={techConfirm} onChange={(e) => setTechConfirm(e.target.value)} />
                  </Field>

                  <div className="mt-2">
                    <div className="text-sm font-semibold text-slate-700">Skills</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {skillsList.map((s) => {
                        const active = selectedSkills.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleSkill(s)}
                            className={[
                              'px-4 py-2 rounded-full border text-sm font-extrabold transition-all active:scale-95',
                              active ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                            ].join(' ')}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="text-sm font-semibold text-slate-700">Service Cities</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {serviceCityList.map((c) => {
                        const active = selectedTechCities.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleServiceCity(c)}
                            className={[
                              'px-4 py-2 rounded-full border text-sm font-extrabold transition-all active:scale-95',
                              active ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                            ].join(' ')}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input type="checkbox" checked={techTerms} onChange={(e) => setTechTerms(e.target.checked)} className="accent-[#0D9B6C] mt-1" />
                    <span className="leading-relaxed">I agree to Terms of Service and Privacy Policy</span>
                  </label>
                  <div className="text-xs text-slate-500 pt-1">
                    You'll need to upload ID documents after registration.
                  </div>
                </>
              )}

              {role === 'supplier' && (
                <>
                  <Field label="Business Name*">
                    <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]" value={supplierBusinessName} onChange={(e) => setSupplierBusinessName(e.target.value)} />
                  </Field>
                  <Field label="Owner Name*">
                    <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]" value={supplierOwnerName} onChange={(e) => setSupplierOwnerName(e.target.value)} />
                  </Field>
                  <Field label="Business Email* (login)">
                    <input
                      type="email"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]"
                      value={supplierEmail}
                      onChange={(e) => setSupplierEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </Field>
                  <Field label="Phone Number*">
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-extrabold text-slate-700">+91</span>
                      <input
                        className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 focus:ring-2 focus:ring-[#0D9B6C]"
                        value={supplierPhone}
                        onChange={(e) => setSupplierPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        inputMode="numeric"
                      />
                    </div>
                  </Field>
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-slate-600">AuroTap ID preview</div>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                      Your AuroTap ID will be:{' '}
                      <span className="font-extrabold text-[#0F1C18]">{aurotapPreview || '—'}</span>
                    </div>
                  </div>
                  <Field label="City*">
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]"
                      value={supplierCity}
                      onChange={(e) => setSupplierCity(e.target.value as (typeof UP_CITIES)[number])}
                    >
                      {UP_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="GST Number (optional)">
                    <input className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]" value={supplierGst} onChange={(e) => setSupplierGst(e.target.value)} />
                  </Field>
                  <Field label="Fleet Type">
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]"
                      value={supplierFleetType}
                      onChange={(e) =>
                        setSupplierFleetType(e.target.value as 'Tanker' | 'Equipment' | 'Both')
                      }
                    >
                      <option value="Tanker">Tanker</option>
                      <option value="Equipment">Equipment</option>
                      <option value="Both">Both</option>
                    </select>
                  </Field>

                  <Field label="Password*">
                    <input type="password" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]" value={supplierPassword} onChange={(e) => setSupplierPassword(e.target.value)} />
                    <StrengthMeter password={supplierPassword} />
                  </Field>
                  <Field label="Confirm Password*">
                    <input type="password" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 mt-2 focus:ring-2 focus:ring-[#0D9B6C]" value={supplierConfirm} onChange={(e) => setSupplierConfirm(e.target.value)} />
                  </Field>

                  <label className="flex items-start gap-3 text-sm text-slate-700">
                    <input type="checkbox" checked={supplierTerms} onChange={(e) => setSupplierTerms(e.target.checked)} className="accent-[#0D9B6C] mt-1" />
                    <span className="leading-relaxed">I agree to Terms of Service and Privacy Policy</span>
                  </label>
                </>
              )}

              {err ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm font-semibold">{err}</div> : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60"
              >
                {loading ? 'Creating…' : 'Create Account'}
              </button>

              <div className="text-xs text-slate-500 pt-1">
                Supplier or technician onboarding?{' '}
                <Link href="/register/pro" className="text-[#0D9B6C] font-extrabold hover:underline">
                  Professional signup →
                </Link>
              </div>

              <div className="text-sm text-slate-600 pt-1">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-[#0D9B6C] font-extrabold hover:underline">
                  Sign In →
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  active,
  title,
  icon,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  icon: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-2xl border p-4 text-left transition-all active:scale-95',
        active ? 'border-[#0D9B6C] bg-[#E8F8F2]' : 'border-slate-200 bg-white hover:bg-slate-50',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl leading-none">{icon}</div>
          <div className="mt-2 text-sm font-extrabold text-slate-900">{title}</div>
          <div className="text-xs text-slate-600 mt-1">{desc}</div>
        </div>
        {active ? <div className="text-[#0D9B6C] font-extrabold">✓</div> : <div className="text-slate-300 font-extrabold"> </div>}
      </div>
    </button>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-700">{label}</div>
      {children}
      {error ? <p className="mt-1 text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}

function StrengthMeter({ password }: { password: string }) {
  const score = basePasswordStrength(password);
  const segs = [0, 1, 2, 3].map((idx) => idx < score);
  const label = strengthLabel(score);

  return (
    <div className="mt-2">
      <div className="text-xs font-extrabold text-slate-600 flex items-center justify-between">
        <span>Password strength</span>
        <span className="text-[#0F1C18]">
          {label.label}
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        {segs.map((on, idx) => (
          <div
            key={idx}
            className={[
              'h-2 flex-1 rounded-full',
              on
                ? score <= 1
                  ? 'bg-rose-500'
                  : score === 2
                    ? 'bg-amber-400'
                    : score === 3
                      ? 'bg-blue-500'
                      : 'bg-emerald-500'
                : 'bg-slate-200',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  );
}

