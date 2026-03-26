'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

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

type Review = {
  orderId: string;
  rating: number;
  text?: string;
  createdAt: number;
};

const STORAGE_ORDERS_KEY = 'aurowater_orders';
const STORAGE_REVIEWS_KEY = 'aurowater_reviews';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function formatMoney(n: number) {
  const val = Number.isFinite(n) ? n : 0;
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

function badgeFromStatus(status: StoredOrder['status']) {
  const s = status.toUpperCase();
  if (s === 'COMPLETED') return { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (s === 'CANCELLED') return { label: 'Cancelled', className: 'bg-rose-100 text-rose-800 border-rose-200' };
  return { label: 'In Progress', className: 'bg-amber-100 text-amber-800 border-amber-200' };
}

function getMockTechnicianForOrder(o: StoredOrder) {
  const map: Record<string, { name: string; initials: string; city: string; rating: number }> = {
    water_tanker: { name: 'Rahul Verma', initials: 'RV', city: 'Kanpur', rating: 4.9 },
    ro_service: { name: 'Mohit Gupta', initials: 'MG', city: 'Delhi', rating: 4.8 },
    plumbing: { name: 'Sunita Agarwal', initials: 'SA', city: 'Lucknow', rating: 4.9 },
    borewell: { name: 'Vikram Tiwari', initials: 'VT', city: 'Varanasi', rating: 4.9 },
    motor_pump: { name: 'Kavya Singh', initials: 'KS', city: 'Agra', rating: 4.7 },
    tank_cleaning: { name: 'Priya Sharma', initials: 'PS', city: 'Kanpur', rating: 5 },
  };
  return map[o.serviceKey] || map.water_tanker;
}

function timelineIndexFromStatus(status: StoredOrder['status']): number {
  if (status === 'COMPLETED') return 4;
  if (status === 'IN_PROGRESS') return 3;
  if (status === 'ASSIGNED') return 2;
  if (status === 'PENDING') return 0;
  return 0;
}

function derivePriceBreakdown(order: StoredOrder) {
  const convenienceFee = 29;
  const emergencyExtra = order.emergency ? 199 : 0;
  const total = Math.round(order.total);

  for (let base = 0; base <= 50000; base += 1) {
    const gst = Math.round((base + convenienceFee) * 0.18);
    if (base + convenienceFee + emergencyExtra + gst === total) {
      return { base, convenienceFee, emergencyExtra, gst, total };
    }
  }

  const taxable = Math.max(0, total - convenienceFee - emergencyExtra);
  const gst = Math.round(taxable * 0.18);
  const base = Math.max(0, total - convenienceFee - emergencyExtra - gst);
  return { base, convenienceFee, emergencyExtra, gst, total };
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-slate-600">{label}</div>
      <div className="font-extrabold text-[#0F1C18]">{value}</div>
    </div>
  );
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params?.id ? decodeURIComponent(params.id) : '';

  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingText, setRatingText] = useState('');

  useEffect(() => {
    const savedOrders = safeParse<StoredOrder[]>(localStorage.getItem(STORAGE_ORDERS_KEY));
    const savedReviews = safeParse<Review[]>(localStorage.getItem(STORAGE_REVIEWS_KEY));
    setOrders(Array.isArray(savedOrders) ? savedOrders : []);
    setReviews(Array.isArray(savedReviews) ? savedReviews : []);
  }, []);

  const order = useMemo(() => orders.find((o) => o.id === orderId) || null, [orders, orderId]);
  const badge = order ? badgeFromStatus(order.status) : null;
  const technician = order ? getMockTechnicianForOrder(order) : null;
  const breakdown = order ? derivePriceBreakdown(order) : null;
  const existingReview = useMemo(() => {
    if (!order) return null;
    return reviews.find((r) => r.orderId === order.id) || null;
  }, [order, reviews]);

  useEffect(() => {
    if (!existingReview) return;
    setRatingStars(existingReview.rating);
    setRatingText(existingReview.text ?? '');
  }, [existingReview]);

  const persistOrders = (next: StoredOrder[]) => {
    setOrders(next);
    try {
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const persistReviews = (next: Review[]) => {
    setReviews(next);
    try {
      localStorage.setItem(STORAGE_REVIEWS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const confirmCancel = () => {
    if (!order) return;
    const next = orders.map((o) => (o.id === order.id ? { ...o, status: 'CANCELLED' as const } : o));
    persistOrders(next);
    setCancelOpen(false);
    toast.error('Order cancelled');
  };

  const submitReview = () => {
    if (!order) return;
    if (!ratingStars || ratingStars < 1) {
      toast.error('Please select a star rating.');
      return;
    }
    const nextReview: Review = {
      orderId: order.id,
      rating: Math.min(5, Math.max(1, Math.round(ratingStars))),
      text: ratingText.trim() ? ratingText.trim() : undefined,
      createdAt: Date.now(),
    };
    const idx = reviews.findIndex((r) => r.orderId === order.id);
    const nextReviews = idx === -1 ? [nextReview, ...reviews] : reviews.map((r) => (r.orderId === order.id ? nextReview : r));
    persistReviews(nextReviews);
    toast.success('Thanks for your review!');
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link href="/dashboard?tab=orders" className="text-sm font-extrabold text-[#0D9B6C] hover:underline">
            ⬅ Back to Orders
          </Link>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 mt-6">
            <div className="text-2xl">📦</div>
            <div className="font-extrabold mt-2 text-slate-900">Order not found</div>
            <div className="text-sm text-slate-600 mt-1">Try returning to your orders list.</div>
            <button type="button" onClick={() => router.push('/dashboard?tab=orders')} className="mt-4 rounded-xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C]">
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const timelineIdx = timelineIndexFromStatus(order.status);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard?tab=orders" className="text-sm font-extrabold text-[#0D9B6C] hover:underline">
            ⬅ Back to Orders
          </Link>
          {badge ? (
            <div className={`inline-flex items-center px-3 py-1 rounded-full border ${badge.className} text-xs font-extrabold`}>
              {badge.label}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 mt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-600">Order ID</div>
              <div className="text-lg font-extrabold text-slate-900 mt-1">{order.id}</div>
              <div className="text-sm text-slate-600 mt-2">
                {order.scheduledDate} • {order.timeKey}
              </div>
              <div className="text-sm text-slate-600 mt-1">
                {order.address.houseFlat}, {order.address.area} • {order.address.city}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-500">Price</div>
              <div className="text-xl font-extrabold text-[#0D9B6C] mt-1">{formatMoney(order.total)}</div>
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-6">
            <div className="text-sm font-extrabold text-[#0F1C18] mb-3">Status Timeline</div>
            <div className="flex items-start gap-3">
              {(['Placed', 'Confirmed', 'Assigned', 'In Progress', 'Completed'] as const).map((label, idx) => {
                const active = idx <= timelineIdx && order.status !== 'CANCELLED';
                return (
                  <div key={label} className="flex-1">
                    <div
                      className={[
                        'w-8 h-8 rounded-full border flex items-center justify-center text-sm font-extrabold mx-auto',
                        active ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 text-slate-400 border-slate-200',
                      ].join(' ')}
                    >
                      {idx + 1}
                    </div>
                    <div className="text-xs text-slate-600 mt-2 text-center">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Technician */}
          <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-extrabold text-[#0F1C18]">Assigned Technician</div>
                <div className="text-xs text-slate-600 mt-1">
                  {order.status === 'PENDING' ? 'Not assigned yet' : `${technician?.name} · ${technician?.city}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0D9B6C] to-[#38BDF8] text-white font-extrabold flex items-center justify-center">
                  {technician?.initials}
                </div>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white border border-slate-100 px-3 py-1">
              <span className="text-xs font-extrabold text-[#0F1C18]">★</span>
              <span className="text-xs font-extrabold text-[#0D9B6C]">{technician?.rating.toFixed(1)}</span>
              <span className="text-xs text-slate-600">Verified rating</span>
            </div>
          </div>

          {/* Price breakdown */}
          <div className="mt-6 rounded-2xl bg-white border border-slate-100 p-4">
            <div className="text-sm font-extrabold text-[#0F1C18] mb-3">Price Breakdown</div>
            {breakdown ? (
              <div className="space-y-2 text-sm">
                <Row label="Base" value={`₹${breakdown.base}`} />
                <Row label="Convenience fee" value={`₹${breakdown.convenienceFee}`} />
                <Row label="GST (18%)" value={`₹${breakdown.gst}`} />
                {breakdown.emergencyExtra > 0 ? <Row label="Emergency surcharge" value={`₹${breakdown.emergencyExtra}`} /> : null}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-sm font-extrabold text-[#0F1C18]">Total</div>
                  <div className="text-sm font-extrabold text-[#0D9B6C]">₹{breakdown.total}</div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Rating */}
          {order.status === 'COMPLETED' ? (
            <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-extrabold text-[#0F1C18]">Rate this service</div>
                  <div className="text-xs text-slate-600 mt-1">Share your experience (optional).</div>
                </div>
                {existingReview ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs font-extrabold">
                    ⭐ Rated {existingReview.rating}★
                  </div>
                ) : null}
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const star = i + 1;
                    const active = (existingReview ? existingReview.rating : ratingStars) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        disabled={!!existingReview}
                        onClick={() => setRatingStars(star)}
                        className={[
                          'w-10 h-10 rounded-xl border transition-all active:scale-95',
                          active ? 'bg-[#0D9B6C] border-[#0D9B6C] text-white' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50',
                        ].join(' ')}
                        aria-label={`Rate ${star} stars`}
                      >
                        ★
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={existingReview ? existingReview.text ?? '' : ratingText}
                  onChange={(e) => setRatingText(e.target.value)}
                  disabled={!!existingReview}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C] disabled:opacity-60"
                  placeholder="Share your experience (optional)"
                />

                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!!existingReview}
                    onClick={submitReview}
                    className="rounded-xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60"
                  >
                    {existingReview ? 'Review Submitted' : 'Submit Review'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Cancel */}
          {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' ? (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="rounded-xl border border-rose-200 text-rose-700 font-extrabold px-5 py-3 hover:bg-rose-50 active:scale-95 transition-all"
              >
                Cancel Order
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {cancelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-100 shadow-card p-6">
            <div className="text-xl font-extrabold text-[#0F1C18]">Cancel this booking?</div>
            <div className="text-sm text-slate-600 mt-2">This will mark your order as cancelled.</div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setCancelOpen(false)} className="flex-1 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold py-3 hover:bg-slate-50 transition-all">
                Keep Order
              </button>
              <button type="button" onClick={confirmCancel} className="flex-1 rounded-xl bg-rose-600 text-white font-extrabold py-3 hover:bg-rose-700 active:scale-95 transition-all">
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

