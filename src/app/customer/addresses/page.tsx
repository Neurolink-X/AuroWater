'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import GlassCard from '@/components/ui/GlassCard';

type Address = {
  id: string;
  houseFlat: string;
  area: string;
  city: string;
  pincode: string;
  landmark?: string;
  label?: string;
  createdAt: number;
  isDefault?: boolean;
};

const STORAGE_KEY = 'aurowater_addresses';
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

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isValidPincode(pin: string) {
  return /^[0-9]{6}$/.test(pin.trim());
}

function isValidCity(city: string) {
  const normalized = city.trim().toLowerCase();
  return UP_CITIES.some((c) => c.toLowerCase() === normalized);
}

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [houseFlat, setHouseFlat] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const [label, setLabel] = useState('Home');
  const [isDefault, setIsDefault] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const list = safeParse<Address[]>(localStorage.getItem(STORAGE_KEY)) ?? [];
    setAddresses(Array.isArray(list) ? list : []);
  }, []);

  const defaultId = useMemo(() => addresses.find((a) => a.isDefault)?.id ?? null, [addresses]);

  const save = () => {
    setError(null);
    if (!houseFlat.trim()) return setError('House/Flat No is required.');
    if (!area.trim()) return setError('Area is required.');
    if (!isValidCity(city)) return setError('City is required.');
    if (!isValidPincode(pincode)) return setError('Pincode must be a 6-digit number.');

    const now = Date.now();
    const next: Address = {
      id: `addr_${now}_${Math.random().toString(16).slice(2)}`,
      houseFlat: houseFlat.trim(),
      area: area.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
      landmark: landmark.trim() ? landmark.trim() : undefined,
      label: label.trim() ? label.trim() : 'Address',
      createdAt: now,
      isDefault: isDefault || addresses.length === 0,
    };

    const merged = [next, ...addresses].map((a) => ({ ...a }));
    if (next.isDefault) {
      for (const a of merged) a.isDefault = a.id === next.id;
    }

    setAddresses(merged);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

    // keep form usable, but clear value fields
    setHouseFlat('');
    setArea('');
    setCity('');
    setPincode('');
    setLandmark('');
    setLabel('Home');
    setIsDefault(false);
    toast.success('Address saved.');
  };

  const makeDefault = (id: string) => {
    const next = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
    setAddresses(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    toast.success('Default address updated.');
  };

  const del = (id: string) => {
    const nextRaw = addresses.filter((a) => a.id !== id);
    const normalized =
      nextRaw.length === 0
        ? nextRaw
        : nextRaw.some((a) => a.isDefault)
          ? nextRaw
          : nextRaw.map((a, idx) => ({ ...a, isDefault: idx === 0 }));
    setAddresses(normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    toast.success('Address deleted.');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500">
              Delivery addresses
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#0F1C18]">Saved addresses</h1>
            <p className="mt-2 text-slate-600">
              Add, set default, and delete addresses stored on this device.
            </p>
          </div>
          <Link
            href="/book"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-[#0D9B6C] text-white font-bold hover:bg-[#086D4C] transition"
          >
            Book now
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,1fr] gap-6">
          <GlassCard className="p-6 rounded-2xl">
            <h2 className="text-lg font-extrabold text-[#0F1C18] mb-4">Add New Address</h2>
            {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 text-sm">{error}</div>}

            <div className="grid grid-cols-1 gap-3">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Label (Home/Office)"
              />
              <input
                value={houseFlat}
                onChange={(e) => setHouseFlat(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="House/Flat No"
              />
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Area"
              />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select City</option>
                {UP_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Pincode (6 digits)"
                inputMode="numeric"
              />
              <input
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Landmark (optional)"
              />

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                Set as default
              </label>

              <button
                type="button"
                onClick={save}
                className="rounded-xl px-5 py-3 bg-[#0D9B6C] text-white font-bold hover:bg-[#086D4C] transition"
              >
                Save & Use
              </button>
            </div>
          </GlassCard>

          <GlassCard className="p-6 rounded-2xl">
            <h2 className="text-lg font-extrabold text-[#0F1C18] mb-4">Your saved list</h2>
            {addresses.length === 0 ? (
              <div className="text-slate-600 text-sm">
                No saved addresses yet. Add one on the left.
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((a) => (
                  <div
                    key={a.id}
                    className={[
                      'rounded-2xl border p-4',
                      a.id === defaultId ? 'border-[#0D9B6C] bg-[#E8F8F2]' : 'border-slate-200 bg-white',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-extrabold text-[#0F1C18]">{a.label ?? 'Address'}</div>
                          {a.isDefault && (
                            <span className="text-xs font-extrabold bg-[#0D9B6C] text-white px-2 py-1 rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-slate-700">
                          {a.houseFlat}, {a.area}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">
                          {a.city} • {a.pincode}
                        </div>
                        {a.landmark && <div className="mt-1 text-xs text-slate-500">Landmark: {a.landmark}</div>}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => makeDefault(a.id)}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition"
                        >
                          Make default
                        </button>
                        <button
                          type="button"
                          onClick={() => del(a.id)}
                          className="px-3 py-2 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

