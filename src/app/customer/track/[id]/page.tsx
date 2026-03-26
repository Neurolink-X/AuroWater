'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';

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

type ServiceKey =
  | 'water_tanker'
  | 'ro_service'
  | 'plumbing'
  | 'borewell'
  | 'motor_pump'
  | 'tank_cleaning';

type ServiceDef = {
  key: ServiceKey;
  title: string;
  subLabels?: Record<string, string>;
};

type StoredOrder = {
  id: string;
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: number;
  serviceKey: ServiceKey;
  subOptionKey: string;
  address: Address;
  scheduledDate: string;
  timeKey: string;
  emergency: boolean;
  total: number;
  paymentMethod: 'cash' | 'online';
  paymentStatus: 'unpaid' | 'paid';
};

const STORAGE_ORDERS_KEY = 'aurowater_orders';

const SERVICE_DEFS: Record<ServiceKey, ServiceDef> = {
  water_tanker: { key: 'water_tanker', title: 'Water Tanker Delivery', subLabels: { standard: 'Standard delivery' } },
  ro_service: {
    key: 'ro_service',
    title: 'RO Service & Repair',
    subLabels: { amc: 'AMC (Annual Maintenance)', repair: 'One-time repair', filter: 'Filter change' },
  },
  plumbing: {
    key: 'plumbing',
    title: 'Plumbing Services',
    subLabels: { fitting: 'Fittings & repair', leak: 'Leak fixing', pump: 'Pump repair' },
  },
  borewell: {
    key: 'borewell',
    title: 'Borewell Services',
    subLabels: { repair: 'Borewell repair', installation: 'Installation', boring: 'Boring' },
  },
  motor_pump: {
    key: 'motor_pump',
    title: 'Motor Pump Repair',
    subLabels: { service: 'Motor servicing', repair: 'Motor repair', pump: 'Pump check & repair' },
  },
  tank_cleaning: {
    key: 'tank_cleaning',
    title: 'Water Tank Cleaning',
    subLabels: { clean: 'Tank cleaning', sanitise: 'Sanitization' },
  },
};

const statusSteps = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] as const;

function badgeClasses(status: StoredOrder['status']) {
  if (status === 'COMPLETED') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'IN_PROGRESS') return 'bg-violet-100 text-violet-800 border-violet-200';
  if (status === 'ASSIGNED') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (status === 'CANCELLED') return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
}

export default function TrackOrderPage() {
  const params = useParams();
  const id = (params?.id as string) || '';

  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_ORDERS_KEY);
      const list = raw ? (JSON.parse(raw) as StoredOrder[]) : [];
      const found = Array.isArray(list) ? list.find((o) => o.id === id) ?? null : null;
      setOrder(found);
      setNotFound(!found);
    } catch {
      setOrder(null);
      setNotFound(true);
    }
  }, [id]);

  const serviceTitle = order ? SERVICE_DEFS[order.serviceKey]?.title : '';
  const subLabel = order
    ? SERVICE_DEFS[order.serviceKey]?.subLabels?.[order.subOptionKey] ?? order.subOptionKey
    : '';

  const timeline = useMemo(() => {
    if (!order) return [];
    const currentIndex = Math.max(0, statusSteps.indexOf(order.status as any));
    return statusSteps.map((s, idx) => ({
      step: s,
      active: idx <= currentIndex,
      done: idx < currentIndex,
    }));
  }, [order]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <div className="rounded-2xl bg-white border border-slate-100 p-6">
            <h1 className="text-2xl font-bold text-slate-900">Order not found</h1>
            <p className="text-slate-600 mt-2">
              We couldn&apos;t find this booking in your device&apos;s saved orders. Please make a new booking.
            </p>
            <div className="mt-5 flex gap-3">
              <Link href="/book" className="rounded-xl bg-[#0D9B6C] text-white px-6 py-3 font-bold hover:bg-[#086D4C] transition">
                Book now
              </Link>
              <Link href="/" className="rounded-xl border border-slate-200 text-slate-700 px-6 py-3 font-bold hover:bg-slate-50 transition">
                Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-slate-500 font-semibold">Loading order…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Track order</h1>
            <p className="text-slate-600 mt-1">
              Order: <span className="font-extrabold">{order.id}</span>
            </p>
          </div>
          <Link href="/book" className="rounded-xl border border-slate-200 text-slate-700 px-4 py-2 font-semibold hover:bg-slate-50 transition">
            New booking
          </Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-100 p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-sm font-semibold text-slate-600">Status</div>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${badgeClasses(order.status)}`}>
                    {order.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-600">Total</div>
                  <div className="text-2xl font-extrabold text-[#0D9B6C]">{`₹${Math.round(order.total).toLocaleString('en-IN')}`}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-500">Service</div>
                  <div className="mt-1 font-bold text-slate-900">{serviceTitle}</div>
                  <div className="text-sm text-slate-600 mt-1">{subLabel}</div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-xs font-semibold text-slate-500">Schedule</div>
                  <div className="mt-1 font-bold text-slate-900">{order.scheduledDate}</div>
                  <div className="text-sm text-slate-600 mt-1">Time: {order.timeKey}</div>
                  {order.emergency && <div className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">Emergency</div>}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 p-4 bg-slate-50">
                <div className="text-sm font-bold text-slate-800 mb-2">Address</div>
                <div className="text-sm text-slate-700">
                  {order.address.houseFlat}, {order.address.area}
                  <br />
                  {order.address.city} {order.address.pincode}
                  {order.address.landmark ? (
                    <>
                      <br />
                      Landmark: {order.address.landmark}
                    </>
                  ) : null}
                </div>
              </div>

              <div className="mt-5">
                <div className="text-sm font-bold text-slate-800 mb-3">Status timeline</div>
                <div className="space-y-3">
                  {timeline.map((t) => (
                    <div
                      key={t.step}
                      className={[
                        'rounded-xl border p-4 flex items-center justify-between gap-4',
                        t.active ? 'border-[#0D9B6C] bg-[#E8F8F2]' : 'border-slate-100 bg-white',
                      ].join(' ')}
                    >
                      <div className="font-extrabold text-slate-900">{t.step}</div>
                      <div className="text-xs font-semibold text-slate-600">
                        {t.active ? 'Reached' : 'Pending'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-slate-100 p-6">
              <div className="text-sm font-bold text-slate-800 mb-3">Next steps</div>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-900">Technician assignment</div>
                  <div className="text-sm text-slate-600 mt-1">
                    {order.status === 'PENDING' ? 'We’ll assign shortly. You’ll get updates.' : 'Assignment updated.'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="text-sm font-bold text-slate-900">Payment</div>
                  <div className="text-sm text-slate-600 mt-1">Cash on service.</div>
                </div>
                <Link
                  href="/dashboard"
                  className="block w-full rounded-xl bg-[#0D9B6C] text-white px-6 py-3 text-center font-bold hover:bg-[#086D4C] transition"
                >
                  Go to dashboard
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

