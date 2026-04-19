'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { ApiError, postContact } from '@/lib/api-client';

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

type ProForm = {
  name: string;
  email: string;
  phone: string;
  city: (typeof UP_CITIES)[number];
  note: string;
};

const emptyForm = (): ProForm => ({
  name: '',
  email: '',
  phone: '',
  city: UP_CITIES[0],
  note: '',
});

/**
 * Supplier/technician onboarding stays human-led — this page only captures inbound leads via `/api/contact`.
 */
export default function RegisterProPage() {
  const [supplier, setSupplier] = useState<ProForm>(emptyForm);
  const [tech, setTech] = useState<ProForm>(emptyForm);
  const [busy, setBusy] = useState<'supplier' | 'tech' | null>(null);

  const submit = async (kind: 'supplier' | 'tech') => {
    const src = kind === 'supplier' ? supplier : tech;
    if (!src.name.trim() || !src.email.trim() || !src.phone.trim()) {
      toast.error('Name, email, and phone are required.');
      return;
    }
    setBusy(kind);
    try {
      await postContact({
        name: src.name.trim(),
        email: src.email.trim(),
        phone: src.phone.trim(),
        message: JSON.stringify({
          type: 'pro_registration',
          role: kind === 'supplier' ? 'supplier' : 'technician',
          city: src.city,
          note: src.note.trim(),
        }),
      });
      toast.success('Thanks — our team will reach out shortly.');
      if (kind === 'supplier') setSupplier(emptyForm());
      else setTech(emptyForm());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not submit.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-sm font-semibold text-emerald-700 uppercase tracking-wide">
          Partner with AuroWater
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-center text-[#0F172A]">Join as a Supplier or Technician</h1>
        <p className="mt-3 text-center text-slate-600 max-w-xl mx-auto">
          Full onboarding and KYC happen after we review your application — submit your details below to get started.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span aria-hidden>🚛</span> Become a Supplier
            </h2>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="Full name"
              value={supplier.name}
              onChange={(e) => setSupplier((s) => ({ ...s, name: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="Email"
              type="email"
              value={supplier.email}
              onChange={(e) => setSupplier((s) => ({ ...s, email: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="Phone (10 digits)"
              inputMode="numeric"
              value={supplier.phone}
              onChange={(e) =>
                setSupplier((s) => ({ ...s, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))
              }
            />
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              value={supplier.city}
              onChange={(e) =>
                setSupplier((s) => ({ ...s, city: e.target.value as (typeof UP_CITIES)[number] }))
              }
            >
              {UP_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2 min-h-[88px]"
              placeholder="Fleet size, coverage area, notes…"
              value={supplier.note}
              onChange={(e) => setSupplier((s) => ({ ...s, note: e.target.value }))}
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void submit('supplier')}
              className="w-full rounded-xl bg-emerald-600 text-white py-3 font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === 'supplier' ? 'Sending…' : 'Submit supplier interest'}
            </button>
          </div>

          <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span aria-hidden>🔧</span> Join as Technician
            </h2>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="Full name"
              value={tech.name}
              onChange={(e) => setTech((s) => ({ ...s, name: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="Email"
              type="email"
              value={tech.email}
              onChange={(e) => setTech((s) => ({ ...s, email: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              placeholder="Phone (10 digits)"
              inputMode="numeric"
              value={tech.phone}
              onChange={(e) =>
                setTech((s) => ({ ...s, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))
              }
            />
            <select
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              value={tech.city}
              onChange={(e) =>
                setTech((s) => ({ ...s, city: e.target.value as (typeof UP_CITIES)[number] }))
              }
            >
              {UP_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2 min-h-[88px]"
              placeholder="Skills (RO, plumbing…), preferred zones…"
              value={tech.note}
              onChange={(e) => setTech((s) => ({ ...s, note: e.target.value }))}
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void submit('tech')}
              className="w-full rounded-xl bg-slate-900 text-white py-3 font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {busy === 'tech' ? 'Sending…' : 'Submit technician interest'}
            </button>
          </div>
        </div>

        <p className="mt-10 text-center text-sm text-slate-600">
          Already registered?{' '}
          <Link href="/auth/login" className="font-semibold text-emerald-700 underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
