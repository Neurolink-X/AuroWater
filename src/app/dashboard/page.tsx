'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

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

type NotificationItem = {
  id: number;
  icon: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
};

type Profile = {
  name: string;
  email: string;
  phone: string;
  avatarSeed?: string;
};

type Review = {
  orderId: string;
  rating: number; // 1..5
  text?: string;
  createdAt: number;
};

const STORAGE_ORDERS_KEY = 'aurowater_orders';
const STORAGE_ADDRESSES_KEY = 'aurowater_addresses';
const STORAGE_NOTIFICATIONS_KEY = 'aurowater_notifications';
const STORAGE_PROFILE_KEY = 'aurowater_profile';
const STORAGE_REVIEWS_KEY = 'aurowater_reviews';
const STORAGE_REFERRAL_KEY = 'aurowater_referral_code';
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

function makeOrderId() {
  const n = Math.floor(10000000 + Math.random() * 90000000);
  return `AW-${n}`;
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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function countDefault(order: Address[]) {
  return order.filter((a) => a.isDefault).length ? order.find((a) => a.isDefault) : null;
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
  // Steps: Placed -> Confirmed -> Assigned -> In Progress -> Completed
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

  // total = base + convenience + emergencyExtra + gst
  // gst = round((base + convenience) * 0.18)
  for (let base = 0; base <= 50000; base += 1) {
    const gst = Math.round((base + convenienceFee) * 0.18);
    if (base + convenienceFee + emergencyExtra + gst === total) {
      return { base, convenienceFee, emergencyExtra, gst, total };
    }
  }

  // Fallback keeps the UI stable.
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

function randomReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `AW-${out}`;
}

function AnimatedNumber({ target, durationMs = 1500 }: { target: number; durationMs?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const next = Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      setDisplay(next);
      if (t < 1) requestAnimationFrame(tick);
    }

    setDisplay(0);
    requestAnimationFrame(tick);
  }, [target, durationMs]);

  return <>{display}</>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'overview' | 'orders' | 'notifications' | 'addresses' | 'profile'>('overview');

  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [profile, setProfile] = useState<Profile>({ name: 'Guest', email: '', phone: '' });
  const { role: authRole } = useAuth();
  const roleLabel =
    authRole === 'technician' ? 'Technician'
      : authRole === 'supplier' ? 'Supplier'
        : authRole === 'admin' ? 'Admin'
          : 'Customer';

  const initials = profile?.name?.trim()
    ? profile.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase()
    : 'A';

  const [reviews, setReviews] = useState<Review[]>([]);
  const [referralCode, setReferralCode] = useState<string>('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, { stars: number; text: string }>>({});

  // Address add form (reused for dashboard sync)
  const [addForm, setAddForm] = useState({
    label: 'Saved address',
    houseFlat: '',
    area: '',
    city: '',
    pincode: '',
    landmark: '',
  });
  const [addErr, setAddErr] = useState<string | null>(null);

  const [ordersFilter, setOrdersFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  const seed = () => {
    const now = Date.now();
    const a1: Address = {
      id: 'addr_1',
      houseFlat: 'Flat 402',
      area: 'Bara 8 Cross, Near City Mall',
      city: 'Kanpur',
      pincode: '208027',
      landmark: 'City Mall Road',
      createdAt: now - 1000 * 60 * 60 * 24 * 8,
      isDefault: true,
      label: 'Home',
    };
    const a2: Address = {
      id: 'addr_2',
      houseFlat: 'House No. 19',
      area: 'Civil Lines',
      city: 'Kanpur',
      pincode: '208001',
      createdAt: now - 1000 * 60 * 60 * 24 * 4,
      isDefault: false,
      label: 'Office',
    };

    const mockOrders: StoredOrder[] = [
      {
        id: 'AW-00000001',
        status: 'COMPLETED',
        createdAt: now - 1000 * 60 * 60 * 24 * 10,
        serviceKey: 'water_tanker',
        subOptionKey: 'standard',
        address: a1,
        scheduledDate: '2026-03-20',
        timeKey: 'Morning',
        emergency: false,
        total: 449,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
      },
      {
        id: 'AW-00000002',
        status: 'PENDING',
        createdAt: now - 1000 * 60 * 60 * 24 * 6,
        serviceKey: 'ro_service',
        subOptionKey: 'filter',
        address: a1,
        scheduledDate: '2026-03-24',
        timeKey: 'Afternoon',
        emergency: false,
        total: 279,
        paymentMethod: 'cash',
        paymentStatus: 'unpaid',
      },
      {
        id: 'AW-00000003',
        status: 'CANCELLED',
        createdAt: now - 1000 * 60 * 60 * 24 * 15,
        serviceKey: 'plumbing',
        subOptionKey: 'leak',
        address: a1,
        scheduledDate: '2026-03-15',
        timeKey: 'Morning',
        emergency: false,
        total: 199,
        paymentMethod: 'cash',
        paymentStatus: 'unpaid',
      },
    ];

    const mockNotifications: NotificationItem[] = [
      { id: 1, icon: '✅', title: 'Order Confirmed', body: 'Your RO service is confirmed for Mar 24, Afternoon', time: '2 hours ago', read: false },
      { id: 2, icon: '🔔', title: 'Technician Assigned', body: 'Rahul Verma will service your RO. Contact: 9XXXXXXXXX', time: '1 hour ago', read: false },
      { id: 3, icon: '⭐', title: 'Rate your experience', body: 'How was your water tanker delivery on Mar 20?', time: '3 days ago', read: true },
    ];

    setOrders(mockOrders);
    setAddresses([a1, a2]);
    setNotifications(mockNotifications);

    try {
      localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(mockOrders));
      localStorage.setItem(STORAGE_ADDRESSES_KEY, JSON.stringify([a1, a2]));
      localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(mockNotifications));
    } catch {
      // ignore write issues
    }
  };

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const raw = (sp.get('tab') || '').toLowerCase();
    if (raw === 'orders' || raw === 'notifications' || raw === 'addresses' || raw === 'profile' || raw === 'overview') {
      setTab(raw as typeof tab);
    }
  }, []);

  useEffect(() => {
    const savedOrders = safeParse<StoredOrder[]>(localStorage.getItem(STORAGE_ORDERS_KEY));
    const savedAddresses = safeParse<Address[]>(localStorage.getItem(STORAGE_ADDRESSES_KEY));
    const savedNotifs = safeParse<NotificationItem[]>(localStorage.getItem(STORAGE_NOTIFICATIONS_KEY));
    const savedProfile = safeParse<Profile>(localStorage.getItem(STORAGE_PROFILE_KEY));
    const savedReviews = safeParse<Review[]>(localStorage.getItem(STORAGE_REVIEWS_KEY));
    const existingReferral = localStorage.getItem(STORAGE_REFERRAL_KEY);

    const validOrders = Array.isArray(savedOrders) ? savedOrders : [];
    const validAddresses = Array.isArray(savedAddresses) ? savedAddresses : [];
    const validNotifs = Array.isArray(savedNotifs) ? savedNotifs : [];
    const validReviews = Array.isArray(savedReviews) ? savedReviews : [];

    if (validOrders.length === 0 && validAddresses.length === 0 && validNotifs.length === 0) {
      seed();
      return;
    }

    setOrders(validOrders);
    setAddresses(validAddresses);
    setNotifications(validNotifs);
    setReviews(validReviews);
    if (savedProfile?.name) setProfile(savedProfile);

    if (existingReferral && existingReferral.trim().length) {
      setReferralCode(existingReferral);
    } else {
      const next = randomReferralCode();
      setReferralCode(next);
      try {
        localStorage.setItem(STORAGE_REFERRAL_KEY, next);
      } catch {
        // ignore
      }
    }
  }, []);

  const activeOrdersCount = useMemo(() => {
    return orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length;
  }, [orders]);

  const completedCount = useMemo(() => orders.filter((o) => o.status === 'COMPLETED').length, [orders]);

  const filteredOrders = useMemo(() => {
    if (ordersFilter === 'all') return orders;
    if (ordersFilter === 'active') return orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    if (ordersFilter === 'completed') return orders.filter((o) => o.status === 'COMPLETED');
    return orders.filter((o) => o.status === 'CANCELLED');
  }, [orders, ordersFilter]);

  const recent = useMemo(() => orders.slice(0, 3), [orders]);

  const makeDefault = (id: string) => {
    const next = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
    setAddresses(next);
    try {
      localStorage.setItem(STORAGE_ADDRESSES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    toast.success('Default address updated.');
  };

  const deleteAddress = (id: string) => {
    const next = addresses.filter((a) => a.id !== id);
    if (next.length && !next.some((a) => a.isDefault)) {
      next[0].isDefault = true;
    }
    setAddresses(next);
    try {
      localStorage.setItem(STORAGE_ADDRESSES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    toast.success('Address deleted.');
  };

  const onAddAddress = () => {
    setAddErr(null);
    const houseFlat = addForm.houseFlat.trim();
    const area = addForm.area.trim();
    const city = addForm.city.trim();
    const pincode = addForm.pincode.trim();
    const landmark = addForm.landmark.trim();

    const pinOk = /^[0-9]{6}$/.test(pincode);
    if (!houseFlat || !area || !city || !pincode) {
      setAddErr('House/Flat, Area, City and Pincode are required.');
      return;
    }
    if (!pinOk) {
      setAddErr('Pincode must be 6 digits.');
      return;
    }

    const now = Date.now();
    const newAddr: Address = {
      id: `addr_${now}_${Math.random().toString(16).slice(2)}`,
      houseFlat,
      area,
      city,
      pincode,
      landmark: landmark ? landmark : undefined,
      label: addForm.label || 'Saved address',
      createdAt: now,
      isDefault: addresses.length === 0 || !addresses.some((a) => a.isDefault),
    };

    const next = [newAddr, ...addresses].map((a) => ({ ...a }));
    if (newAddr.isDefault) next.forEach((a) => (a.isDefault = a.id === newAddr.id));

    setAddresses(next);
    try {
      localStorage.setItem(STORAGE_ADDRESSES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    setAddForm({ label: 'Saved address', houseFlat: '', area: '', city: '', pincode: '', landmark: '' });
    toast.success('Address saved.');
  };

  const toggleAllRead = () => {
    const next = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(next);
    try {
      localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    toast.success('All notifications marked as read.');
  };

  const markOneRead = (id: number) => {
    const next = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(next);
    try {
      localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const saveProfile = (next: Profile) => {
    setProfile(next);
    try {
      localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    toast.success('Profile saved.');
  };

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

  const confirmCancelOrder = () => {
    if (!cancelOrderId) return;
    const next = orders.map((o) => (o.id === cancelOrderId ? { ...o, status: 'CANCELLED' as const } : o));
    persistOrders(next);
    setCancelOrderId(null);
    setExpandedOrderId(null);
    toast.error('Order cancelled');
  };

  const submitReview = (orderId: string) => {
    const draft = ratingDrafts[orderId] || { stars: 0, text: '' };
    const stars = Number(draft.stars);
    if (!stars || stars < 1) {
      toast.error('Please select a star rating.');
      return;
    }
    const nextReviews = (() => {
      const idx = reviews.findIndex((r) => r.orderId === orderId);
      const nextReview: Review = {
        orderId,
        rating: Math.min(5, Math.max(1, Math.round(stars))),
        text: draft.text?.trim() ? draft.text.trim() : undefined,
        createdAt: Date.now(),
      };
      if (idx === -1) return [nextReview, ...reviews];
      const copy = [...reviews];
      copy[idx] = nextReview;
      return copy;
    })();
    persistReviews(nextReviews);
    toast.success('Thanks for your review!');
  };

  const navItems = [
    { key: 'overview', label: 'Overview' },
    { key: 'orders', label: 'My Orders' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'addresses', label: 'Addresses' },
    { key: 'profile', label: 'Profile' },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-5 sticky top-24">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0D9B6C] to-[#38BDF8] flex items-center justify-center text-white font-extrabold"
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-[#0F1C18] truncate">{profile.name || 'Guest'}</div>
                  <div className="mt-1 inline-flex items-center gap-2">
                    <span className="text-xs font-extrabold text-[#0D9B6C] bg-[#E8F8F2] border border-[#0D9B6C]/30 px-3 py-1 rounded-full">
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {navItems.map((it) => {
                  const active = tab === it.key;
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => setTab(it.key)}
                      className={[
                        'w-full rounded-xl px-4 py-3 text-left border transition-all',
                        active
                          ? 'bg-[#E8F8F2] text-[#0D9B6C] border-[#0D9B6C] border-l-4 pl-3'
                          : 'bg-white text-slate-700 border-slate-100 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {it.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100">
                <Link href="/" className="text-sm font-semibold text-[#0D9B6C] hover:underline">
                  ⬅ Back to site
                </Link>
              </div>
            </div>
          </aside>

          {/* Content */}
          <main className="lg:col-span-9">
            {/* Mobile tab header */}
            <div className="lg:hidden mb-4">
              <div className="flex gap-2 flex-wrap">
                {navItems.map((it) => {
                  const active = tab === it.key;
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => setTab(it.key)}
                      className={[
                        'px-4 py-2 rounded-full border text-sm font-extrabold transition-all',
                        active ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {it.label.replace('My ', '')}
                    </button>
                  );
                })}
              </div>
            </div>

            {tab === 'overview' && (
              <div>
                <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-600">{greeting()}</div>
                      <div className="text-2xl sm:text-3xl font-extrabold text-[#0F1C18] mt-1">
                        👋 {profile.name || 'Guest'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/book')}
                      className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-[#0D9B6C] text-white font-extrabold hover:bg-[#086D4C] active:scale-95 transition-all"
                    >
                      Book a New Service
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Bookings', value: orders.length, icon: '📦' },
                      { label: 'Active Orders', value: activeOrdersCount, icon: '⚡' },
                      { label: 'Completed', value: completedCount, icon: '✅' },
                      { label: 'Saved Addresses', value: addresses.length, icon: '📍' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
                        <div className="text-lg">{s.icon}</div>
                        <div className="text-3xl font-extrabold text-[#0D9B6C] mt-1">
                          <AnimatedNumber target={s.value} />
                        </div>
                        <div className="text-xs font-semibold text-slate-600 mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-2xl bg-gradient-to-r from-[#0D9B6C] to-[#38BDF8] text-white p-6 overflow-hidden relative">
                    <div className="hero-water-bg opacity-50" />
                    <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="text-lg font-extrabold">Need water or plumbing help?</div>
                        <div className="text-white/90 text-sm mt-1">Book in seconds. Track your timeline.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push('/book')}
                        className="rounded-xl bg-white text-[#0D9B6C] font-extrabold px-5 py-3 hover:bg-white/90 active:scale-95 transition-all"
                      >
                        Book Now →
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-emerald-800">🎁 Refer a friend and earn ₹50 credit</div>
                        <div className="mt-2 inline-flex items-center gap-3 rounded-xl bg-white border border-emerald-200 px-4 py-3">
                          <span className="text-xs font-extrabold text-slate-600">Your code</span>
                          <span className="text-[#0D9B6C] font-extrabold tracking-wider">{referralCode || '—'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(referralCode);
                            toast.success('Code copied!');
                          } catch {
                            toast.error('Could not copy code.');
                          }
                        }}
                        className="rounded-xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
                      >
                        Copy Code
                      </button>
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="flex items-center justify-between">
                      <div className="font-extrabold text-[#0F1C18]">Recent Orders</div>
                      <button type="button" className="text-sm font-extrabold text-[#0D9B6C] hover:underline" onClick={() => setTab('orders')}>
                        View All
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {recent.length === 0 ? (
                        <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-slate-600">
                          No orders yet. Book your first service to get started.
                        </div>
                      ) : (
                        recent.map((o) => {
                          const badge = badgeFromStatus(o.status);
                          return (
                            <div key={o.id} className="rounded-2xl border border-slate-100 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex-1">
                                <div className="font-extrabold text-slate-900">
                                  {o.serviceKey.replace('_', ' ')}
                                </div>
                                <div className="text-sm text-slate-600 mt-1">
                                  {o.scheduledDate} • {o.timeKey}
                                </div>
                                <div className="text-sm text-slate-600 mt-1">
                                  {o.address.city} • {o.address.pincode}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className={`inline-flex items-center px-3 py-1 rounded-full border ${badge.className} text-xs font-extrabold`}>
                                  {badge.label}
                                </div>
                                <div className="font-extrabold text-[#0D9B6C]">{formatMoney(o.total)}</div>
                              </div>
                              <div className="flex gap-2">
                                <Link href={`/customer/track/${encodeURIComponent(o.id)}`} className="rounded-xl border border-slate-200 px-4 py-2 font-extrabold text-slate-700 hover:bg-slate-50 transition">
                                  View Details
                                </Link>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'orders' && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="text-2xl font-extrabold text-[#0F1C18]">My Orders</div>
                    <div className="text-slate-600 mt-1 text-sm">Filter and view booking details.</div>
                  </div>
                  <button type="button" onClick={() => router.push('/book')} className="rounded-xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all">
                    Book Now
                  </button>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {([
                    { key: 'all', label: 'All' },
                    { key: 'active', label: 'Active' },
                    { key: 'completed', label: 'Completed' },
                    { key: 'cancelled', label: 'Cancelled' },
                  ] as const).map((f) => {
                    const active = ordersFilter === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setOrdersFilter(f.key)}
                        className={[
                          'px-4 py-2 rounded-full border text-sm font-extrabold transition-all',
                          active ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 space-y-3">
                  {filteredOrders.length === 0 ? (
                    <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-slate-600">
                      <div className="text-4xl">📦</div>
                      <div className="font-extrabold mt-2 text-slate-900">No orders yet</div>
                      <div className="text-sm mt-1">Book your first service to get started.</div>
                    </div>
                  ) : (
                    filteredOrders.map((o) => {
                      const badge = badgeFromStatus(o.status);
                      const isExpanded = expandedOrderId === o.id;
                      const technician = getMockTechnicianForOrder(o);
                      const breakdown = derivePriceBreakdown(o);
                      const timelineIdx = timelineIndexFromStatus(o.status);
                      const existingReview = reviews.find((r) => r.orderId === o.id);
                      return (
                        <div
                          key={o.id}
                          className={[
                            'rounded-2xl border border-slate-100 bg-white p-4 transition-all',
                            isExpanded ? 'shadow-card' : '',
                          ].join(' ')}
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpandedOrderId((cur) => (cur === o.id ? null : o.id))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') setExpandedOrderId((cur) => (cur === o.id ? null : o.id));
                          }}
                        >
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="text-2xl">🧰</div>
                                <div className="font-extrabold text-slate-900">
                                  {o.serviceKey.replace('_', ' ')}
                                </div>
                                <div className={`ml-auto md:ml-0 inline-flex items-center px-3 py-1 rounded-full border ${badge.className} text-xs font-extrabold`}>
                                  {badge.label}
                                </div>
                              </div>
                              <div className="text-sm text-slate-600 mt-2">
                                Order ID: <span className="font-extrabold">{o.id}</span>
                              </div>
                              <div className="text-sm text-slate-600 mt-1">
                                {o.scheduledDate} • {o.timeKey}
                              </div>
                              <div className="text-sm text-slate-600 mt-1">
                                {o.address.houseFlat}, {o.address.area} • {o.address.city}
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:mt-0">
                              <div className="text-right">
                                <div className="text-xs font-semibold text-slate-500">Price</div>
                                <div className="font-extrabold text-[#0D9B6C]">{formatMoney(o.total)}</div>
                              </div>
                              <div className="flex gap-2">
                                <Link
                                  href={`/dashboard/orders/${encodeURIComponent(o.id)}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded-xl border border-slate-200 px-4 py-2 font-extrabold text-slate-700 hover:bg-slate-50 transition"
                                >
                                  View Details
                                </Link>
                                {o.status === 'COMPLETED' ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/book?service=${encodeURIComponent(o.serviceKey)}`);
                                    }}
                                    className="rounded-xl bg-[#0D9B6C] text-white font-extrabold px-4 py-2 hover:bg-[#086D4C] transition active:scale-95"
                                  >
                                    Rebook
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-5 pt-4 border-t border-slate-100">
                              {/* Timeline */}
                              <div className="flex flex-col lg:flex-row lg:items-start lg:gap-6 gap-4">
                                <div className="flex-1">
                                  <div className="text-sm font-extrabold text-[#0F1C18] mb-3">Status Timeline</div>
                                  <div className="flex items-start gap-3">
                                    {(['Placed', 'Confirmed', 'Assigned', 'In Progress', 'Completed'] as const).map((label, idx) => {
                                      const active = idx <= timelineIdx && o.status !== 'CANCELLED';
                                      return (
                                        <div key={label} className="flex-1">
                                          <div className="flex items-center gap-2">
                                            <div
                                              className={[
                                                'w-8 h-8 rounded-full border flex items-center justify-center text-sm font-extrabold',
                                                active ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 text-slate-400 border-slate-200',
                                              ].join(' ')}
                                            >
                                              {idx + 1}
                                            </div>
                                          </div>
                                          <div className="text-xs text-slate-600 mt-2">{label}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Technician + Breakdown */}
                                <div className="w-full lg:w-1/2 space-y-4">
                                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-extrabold text-[#0F1C18]">Assigned Technician</div>
                                        <div className="text-xs text-slate-600 mt-1">
                                          {o.status === 'PENDING' ? 'Not assigned yet' : `${technician.name} · ${technician.city}`}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0D9B6C] to-[#38BDF8] text-white font-extrabold flex items-center justify-center">
                                          {technician.initials}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white border border-slate-100 px-3 py-1">
                                      <span className="text-xs font-extrabold text-[#0F1C18]">★</span>
                                      <span className="text-xs font-extrabold text-[#0D9B6C]">{technician.rating.toFixed(1)}</span>
                                      <span className="text-xs text-slate-600">Verified rating</span>
                                    </div>
                                  </div>

                                  <div className="rounded-2xl bg-white border border-slate-100 p-4">
                                    <div className="text-sm font-extrabold text-[#0F1C18] mb-3">Price Breakdown</div>
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
                                  </div>
                                </div>
                              </div>

                              {/* Rating / Cancel */}
                              <div className="mt-5 space-y-4">
                                {o.status === 'COMPLETED' ? (
                                  <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div>
                                        <div className="text-sm font-extrabold text-[#0F1C18]">Rate this service</div>
                                        <div className="text-xs text-slate-600 mt-1">Your feedback helps us improve.</div>
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
                                          const active = (ratingDrafts[o.id]?.stars ?? existingReview?.rating ?? 0) >= star;
                                          return (
                                            <button
                                              key={star}
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setRatingDrafts((cur) => ({
                                                  ...cur,
                                                  [o.id]: {
                                                    stars: star,
                                                    text: cur[o.id]?.text ?? existingReview?.text ?? '',
                                                  },
                                                }));
                                              }}
                                              className={[
                                                'w-10 h-10 rounded-xl border transition-all active:scale-95',
                                                active
                                                  ? 'bg-[#0D9B6C] border-[#0D9B6C] text-white'
                                                  : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50',
                                              ].join(' ')}
                                              aria-label={`Rate ${star} stars`}
                                            >
                                              ★
                                            </button>
                                          );
                                        })}
                                      </div>

                                      <textarea
                                        value={ratingDrafts[o.id]?.text ?? existingReview?.text ?? ''}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const text = e.target.value;
                                          setRatingDrafts((cur) => ({
                                            ...cur,
                                            [o.id]: {
                                              stars: cur[o.id]?.stars ?? existingReview?.rating ?? 0,
                                              text,
                                            },
                                          }));
                                        }}
                                        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
                                        placeholder="Share your experience (optional)"
                                      />

                                      <div className="mt-3 flex items-center gap-3">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            submitReview(o.id);
                                          }}
                                          className="rounded-xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60"
                                          disabled={!!existingReview}
                                        >
                                          {existingReview ? 'Review Submitted' : 'Submit Review'}
                                        </button>
                                        {existingReview ? (
                                          <div className="text-xs font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-xl px-3 py-2">
                                            Thanks for rating!
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                ) : null}

                                {o.status !== 'COMPLETED' && o.status !== 'CANCELLED' ? (
                                  <div className="flex items-center justify-end gap-3">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCancelOrderId(o.id);
                                      }}
                                      className="rounded-xl border border-rose-200 text-rose-700 font-extrabold px-5 py-3 hover:bg-rose-50 active:scale-95 transition-all"
                                    >
                                      Cancel Order
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {tab === 'orders' && cancelOrderId ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
                role="dialog"
                aria-modal="true"
              >
                <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-100 shadow-card p-6">
                  <div className="text-xl font-extrabold text-[#0F1C18]">Cancel this booking?</div>
                  <div className="text-sm text-slate-600 mt-2">
                    This will mark your order as cancelled.
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setCancelOrderId(null)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold py-3 hover:bg-slate-50 transition-all"
                    >
                      Keep Order
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmCancelOrder()}
                      className="flex-1 rounded-xl bg-rose-600 text-white font-extrabold py-3 hover:bg-rose-700 active:scale-95 transition-all"
                    >
                      Confirm Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === 'notifications' && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-extrabold text-[#0F1C18]">Notifications</div>
                    <div className="text-slate-600 mt-1 text-sm">Latest updates about your bookings.</div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleAllRead}
                    className="text-sm font-extrabold text-[#0D9B6C] hover:underline"
                  >
                    Mark all read
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {notifications.length === 0 ? (
                    <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-slate-600">
                      No notifications.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => markOneRead(n.id)}
                        className={[
                          'w-full text-left rounded-2xl border p-4 transition-colors',
                          n.read ? 'border-slate-100 bg-white hover:bg-slate-50' : 'border-[#0D9B6C]/40 bg-[#E8F8F2]',
                        ].join(' ')}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-xl">
                            {n.icon}
                          </div>
                          <div className="flex-1">
                            <div className={`font-extrabold ${n.read ? 'text-slate-800' : 'text-[#0F1C18]'}`}>
                              {n.title}
                            </div>
                            <div className="text-sm text-slate-700 mt-1">{n.body}</div>
                            <div className="text-xs font-semibold text-slate-500 mt-2">{n.time}</div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === 'addresses' && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="text-2xl font-extrabold text-[#0F1C18]">Saved Addresses</div>
                    <div className="text-slate-600 mt-1 text-sm">
                      These addresses sync with the booking flow.
                    </div>
                  </div>
                  <button type="button" onClick={() => router.push('/customer/addresses')} className="text-sm font-extrabold text-[#0D9B6C] hover:underline">
                    Manage in Address page →
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    {addresses.length === 0 ? (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center text-slate-600">
                        No addresses yet. Add one below.
                      </div>
                    ) : (
                      addresses.map((a) => (
                        <div key={a.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-[#E8F8F2] text-[#0D9B6C] border border-[#0D9B6C]">
                                  {a.label || 'Address'}
                                </span>
                                {a.isDefault && (
                                  <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-[#0D9B6C] text-white">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-700 mt-3">
                                {a.houseFlat}, {a.area}
                              </div>
                              <div className="text-sm text-slate-700 mt-1">
                                {a.city} • {a.pincode}
                              </div>
                              {a.landmark ? <div className="text-sm text-slate-700 mt-1">Landmark: {a.landmark}</div> : null}
                            </div>
                            <div className="flex flex-col gap-2">
                              <button type="button" onClick={() => makeDefault(a.id)} className="rounded-xl border border-[#0D9B6C] text-[#0D9B6C] font-extrabold px-4 py-2 hover:bg-[#E8F8F2] active:scale-95 transition-all">
                                Make Default
                              </button>
                              <button type="button" onClick={() => deleteAddress(a.id)} className="rounded-xl border border-rose-200 text-rose-700 font-extrabold px-4 py-2 hover:bg-rose-50 active:scale-95 transition-all">
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                    <div className="font-extrabold text-[#0F1C18]">Add New Address</div>
                    <div className="text-sm text-slate-600 mt-1">Used in /book step 1.</div>

                    <div className="mt-4 grid grid-cols-1 gap-3">
                      <input
                        value={addForm.houseFlat}
                        onChange={(e) => setAddForm((f) => ({ ...f, houseFlat: e.target.value }))}
                        placeholder="House/Flat No"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
                      />
                      <input
                        value={addForm.area}
                        onChange={(e) => setAddForm((f) => ({ ...f, area: e.target.value }))}
                        placeholder="Area"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
                      />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <select
                            value={addForm.city}
                            onChange={(e) => setAddForm((f) => ({ ...f, city: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
                          >
                            <option value="">Select City</option>
                            {UP_CITIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        <input
                          value={addForm.pincode}
                          onChange={(e) => setAddForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                          inputMode="numeric"
                          placeholder="Pincode (6 digits)"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
                        />
                      </div>
                      <input
                        value={addForm.landmark}
                        onChange={(e) => setAddForm((f) => ({ ...f, landmark: e.target.value }))}
                        placeholder="Landmark (optional)"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
                      />
                      {addErr ? <div className="text-xs text-rose-700 font-semibold">{addErr}</div> : null}
                      <button
                        type="button"
                        onClick={onAddAddress}
                        className="w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
                      >
                        Save Address
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'profile' && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-extrabold text-[#0F1C18]">Profile</div>
                    <div className="text-slate-600 mt-1 text-sm">Edit your contact details.</div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1">
                    <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-extrabold text-3xl`}>
                      {(profile.name || 'G')[0].toUpperCase()}
                    </div>
                    <div className="text-center mt-3 font-extrabold text-[#0F1C18]">{profile.name}</div>
                    <div className="text-center text-sm text-slate-600 mt-1">Customer</div>
                  </div>
                  <div className="md:col-span-2">
                    <ProfileEditor profile={profile} onSave={saveProfile} />
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function ProfileEditor({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => void }) {
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);
  const [editing, setEditing] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
      {!editing ? (
        <>
          <div className="text-sm font-semibold text-slate-600">Your details</div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="font-semibold text-slate-700">Name</div>
              <div className="font-extrabold text-slate-900">{profile.name}</div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="font-semibold text-slate-700">Email</div>
              <div className="font-extrabold text-slate-900">{profile.email ? profile.email : '—'}</div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="font-semibold text-slate-700">Phone</div>
              <div className="font-extrabold text-slate-900">{profile.phone ? profile.phone : '—'}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-6 w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
          >
            Edit Profile
          </button>
        </>
      ) : (
        <>
          <div className="text-sm font-semibold text-slate-600">Edit mode</div>
          <div className="mt-4 space-y-3">
            <input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
              placeholder="Full name"
            />
            <input
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
              placeholder="Email"
            />
            <input
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
              placeholder="Phone"
            />
          </div>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                setEditing(false);
              }}
              className="flex-1 rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(profile);
                setEditing(false);
              }}
              className="flex-1 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold py-3 hover:bg-slate-50 active:scale-95 transition-all"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
