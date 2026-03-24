'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GlassCard from '@/components/ui/GlassCard';
import AnimatedServiceCard from '@/components/ui/AnimatedServiceCard';
import TimeSlotPicker, { type TimeSlotPickerValue } from '@/components/booking/TimeSlotPicker';
import { getToken } from '@/lib/api-client';

const TOTAL_STEPS = 5;

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="h-2 w-full bg-slate-200/80 rounded-full overflow-hidden mb-6">
      <div
        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
      />
    </div>
  );
}

interface Address {
  id: number;
  house_no: string;
  area: string;
  landmark?: string;
  city: string;
  pincode: string;
  is_default?: boolean;
  address_type?: string;
}

interface Service {
  id: number;
  name: string;
  description?: string;
  base_price: number;
}

interface PreviewBreakdown {
  base_price: number;
  distance_factor: number;
  subtotal: number;
  tax_percentage: number;
  tax_amount: number;
  emergency_charge: number;
  total_amount: number;
}

export default function BookingWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(500);
  const [emergency, setEmergency] = useState(false);
  const [slotValue, setSlotValue] = useState<TimeSlotPickerValue>({
    time_slot: '',
    scheduled_time: '',
    valid: false,
    errors: [],
    startTime: '09:00',
    endTime: '09:30',
    date: '',
  });
  const [preview, setPreview] = useState<PreviewBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const token = typeof window !== 'undefined' ? getToken() : null;

  const fetchWithAuth = useCallback(
    (url: string, options: RequestInit = {}) => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(options.headers as object),
      };
      if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
      }
      return fetch(url, { ...options, credentials: 'include', headers });
    },
    [token]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const minDate = new Date().toISOString().slice(0, 10);
    setSlotValue((prev) => ({ ...prev, date: prev.date || minDate }));
  }, []);

  useEffect(() => {
    // Mark auth check as complete even if there is no token so
    // guests can browse the booking flow without being forced to login.
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!authChecked) return;

    const load = async () => {
      setServicesLoading(true);
      setAddressesLoading(true);
      setServicesError(null);
      setAddressesError(null);

      // Services are PUBLIC: always load from service_types via /api/services.
      try {
        const res = await fetch('/api/services', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to load services');
        const list = json?.data;
        if (!Array.isArray(list)) {
          setServices([]);
          setServicesError('Invalid services response. Please try again.');
          setServicesLoading(false);
          return;
        }
        if (list.length === 0) {
          setServices([]);
          setServicesError(
            'No services configured yet. An admin can add services in Admin → Services, or seed the database (see README: Database seeding).'
          );
          setServicesLoading(false);
          return;
        }
        setServices(list);
      } catch (e: unknown) {
        setServices([]);
        setServicesError(e instanceof Error ? e.message : 'Failed to load services');
      } finally {
        setServicesLoading(false);
      }

      // Addresses: if logged in, try to load customer addresses; otherwise skip.
      if (token) {
        try {
          const res = await fetchWithAuth('/api/customers/addresses');
          const json = await res.json();
          if (!res.ok) throw new Error(json?.error || 'Failed to load addresses');
          const list = json?.data;
          if (!Array.isArray(list)) throw new Error('Unexpected addresses response');
          setAddresses(list);
          const def = list.find((a: Address) => a.is_default);
          if (def) setAddressId(def.id);
          else if (list.length) setAddressId(list[0].id);
        } catch (e: unknown) {
          setAddresses([]);
          setAddressesError(e instanceof Error ? e.message : 'Failed to load addresses');
        } finally {
          setAddressesLoading(false);
        }
      } else {
        // Guest flow: no saved addresses; let user proceed using guest address later.
        setAddresses([]);
        setAddressesLoading(false);
      }
    };

    load();
  }, [authChecked, token, fetchWithAuth]);

  async function doPreview() {
    setMsg(null);
    if (!addressId) {
      setMsg('Choose an address');
      return;
    }
    if (!serviceId) {
      setMsg('Choose a service');
      return;
    }
    if (!slotValue.valid) {
      setMsg('Provide a valid time slot (start, end, min 30 min, future only)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/orders/preview', {
        method: 'POST',
        body: JSON.stringify({
          service_type_id: serviceId,
          address_id: addressId,
          quantity,
          emergency,
          start_time: slotValue.startTime,
          end_time: slotValue.endTime,
          date: slotValue.date,
          time_slot: slotValue.time_slot,
          scheduled_time: slotValue.scheduled_time,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMsg(
          data?.errors?.length
            ? data.errors.join('; ')
            : data?.error || data?.message || 'Preview failed'
        );
        setPreview(null);
        setLoading(false);
        return;
      }
      setPreview(data.breakdown ?? data.data?.breakdown ?? null);
      setStep(4); // Price breakdown; user can go to step 5 to confirm
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  async function doCreate() {
    if (!preview || !slotValue.valid) {
      setMsg('Invalid state');
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetchWithAuth('/api/orders/create', {
        method: 'POST',
        body: JSON.stringify({
          service_type_id: serviceId,
          address_id: addressId,
          quantity,
          emergency,
          service_details:
            services.find((s) => s.id === serviceId)?.name === 'WATER_SUPPLY'
              ? { quantity, unit: 'liters' }
              : undefined,
          start_time: slotValue.startTime,
          end_time: slotValue.endTime,
          date: slotValue.date,
          time_slot: slotValue.time_slot,
          scheduled_time: slotValue.scheduled_time,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMsg(data?.error || data?.message || 'Create failed');
        setLoading(false);
        return;
      }
      router.push('/customer/history');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-gradient-to-b from-emerald-50/80 via-white to-slate-50">
      <div className="max-w-2xl mx-auto">
        <GlassCard className="p-6 sm:p-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                Book a Service
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Step {step} of {TOTAL_STEPS}
              </p>
            </div>
          </div>

          <ProgressBar step={step} />

          {/* Step 1: Address */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <h2 className="font-semibold text-slate-800">Choose address</h2>
              {addressesLoading ? (
                <div className="p-4 rounded-xl border border-slate-200 bg-white/80 text-sm text-slate-500">
                  Loading your saved addresses…
                </div>
              ) : addressesError ? (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700">
                  {addressesError}
                </div>
              ) : addresses.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-sm text-slate-500 text-center">
                  No saved addresses. Add one first.
                </div>
              ) : (
                <div className="grid gap-3">
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className={`block p-4 rounded-xl border cursor-pointer transition-all ${
                        addressId === a.id
                          ? 'ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50/80'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="addr"
                        className="sr-only"
                        checked={addressId === a.id}
                        onChange={() => setAddressId(a.id)}
                      />
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-800">
                            {a.house_no}, {a.area}
                          </span>
                          {a.landmark && (
                            <span className="text-slate-500"> · {a.landmark}</span>
                          )}
                          <div className="text-xs text-slate-500 mt-1">
                            {a.city} · {a.pincode}
                          </div>
                        </div>
                        {a.is_default && (
                          <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                            Primary
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-emerald-600 text-white font-medium py-3 shadow-md hover:bg-emerald-700 transition-colors"
                  onClick={() => setStep(2)}
                  disabled={addressesLoading || !!addressesError || addresses.length === 0}
                >
                  Continue
                </button>
                <Link
                  href="/customer/addresses"
                  className="flex-1 rounded-xl border border-slate-200 text-slate-700 font-medium py-3 text-center hover:bg-slate-50 transition-colors"
                >
                  Manage addresses
                </Link>
              </div>
            </div>
          )}

          {/* Step 2: Service */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <h2 className="font-semibold text-slate-800">Choose service</h2>
              {servicesLoading ? (
                <div className="grid gap-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-5 rounded-2xl border border-slate-200 bg-white/80 animate-pulse"
                    >
                      <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
                      <div className="h-3 w-64 bg-slate-200 rounded mb-3" />
                      <div className="h-8 w-24 bg-slate-200 rounded" />
                    </div>
                  ))}
                </div>
              ) : servicesError ? (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800 space-y-2">
                  <p>{servicesError}</p>
                  {servicesError.includes('No services configured') && (
                    <p className="pt-1">
                      <Link href="/admin/login" className="font-medium text-emerald-700 hover:underline">
                        Admin? Sign in here
                      </Link>{' '}
                      to add services.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid gap-3">
                  {services.map((s) => (
                    <AnimatedServiceCard
                      key={s.id}
                      service={{
                        id: s.id,
                        name: s.name.replace(/_/g, ' '),
                        description: s.description,
                        base_price: s.base_price,
                      }}
                      onSelect={(id) => setServiceId(id)}
                      selected={serviceId === s.id}
                    />
                  ))}
                </div>
              )}
              {services.find((s) => s.id === serviceId)?.name === 'WATER_SUPPLY' && (
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      Quantity (liters)
                    </label>
                    <select
                      className="rounded-xl border border-slate-200 px-3 py-2 bg-white"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    >
                      {[500, 1000, 2000, 3000, 5000].map((q) => (
                        <option key={q} value={q}>
                          {q} L
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emergency}
                      onChange={(e) => setEmergency(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">Emergency</span>
                  </label>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 text-slate-700 font-medium py-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-emerald-600 text-white font-medium py-3 shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  onClick={() => setStep(3)}
                  disabled={servicesLoading || !!servicesError || services.length === 0 || !serviceId}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Time slot */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <h2 className="font-semibold text-slate-800">Pick time slot</h2>
              <p className="text-sm text-slate-500">
                Min 30 minutes · End after start · Future only
              </p>
              <TimeSlotPicker
                value={slotValue}
                onChange={(v) => setSlotValue(v)}
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 text-slate-700 font-medium py-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setStep(2)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-emerald-600 text-white font-medium py-3 shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  onClick={doPreview}
                  disabled={!slotValue.valid || !serviceId || !addressId || loading}
                >
                  {loading ? 'Loading…' : 'Preview price'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Price breakdown */}
          {step === 4 && preview && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <h2 className="font-semibold text-slate-800">Price breakdown</h2>
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-slate-500">Estimated total</span>
                  <span className="text-2xl font-bold text-emerald-700">
                    ₹{preview.total_amount.toFixed(2)}
                  </span>
                </div>
                <div className="text-sm text-slate-600 space-y-2">
                  <div className="flex justify-between">
                    <span>Base</span>
                    <span>₹{preview.base_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Distance factor</span>
                    <span>{preview.distance_factor}×</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>₹{preview.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax ({preview.tax_percentage ?? 0}%)</span>
                    <span>₹{preview.tax_amount.toFixed(2)}</span>
                  </div>
                  {preview.emergency_charge > 0 && (
                    <div className="flex justify-between">
                      <span>Emergency</span>
                      <span>₹{preview.emergency_charge.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-slate-800">
                    <span>Total</span>
                    <span>₹{preview.total_amount.toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">{slotValue.time_slot} · {slotValue.date}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 text-slate-700 font-medium py-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setStep(3)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-emerald-600 text-white font-medium py-3 shadow-md hover:bg-emerald-700 transition-colors"
                  onClick={() => setStep(5)}
                >
                  Next: Confirm
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Confirm */}
          {step === 5 && preview && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <h2 className="font-semibold text-slate-800">Confirm order</h2>
              <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-600">Total</span>
                  <span className="text-xl font-bold text-emerald-700">₹{preview.total_amount.toFixed(2)}</span>
                </div>
                <p className="text-sm text-slate-500">{slotValue.time_slot} on {slotValue.date}</p>
                <p className="text-sm text-slate-600 mt-1">
                  {addresses.find((a) => a.id === addressId)?.house_no}, {addresses.find((a) => a.id === addressId)?.area},{' '}
                  {addresses.find((a) => a.id === addressId)?.city}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 text-slate-700 font-medium py-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setStep(4)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-emerald-600 text-white font-medium py-3 shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  onClick={doCreate}
                  disabled={loading}
                >
                  {loading ? 'Placing order…' : 'Place order'}
                </button>
              </div>
            </div>
          )}

          {msg && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">
              {msg}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
