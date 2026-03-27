'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
export const dynamic = 'force-dynamic';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type ServiceKey = 'water_tanker' | 'ro_service' | 'plumbing' | 'borewell' | 'motor_pump' | 'tank_cleaning';

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

type Profile = { name: string; email: string; phone: string; avatarSeed?: string };

type Review = { orderId: string; rating: number; text?: string; createdAt: number };

type TabKey = 'overview' | 'orders' | 'notifications' | 'addresses' | 'profile';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE = {
  ORDERS: 'aurowater_orders',
  ADDRESSES: 'aurowater_addresses',
  NOTIFICATIONS: 'aurowater_notifications',
  PROFILE: 'aurowater_profile',
  REVIEWS: 'aurowater_reviews',
  REFERRAL: 'aurowater_referral_code',
} as const;

const UP_CITIES = ['Delhi', 'Noida', 'Ghaziabad', 'Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj', 'Agra', 'Meerut', 'Bareilly', 'Aligarh', 'Mathura'] as const;

const SERVICE_META: Record<ServiceKey, { label: string; icon: string; color: string }> = {
  water_tanker:    { label: 'Water Tanker',       icon: '🚛', color: 'from-blue-500 to-cyan-400' },
  ro_service:      { label: 'RO Service',          icon: '💧', color: 'from-teal-500 to-emerald-400' },
  plumbing:        { label: 'Plumbing',            icon: '🔧', color: 'from-orange-500 to-amber-400' },
  borewell:        { label: 'Borewell',            icon: '🕳️', color: 'from-stone-500 to-zinc-400' },
  motor_pump:      { label: 'Motor & Pump',        icon: '⚙️', color: 'from-violet-500 to-purple-400' },
  tank_cleaning:   { label: 'Tank Cleaning',       icon: '🪣', color: 'from-sky-500 to-blue-400' },
};

const MOCK_TECHNICIANS: Record<ServiceKey, { name: string; initials: string; city: string; rating: number; phone: string }> = {
  water_tanker:  { name: 'Rahul Verma',    initials: 'RV', city: 'Kanpur',   rating: 4.9, phone: '9876XXXXXX' },
  ro_service:    { name: 'Mohit Gupta',    initials: 'MG', city: 'Delhi',    rating: 4.8, phone: '9812XXXXXX' },
  plumbing:      { name: 'Sunita Agarwal', initials: 'SA', city: 'Lucknow',  rating: 4.9, phone: '9823XXXXXX' },
  borewell:      { name: 'Vikram Tiwari',  initials: 'VT', city: 'Varanasi', rating: 4.9, phone: '9834XXXXXX' },
  motor_pump:    { name: 'Kavya Singh',    initials: 'KS', city: 'Agra',     rating: 4.7, phone: '9845XXXXXX' },
  tank_cleaning: { name: 'Priya Sharma',   initials: 'PS', city: 'Noida',    rating: 5.0, phone: '9856XXXXXX' },
};

const TIMELINE_STEPS = ['Placed', 'Confirmed', 'Assigned', 'In Progress', 'Completed'] as const;

// ─── SSR-safe helpers ────────────────────────────────────────────────────────

function lsGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, val: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, val); } catch { /* ignore */ }
}
function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  return `₹${Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-IN')}`;
}

function randomReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'AW-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function timelineIndex(status: StoredOrder['status']): number {
  return { PENDING: 0, ASSIGNED: 2, IN_PROGRESS: 3, COMPLETED: 4, CANCELLED: 0 }[status] ?? 0;
}

function derivePriceBreakdown(order: StoredOrder) {
  const conv = 29, emg = order.emergency ? 199 : 0, total = Math.round(order.total);
  for (let base = 0; base <= 50000; base++) {
    const gst = Math.round((base + conv) * 0.18);
    if (base + conv + emg + gst === total) return { base, conv, emg, gst, total };
  }
  const taxable = Math.max(0, total - conv - emg);
  const gst = Math.round(taxable * 0.18);
  return { base: Math.max(0, total - conv - emg - gst), conv, emg, gst, total };
}

function getGreeting() {
  if (typeof window === 'undefined') return 'Hello';
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'U';
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

function buildSeedData() {
  const now = Date.now();
  const a1: Address = { id: 'addr_1', houseFlat: 'Flat 402', area: 'Bara 8 Cross, Near City Mall', city: 'Kanpur', pincode: '208027', landmark: 'City Mall Road', createdAt: now - 864e6, isDefault: true, label: 'Home' };
  const a2: Address = { id: 'addr_2', houseFlat: 'House No. 19', area: 'Sector 62', city: 'Noida', pincode: '201301', createdAt: now - 432e6, isDefault: false, label: 'Office' };
  const orders: StoredOrder[] = [
    { id: 'AW-00000001', status: 'COMPLETED', createdAt: now - 864e6, serviceKey: 'water_tanker', subOptionKey: 'standard', address: a1, scheduledDate: '2026-03-20', timeKey: 'Morning', emergency: false, total: 449, paymentMethod: 'cash', paymentStatus: 'paid' },
    { id: 'AW-00000002', status: 'PENDING',   createdAt: now - 518e6, serviceKey: 'ro_service',   subOptionKey: 'filter',   address: a1, scheduledDate: '2026-03-28', timeKey: 'Afternoon', emergency: false, total: 279, paymentMethod: 'cash', paymentStatus: 'unpaid' },
    { id: 'AW-00000003', status: 'CANCELLED', createdAt: now - 1296e6, serviceKey: 'plumbing',    subOptionKey: 'leak',     address: a1, scheduledDate: '2026-03-15', timeKey: 'Morning', emergency: false, total: 199, paymentMethod: 'cash', paymentStatus: 'unpaid' },
    { id: 'AW-00000004', status: 'IN_PROGRESS',createdAt: now - 3600e3,serviceKey: 'tank_cleaning',subOptionKey:'full',     address: a2, scheduledDate: '2026-03-26', timeKey: 'Morning', emergency: false, total: 599, paymentMethod: 'online', paymentStatus: 'paid' },
  ];
  const notifs: NotificationItem[] = [
    { id: 1, icon: '✅', title: 'Order Confirmed', body: 'Your RO service is confirmed for Mar 28, Afternoon.', time: '2 hours ago', read: false },
    { id: 2, icon: '🔔', title: 'Technician Assigned', body: 'Rahul Verma will service your tank. Contact: 9876XXXXXX', time: '1 hour ago', read: false },
    { id: 3, icon: '⭐', title: 'Rate Your Experience', body: 'How was your water tanker delivery on Mar 20?', time: '3 days ago', read: true },
    { id: 4, icon: '💧', title: 'Tank Cleaning In Progress', body: 'Priya Sharma is currently at your location.', time: 'Just now', read: false },
  ];
  return { orders, addresses: [a1, a2], notifs };
}

// ─── AnimatedCounter ─────────────────────────────────────────────────────────

function AnimatedCounter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1200;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * ease));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    setDisplay(0);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);
  return <>{prefix}{display}{suffix}</>;
}

