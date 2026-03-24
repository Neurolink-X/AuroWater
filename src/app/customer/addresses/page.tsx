/* eslint-disable react/no-unescaped-entities */
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import GlassCard from '@/components/ui/GlassCard';

type Address = {
  id: string;
  label: string;
  address: string;
  landmark?: string;
  city: string;
  pincode?: string;
  isDefault: boolean;
  createdAt: number;
};

const STORAGE_KEY = 'auro_public_addresses_v1';

function loadAddresses(): Address[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Address[]) : [];
  } catch {
    return [];
  }
}

function saveAddresses(list: Address[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export default function PublicAddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [label, setLabel] = useState('Home');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAddresses(loadAddresses());
  }, []);

  const defaultId = useMemo(() => addresses.find((a) => a.isDefault)?.id ?? null, [addresses]);

  const onAdd = () => {
    setError(null);
    if (!address.trim() || !city.trim()) {
      setError('Please enter at least address and city.');
      return;
    }

    const next: Address = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      label: label.trim() || 'Address',
      address: address.trim(),
      landmark: landmark.trim() || undefined,
      city: city.trim(),
      pincode: pincode.trim() || undefined,
      isDefault: isDefault || addresses.length === 0,
      createdAt: Date.now(),
    };

    let list = [next, ...addresses];
    if (next.isDefault) {
      list = list.map((a) => (a.id === next.id ? a : { ...a, isDefault: false }));
    }
    setAddresses(list);
    saveAddresses(list);

    setAddress('');
    setLandmark('');
    setCity('');
    setPincode('');
    setIsDefault(false);
  };

  const onMakeDefault = (id: string) => {
    const list = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
    setAddresses(list);
    saveAddresses(list);
  };

  const onDelete = (id: string) => {
    const list = addresses.filter((a) => a.id !== id);
    const hadDefault = id === defaultId;
    const normalized =
      hadDefault && list.length
        ? list.map((a, idx) => ({ ...a, isDefault: idx === 0 }))
        : list;
    setAddresses(normalized);
    saveAddresses(normalized);
  };

  return (
    <div className="min-h-screen gradient-section">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500">
              Delivery preferences
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
              Saved addresses (no login required)
            </h1>
            <p className="mt-2 text-slate-600 max-w-2xl">
              Add addresses here to speed up booking on this device. During checkout we’ll also let
              you enter an address directly.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/book"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
            >
              Book now
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 bg-white/70 text-slate-700 font-semibold hover:bg-white transition-colors"
            >
              Home
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.2fr] gap-6">
          <GlassCard className="p-6 rounded-2xl shadow-card">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Add a new address</h2>
            {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Home / Office"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Gorakhpur"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Full address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="House no, street, area"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Landmark (optional)
                  </label>
                  <input
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Near..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Pincode (optional)
                  </label>
                  <input
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="273001"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                Make this default
              </label>

              <button
                type="button"
                onClick={onAdd}
                className="w-full rounded-xl bg-slate-900 text-white font-semibold py-2.5 hover:bg-slate-800 transition-colors"
              >
                Save address
              </button>
            </div>
          </GlassCard>

          <div className="space-y-4">
            {addresses.length === 0 ? (
              <GlassCard className="p-10 rounded-2xl text-center shadow-card">
                <p className="text-slate-700 font-medium">No saved addresses yet</p>
                <p className="text-slate-500 text-sm mt-2">
                  Add one on the left, or just continue to booking and enter address at checkout.
                </p>
                <Link
                  href="/book"
                  className="inline-flex mt-5 items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
                >
                  Continue to booking →
                </Link>
              </GlassCard>
            ) : (
              addresses.map((a) => (
                <GlassCard key={a.id} className="p-5 rounded-2xl shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{a.label}</p>
                        {a.isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{a.address}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {a.city}
                        {a.pincode ? ` • ${a.pincode}` : ''}
                        {a.landmark ? ` • ${a.landmark}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => onMakeDefault(a.id)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Make default
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(a.id)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