// ─── StatusPill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: StoredOrder['status'] }) {
  const map = {
    COMPLETED:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100' },
    CANCELLED:   { label: 'Cancelled',   cls: 'bg-red-50 text-red-600 border-red-200 ring-red-100' },
    PENDING:     { label: 'Pending',     cls: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-100' },
    ASSIGNED:    { label: 'Assigned',    cls: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-100' },
    IN_PROGRESS: { label: 'In Progress', cls: 'bg-violet-50 text-violet-700 border-violet-200 ring-violet-100' },
  }[status] ?? { label: status, cls: 'bg-zinc-100 text-zinc-600 border-zinc-200 ring-zinc-100' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold tracking-wide ring-1 ${map.cls}`}>
      {status === 'IN_PROGRESS' && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />}
      {map.label}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { role: authRole } = useAuth();

  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<TabKey>('overview');

  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [profile, setProfile] = useState<Profile>({ name: 'Guest', email: '', phone: '' });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [referralCode, setReferralCode] = useState('');

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, { stars: number; text: string }>>({});
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  const [addForm, setAddForm] = useState({ label: 'Home', houseFlat: '', area: '', city: '', pincode: '', landmark: '' });
  const [addErr, setAddErr] = useState<string | null>(null);

  const [profileEditing, setProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Profile>({ name: '', email: '', phone: '' });

  // ── Hydrate ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Parse URL tab param
    const sp = new URLSearchParams(window.location.search);
    const raw = sp.get('tab')?.toLowerCase() ?? '';
    if (['overview','orders','notifications','addresses','profile'].includes(raw)) setTab(raw as TabKey);

    const savedOrders   = safeParse<StoredOrder[]>(lsGet(STORAGE.ORDERS));
    const savedAddrs    = safeParse<Address[]>(lsGet(STORAGE.ADDRESSES));
    const savedNotifs   = safeParse<NotificationItem[]>(lsGet(STORAGE.NOTIFICATIONS));
    const savedProfile  = safeParse<Profile>(lsGet(STORAGE.PROFILE));
    const savedReviews  = safeParse<Review[]>(lsGet(STORAGE.REVIEWS));
    const savedReferral = lsGet(STORAGE.REFERRAL);

    const hasData = Array.isArray(savedOrders) && savedOrders.length > 0;
    if (!hasData) {
      const { orders: so, addresses: sa, notifs: sn } = buildSeedData();
      setOrders(so); setAddresses(sa); setNotifications(sn);
      lsSet(STORAGE.ORDERS, JSON.stringify(so));
      lsSet(STORAGE.ADDRESSES, JSON.stringify(sa));
      lsSet(STORAGE.NOTIFICATIONS, JSON.stringify(sn));
    } else {
      setOrders(savedOrders ?? []);
      setAddresses(Array.isArray(savedAddrs) ? savedAddrs : []);
      setNotifications(Array.isArray(savedNotifs) ? savedNotifs : []);
    }

    if (savedProfile?.name) { setProfile(savedProfile); setProfileDraft(savedProfile); }
    if (Array.isArray(savedReviews)) setReviews(savedReviews);

    const code = savedReferral?.trim() || randomReferralCode();
    setReferralCode(code);
    if (!savedReferral) lsSet(STORAGE.REFERRAL, code);

    setHydrated(true);
  }, []);

  // ── Persist ───────────────────────────────────────────────────────────────────
  const persistOrders = useCallback((next: StoredOrder[]) => {
    setOrders(next); lsSet(STORAGE.ORDERS, JSON.stringify(next));
  }, []);
  const persistAddresses = useCallback((next: Address[]) => {
    setAddresses(next); lsSet(STORAGE.ADDRESSES, JSON.stringify(next));
  }, []);
  const persistNotifs = useCallback((next: NotificationItem[]) => {
    setNotifications(next); lsSet(STORAGE.NOTIFICATIONS, JSON.stringify(next));
  }, []);
  const persistReviews = useCallback((next: Review[]) => {
    setReviews(next); lsSet(STORAGE.REVIEWS, JSON.stringify(next));
  }, []);
  const persistProfile = useCallback((next: Profile) => {
    setProfile(next); lsSet(STORAGE.PROFILE, JSON.stringify(next)); toast.success('Profile saved.');
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const completed = orders.filter(o => o.status === 'COMPLETED');
    const active    = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    const totalSpend = completed.reduce((s, o) => s + o.total, 0);
    const unreadCount = notifications.filter(n => !n.read).length;
    return { total: orders.length, active: active.length, completed: completed.length, totalSpend, unreadCount };
  }, [orders, notifications]);

  const filteredOrders = useMemo(() => {
    if (ordersFilter === 'active')    return orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
    if (ordersFilter === 'completed') return orders.filter(o => o.status === 'COMPLETED');
    if (ordersFilter === 'cancelled') return orders.filter(o => o.status === 'CANCELLED');
    return orders;
  }, [orders, ordersFilter]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const cancelOrder = useCallback(() => {
    if (!cancelOrderId) return;
    persistOrders(orders.map(o => o.id === cancelOrderId ? { ...o, status: 'CANCELLED' as const } : o));
    setCancelOrderId(null);
    setExpandedOrderId(null);
    toast.error('Order cancelled.');
  }, [cancelOrderId, orders, persistOrders]);

  const submitReview = useCallback((orderId: string) => {
    const draft = ratingDrafts[orderId];
    if (!draft?.stars || draft.stars < 1) { toast.error('Select a star rating.'); return; }
    const existing = reviews.findIndex(r => r.orderId === orderId);
    const newReview: Review = { orderId, rating: Math.min(5, Math.max(1, draft.stars)), text: draft.text?.trim() || undefined, createdAt: Date.now() };
    const next = existing >= 0 ? reviews.map((r, i) => i === existing ? newReview : r) : [newReview, ...reviews];
    persistReviews(next);
    toast.success('Thanks for your review! ⭐');
  }, [ratingDrafts, reviews, persistReviews]);

  const makeDefault = useCallback((id: string) => {
    persistAddresses(addresses.map(a => ({ ...a, isDefault: a.id === id })));
    toast.success('Default address updated.');
  }, [addresses, persistAddresses]);

  const deleteAddress = useCallback((id: string) => {
    const next = addresses.filter(a => a.id !== id);
    if (next.length && !next.some(a => a.isDefault)) next[0].isDefault = true;
    persistAddresses(next);
    toast.success('Address deleted.');
  }, [addresses, persistAddresses]);

  const addAddress = useCallback(() => {
    setAddErr(null);
    const { houseFlat, area, city, pincode, landmark, label } = addForm;
    if (!houseFlat.trim() || !area.trim() || !city.trim() || !pincode.trim()) { setAddErr('House/Flat, Area, City and Pincode are required.'); return; }
    if (!/^\d{6}$/.test(pincode.trim())) { setAddErr('Pincode must be exactly 6 digits.'); return; }
    const now = Date.now();
    const newAddr: Address = {
      id: `addr_${now}`, houseFlat: houseFlat.trim(), area: area.trim(), city, pincode: pincode.trim(),
      landmark: landmark.trim() || undefined, label: label || 'Home',
      createdAt: now, isDefault: addresses.length === 0,
    };
    const next = [newAddr, ...addresses].map(a => ({ ...a, isDefault: addresses.length === 0 ? a.id === newAddr.id : a.isDefault }));
    persistAddresses(next);
    setAddForm({ label: 'Home', houseFlat: '', area: '', city: '', pincode: '', landmark: '' });
    toast.success('Address saved.');
  }, [addForm, addresses, persistAddresses]);

  const markAllRead = useCallback(() => {
    persistNotifs(notifications.map(n => ({ ...n, read: true })));
    toast.success('All notifications marked as read.');
  }, [notifications, persistNotifs]);

  const markOneRead = useCallback((id: number) => {
    persistNotifs(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  }, [notifications, persistNotifs]);

  const roleLabel = authRole === 'technician' ? 'Technician' : authRole === 'supplier' ? 'Supplier' : authRole === 'admin' ? 'Admin' : 'Customer';

  if (!hydrated) return (
    <div className="min-h-screen bg-[#f0faf6] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center animate-pulse">
          <span className="text-2xl">💧</span>
        </div>
        <p className="text-sm font-semibold text-teal-700">Loading dashboard…</p>
      </div>
    </div>
  );

  const NAV_TABS: { key: TabKey; label: string; icon: string; badge?: number }[] = [
    { key: 'overview',       label: 'Overview',       icon: '◈' },
    { key: 'orders',         label: 'My Orders',      icon: '📦', badge: stats.active > 0 ? stats.active : undefined },
    { key: 'notifications',  label: 'Notifications',  icon: '🔔', badge: stats.unreadCount > 0 ? stats.unreadCount : undefined },
    { key: 'addresses',      label: 'Addresses',      icon: '📍' },
    { key: 'profile',        label: 'Profile',        icon: '👤' },
  ];

  return (
    <>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
        .dash-root { font-family: 'DM Sans', sans-serif; }
        .dash-display { font-family: 'Sora', sans-serif; }
        .water-ripple {
          background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(13,155,108,0.12) 0%, transparent 70%);
        }
        .card-hover { transition: transform 0.18s ease, box-shadow 0.18s ease; }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(13,155,108,0.10); }
        .nav-pill.active { background: linear-gradient(135deg, #0D9B6C 0%, #0b8a60 100%); color: white; }
        .stat-card { background: white; border: 1px solid rgba(13,155,108,0.10); }
        .shimmer { background: linear-gradient(90deg, #f0faf6 25%, #e0f5ec 50%, #f0faf6 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .order-card { transition: all 0.2s ease; border: 1px solid #e8f8f2; }
        .order-card:hover { border-color: rgba(13,155,108,0.3); background: #fafffe; }
        .timeline-dot.done { background: #0D9B6C; border-color: #0D9B6C; }
        .timeline-dot.current { background: white; border-color: #0D9B6C; box-shadow: 0 0 0 3px rgba(13,155,108,0.2); }
        .timeline-line.done { background: #0D9B6C; }
        .glass-banner { background: linear-gradient(135deg, rgba(13,155,108,0.95) 0%, rgba(11,138,96,0.95) 50%, rgba(56,189,248,0.9) 100%); backdrop-filter: blur(12px); }
        .refer-card { background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px dashed rgba(13,155,108,0.35); }
        .notif-unread { border-left: 3px solid #0D9B6C; }
        .star-btn.active { background: #0D9B6C; color: white; border-color: #0D9B6C; }
        .breakdown-row { border-bottom: 1px dashed rgba(13,155,108,0.15); }
        .tag-chip { font-family: 'Sora', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
      `}</style>

      <div className="dash-root min-h-screen bg-[#f4fbf8]">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="flex gap-6 lg:gap-8">

            {/* ── Sidebar ── */}
            <aside className="hidden lg:flex flex-col w-60 shrink-0">
              <div className="sticky top-6">
                {/* User Card */}
                <div className="bg-white rounded-2xl border border-[#e0f5ec] shadow-sm overflow-hidden mb-3">
                  <div className="h-16 glass-banner" />
                  <div className="px-5 pb-5 -mt-8">
                    <div className="w-14 h-14 rounded-2xl border-2 border-white shadow-md bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-xl font-bold dash-display">
                      {getInitials(profile.name)}
                    </div>
                    <div className="mt-2">
                      <p className="font-bold text-[#0F1C18] text-sm dash-display truncate">{profile.name || 'Guest'}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{profile.email || 'No email set'}</p>
                      <span className="mt-2 inline-block tag-chip bg-[#e8f8f2] text-[#0D9B6C] px-2.5 py-1 rounded-full border border-[#0D9B6C]/20">
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nav */}
                <nav className="bg-white rounded-2xl border border-[#e0f5ec] shadow-sm p-2 space-y-0.5">
                  {NAV_TABS.map(it => (
                    <button key={it.key} type="button" onClick={() => setTab(it.key)}
                      className={`nav-pill w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === it.key ? 'active' : 'text-slate-600 hover:bg-[#f0faf6] hover:text-[#0D9B6C]'}`}>
                      <span className="text-base leading-none">{it.icon}</span>
                      <span className="flex-1 text-left">{it.label}</span>
                      {it.badge != null && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${tab === it.key ? 'bg-white/25 text-white' : 'bg-[#0D9B6C] text-white'}`}>
                          {it.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>

                <div className="mt-3 bg-white rounded-2xl border border-[#e0f5ec] p-3">
                  <Link href="/" className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#0D9B6C] transition-colors px-1">
                    <span>←</span> Back to AuroWater
                  </Link>
                </div>
              </div>
            </aside>

            {/* ── Main ── */}
            <main className="flex-1 min-w-0 space-y-5 pb-24 lg:pb-0">

              {/* Mobile nav */}
              <div className="lg:hidden overflow-x-auto pb-1">
                <div className="flex gap-2 w-max">
                  {NAV_TABS.map(it => (
                    <button key={it.key} type="button" onClick={() => setTab(it.key)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-xs font-bold whitespace-nowrap transition-all ${tab === it.key ? 'bg-[#0D9B6C] border-[#0D9B6C] text-white' : 'bg-white border-[#d0ece3] text-slate-600'}`}>
                      {it.icon} {it.label.replace('My ', '')}
                      {it.badge != null && <span className={`ml-0.5 text-[9px] font-black px-1 py-0.5 rounded-full ${tab === it.key ? 'bg-white/25' : 'bg-[#0D9B6C] text-white'}`}>{it.badge}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* ────── OVERVIEW ────── */}
              {tab === 'overview' && (
                <div className="space-y-5">
                  {/* Hero greeting */}
                  <div className="bg-white rounded-2xl border border-[#e0f5ec] shadow-sm overflow-hidden">
                    <div className="p-6 sm:p-7">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                        <div>
                          <p className="tag-chip text-[#0D9B6C] mb-1.5">{getGreeting()}</p>
                          <h1 className="dash-display text-2xl sm:text-3xl font-extrabold text-[#0F1C18] leading-tight">
                            Welcome back,<br className="sm:hidden" /> {profile.name?.split(' ')[0] || 'there'} 👋
                          </h1>
                          <p className="text-sm text-slate-500 mt-1.5">
                            {stats.active > 0 ? `You have ${stats.active} active booking${stats.active > 1 ? 's' : ''}.` : 'All clear — ready to book a service?'}
                          </p>
                        </div>
                        <button onClick={() => router.push('/book')}
                          className="self-start sm:self-auto flex items-center gap-2 bg-[#0D9B6C] text-white font-bold px-5 py-3 rounded-xl hover:bg-[#0b8a60] active:scale-95 transition-all text-sm shadow-sm shadow-emerald-200">
                          <span>+</span> Book a Service
                        </button>
                      </div>

                      {/* Stats */}
                      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Total Bookings', value: stats.total, icon: '📦', color: 'text-teal-600' },
                          { label: 'Active Orders', value: stats.active, icon: '⚡', color: 'text-amber-600' },
                          { label: 'Completed', value: stats.completed, icon: '✅', color: 'text-emerald-600' },
                          { label: 'Total Spent', value: stats.totalSpend, icon: '💰', color: 'text-indigo-600', isMoney: true },
                        ].map(s => (
                          <div key={s.label} className="stat-card rounded-xl p-4 text-center">
                            <span className="text-2xl block mb-1">{s.icon}</span>
                            <div className={`dash-display text-2xl font-extrabold ${s.color}`}>
                              {s.isMoney ? <AnimatedCounter target={s.value} prefix="₹" /> : <AnimatedCounter target={s.value} />}
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500 mt-1">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* CTA Banner */}
                  <div className="glass-banner rounded-2xl p-6 text-white overflow-hidden relative">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 0%, transparent 60%)' }} />
                    <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h2 className="dash-display text-xl font-bold">Need water or plumbing help?</h2>
                        <p className="text-white/80 text-sm mt-1">Verified technicians · Real-time tracking · Instant confirmation</p>
                      </div>
                      <button onClick={() => router.push('/book')}
                        className="self-start sm:self-auto bg-white text-[#0D9B6C] font-bold px-6 py-3 rounded-xl hover:bg-white/90 active:scale-95 transition-all text-sm whitespace-nowrap">
                        Book Now →
                      </button>
                    </div>
                  </div>

                  {/* Active order spotlight */}
                  {orders.find(o => o.status === 'IN_PROGRESS') && (() => {
                    const live = orders.find(o => o.status === 'IN_PROGRESS')!;
                    const meta = SERVICE_META[live.serviceKey];
                    const tech = MOCK_TECHNICIANS[live.serviceKey];
                    return (
                      <div className="bg-white rounded-2xl border-2 border-violet-200 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                          <span className="tag-chip text-violet-700">Live Now</span>
                        </div>
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-2xl shrink-0 shadow-sm`}>
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="dash-display font-bold text-[#0F1C18]">{meta.label}</p>
                            <p className="text-sm text-slate-500 mt-0.5 truncate">{live.address.area}, {live.address.city}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-semibold text-slate-500">Technician</p>
                            <p className="text-sm font-bold text-[#0F1C18]">{tech.name}</p>
                            <p className="text-xs text-emerald-600 font-semibold">★ {tech.rating}</p>
                          </div>
                        </div>
                        <button onClick={() => { setTab('orders'); setExpandedOrderId(live.id); }}
                          className="mt-4 w-full border border-violet-200 text-violet-700 font-bold py-2.5 rounded-xl hover:bg-violet-50 transition-colors text-sm">
                          Track Order
                        </button>
                      </div>
                    );
                  })()}

                  {/* Refer banner */}
                  <div className="refer-card rounded-2xl p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <p className="font-bold text-[#0F1C18] text-sm dash-display">🎁 Refer a friend, earn ₹50 credit</p>
                        <p className="text-xs text-slate-500 mt-1">Share your code and get rewarded when they book.</p>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="bg-white border border-[#c8eedd] rounded-xl px-4 py-2.5 flex items-center gap-3">
                            <span className="text-xs font-semibold text-slate-500">Your code</span>
                            <span className="dash-display font-extrabold text-[#0D9B6C] tracking-wider">{referralCode}</span>
                          </div>
                          <button onClick={async () => { try { await navigator.clipboard.writeText(referralCode); toast.success('Code copied!'); } catch { toast.error('Failed to copy.'); } }}
                            className="bg-[#0D9B6C] text-white font-bold px-4 py-2.5 rounded-xl hover:bg-[#0b8a60] active:scale-95 transition-all text-sm">
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0D9B6C]/10 text-3xl">
                        🎯
                      </div>
                    </div>
                  </div>

                  {/* Recent orders */}
                  <div className="bg-white rounded-2xl border border-[#e0f5ec] shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="dash-display font-bold text-[#0F1C18]">Recent Orders</h2>
                      <button onClick={() => setTab('orders')} className="text-xs font-bold text-[#0D9B6C] hover:underline">View all →</button>
                    </div>
                    {orders.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <p className="text-4xl mb-2">📦</p>
                        <p className="text-sm font-semibold">No orders yet — book your first service!</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orders.slice(0, 3).map(o => {
                          const meta = SERVICE_META[o.serviceKey];
                          return (
                            <div key={o.id} className="order-card rounded-xl p-3.5 cursor-pointer" onClick={() => { setTab('orders'); setExpandedOrderId(o.id); }}>
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-lg shrink-0`}>
                                  {meta.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm text-[#0F1C18] truncate">{meta.label}</p>
                                  <p className="text-[11px] text-slate-400 mt-0.5">{o.scheduledDate} · {o.timeKey}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <StatusPill status={o.status} />
                                  <p className="text-xs font-bold text-[#0D9B6C] mt-1.5">{formatMoney(o.total)}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ────── ORDERS ────── */}
              {tab === 'orders' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-[#e0f5ec] shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h1 className="dash-display text-xl font-extrabold text-[#0F1C18]">My Orders</h1>
                      <p className="text-sm text-slate-500 mt-0.5">{orders.length} total · {stats.active} active</p>
                    </div>
                    <button onClick={() => router.push('/book')}
                      className="self-start sm:self-auto bg-[#0D9B6C] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#0b8a60] active:scale-95 transition-all text-sm">
                      + New Booking
                    </button>
                  </div>

                  {/* Filters */}
                  <div className="flex gap-2 flex-wrap">
                    {(['all', 'active', 'completed', 'cancelled'] as const).map(f => (
                      <button key={f} type="button" onClick={() => setOrdersFilter(f)}
                        className={`px-4 py-2 rounded-full border text-xs font-bold capitalize transition-all ${ordersFilter === f ? 'bg-[#0D9B6C] border-[#0D9B6C] text-white' : 'bg-white border-[#d0ece3] text-slate-600 hover:border-[#0D9B6C]/40'}`}>
                        {f === 'all' ? `All (${orders.length})` : f === 'active' ? `Active (${stats.active})` : f === 'completed' ? `Completed (${stats.completed})` : `Cancelled (${orders.filter(o => o.status === 'CANCELLED').length})`}
                      </button>
                    ))}
                  </div>

                  {filteredOrders.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#e0f5ec] p-12 text-center">
                      <p className="text-5xl mb-3">📭</p>
                      <p className="font-bold text-[#0F1C18] dash-display">No orders here</p>
                      <p className="text-sm text-slate-500 mt-1">Book a service to see it here.</p>
                      <button onClick={() => router.push('/book')} className="mt-4 bg-[#0D9B6C] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#0b8a60] transition-all text-sm">
                        Book Now
                      </button>
                    </div>
                  ) : (
                    filteredOrders.map(o => {
                      const meta = SERVICE_META[o.serviceKey];
                      const isExpanded = expandedOrderId === o.id;
                      const tech = MOCK_TECHNICIANS[o.serviceKey];
                      const bd = derivePriceBreakdown(o);
                      const tlIdx = timelineIndex(o.status);
                      const existingReview = reviews.find(r => r.orderId === o.id);
                      return (
                        <div key={o.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${isExpanded ? 'border-2 border-[#0D9B6C]/30' : 'border border-[#e0f5ec] order-card'}`}>
                          <button type="button" onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                            className="w-full p-5 text-left hover:bg-[#fafffe]/80 transition-colors">
                            <div className="flex items-start gap-4">
                              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-xl shrink-0 shadow-sm`}>
                                {meta.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div>
                                    <p className="dash-display font-bold text-[#0F1C18]">{meta.label}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{o.id} · {o.scheduledDate} · {o.timeKey}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <StatusPill status={o.status} />
                                    <span className="dash-display text-sm font-extrabold text-[#0D9B6C]">{formatMoney(o.total)}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-1.5 truncate">📍 {o.address.houseFlat}, {o.address.area}, {o.address.city}</p>
                              </div>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-[#e8f8f2] p-5 space-y-5">
                              {/* Timeline */}
                              {o.status !== 'CANCELLED' && (
                                <div>
                                  <p className="tag-chip text-slate-500 mb-3">Order Progress</p>
                                  <div className="flex items-center">
                                    {TIMELINE_STEPS.map((step, i) => {
                                      const done = i <= tlIdx;
                                      const current = i === tlIdx;
                                      return (
                                        <React.Fragment key={step}>
                                          <div className="flex flex-col items-center">
                                            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all timeline-dot ${done ? 'done text-white' : current ? 'current text-[#0D9B6C]' : 'border-slate-200 text-slate-300'}`}>
                                              {done ? '✓' : i + 1}
                                            </div>
                                            <p className="text-[9px] font-semibold mt-1.5 text-center w-12 leading-tight text-slate-500">{step}</p>
                                          </div>
                                          {i < TIMELINE_STEPS.length - 1 && (
                                            <div className={`flex-1 h-0.5 mx-1 mb-4 transition-all timeline-line ${i < tlIdx ? 'done' : 'bg-slate-100'}`} />
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Technician */}
                                <div className="bg-[#f4fbf8] rounded-xl p-4 border border-[#d8f0e6]">
                                  <p className="tag-chip text-slate-500 mb-3">Assigned Technician</p>
                                  {o.status === 'PENDING' ? (
                                    <p className="text-sm text-slate-500 font-medium">Not assigned yet — we'll notify you soon.</p>
                                  ) : (
                                    <div className="flex items-center gap-3">
                                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-bold flex items-center justify-center text-sm dash-display shrink-0">
                                        {tech.initials}
                                      </div>
                                      <div>
                                        <p className="font-bold text-[#0F1C18] text-sm">{tech.name}</p>
                                        <p className="text-xs text-slate-500">{tech.city} · {tech.phone}</p>
                                        <div className="flex items-center gap-1 mt-1">
                                          {'★★★★★'.split('').map((s, i) => (
                                            <span key={i} className={`text-xs ${i < Math.floor(tech.rating) ? 'text-amber-400' : 'text-slate-200'}`}>{s}</span>
                                          ))}
                                          <span className="text-xs font-bold text-slate-600 ml-1">{tech.rating.toFixed(1)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Price breakdown */}
                                <div className="bg-white rounded-xl p-4 border border-[#e0f5ec]">
                                  <p className="tag-chip text-slate-500 mb-3">Price Breakdown</p>
                                  <div className="space-y-2">
                                    {[
                                      { label: 'Base price', val: `₹${bd.base}` },
                                      { label: 'Convenience fee', val: `₹${bd.conv}` },
                                      { label: 'GST (18%)', val: `₹${bd.gst}` },
                                      ...(bd.emg > 0 ? [{ label: 'Emergency surcharge', val: `₹${bd.emg}` }] : []),
                                    ].map(row => (
                                      <div key={row.label} className="breakdown-row flex justify-between items-center pb-2 text-sm">
                                        <span className="text-slate-500">{row.label}</span>
                                        <span className="font-semibold text-[#0F1C18]">{row.val}</span>
                                      </div>
                                    ))}
                                    <div className="flex justify-between items-center pt-1">
                                      <span className="font-bold text-[#0F1C18] text-sm">Total</span>
                                      <span className="dash-display font-extrabold text-[#0D9B6C]">{formatMoney(bd.total)}</span>
                                    </div>
                                  </div>
                                  <div className="mt-3 flex items-center gap-2">
                                    <span className={`tag-chip px-2 py-1 rounded-md ${o.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                      {o.paymentStatus === 'paid' ? '✓ Paid' : '○ Unpaid'}
                                    </span>
                                    <span className="tag-chip px-2 py-1 rounded-md bg-slate-50 text-slate-600 border border-slate-200 capitalize">{o.paymentMethod}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Rating */}
                              {o.status === 'COMPLETED' && (
                                <div className="bg-[#f4fbf8] rounded-xl p-4 border border-[#d8f0e6]">
                                  <div className="flex items-start justify-between gap-3 mb-3">
                                    <div>
                                      <p className="tag-chip text-slate-500">Rate This Service</p>
                                      <p className="text-xs text-slate-500 mt-1">Your feedback improves our quality.</p>
                                    </div>
                                    {existingReview && (
                                      <span className="tag-chip bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
                                        ⭐ Rated {existingReview.rating}/5
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-2 mb-3">
                                    {[1, 2, 3, 4, 5].map(star => {
                                      const active = (ratingDrafts[o.id]?.stars ?? existingReview?.rating ?? 0) >= star;
                                      return (
                                        <button key={star} type="button" disabled={!!existingReview}
                                          onClick={e => { e.stopPropagation(); setRatingDrafts(c => ({ ...c, [o.id]: { stars: star, text: c[o.id]?.text ?? '' } })); }}
                                          className={`star-btn w-10 h-10 rounded-xl border-2 text-lg font-bold transition-all disabled:cursor-not-allowed ${active ? 'active border-[#0D9B6C]' : 'bg-white border-slate-200 text-slate-300 hover:border-[#0D9B6C]/40'}`}>
                                          ★
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <textarea value={ratingDrafts[o.id]?.text ?? existingReview?.text ?? ''}
                                    disabled={!!existingReview}
                                    onChange={e => { e.stopPropagation(); setRatingDrafts(c => ({ ...c, [o.id]: { stars: c[o.id]?.stars ?? 0, text: e.target.value } })); }}
                                    rows={2} placeholder="Share your experience (optional)…"
                                    className="w-full bg-white border border-[#d0ece3] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9B6C]/40 resize-none disabled:opacity-60" />
                                  {!existingReview && (
                                    <button onClick={e => { e.stopPropagation(); submitReview(o.id); }}
                                      className="mt-3 bg-[#0D9B6C] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#0b8a60] active:scale-95 transition-all text-sm">
                                      Submit Review
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Link href={`/customer/track/${encodeURIComponent(o.id)}`} onClick={e => e.stopPropagation()}
                                  className="bg-[#0D9B6C] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#0b8a60] transition-all text-sm">
                                  View Details →
                                </Link>
                                {o.status === 'COMPLETED' && (
                                  <button onClick={e => { e.stopPropagation(); router.push(`/book?service=${o.serviceKey}`); }}
                                    className="border border-[#0D9B6C] text-[#0D9B6C] font-bold px-5 py-2.5 rounded-xl hover:bg-[#f0faf6] transition-all text-sm">
                                    Rebook
                                  </button>
                                )}
                                {o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && (
                                  <button onClick={e => { e.stopPropagation(); setCancelOrderId(o.id); }}
                                    className="border border-red-200 text-red-600 font-bold px-5 py-2.5 rounded-xl hover:bg-red-50 transition-all text-sm">
                                    Cancel Order
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ────── NOTIFICATIONS ────── */}
              {tab === 'notifications' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-[#e0f5ec] shadow-sm p-5 flex items-center justify-between">
                    <div>
                      <h1 className="dash-display text-xl font-extrabold text-[#0F1C18]">Notifications</h1>
                      <p className="text-sm text-slate-500 mt-0.5">{stats.unreadCount} unread</p>
                    </div>
                    {stats.unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs font-bold text-[#0D9B6C] hover:underline">Mark all read</button>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#e0f5ec] p-12 text-center">
                      <p className="text-5xl mb-3">🔕</p>
                      <p className="font-bold text-[#0F1C18] dash-display">All caught up!</p>
                      <p className="text-sm text-slate-500 mt-1">No notifications yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map(n => (
                        <button key={n.id} type="button" onClick={() => markOneRead(n.id)}
                          className={`w-full text-left bg-white rounded-2xl border p-4 transition-all hover:shadow-sm ${n.read ? 'border-[#e0f5ec]' : 'border-[#0D9B6C]/25 notif-unread'}`}>
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-[#f0faf6] border border-[#d0ece3] flex items-center justify-center text-xl shrink-0">{n.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm font-bold ${n.read ? 'text-slate-700' : 'text-[#0F1C18]'}`}>{n.title}</p>
                                {!n.read && <span className="w-2 h-2 rounded-full bg-[#0D9B6C] shrink-0 mt-1" />}
                              </div>
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.body}</p>
                              <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{n.time}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ────── ADDRESSES ────── */}
              {tab === 'addresses' && (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl border border-[#e0f5ec] shadow-sm p-5 flex items-start justify-between gap-4">
                    <div>
                      <h1 className="dash-display text-xl font-extrabold text-[#0F1C18]">Saved Addresses</h1>
                      <p className="text-sm text-slate-500 mt-0.5">{addresses.length} saved · synced with booking flow</p>
                    </div>
                    <Link href="/customer/addresses" className="text-xs font-bold text-[#0D9B6C] hover:underline whitespace-nowrap">Manage all →</Link>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Address list */}
                    <div className="space-y-3">
                      {addresses.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-[#e0f5ec] p-8 text-center">
                          <p className="text-4xl mb-2">🗺️</p>
                          <p className="font-bold text-[#0F1C18] dash-display">No addresses saved</p>
                          <p className="text-sm text-slate-500 mt-1">Add one using the form.</p>
                        </div>
                      ) : addresses.map(a => (
                        <div key={a.id} className="bg-white rounded-2xl border border-[#e0f5ec] p-4 card-hover">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-lg bg-[#f0faf6] border border-[#d0ece3] flex items-center justify-center text-base shrink-0">
                                {a.label === 'Home' ? '🏠' : a.label === 'Office' ? '🏢' : '📍'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="tag-chip bg-[#f0faf6] text-[#0D9B6C] border border-[#0D9B6C]/20 px-2 py-0.5 rounded-md">{a.label || 'Address'}</span>
                                  {a.isDefault && <span className="tag-chip bg-[#0D9B6C] text-white px-2 py-0.5 rounded-md">Default</span>}
                                </div>
                                <p className="text-sm font-semibold text-[#0F1C18] mt-2">{a.houseFlat}, {a.area}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{a.city} · {a.pincode}</p>
                                {a.landmark && <p className="text-xs text-slate-400 mt-0.5">Near {a.landmark}</p>}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0">
                              {!a.isDefault && (
                                <button onClick={() => makeDefault(a.id)}
                                  className="text-[11px] font-bold border border-[#0D9B6C] text-[#0D9B6C] px-2.5 py-1.5 rounded-lg hover:bg-[#f0faf6] transition-colors">
                                  Set Default
                                </button>
                              )}
                              <button onClick={() => deleteAddress(a.id)}
                                className="text-[11px] font-bold border border-red-200 text-red-500 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add form */}
                    <div className="bg-white rounded-2xl border border-[#e0f5ec] shadow-sm p-5">
                      <h2 className="dash-display font-bold text-[#0F1C18] mb-4">Add New Address</h2>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          {['Home', 'Office', 'Other'].map(l => (
                            <button key={l} type="button" onClick={() => setAddForm(f => ({ ...f, label: l }))}
                              className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${addForm.label === l ? 'bg-[#0D9B6C] border-[#0D9B6C] text-white' : 'bg-white border-[#d0ece3] text-slate-600'}`}>
                              {l === 'Home' ? '🏠' : l === 'Office' ? '🏢' : '📍'} {l}
                            </button>
                          ))}
                        </div>
                        {[
                          { key: 'houseFlat', placeholder: 'House / Flat No.*', type: 'text' },
                          { key: 'area', placeholder: 'Area / Street*', type: 'text' },
                          { key: 'landmark', placeholder: 'Landmark (optional)', type: 'text' },
                        ].map(({ key, placeholder, type }) => (
                          <input key={key} type={type} value={addForm[key as keyof typeof addForm]} placeholder={placeholder}
                            onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))}
                            className="w-full bg-[#f9fffe] border border-[#d0ece3] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9B6C]/40" />
                        ))}
                        <div className="grid grid-cols-2 gap-3">
                          <select value={addForm.city} onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))}
                            className="w-full bg-[#f9fffe] border border-[#d0ece3] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9B6C]/40">
                            <option value="">Select City*</option>
                            {UP_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input type="text" inputMode="numeric" value={addForm.pincode} placeholder="Pincode*" maxLength={6}
                            onChange={e => setAddForm(f => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                            className="w-full bg-[#f9fffe] border border-[#d0ece3] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9B6C]/40" />
                        </div>
                        {addErr && <p className="text-xs text-red-600 font-semibold">{addErr}</p>}
                        <button type="button" onClick={addAddress}
                          className="w-full bg-[#0D9B6C] text-white font-bold py-3 rounded-xl hover:bg-[#0b8a60] active:scale-95 transition-all text-sm">
                          Save Address
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ────── PROFILE ────── */}
              {tab === 'profile' && (
                <div className="space-y-5">
                  <div className="bg-white rounded-2xl border border-[#e0f5ec] shadow-sm overflow-hidden">
                    <div className="h-24 glass-banner relative">
                      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 0%, transparent 50%)' }} />
                    </div>
                    <div className="px-6 pb-6 -mt-10">
                      <div className="flex items-end justify-between gap-4">
                        <div className="w-16 h-16 rounded-2xl border-3 border-white shadow-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-2xl font-extrabold dash-display" style={{ border: '3px solid white' }}>
                          {getInitials(profile.name)}
                        </div>
                        <button onClick={() => { setProfileDraft(profile); setProfileEditing(!profileEditing); }}
                          className={`mb-1 text-xs font-bold px-4 py-2 rounded-xl border transition-all ${profileEditing ? 'bg-red-50 border-red-200 text-red-600' : 'bg-[#f0faf6] border-[#0D9B6C]/30 text-[#0D9B6C]'}`}>
                          {profileEditing ? 'Cancel' : '✎ Edit Profile'}
                        </button>
                      </div>
                      <div className="mt-3">
                        <h2 className="dash-display text-xl font-extrabold text-[#0F1C18]">{profile.name || 'Guest'}</h2>
                        <p className="text-sm text-slate-500 mt-0.5">{profile.email || 'No email set'}</p>
                        <span className="mt-2 inline-block tag-chip bg-[#e8f8f2] text-[#0D9B6C] border border-[#0D9B6C]/20 px-2.5 py-1 rounded-full">{roleLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#e0f5ec] shadow-sm p-5">
                    {!profileEditing ? (
                      <div>
                        <h3 className="tag-chip text-slate-500 mb-4">Contact Details</h3>
                        <div className="space-y-4">
                          {[
                            { label: 'Full Name', value: profile.name, icon: '👤' },
                            { label: 'Email', value: profile.email || 'Not set', icon: '✉️' },
                            { label: 'Phone', value: profile.phone || 'Not set', icon: '📱' },
                          ].map(row => (
                            <div key={row.label} className="flex items-center gap-4 p-3.5 bg-[#f9fffe] rounded-xl border border-[#e8f8f2]">
                              <span className="text-lg shrink-0">{row.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{row.label}</p>
                                <p className="text-sm font-semibold text-[#0F1C18] mt-0.5 truncate">{row.value}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="tag-chip text-slate-500 mb-4">Edit Your Details</h3>
                        <div className="space-y-3">
                          {[
                            { key: 'name', label: 'Full Name', placeholder: 'Your full name', type: 'text' },
                            { key: 'email', label: 'Email Address', placeholder: 'your@email.com', type: 'email' },
                            { key: 'phone', label: 'Phone Number', placeholder: '9876XXXXXX', type: 'tel' },
                          ].map(({ key, label, placeholder, type }) => (
                            <div key={key}>
                              <label className="text-xs font-bold text-slate-500 block mb-1.5">{label}</label>
                              <input type={type} value={profileDraft[key as keyof Profile]} placeholder={placeholder}
                                onChange={e => setProfileDraft(d => ({ ...d, [key]: e.target.value }))}
                                className="w-full bg-[#f9fffe] border border-[#d0ece3] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9B6C]/40" />
                            </div>
                          ))}
                          <button onClick={() => { persistProfile(profileDraft); setProfileEditing(false); }}
                            className="w-full bg-[#0D9B6C] text-white font-bold py-3 rounded-xl hover:bg-[#0b8a60] active:scale-95 transition-all text-sm mt-2">
                            Save Changes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order summary */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Orders', value: stats.total, icon: '📦' },
                      { label: 'Completed', value: stats.completed, icon: '✅' },
                      { label: 'Total Spent', value: formatMoney(stats.totalSpend), icon: '💳' },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-2xl border border-[#e0f5ec] p-4 text-center">
                        <p className="text-2xl mb-1">{s.icon}</p>
                        <p className="dash-display text-lg font-extrabold text-[#0D9B6C]">{typeof s.value === 'number' ? <AnimatedCounter target={s.value} /> : s.value}</p>
                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>

        {/* ── Mobile bottom nav ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e0f5ec] shadow-xl">
          <div className="flex items-stretch">
            {NAV_TABS.map(it => (
              <button key={it.key} onClick={() => setTab(it.key)}
                className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors relative ${tab === it.key ? 'text-[#0D9B6C]' : 'text-slate-400'}`}>
                {tab === it.key && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#0D9B6C] rounded-full" />}
                <span className="text-base leading-none">{it.icon}</span>
                <span className="text-[9px] font-bold uppercase tracking-wide">{it.label.replace('My ', '')}</span>
                {it.badge != null && <span className="absolute top-1.5 right-1/4 bg-[#0D9B6C] text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">{it.badge}</span>}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Cancel modal ── */}
        {cancelOrderId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="w-full max-w-md bg-white rounded-2xl border border-[#e0f5ec] shadow-2xl p-6">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-2xl mx-auto mb-4">❌</div>
              <h2 className="dash-display text-lg font-extrabold text-[#0F1C18] text-center">Cancel this booking?</h2>
              <p className="text-sm text-slate-500 mt-2 text-center">This action cannot be undone. Your order will be marked as cancelled.</p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setCancelOrderId(null)}
                  className="flex-1 border border-[#d0ece3] bg-white text-slate-700 font-bold py-3 rounded-xl hover:bg-[#f9fffe] transition-all text-sm">
                  Keep Order
                </button>
                <button onClick={cancelOrder}
                  className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 active:scale-95 transition-all text-sm">
                  Yes, Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}


















// 'use client';

// import React, { useEffect, useMemo, useState } from 'react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';
// import { toast } from 'sonner';
// import { useAuth } from '@/hooks/useAuth';

// type Address = {
//   id: string;
//   houseFlat: string;
//   area: string;
//   city: string;
//   pincode: string;
//   landmark?: string;
//   label?: string;
//   createdAt: number;
//   isDefault?: boolean;
// };

// type ServiceKey =
//   | 'water_tanker'
//   | 'ro_service'
//   | 'plumbing'
//   | 'borewell'
//   | 'motor_pump'
//   | 'tank_cleaning';

// type StoredOrder = {
//   id: string;
//   status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
//   createdAt: number;
//   serviceKey: ServiceKey;
//   subOptionKey: string;
//   address: Address;
//   scheduledDate: string;
//   timeKey: string;
//   emergency: boolean;
//   total: number;
//   paymentMethod: 'cash' | 'online';
//   paymentStatus: 'unpaid' | 'paid';
// };

// type NotificationItem = {
//   id: number;
//   icon: string;
//   title: string;
//   body: string;
//   time: string;
//   read: boolean;
// };

// type Profile = {
//   name: string;
//   email: string;
//   phone: string;
//   avatarSeed?: string;
// };

// type Review = {
//   orderId: string;
//   rating: number; // 1..5
//   text?: string;
//   createdAt: number;
// };

// const STORAGE_ORDERS_KEY = 'aurowater_orders';
// const STORAGE_ADDRESSES_KEY = 'aurowater_addresses';
// const STORAGE_NOTIFICATIONS_KEY = 'aurowater_notifications';
// const STORAGE_PROFILE_KEY = 'aurowater_profile';
// const STORAGE_REVIEWS_KEY = 'aurowater_reviews';
// const STORAGE_REFERRAL_KEY = 'aurowater_referral_code';
// const UP_CITIES = [
//   'Delhi',
//   'Noida',
//   'Ghaziabad',
//   'Kanpur',
//   'Gorakhpur',
//   'Lucknow',
//   'Varanasi',
//   'Prayagraj',
//   'Agra',
//   'Meerut',
//   'Bareilly',
//   'Aligarh',
//   'Mathura',
// ] as const;

// function safeParse<T>(raw: string | null): T | null {
//   if (!raw) return null;
//   try {
//     return JSON.parse(raw) as T;
//   } catch {
//     return null;
//   }
// }

// function makeOrderId() {
//   const n = Math.floor(10000000 + Math.random() * 90000000);
//   return `AW-${n}`;
// }

// function formatMoney(n: number) {
//   const val = Number.isFinite(n) ? n : 0;
//   return `₹${Math.round(val).toLocaleString('en-IN')}`;
// }

// function badgeFromStatus(status: StoredOrder['status']) {
//   const s = status.toUpperCase();
//   if (s === 'COMPLETED') return { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
//   if (s === 'CANCELLED') return { label: 'Cancelled', className: 'bg-rose-100 text-rose-800 border-rose-200' };
//   return { label: 'In Progress', className: 'bg-amber-100 text-amber-800 border-amber-200' };
// }

// function greeting() {
//   const h = new Date().getHours();
//   if (h < 12) return 'Good morning';
//   if (h < 17) return 'Good afternoon';
//   return 'Good evening';
// }

// function countDefault(order: Address[]) {
//   return order.filter((a) => a.isDefault).length ? order.find((a) => a.isDefault) : null;
// }

// function getMockTechnicianForOrder(o: StoredOrder) {
//   const map: Record<string, { name: string; initials: string; city: string; rating: number }> = {
//     water_tanker: { name: 'Rahul Verma', initials: 'RV', city: 'Kanpur', rating: 4.9 },
//     ro_service: { name: 'Mohit Gupta', initials: 'MG', city: 'Delhi', rating: 4.8 },
//     plumbing: { name: 'Sunita Agarwal', initials: 'SA', city: 'Lucknow', rating: 4.9 },
//     borewell: { name: 'Vikram Tiwari', initials: 'VT', city: 'Varanasi', rating: 4.9 },
//     motor_pump: { name: 'Kavya Singh', initials: 'KS', city: 'Agra', rating: 4.7 },
//     tank_cleaning: { name: 'Priya Sharma', initials: 'PS', city: 'Noida', rating: 5 },
//   };
//   return map[o.serviceKey] || map.water_tanker;
// }

// function timelineIndexFromStatus(status: StoredOrder['status']): number {
//   // Steps: Placed -> Confirmed -> Assigned -> In Progress -> Completed
//   if (status === 'COMPLETED') return 4;
//   if (status === 'IN_PROGRESS') return 3;
//   if (status === 'ASSIGNED') return 2;
//   if (status === 'PENDING') return 0;
//   return 0;
// }

// function derivePriceBreakdown(order: StoredOrder) {
//   const convenienceFee = 29;
//   const emergencyExtra = order.emergency ? 199 : 0;
//   const total = Math.round(order.total);

//   // total = base + convenience + emergencyExtra + gst
//   // gst = round((base + convenience) * 0.18)
//   for (let base = 0; base <= 50000; base += 1) {
//     const gst = Math.round((base + convenienceFee) * 0.18);
//     if (base + convenienceFee + emergencyExtra + gst === total) {
//       return { base, convenienceFee, emergencyExtra, gst, total };
//     }
//   }

//   // Fallback keeps the UI stable.
//   const taxable = Math.max(0, total - convenienceFee - emergencyExtra);
//   const gst = Math.round(taxable * 0.18);
//   const base = Math.max(0, total - convenienceFee - emergencyExtra - gst);
//   return { base, convenienceFee, emergencyExtra, gst, total };
// }

// function Row({ label, value }: { label: string; value: string }) {
//   return (
//     <div className="flex items-center justify-between">
//       <div className="text-slate-600">{label}</div>
//       <div className="font-extrabold text-[#0F1C18]">{value}</div>
//     </div>
//   );
// }

// function randomReferralCode() {
//   const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
//   let out = '';
//   for (let i = 0; i < 6; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
//   return `AW-${out}`;
// }

// function AnimatedNumber({ target, durationMs = 1500 }: { target: number; durationMs?: number }) {
//   const [display, setDisplay] = useState(0);

//   useEffect(() => {
//     const start = performance.now();
//     const from = 0;

//     function tick(now: number) {
//       const t = Math.min(1, (now - start) / durationMs);
//       const next = Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3)));
//       setDisplay(next);
//       if (t < 1) requestAnimationFrame(tick);
//     }

//     setDisplay(0);
//     requestAnimationFrame(tick);
//   }, [target, durationMs]);

//   return <>{display}</>;
// }

// export default function DashboardPage() {
//   const router = useRouter();
//   const [tab, setTab] = useState<'overview' | 'orders' | 'notifications' | 'addresses' | 'profile'>('overview');

//   const [orders, setOrders] = useState<StoredOrder[]>([]);
//   const [addresses, setAddresses] = useState<Address[]>([]);
//   const [notifications, setNotifications] = useState<NotificationItem[]>([]);
//   const [profile, setProfile] = useState<Profile>({ name: 'Guest', email: '', phone: '' });
//   const { role: authRole } = useAuth();
//   const roleLabel =
//     authRole === 'technician' ? 'Technician'
//       : authRole === 'supplier' ? 'Supplier'
//         : authRole === 'admin' ? 'Admin'
//           : 'Customer';

//   const initials = profile?.name?.trim()
//     ? profile.name
//         .trim()
//         .split(/\s+/)
//         .slice(0, 2)
//         .map((p) => p[0])
//         .join('')
//         .toUpperCase()
//     : 'A';

//   const [reviews, setReviews] = useState<Review[]>([]);
//   const [referralCode, setReferralCode] = useState<string>('');
//   const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
//   const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
//   const [ratingDrafts, setRatingDrafts] = useState<Record<string, { stars: number; text: string }>>({});

//   // Address add form (reused for dashboard sync)
//   const [addForm, setAddForm] = useState({
//     label: 'Saved address',
//     houseFlat: '',
//     area: '',
//     city: '',
//     pincode: '',
//     landmark: '',
//   });
//   const [addErr, setAddErr] = useState<string | null>(null);

//   const [ordersFilter, setOrdersFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

//   const seed = () => {
//     const now = Date.now();
//     const a1: Address = {
//       id: 'addr_1',
//       houseFlat: 'Flat 402',
//       area: 'Bara 8 Cross, Near City Mall',
//       city: 'Kanpur',
//       pincode: '208027',
//       landmark: 'City Mall Road',
//       createdAt: now - 1000 * 60 * 60 * 24 * 8,
//       isDefault: true,
//       label: 'Home',
//     };
//     const a2: Address = {
//       id: 'addr_2',
//       houseFlat: 'House No. 19',
//       area: 'Sector 62',
//       city: 'Noida',
//       pincode: '208001',
//       createdAt: now - 1000 * 60 * 60 * 24 * 4,
//       isDefault: false,
//       label: 'Office',
//     };

//     const mockOrders: StoredOrder[] = [
//       {
//         id: 'AW-00000001',
//         status: 'COMPLETED',
//         createdAt: now - 1000 * 60 * 60 * 24 * 10,
//         serviceKey: 'water_tanker',
//         subOptionKey: 'standard',
//         address: a1,
//         scheduledDate: '2026-03-20',
//         timeKey: 'Morning',
//         emergency: false,
//         total: 449,
//         paymentMethod: 'cash',
//         paymentStatus: 'paid',
//       },
//       {
//         id: 'AW-00000002',
//         status: 'PENDING',
//         createdAt: now - 1000 * 60 * 60 * 24 * 6,
//         serviceKey: 'ro_service',
//         subOptionKey: 'filter',
//         address: a1,
//         scheduledDate: '2026-03-24',
//         timeKey: 'Afternoon',
//         emergency: false,
//         total: 279,
//         paymentMethod: 'cash',
//         paymentStatus: 'unpaid',
//       },
//       {
//         id: 'AW-00000003',
//         status: 'CANCELLED',
//         createdAt: now - 1000 * 60 * 60 * 24 * 15,
//         serviceKey: 'plumbing',
//         subOptionKey: 'leak',
//         address: a1,
//         scheduledDate: '2026-03-15',
//         timeKey: 'Morning',
//         emergency: false,
//         total: 199,
//         paymentMethod: 'cash',
//         paymentStatus: 'unpaid',
//       },
//     ];

//     const mockNotifications: NotificationItem[] = [
//       { id: 1, icon: '✅', title: 'Order Confirmed', body: 'Your RO service is confirmed for Mar 24, Afternoon', time: '2 hours ago', read: false },
//       { id: 2, icon: '🔔', title: 'Technician Assigned', body: 'Rahul Verma will service your RO. Contact: 9XXXXXXXXX', time: '1 hour ago', read: false },
//       { id: 3, icon: '⭐', title: 'Rate your experience', body: 'How was your water tanker delivery on Mar 20?', time: '3 days ago', read: true },
//     ];

//     setOrders(mockOrders);
//     setAddresses([a1, a2]);
//     setNotifications(mockNotifications);

//     try {
//       localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(mockOrders));
//       localStorage.setItem(STORAGE_ADDRESSES_KEY, JSON.stringify([a1, a2]));
//       localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(mockNotifications));
//     } catch {
//       // ignore write issues
//     }
//   };

//   useEffect(() => {
//     const sp = new URLSearchParams(window.location.search);
//     const raw = (sp.get('tab') || '').toLowerCase();
//     if (raw === 'orders' || raw === 'notifications' || raw === 'addresses' || raw === 'profile' || raw === 'overview') {
//       setTab(raw as typeof tab);
//     }
//   }, []);

//   useEffect(() => {
//     const savedOrders = safeParse<StoredOrder[]>(localStorage.getItem(STORAGE_ORDERS_KEY));
//     const savedAddresses = safeParse<Address[]>(localStorage.getItem(STORAGE_ADDRESSES_KEY));
//     const savedNotifs = safeParse<NotificationItem[]>(localStorage.getItem(STORAGE_NOTIFICATIONS_KEY));
//     const savedProfile = safeParse<Profile>(localStorage.getItem(STORAGE_PROFILE_KEY));
//     const savedReviews = safeParse<Review[]>(localStorage.getItem(STORAGE_REVIEWS_KEY));
//     const existingReferral = localStorage.getItem(STORAGE_REFERRAL_KEY);

//     const validOrders = Array.isArray(savedOrders) ? savedOrders : [];
//     const validAddresses = Array.isArray(savedAddresses) ? savedAddresses : [];
//     const validNotifs = Array.isArray(savedNotifs) ? savedNotifs : [];
//     const validReviews = Array.isArray(savedReviews) ? savedReviews : [];

//     if (validOrders.length === 0 && validAddresses.length === 0 && validNotifs.length === 0) {
//       seed();
//       return;
//     }

//     setOrders(validOrders);
//     setAddresses(validAddresses);
//     setNotifications(validNotifs);
//     setReviews(validReviews);
//     if (savedProfile?.name) setProfile(savedProfile);

//     if (existingReferral && existingReferral.trim().length) {
//       setReferralCode(existingReferral);
//     } else {
//       const next = randomReferralCode();
//       setReferralCode(next);
//       try {
//         localStorage.setItem(STORAGE_REFERRAL_KEY, next);
//       } catch {
//         // ignore
//       }
//     }
//   }, []);

//   const activeOrdersCount = useMemo(() => {
//     return orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length;
//   }, [orders]);

//   const completedCount = useMemo(() => orders.filter((o) => o.status === 'COMPLETED').length, [orders]);

//   const filteredOrders = useMemo(() => {
//     if (ordersFilter === 'all') return orders;
//     if (ordersFilter === 'active') return orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
//     if (ordersFilter === 'completed') return orders.filter((o) => o.status === 'COMPLETED');
//     return orders.filter((o) => o.status === 'CANCELLED');
//   }, [orders, ordersFilter]);

//   const recent = useMemo(() => orders.slice(0, 3), [orders]);

//   const makeDefault = (id: string) => {
//     const next = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
//     setAddresses(next);
//     try {
//       localStorage.setItem(STORAGE_ADDRESSES_KEY, JSON.stringify(next));
//     } catch {
//       // ignore
//     }
//     toast.success('Default address updated.');
//   };

//   const deleteAddress = (id: string) => {
//     const next = addresses.filter((a) => a.id !== id);
//     if (next.length && !next.some((a) => a.isDefault)) {
//       next[0].isDefault = true;
//     }
//     setAddresses(next);
//     try {
//       localStorage.setItem(STORAGE_ADDRESSES_KEY, JSON.stringify(next));
//     } catch {
//       // ignore
//     }
//     toast.success('Address deleted.');
//   };

//   const onAddAddress = () => {
//     setAddErr(null);
//     const houseFlat = addForm.houseFlat.trim();
//     const area = addForm.area.trim();
//     const city = addForm.city.trim();
//     const pincode = addForm.pincode.trim();
//     const landmark = addForm.landmark.trim();

//     const pinOk = /^[0-9]{6}$/.test(pincode);
//     if (!houseFlat || !area || !city || !pincode) {
//       setAddErr('House/Flat, Area, City and Pincode are required.');
//       return;
//     }
//     if (!pinOk) {
//       setAddErr('Pincode must be 6 digits.');
//       return;
//     }

//     const now = Date.now();
//     const newAddr: Address = {
//       id: `addr_${now}_${Math.random().toString(16).slice(2)}`,
//       houseFlat,
//       area,
//       city,
//       pincode,
//       landmark: landmark ? landmark : undefined,
//       label: addForm.label || 'Saved address',
//       createdAt: now,
//       isDefault: addresses.length === 0 || !addresses.some((a) => a.isDefault),
//     };

//     const next = [newAddr, ...addresses].map((a) => ({ ...a }));
//     if (newAddr.isDefault) next.forEach((a) => (a.isDefault = a.id === newAddr.id));

//     setAddresses(next);
//     try {
//       localStorage.setItem(STORAGE_ADDRESSES_KEY, JSON.stringify(next));
//     } catch {
//       // ignore
//     }
//     setAddForm({ label: 'Saved address', houseFlat: '', area: '', city: '', pincode: '', landmark: '' });
//     toast.success('Address saved.');
//   };

//   const toggleAllRead = () => {
//     const next = notifications.map((n) => ({ ...n, read: true }));
//     setNotifications(next);
//     try {
//       localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(next));
//     } catch {
//       // ignore
//     }
//     toast.success('All notifications marked as read.');
//   };

//   const markOneRead = (id: number) => {
//     const next = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
//     setNotifications(next);
//     try {
//       localStorage.setItem(STORAGE_NOTIFICATIONS_KEY, JSON.stringify(next));
//     } catch {
//       // ignore
//     }
//   };

//   const saveProfile = (next: Profile) => {
//     setProfile(next);
//     try {
//       localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(next));
//     } catch {
//       // ignore
//     }
//     toast.success('Profile saved.');
//   };

//   const persistOrders = (next: StoredOrder[]) => {
//     setOrders(next);
//     try {
//       localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(next));
//     } catch {
//       // ignore
//     }
//   };

//   const persistReviews = (next: Review[]) => {
//     setReviews(next);
//     try {
//       localStorage.setItem(STORAGE_REVIEWS_KEY, JSON.stringify(next));
//     } catch {
//       // ignore
//     }
//   };

//   const confirmCancelOrder = () => {
//     if (!cancelOrderId) return;
//     const next = orders.map((o) => (o.id === cancelOrderId ? { ...o, status: 'CANCELLED' as const } : o));
//     persistOrders(next);
//     setCancelOrderId(null);
//     setExpandedOrderId(null);
//     toast.error('Order cancelled');
//   };

//   const submitReview = (orderId: string) => {
//     const draft = ratingDrafts[orderId] || { stars: 0, text: '' };
//     const stars = Number(draft.stars);
//     if (!stars || stars < 1) {
//       toast.error('Please select a star rating.');
//       return;
//     }
//     const nextReviews = (() => {
//       const idx = reviews.findIndex((r) => r.orderId === orderId);
//       const nextReview: Review = {
//         orderId,
//         rating: Math.min(5, Math.max(1, Math.round(stars))),
//         text: draft.text?.trim() ? draft.text.trim() : undefined,
//         createdAt: Date.now(),
//       };
//       if (idx === -1) return [nextReview, ...reviews];
//       const copy = [...reviews];
//       copy[idx] = nextReview;
//       return copy;
//     })();
//     persistReviews(nextReviews);
//     toast.success('Thanks for your review!');
//   };

//   const navItems = [
//     { key: 'overview', label: 'Overview' },
//     { key: 'orders', label: 'My Orders' },
//     { key: 'notifications', label: 'Notifications' },
//     { key: 'addresses', label: 'Addresses' },
//     { key: 'profile', label: 'Profile' },
//   ] as const;

//   return (
//     <div className="min-h-screen bg-slate-50">
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
//           {/* Desktop sidebar */}
//           <aside className="hidden lg:block lg:col-span-3">
//             <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-5 sticky top-24">
//               <div className="flex items-center gap-3">
//                 <div
//                   className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0D9B6C] to-[#38BDF8] flex items-center justify-center text-white font-extrabold"
//                 >
//                   {initials}
//                 </div>
//                 <div className="min-w-0">
//                   <div className="font-extrabold text-[#0F1C18] truncate">{profile.name || 'Guest'}</div>
//                   <div className="mt-1 inline-flex items-center gap-2">
//                     <span className="text-xs font-extrabold text-[#0D9B6C] bg-[#E8F8F2] border border-[#0D9B6C]/30 px-3 py-1 rounded-full">
//                       {roleLabel}
//                     </span>
//                   </div>
//                 </div>
//               </div>

//               <div className="mt-5 space-y-2">
//                 {navItems.map((it) => {
//                   const active = tab === it.key;
//                   return (
//                     <button
//                       key={it.key}
//                       type="button"
//                       onClick={() => setTab(it.key)}
//                       className={[
//                         'w-full rounded-xl px-4 py-3 text-left border transition-all',
//                         active
//                           ? 'bg-[#E8F8F2] text-[#0D9B6C] border-[#0D9B6C] border-l-4 pl-3'
//                           : 'bg-white text-slate-700 border-slate-100 hover:bg-slate-50',
//                       ].join(' ')}
//                     >
//                       {it.label}
//                     </button>
//                   );
//                 })}
//               </div>

//               <div className="mt-6 pt-5 border-t border-slate-100">
//                 <Link href="/" className="text-sm font-semibold text-[#0D9B6C] hover:underline">
//                   ⬅ Back to site
//                 </Link>
//               </div>
//             </div>
//           </aside>

//           {/* Content */}
//           <main className="lg:col-span-9">
//             {/* Mobile tab header */}
//             <div className="lg:hidden mb-4">
//               <div className="flex gap-2 flex-wrap">
//                 {navItems.map((it) => {
//                   const active = tab === it.key;
//                   return (
//                     <button
//                       key={it.key}
//                       type="button"
//                       onClick={() => setTab(it.key)}
//                       className={[
//                         'px-4 py-2 rounded-full border text-sm font-extrabold transition-all',
//                         active ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
//                       ].join(' ')}
//                     >
//                       {it.label.replace('My ', '')}
//                     </button>
//                   );
//                 })}
//               </div>
//             </div>

//             {tab === 'overview' && (
//               <div>
//                 <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 sm:p-8">
//                   <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
//                     <div>
//                       <div className="text-sm font-semibold text-slate-600">{greeting()}</div>
//                       <div className="text-2xl sm:text-3xl font-extrabold text-[#0F1C18] mt-1">
//                         👋 {profile.name || 'Guest'}
//                       </div>
//                     </div>
//                     <button
//                       type="button"
//                       onClick={() => router.push('/book')}
//                       className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-[#0D9B6C] text-white font-extrabold hover:bg-[#086D4C] active:scale-95 transition-all"
//                     >
//                       Book a New Service
//                     </button>
//                   </div>

//                   <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
//                     {[
//                       { label: 'Total Bookings', value: orders.length, icon: '📦' },
//                       { label: 'Active Orders', value: activeOrdersCount, icon: '⚡' },
//                       { label: 'Completed', value: completedCount, icon: '✅' },
//                       { label: 'Saved Addresses', value: addresses.length, icon: '📍' },
//                     ].map((s) => (
//                       <div key={s.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
//                         <div className="text-lg">{s.icon}</div>
//                         <div className="text-3xl font-extrabold text-[#0D9B6C] mt-1">
//                           <AnimatedNumber target={s.value} />
//                         </div>
//                         <div className="text-xs font-semibold text-slate-600 mt-1">{s.label}</div>
//                       </div>
//                     ))}
//                   </div>

//                   <div className="mt-6 rounded-2xl bg-gradient-to-r from-[#0D9B6C] to-[#38BDF8] text-white p-6 overflow-hidden relative">
//                     <div className="hero-water-bg opacity-50" />
//                     <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//                       <div>
//                         <div className="text-lg font-extrabold">Need water or plumbing help?</div>
//                         <div className="text-white/90 text-sm mt-1">Book in seconds. Track your timeline.</div>
//                       </div>
//                       <button
//                         type="button"
//                         onClick={() => router.push('/book')}
//                         className="rounded-xl bg-white text-[#0D9B6C] font-extrabold px-5 py-3 hover:bg-white/90 active:scale-95 transition-all"
//                       >
//                         Book Now →
//                       </button>
//                     </div>
//                   </div>

//                   <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6">
//                     <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//                       <div>
//                         <div className="text-sm font-semibold text-emerald-800">🎁 Refer a friend and earn ₹50 credit</div>
//                         <div className="mt-2 inline-flex items-center gap-3 rounded-xl bg-white border border-emerald-200 px-4 py-3">
//                           <span className="text-xs font-extrabold text-slate-600">Your code</span>
//                           <span className="text-[#0D9B6C] font-extrabold tracking-wider">{referralCode || '—'}</span>
//                         </div>
//                       </div>
//                       <button
//                         type="button"
//                         onClick={async () => {
//                           try {
//                             await navigator.clipboard.writeText(referralCode);
//                             toast.success('Code copied!');
//                           } catch {
//                             toast.error('Could not copy code.');
//                           }
//                         }}
//                         className="rounded-xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
//                       >
//                         Copy Code
//                       </button>
//                     </div>
//                   </div>

//                   <div className="mt-8">
//                     <div className="flex items-center justify-between">
//                       <div className="font-extrabold text-[#0F1C18]">Recent Orders</div>
//                       <button type="button" className="text-sm font-extrabold text-[#0D9B6C] hover:underline" onClick={() => setTab('orders')}>
//                         View All
//                       </button>
//                     </div>
//                     <div className="mt-4 space-y-3">
//                       {recent.length === 0 ? (
//                         <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-slate-600">
//                           No orders yet. Book your first service to get started.
//                         </div>
//                       ) : (
//                         recent.map((o) => {
//                           const badge = badgeFromStatus(o.status);
//                           return (
//                             <div key={o.id} className="rounded-2xl border border-slate-100 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//                               <div className="flex-1">
//                                 <div className="font-extrabold text-slate-900">
//                                   {o.serviceKey.replace('_', ' ')}
//                                 </div>
//                                 <div className="text-sm text-slate-600 mt-1">
//                                   {o.scheduledDate} • {o.timeKey}
//                                 </div>
//                                 <div className="text-sm text-slate-600 mt-1">
//                                   {o.address.city} • {o.address.pincode}
//                                 </div>
//                               </div>
//                               <div className="flex items-center gap-3">
//                                 <div className={`inline-flex items-center px-3 py-1 rounded-full border ${badge.className} text-xs font-extrabold`}>
//                                   {badge.label}
//                                 </div>
//                                 <div className="font-extrabold text-[#0D9B6C]">{formatMoney(o.total)}</div>
//                               </div>
//                               <div className="flex gap-2">
//                                 <Link href={`/customer/track/${encodeURIComponent(o.id)}`} className="rounded-xl border border-slate-200 px-4 py-2 font-extrabold text-slate-700 hover:bg-slate-50 transition">
//                                   View Details
//                                 </Link>
//                               </div>
//                             </div>
//                           );
//                         })
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {tab === 'orders' && (
//               <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 sm:p-8">
//                 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//                   <div>
//                     <div className="text-2xl font-extrabold text-[#0F1C18]">My Orders</div>
//                     <div className="text-slate-600 mt-1 text-sm">Filter and view booking details.</div>
//                   </div>
//                   <button type="button" onClick={() => router.push('/book')} className="rounded-xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all">
//                     Book Now
//                   </button>
//                 </div>

//                 <div className="mt-6 flex flex-wrap gap-2">
//                   {([
//                     { key: 'all', label: 'All' },
//                     { key: 'active', label: 'Active' },
//                     { key: 'completed', label: 'Completed' },
//                     { key: 'cancelled', label: 'Cancelled' },
//                   ] as const).map((f) => {
//                     const active = ordersFilter === f.key;
//                     return (
//                       <button
//                         key={f.key}
//                         type="button"
//                         onClick={() => setOrdersFilter(f.key)}
//                         className={[
//                           'px-4 py-2 rounded-full border text-sm font-extrabold transition-all',
//                           active ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
//                         ].join(' ')}
//                       >
//                         {f.label}
//                       </button>
//                     );
//                   })}
//                 </div>

//                 <div className="mt-5 space-y-3">
//                   {filteredOrders.length === 0 ? (
//                     <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-slate-600">
//                       <div className="text-4xl">📦</div>
//                       <div className="font-extrabold mt-2 text-slate-900">No orders yet</div>
//                       <div className="text-sm mt-1">Book your first service to get started.</div>
//                     </div>
//                   ) : (
//                     filteredOrders.map((o) => {
//                       const badge = badgeFromStatus(o.status);
//                       const isExpanded = expandedOrderId === o.id;
//                       const technician = getMockTechnicianForOrder(o);
//                       const breakdown = derivePriceBreakdown(o);
//                       const timelineIdx = timelineIndexFromStatus(o.status);
//                       const existingReview = reviews.find((r) => r.orderId === o.id);
//                       return (
//                         <div
//                           key={o.id}
//                           className={[
//                             'rounded-2xl border border-slate-100 bg-white p-4 transition-all',
//                             isExpanded ? 'shadow-card' : '',
//                           ].join(' ')}
//                           role="button"
//                           tabIndex={0}
//                           onClick={() => setExpandedOrderId((cur) => (cur === o.id ? null : o.id))}
//                           onKeyDown={(e) => {
//                             if (e.key === 'Enter' || e.key === ' ') setExpandedOrderId((cur) => (cur === o.id ? null : o.id));
//                           }}
//                         >
//                           <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
//                             <div className="flex-1">
//                               <div className="flex items-center gap-2">
//                                 <div className="text-2xl">🧰</div>
//                                 <div className="font-extrabold text-slate-900">
//                                   {o.serviceKey.replace('_', ' ')}
//                                 </div>
//                                 <div className={`ml-auto md:ml-0 inline-flex items-center px-3 py-1 rounded-full border ${badge.className} text-xs font-extrabold`}>
//                                   {badge.label}
//                                 </div>
//                               </div>
//                               <div className="text-sm text-slate-600 mt-2">
//                                 Order ID: <span className="font-extrabold">{o.id}</span>
//                               </div>
//                               <div className="text-sm text-slate-600 mt-1">
//                                 {o.scheduledDate} • {o.timeKey}
//                               </div>
//                               <div className="text-sm text-slate-600 mt-1">
//                                 {o.address.houseFlat}, {o.address.area} • {o.address.city}
//                               </div>
//                             </div>

//                             <div className="flex flex-col sm:flex-row sm:items-center gap-2 md:mt-0">
//                               <div className="text-right">
//                                 <div className="text-xs font-semibold text-slate-500">Price</div>
//                                 <div className="font-extrabold text-[#0D9B6C]">{formatMoney(o.total)}</div>
//                               </div>
//                               <div className="flex gap-2">
//                                 <Link
//                                   href={`/dashboard/orders/${encodeURIComponent(o.id)}`}
//                                   onClick={(e) => e.stopPropagation()}
//                                   className="rounded-xl border border-slate-200 px-4 py-2 font-extrabold text-slate-700 hover:bg-slate-50 transition"
//                                 >
//                                   View Details
//                                 </Link>
//                                 {o.status === 'COMPLETED' ? (
//                                   <button
//                                     type="button"
//                                     onClick={(e) => {
//                                       e.stopPropagation();
//                                       router.push(`/book?service=${encodeURIComponent(o.serviceKey)}`);
//                                     }}
//                                     className="rounded-xl bg-[#0D9B6C] text-white font-extrabold px-4 py-2 hover:bg-[#086D4C] transition active:scale-95"
//                                   >
//                                     Rebook
//                                   </button>
//                                 ) : null}
//                               </div>
//                             </div>
//                           </div>

//                           {isExpanded && (
//                             <div className="mt-5 pt-4 border-t border-slate-100">
//                               {/* Timeline */}
//                               <div className="flex flex-col lg:flex-row lg:items-start lg:gap-6 gap-4">
//                                 <div className="flex-1">
//                                   <div className="text-sm font-extrabold text-[#0F1C18] mb-3">Status Timeline</div>
//                                   <div className="flex items-start gap-3">
//                                     {(['Placed', 'Confirmed', 'Assigned', 'In Progress', 'Completed'] as const).map((label, idx) => {
//                                       const active = idx <= timelineIdx && o.status !== 'CANCELLED';
//                                       return (
//                                         <div key={label} className="flex-1">
//                                           <div className="flex items-center gap-2">
//                                             <div
//                                               className={[
//                                                 'w-8 h-8 rounded-full border flex items-center justify-center text-sm font-extrabold',
//                                                 active ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 text-slate-400 border-slate-200',
//                                               ].join(' ')}
//                                             >
//                                               {idx + 1}
//                                             </div>
//                                           </div>
//                                           <div className="text-xs text-slate-600 mt-2">{label}</div>
//                                         </div>
//                                       );
//                                     })}
//                                   </div>
//                                 </div>

//                                 {/* Technician + Breakdown */}
//                                 <div className="w-full lg:w-1/2 space-y-4">
//                                   <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
//                                     <div className="flex items-start justify-between gap-3">
//                                       <div>
//                                         <div className="text-sm font-extrabold text-[#0F1C18]">Assigned Technician</div>
//                                         <div className="text-xs text-slate-600 mt-1">
//                                           {o.status === 'PENDING' ? 'Not assigned yet' : `${technician.name} · ${technician.city}`}
//                                         </div>
//                                       </div>
//                                       <div className="flex items-center gap-2">
//                                         <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0D9B6C] to-[#38BDF8] text-white font-extrabold flex items-center justify-center">
//                                           {technician.initials}
//                                         </div>
//                                       </div>
//                                     </div>
//                                     <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white border border-slate-100 px-3 py-1">
//                                       <span className="text-xs font-extrabold text-[#0F1C18]">★</span>
//                                       <span className="text-xs font-extrabold text-[#0D9B6C]">{technician.rating.toFixed(1)}</span>
//                                       <span className="text-xs text-slate-600">Verified rating</span>
//                                     </div>
//                                   </div>

//                                   <div className="rounded-2xl bg-white border border-slate-100 p-4">
//                                     <div className="text-sm font-extrabold text-[#0F1C18] mb-3">Price Breakdown</div>
//                                     <div className="space-y-2 text-sm">
//                                       <Row label="Base" value={`₹${breakdown.base}`} />
//                                       <Row label="Convenience fee" value={`₹${breakdown.convenienceFee}`} />
//                                       <Row label="GST (18%)" value={`₹${breakdown.gst}`} />
//                                       {breakdown.emergencyExtra > 0 ? <Row label="Emergency surcharge" value={`₹${breakdown.emergencyExtra}`} /> : null}
//                                       <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
//                                         <div className="text-sm font-extrabold text-[#0F1C18]">Total</div>
//                                         <div className="text-sm font-extrabold text-[#0D9B6C]">₹{breakdown.total}</div>
//                                       </div>
//                                     </div>
//                                   </div>
//                                 </div>
//                               </div>

//                               {/* Rating / Cancel */}
//                               <div className="mt-5 space-y-4">
//                                 {o.status === 'COMPLETED' ? (
//                                   <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
//                                     <div className="flex items-start justify-between gap-4">
//                                       <div>
//                                         <div className="text-sm font-extrabold text-[#0F1C18]">Rate this service</div>
//                                         <div className="text-xs text-slate-600 mt-1">Your feedback helps us improve.</div>
//                                       </div>
//                                       {existingReview ? (
//                                         <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs font-extrabold">
//                                           ⭐ Rated {existingReview.rating}★
//                                         </div>
//                                       ) : null}
//                                     </div>

//                                     <div className="mt-4">
//                                       <div className="flex items-center gap-2">
//                                         {Array.from({ length: 5 }).map((_, i) => {
//                                           const star = i + 1;
//                                           const active = (ratingDrafts[o.id]?.stars ?? existingReview?.rating ?? 0) >= star;
//                                           return (
//                                             <button
//                                               key={star}
//                                               type="button"
//                                               onClick={(e) => {
//                                                 e.stopPropagation();
//                                                 setRatingDrafts((cur) => ({
//                                                   ...cur,
//                                                   [o.id]: {
//                                                     stars: star,
//                                                     text: cur[o.id]?.text ?? existingReview?.text ?? '',
//                                                   },
//                                                 }));
//                                               }}
//                                               className={[
//                                                 'w-10 h-10 rounded-xl border transition-all active:scale-95',
//                                                 active
//                                                   ? 'bg-[#0D9B6C] border-[#0D9B6C] text-white'
//                                                   : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50',
//                                               ].join(' ')}
//                                               aria-label={`Rate ${star} stars`}
//                                             >
//                                               ★
//                                             </button>
//                                           );
//                                         })}
//                                       </div>

//                                       <textarea
//                                         value={ratingDrafts[o.id]?.text ?? existingReview?.text ?? ''}
//                                         onChange={(e) => {
//                                           e.stopPropagation();
//                                           const text = e.target.value;
//                                           setRatingDrafts((cur) => ({
//                                             ...cur,
//                                             [o.id]: {
//                                               stars: cur[o.id]?.stars ?? existingReview?.rating ?? 0,
//                                               text,
//                                             },
//                                           }));
//                                         }}
//                                         className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
//                                         placeholder="Share your experience (optional)"
//                                       />

//                                       <div className="mt-3 flex items-center gap-3">
//                                         <button
//                                           type="button"
//                                           onClick={(e) => {
//                                             e.stopPropagation();
//                                             submitReview(o.id);
//                                           }}
//                                           className="rounded-xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60"
//                                           disabled={!!existingReview}
//                                         >
//                                           {existingReview ? 'Review Submitted' : 'Submit Review'}
//                                         </button>
//                                         {existingReview ? (
//                                           <div className="text-xs font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-xl px-3 py-2">
//                                             Thanks for rating!
//                                           </div>
//                                         ) : null}
//                                       </div>
//                                     </div>
//                                   </div>
//                                 ) : null}

//                                 {o.status !== 'COMPLETED' && o.status !== 'CANCELLED' ? (
//                                   <div className="flex items-center justify-end gap-3">
//                                     <button
//                                       type="button"
//                                       onClick={(e) => {
//                                         e.stopPropagation();
//                                         setCancelOrderId(o.id);
//                                       }}
//                                       className="rounded-xl border border-rose-200 text-rose-700 font-extrabold px-5 py-3 hover:bg-rose-50 active:scale-95 transition-all"
//                                     >
//                                       Cancel Order
//                                     </button>
//                                   </div>
//                                 ) : null}
//                               </div>
//                             </div>
//                           )}
//                         </div>
//                       );
//                     })
//                   )}
//                 </div>
//               </div>
//             )}

//             {tab === 'orders' && cancelOrderId ? (
//               <div
//                 className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
//                 role="dialog"
//                 aria-modal="true"
//               >
//                 <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-100 shadow-card p-6">
//                   <div className="text-xl font-extrabold text-[#0F1C18]">Cancel this booking?</div>
//                   <div className="text-sm text-slate-600 mt-2">
//                     This will mark your order as cancelled.
//                   </div>
//                   <div className="mt-6 flex gap-3">
//                     <button
//                       type="button"
//                       onClick={() => setCancelOrderId(null)}
//                       className="flex-1 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold py-3 hover:bg-slate-50 transition-all"
//                     >
//                       Keep Order
//                     </button>
//                     <button
//                       type="button"
//                       onClick={() => confirmCancelOrder()}
//                       className="flex-1 rounded-xl bg-rose-600 text-white font-extrabold py-3 hover:bg-rose-700 active:scale-95 transition-all"
//                     >
//                       Confirm Cancel
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             ) : null}

//             {tab === 'notifications' && (
//               <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 sm:p-8">
//                 <div className="flex items-start justify-between gap-4">
//                   <div>
//                     <div className="text-2xl font-extrabold text-[#0F1C18]">Notifications</div>
//                     <div className="text-slate-600 mt-1 text-sm">Latest updates about your bookings.</div>
//                   </div>
//                   <button
//                     type="button"
//                     onClick={toggleAllRead}
//                     className="text-sm font-extrabold text-[#0D9B6C] hover:underline"
//                   >
//                     Mark all read
//                   </button>
//                 </div>

//                 <div className="mt-5 space-y-3">
//                   {notifications.length === 0 ? (
//                     <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center text-slate-600">
//                       No notifications.
//                     </div>
//                   ) : (
//                     notifications.map((n) => (
//                       <button
//                         key={n.id}
//                         type="button"
//                         onClick={() => markOneRead(n.id)}
//                         className={[
//                           'w-full text-left rounded-2xl border p-4 transition-colors',
//                           n.read ? 'border-slate-100 bg-white hover:bg-slate-50' : 'border-[#0D9B6C]/40 bg-[#E8F8F2]',
//                         ].join(' ')}
//                       >
//                         <div className="flex items-start gap-4">
//                           <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-xl">
//                             {n.icon}
//                           </div>
//                           <div className="flex-1">
//                             <div className={`font-extrabold ${n.read ? 'text-slate-800' : 'text-[#0F1C18]'}`}>
//                               {n.title}
//                             </div>
//                             <div className="text-sm text-slate-700 mt-1">{n.body}</div>
//                             <div className="text-xs font-semibold text-slate-500 mt-2">{n.time}</div>
//                           </div>
//                         </div>
//                       </button>
//                     ))
//                   )}
//                 </div>
//               </div>
//             )}

//             {tab === 'addresses' && (
//               <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 sm:p-8">
//                 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
//                   <div>
//                     <div className="text-2xl font-extrabold text-[#0F1C18]">Saved Addresses</div>
//                     <div className="text-slate-600 mt-1 text-sm">
//                       These addresses sync with the booking flow.
//                     </div>
//                   </div>
//                   <button type="button" onClick={() => router.push('/customer/addresses')} className="text-sm font-extrabold text-[#0D9B6C] hover:underline">
//                     Manage in Address page →
//                   </button>
//                 </div>

//                 <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
//                   <div className="space-y-3">
//                     {addresses.length === 0 ? (
//                       <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center text-slate-600">
//                         No addresses yet. Add one below.
//                       </div>
//                     ) : (
//                       addresses.map((a) => (
//                         <div key={a.id} className="rounded-2xl border border-slate-100 bg-white p-4">
//                           <div className="flex items-start justify-between gap-3">
//                             <div>
//                               <div className="flex items-center gap-2">
//                                 <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-[#E8F8F2] text-[#0D9B6C] border border-[#0D9B6C]">
//                                   {a.label || 'Address'}
//                                 </span>
//                                 {a.isDefault && (
//                                   <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-[#0D9B6C] text-white">
//                                     Default
//                                   </span>
//                                 )}
//                               </div>
//                               <div className="text-sm text-slate-700 mt-3">
//                                 {a.houseFlat}, {a.area}
//                               </div>
//                               <div className="text-sm text-slate-700 mt-1">
//                                 {a.city} • {a.pincode}
//                               </div>
//                               {a.landmark ? <div className="text-sm text-slate-700 mt-1">Landmark: {a.landmark}</div> : null}
//                             </div>
//                             <div className="flex flex-col gap-2">
//                               <button type="button" onClick={() => makeDefault(a.id)} className="rounded-xl border border-[#0D9B6C] text-[#0D9B6C] font-extrabold px-4 py-2 hover:bg-[#E8F8F2] active:scale-95 transition-all">
//                                 Make Default
//                               </button>
//                               <button type="button" onClick={() => deleteAddress(a.id)} className="rounded-xl border border-rose-200 text-rose-700 font-extrabold px-4 py-2 hover:bg-rose-50 active:scale-95 transition-all">
//                                 Delete
//                               </button>
//                             </div>
//                           </div>
//                         </div>
//                       ))
//                     )}
//                   </div>

//                   <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
//                     <div className="font-extrabold text-[#0F1C18]">Add New Address</div>
//                     <div className="text-sm text-slate-600 mt-1">Used in /book step 1.</div>

//                     <div className="mt-4 grid grid-cols-1 gap-3">
//                       <input
//                         value={addForm.houseFlat}
//                         onChange={(e) => setAddForm((f) => ({ ...f, houseFlat: e.target.value }))}
//                         placeholder="House/Flat No"
//                         className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
//                       />
//                       <input
//                         value={addForm.area}
//                         onChange={(e) => setAddForm((f) => ({ ...f, area: e.target.value }))}
//                         placeholder="Area"
//                         className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
//                       />
//                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                           <select
//                             value={addForm.city}
//                             onChange={(e) => setAddForm((f) => ({ ...f, city: e.target.value }))}
//                             className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
//                           >
//                             <option value="">Select City</option>
//                             {UP_CITIES.map((c) => (
//                               <option key={c} value={c}>
//                                 {c}
//                               </option>
//                             ))}
//                           </select>
//                         <input
//                           value={addForm.pincode}
//                           onChange={(e) => setAddForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
//                           inputMode="numeric"
//                           placeholder="Pincode (6 digits)"
//                           className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
//                         />
//                       </div>
//                       <input
//                         value={addForm.landmark}
//                         onChange={(e) => setAddForm((f) => ({ ...f, landmark: e.target.value }))}
//                         placeholder="Landmark (optional)"
//                         className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
//                       />
//                       {addErr ? <div className="text-xs text-rose-700 font-semibold">{addErr}</div> : null}
//                       <button
//                         type="button"
//                         onClick={onAddAddress}
//                         className="w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
//                       >
//                         Save Address
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {tab === 'profile' && (
//               <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-6 sm:p-8">
//                 <div className="flex items-start justify-between gap-4">
//                   <div>
//                     <div className="text-2xl font-extrabold text-[#0F1C18]">Profile</div>
//                     <div className="text-slate-600 mt-1 text-sm">Edit your contact details.</div>
//                   </div>
//                 </div>

//                 <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
//                   <div className="md:col-span-1">
//                     <div className={`w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-extrabold text-3xl`}>
//                       {(profile.name || 'G')[0].toUpperCase()}
//                     </div>
//                     <div className="text-center mt-3 font-extrabold text-[#0F1C18]">{profile.name}</div>
//                     <div className="text-center text-sm text-slate-600 mt-1">Customer</div>
//                   </div>
//                   <div className="md:col-span-2">
//                     <ProfileEditor profile={profile} onSave={saveProfile} />
//                   </div>
//                 </div>
//               </div>
//             )}
//           </main>
//         </div>
//       </div>
//     </div>
//   );
// }

// function ProfileEditor({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => void }) {
//   const [draft, setDraft] = useState(profile);
//   useEffect(() => setDraft(profile), [profile]);
//   const [editing, setEditing] = useState(false);

//   return (
//     <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
//       {!editing ? (
//         <>
//           <div className="text-sm font-semibold text-slate-600">Your details</div>
//           <div className="mt-4 space-y-3 text-sm">
//             <div className="flex items-center justify-between gap-4">
//               <div className="font-semibold text-slate-700">Name</div>
//               <div className="font-extrabold text-slate-900">{profile.name}</div>
//             </div>
//             <div className="flex items-center justify-between gap-4">
//               <div className="font-semibold text-slate-700">Email</div>
//               <div className="font-extrabold text-slate-900">{profile.email ? profile.email : '—'}</div>
//             </div>
//             <div className="flex items-center justify-between gap-4">
//               <div className="font-semibold text-slate-700">Phone</div>
//               <div className="font-extrabold text-slate-900">{profile.phone ? profile.phone : '—'}</div>
//             </div>
//           </div>
//           <button
//             type="button"
//             onClick={() => setEditing(true)}
//             className="mt-6 w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
//           >
//             Edit Profile
//           </button>
//         </>
//       ) : (
//         <>
//           <div className="text-sm font-semibold text-slate-600">Edit mode</div>
//           <div className="mt-4 space-y-3">
//             <input
//               value={draft.name}
//               onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
//               className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
//               placeholder="Full name"
//             />
//             <input
//               value={draft.email}
//               onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
//               className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
//               placeholder="Email"
//             />
//             <input
//               value={draft.phone}
//               onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
//               className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
//               placeholder="Phone"
//             />
//           </div>
//           <div className="mt-5 flex gap-3">
//             <button
//               type="button"
//               onClick={() => {
//                 onSave(draft);
//                 setEditing(false);
//               }}
//               className="flex-1 rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
//             >
//               Save
//             </button>
//             <button
//               type="button"
//               onClick={() => {
//                 setDraft(profile);
//                 setEditing(false);
//               }}
//               className="flex-1 rounded-xl border border-slate-200 bg-white text-slate-700 font-extrabold py-3 hover:bg-slate-50 active:scale-95 transition-all"
//             >
//               Cancel
//             </button>
//           </div>
//         </>
//       )}
//     </div>
//   );
// }
