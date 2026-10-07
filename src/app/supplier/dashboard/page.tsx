'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  supplierOrderAccept,
  supplierOrderUpdateStatus,
} from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type SupplierProfile = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  city: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  is_active: boolean;
  is_verified: boolean;
  total_deliveries: number;
  total_earnings: number;
  rating: number;
  rating_count: number;
  created_at: string;
};

type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'delivered'
  | 'cancelled';

type Order = {
  id: string;
  booking_id: string;
  service_type: string;
  customer_name: string;
  customer_phone: string;
  address_line: string;
  city: string;
  scheduled_date: string;
  scheduled_slot: string;
  status: OrderStatus;
  amount: number;
  cans_count: number | null;
  notes: string | null;
  created_at: string;
  accepted_at?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
};

type EarningRow = {
  id: string;
  order_id: string;
  amount: number;
  status: 'pending' | 'paid';
  paid_at: string | null;
  created_at: string;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

type DashboardStats = {
  todayOrders: number;
  pendingOrders: number;
  weekEarnings: number;
  monthEarnings: number;
  completionRate: number;
  avgRating: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_META: Record<
  SupplierProfile['tier'],
  { label: string; color: string; bg: string; next: string; target: number }
> = {
  bronze: {
    label: 'Bronze',
    color: '#CD7F32',
    bg: 'rgba(205,127,50,0.12)',
    next: 'Silver',
    target: 50,
  },
  silver: {
    label: 'Silver',
    color: '#C0C0C0',
    bg: 'rgba(192,192,192,0.12)',
    next: 'Gold',
    target: 150,
  },
  gold: {
    label: 'Gold',
    color: '#FFD700',
    bg: 'rgba(255,215,0,0.12)',
    next: 'Platinum',
    target: 400,
  },
  platinum: {
    label: 'Platinum',
    color: '#E5E4E2',
    bg: 'rgba(229,228,226,0.12)',
    next: '—',
    target: 400,
  },
};

const STATUS_META: Record<
  OrderStatus,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: 'Pending',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
  },
  assigned: {
    label: 'Assigned',
    color: '#38BDF8',
    bg: 'rgba(56,189,248,0.12)',
  },
  in_progress: {
    label: 'In Progress',
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.12)',
  },
  delivered: {
    label: 'Delivered',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
  },
  cancelled: {
    label: 'Cancelled',
    color: '#F87171',
    bg: 'rgba(248,113,113,0.12)',
  },
};

const INR = (n: number) =>
  `₹${Math.round(n).toLocaleString('en-IN')}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

const normalizeOrderStatus = (status: unknown): OrderStatus => {
  switch (String(status ?? '').toUpperCase()) {
    case 'ASSIGNED': return 'assigned';
    case 'IN_PROGRESS': return 'in_progress';
    case 'COMPLETED':
    case 'DELIVERED': return 'delivered';
    case 'CANCELLED': return 'cancelled';
    case 'PENDING':
    default: return 'pending';
  }
};

// ─── SVG Icons/ ────────────────────────────────────────────────────────────────

const Icon = {
  drop: (s = 18, c = '#0D9B6C') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C12 2 5 9.5 5 14.5C5 18.09 8.13 21 12 21C15.87 21 19 18.09 19 14.5C19 9.5 12 2 12 2Z"
        fill={c}
        opacity="0.2"
        stroke={c}
        strokeWidth="1.5"
      />
      <path d="M9 15.5C9.5 17.5 11 18.5 13 18" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  wallet: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" />
    </svg>
  ),
  truck: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M1 3h13v13H1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 8h4l3 3v5h-7V8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="5.5" cy="18.5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18.5" cy="18.5" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  star: (s = 14, filled = true) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <polygon
        points="7,1 8.8,5.2 13,5.6 10,8.4 10.9,12.5 7,10.3 3.1,12.5 4,8.4 1,5.6 5.2,5.2"
        fill={filled ? '#F59E0B' : 'rgba(255,255,255,0.12)'}
      />
    </svg>
  ),
  bell: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  chart: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 16l4-4 4 4 4-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  logout: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  map: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <path d="M7 1C4.8 1 3 2.8 3 5c0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4z" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  phone: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      <rect x="3.5" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="10.5" r="0.7" fill="currentColor" />
    </svg>
  ),
  refresh: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M23 4v6h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1 20v-6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ─── Skeleton loader ───────────────────────────────────────────────────────────

function Skeleton({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: 'linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.10) 50%,rgba(255,255,255,0.06) 75%)',
        backgroundSize: '200% 100%',
        animation: 'auro-shimmer 1.4s ease-in-out infinite',
        flexShrink: 0,
      }}
    />
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  loading: boolean;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1.5px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `${accent}44`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.03em' }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
          {icon}
        </div>
      </div>
      {loading ? (
        <>
          <Skeleton h={28} w="60%" />
          <Skeleton h={12} w="80%" />
        </>
      ) : (
        <>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#F0F4FF', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', fontWeight: 500 }}>{sub}</div>}
        </>
      )}
    </div>
  );
}

// ─── Order card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onAccept,
  onUpdateStatus,
  onRequestComplete,
  updating,
}: {
  order: Order;
  onAccept: (id: string) => Promise<void>;
  onUpdateStatus: (id: string, status: OrderStatus) => Promise<boolean>;
  onRequestComplete: (order: Order) => void;
  updating: string | null;
}) {
  const sm = STATUS_META[order.status];
  const isUpdating = updating === order.id;

  const nextStatus: Record<OrderStatus, OrderStatus | null> = {
    pending: null,
    assigned: order.accepted_at ? 'in_progress' : null,
    in_progress: 'delivered',
    delivered: null,
    cancelled: null,
  };

  const next = nextStatus[order.status];
  const isAssignedAndWaiting = order.status === 'assigned' && !order.accepted_at;

  const nextLabel: Record<OrderStatus, string> = {
    pending: '',
    assigned: 'Start Delivery',
    in_progress: 'Complete Order',
    delivered: '',
    cancelled: '',
  };

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1.5px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.2s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(13,155,108,0.3)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Top accent stripe by status */}
      <div style={{ height: 3, background: sm.color, opacity: 0.7 }} />

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#F0F4FF', letterSpacing: '-0.2px' }}>
              {order.service_type}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              #{order.booking_id.slice(0, 8).toUpperCase()}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              color: sm.color,
              background: sm.bg,
              padding: '3px 9px',
              borderRadius: 999,
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
            }}>
              {sm.label}
            </span>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#0D9B6C' }}>{INR(order.amount)}</span>
          </div>
        </div>

        {/* Customer info */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>{Icon.phone(12)}</span>
            {order.customer_name} · {order.customer_phone}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            <span style={{ marginTop: 1, flexShrink: 0, color: 'rgba(255,255,255,0.3)' }}>{Icon.map(11)}</span>
            {order.address_line}, {order.city}
          </div>
        </div>

        {/* Schedule + cans */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
            📅 {fmtDate(order.scheduled_date)}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
            ⏰ {order.scheduled_slot}
          </span>
          {order.cans_count && (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(13,155,108,0.9)', background: 'rgba(13,155,108,0.1)', padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
              💧 {order.cans_count} can{order.cans_count > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {order.notes && (
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 1.5, borderLeft: '2px solid rgba(255,255,255,0.08)', paddingLeft: 8 }}>
            {order.notes}
          </p>
        )}

        {/* Assignment acceptance */}
        {isAssignedAndWaiting && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onAccept(order.id)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 10,
              border: '1px solid rgba(56,189,248,0.25)',
              background: isUpdating ? 'rgba(56,189,248,0.08)' : 'rgba(56,189,248,0.12)',
              color: isUpdating ? 'rgba(255,255,255,0.4)' : '#7DD3FC',
              fontWeight: 800,
              fontSize: 13,
              cursor: isUpdating ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {isUpdating ? 'Confirming…' : 'Accept Order'}
          </button>
        )}

        {/* Action button */}
        {next && (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => next === 'delivered' ? onRequestComplete(order) : onUpdateStatus(order.id, next)}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 10,
              border: 'none',
              background: isUpdating ? 'rgba(13,155,108,0.2)' : 'linear-gradient(135deg,#0D9B6C,#059652)',
              color: isUpdating ? 'rgba(255,255,255,0.4)' : '#fff',
              fontWeight: 800,
              fontSize: 13,
              cursor: isUpdating ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.18s',
              boxShadow: isUpdating ? 'none' : '0 4px 14px rgba(13,155,108,0.35)',
            }}
            onMouseEnter={(e) => {
              if (!isUpdating) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.01)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            {isUpdating ? (
              <svg style={{ animation: 'auro-spin 0.9s linear infinite' }} width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M7 1.5A5.5 5.5 0 0 0 1.5 7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              Icon.check(14)
            )}
            {isUpdating ? 'Updating…' : nextLabel[order.status]}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SupplierDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [showNotifs, setShowNotifs] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [completionOrder, setCompletionOrder] = useState<Order | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace('/auth/login?redirect=/supplier/dashboard');
        return;
      }
      await loadAll(session.user.id);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load all data ───────────────────────────────────────────────────────────
  const loadAll = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      await Promise.all([
        fetchProfile(userId),
        fetchNotifications(userId),
      ]);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('supplier_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      toast.error('Could not load supplier profile.');
      return;
    }

    setProfile(data as SupplierProfile);
    await fetchOrders(data.id);
    await fetchEarnings(data.id);
    buildStats(data as SupplierProfile);
    setupRealtime(data.id);
  };

  const fetchOrders = async (supplierId: string) => {
    setLoadingOrders(true);

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `id, booking_id, service_type, status, amount, cans_count,
           scheduled_date, scheduled_slot, notes, created_at, accepted_at,
           payment_method, payment_status,
           address_line:delivery_address, city,
           customer_name:customers!orders_customer_id_fkey(full_name),
           customer_phone:customers!orders_customer_id_fkey(phone)`
        )
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[supplier] orders load failed:', error);
        toast.error('Failed to load orders.');
        setOrders([]);
        return;
      }

      const flat: Order[] = (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ''),
        booking_id: String(row.booking_id ?? ''),
        service_type: String(row.service_type ?? 'Service'),
        status: normalizeOrderStatus(row.status),
        amount: Number(row.amount ?? 0),
        cans_count:
          row.cans_count === null || row.cans_count === undefined
            ? null
            : Number(row.cans_count),
        scheduled_date: String(row.scheduled_date ?? ''),
        scheduled_slot: String(row.scheduled_slot ?? ''),
        notes: row.notes as string | null,
        created_at: String(row.created_at ?? ''),
        accepted_at: row.accepted_at as string | null,
        payment_method: row.payment_method as string | null,
        payment_status: row.payment_status as string | null,
        address_line: String(row.address_line ?? ''),
        city: String(row.city ?? ''),
        customer_name:
          (row.customer_name as { full_name?: string } | null)?.full_name ?? '—',
        customer_phone:
          (row.customer_phone as { phone?: string } | null)?.phone ?? '—',
      }));

      setOrders(flat);
    } catch (error) {
      console.error('[supplier] unexpected orders load failure:', error);
      toast.error('Unable to load supplier orders right now.');
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchEarnings = async (supplierId: string) => {
    const { data, error } = await supabase
      .from('supplier_earnings')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[supplier] earnings load failed:', error);
      setEarnings([]);
      return;
    }

    setEarnings((data as EarningRow[]) ?? []);
  };

  const fetchNotifications = async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'supplier')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[supplier] notifications load failed:', error);
      setNotifications([]);
      return;
    }

    setNotifications((data as Notification[]) ?? []);
  };

  const buildStats = (p: SupplierProfile) => {
    // Will be recalculated from real orders after fetchOrders resolves
    // Starting with profile-stored aggregates
    setStats({
      todayOrders: 0,
      pendingOrders: 0,
      weekEarnings: 0,
      monthEarnings: 0,
      completionRate: 0,
      avgRating: p.rating,
    });
  };

  // Recalculate stats from live order data
  useEffect(() => {
    if (!profile) return;
    const today = new Intl.DateTimeFormat('en-CA').format(new Date());
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();

    const todayOrders = orders.filter((o) => o.scheduled_date === today).length;
    const pendingOrders = orders.filter((o) =>
      ['pending', 'assigned', 'in_progress'].includes(o.status)
    ).length;

    const weekEarnings = earnings
      .filter((e) => e.created_at >= weekAgo)
      .reduce((sum, e) => sum + e.amount, 0);

    const monthEarnings = earnings
      .filter((e) => e.created_at >= monthAgo)
      .reduce((sum, e) => sum + e.amount, 0);

    const delivered = orders.filter((o) => o.status === 'delivered').length;
    const completionRate =
      orders.length > 0 ? Math.round((delivered / orders.length) * 100) : 0;

    setStats({
      todayOrders,
      pendingOrders,
      weekEarnings,
      monthEarnings,
      completionRate,
      avgRating: profile.rating,
    });
  }, [orders, earnings, profile]);

  // ── Realtime subscription ───────────────────────────────────────────────────
  const setupRealtime = useCallback((supplierId: string) => {
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);

    const ch = supabase
      .channel(`supplier-${supplierId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `supplier_id=eq.${supplierId}`,
        },
        async () => {
          await fetchOrders(supplierId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        async (payload) => {
          const notif = payload.new as Notification;
          setNotifications((prev) => [notif, ...prev.slice(0, 19)]);
          toast.info(notif.title, { description: notif.body });
        }
      )
      .subscribe();

    realtimeRef.current = ch;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Cleanup realtime on unmount
  useEffect(() => {
    return () => {
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Protected supplier workflow actions ─────────────────────────────────────
  const handleAcceptOrder = useCallback(async (orderId: string) => {
    setUpdatingOrder(orderId);
    try {
      await supplierOrderAccept(orderId);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, accepted_at: new Date().toISOString() }
            : o
        )
      );
      toast.success('Order accepted. You can now start delivery.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to accept this order.');
      if (profile?.id) await fetchOrders(profile.id);
    } finally {
      setUpdatingOrder(null);
    }
  }, [profile?.id]);

  const handleUpdateStatus = useCallback(
    async (
      orderId: string,
      newStatus: OrderStatus,
      payment?: {
        payment_confirmed?: boolean;
        payment_reference?: string;
      },
    ): Promise<boolean> => {
      setUpdatingOrder(orderId);

      try {
        const apiStatus =
          newStatus === 'delivered' ? 'COMPLETED' : 'IN_PROGRESS';

        await supplierOrderUpdateStatus(orderId, apiStatus, payment);

        const nextStatus =
          newStatus === 'delivered' ? 'delivered' : newStatus;

        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: nextStatus,
                  ...(nextStatus === 'delivered'
                    ? { payment_status: 'paid' }
                    : {}),
                }
              : o,
          ),
        );

        toast.success(
          nextStatus === 'delivered'
            ? 'Order completed and payment recorded.'
            : `Order moved to ${STATUS_META[nextStatus].label}.`,
        );

        if (profile?.id) {
          await fetchOrders(profile.id);
        }

        return true;
      } catch (error) {
        console.error('[supplier] update status failed:', error);

        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to update order status.',
        );

        return false;
      } finally {
        setUpdatingOrder(null);
      }
    },
    [profile?.id],
  );

  // ── Sign out ────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      toast.success('Signed out successfully.');
      router.push('/auth/login');
    } catch (error) {
      console.error('[supplier] sign out failed:', error);
      toast.error(
        error instanceof Error ? error.message : 'Unable to sign out.',
      );
    } finally {
      setSigningOut(false);
    }
  };

  // ── Mark notifications read ─────────────────────────────────────────────────
  const markNotifsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);

    if (error) {
      console.error('[supplier] notification read update failed:', error);
      toast.error('Unable to mark notifications as read.');
      return;
    }

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true })),
    );
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const activeOrders = useMemo(
    () => orders.filter((o) => ['pending', 'assigned', 'in_progress'].includes(o.status)),
    [orders]
  );
  const historyOrders = useMemo(
    () => orders.filter((o) => ['delivered', 'cancelled'].includes(o.status)),
    [orders]
  );
  const displayOrders = tab === 'active' ? activeOrders : historyOrders;
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const tier = profile ? TIER_META[profile.tier] : null;
  const tierProgress =
    profile && tier
      ? Math.min(100, Math.round((profile.total_deliveries / tier.target) * 100))
      : 0;

  if (!mounted) return null;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800;900&display=swap');
        .sdash * { box-sizing: border-box; font-family: 'Lexend', sans-serif; }
        @keyframes auro-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes auro-spin { to { transform: rotate(360deg); } }
        @keyframes auro-fadeup {
          from { opacity:0; transform:translateY(12px); }
          to { opacity:1; transform:translateY(0); }
        }
        .sdash .order-col > * {
          animation: auro-fadeup 0.35s ease both;
        }
        .sdash .order-col > *:nth-child(1) { animation-delay:0ms; }
        .sdash .order-col > *:nth-child(2) { animation-delay:50ms; }
        .sdash .order-col > *:nth-child(3) { animation-delay:100ms; }
        .sdash .order-col > *:nth-child(4) { animation-delay:150ms; }
        .sdash .order-col > *:nth-child(5) { animation-delay:200ms; }
        .sdash .order-col > *:nth-child(n+6) { animation-delay:250ms; }
        @media(max-width:640px){
          .sdash .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .sdash .orders-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div
        className="sdash"
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(160deg,#060C17 0%,#070A12 50%,#060E18 100%)',
          color: '#F0F4FF',
          position: 'relative',
        }}
      >
        {/* Ambient glow */}
        <div style={{ position: 'fixed', top: '5%', left: '50%', transform: 'translateX(-50%)', width: '60vw', height: '40vh', background: 'radial-gradient(ellipse,rgba(13,155,108,0.07) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            background: 'rgba(6,12,23,0.88)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '0 clamp(16px,4vw,32px)',
          }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            {/* Logo + role */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#0D9B6C,#059652)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(13,155,108,0.45)' }}>
                {Icon.drop(18, '#fff')}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#F0F4FF', letterSpacing: '-0.3px', lineHeight: 1 }}>AuroTap</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#0D9B6C', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Supplier Portal</div>
              </div>
            </div>

            {/* Right actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Refresh */}
              <button
                type="button"
                title="Refresh data"
                onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (session?.user) await loadAll(session.user.id);
                  toast.success('Dashboard refreshed.');
                }}
                style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', transition: 'all 0.18s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#F0F4FF'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)'; }}
              >
                {Icon.refresh(15)}
              </button>

              {/* Notification bell */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => { setShowNotifs((v) => !v); if (!showNotifs) markNotifsRead(); }}
                  style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', position: 'relative', transition: 'all 0.18s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#F0F4FF'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)'; }}
                >
                  {Icon.bell(16)}
                  {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -4, width: 17, height: 17, borderRadius: '50%', background: '#F87171', fontSize: 9, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #060C17' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification dropdown */}
                {showNotifs && (
                  <div style={{ position: 'absolute', top: 44, right: 0, width: 300, background: '#0A1220', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', zIndex: 100, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12, fontWeight: 800, color: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      Notifications
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{notifications.length} total</span>
                    </div>
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>No notifications yet</div>
                      ) : notifications.map((n) => (
                        <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: n.is_read ? 'transparent' : 'rgba(13,155,108,0.05)' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {!n.is_read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0D9B6C', display: 'inline-block', flexShrink: 0 }} />}
                            {n.title}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{n.body}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{fmtTime(n.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile pill */}
              {loading ? (
                <Skeleton w={110} h={34} r={10} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 12px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: `linear-gradient(135deg,${tier?.color ?? '#0D9B6C'},${tier?.color ?? '#059652'}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#0A1220', flexShrink: 0 }}>
                    {profile?.full_name?.[0]?.toUpperCase() ?? 'S'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#F0F4FF', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>
                      {profile?.full_name?.split(' ')[0] ?? 'Supplier'}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: tier?.color ?? '#0D9B6C', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {tier?.label ?? '—'} Tier
                    </div>
                  </div>
                </div>
              )}

              {/* Sign out */}
              <button
                type="button"
                disabled={signingOut}
                onClick={handleSignOut}
                title="Sign out"
                style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#F87171', transition: 'all 0.18s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.14)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(248,113,113,0.06)'; }}
              >
                {Icon.logout(15)}
              </button>
            </div>
          </div>
        </header>

        {/* ── MAIN ───────────────────────────────────────────────────────── */}
        <main style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(20px,4vw,32px) clamp(16px,4vw,24px) 80px', position: 'relative', zIndex: 1 }}>

          {/* Welcome strip */}
          <div style={{ marginBottom: 28, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0D9B6C', letterSpacing: '0.1em', marginBottom: 6 }}>
                {loading ? <Skeleton w={120} h={12} /> : `Welcome back, ${profile?.full_name?.split(' ')[0]}`}
              </div>
              <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 900, color: '#F0F4FF', letterSpacing: '-0.6px', lineHeight: 1.1 }}>
                {loading ? <Skeleton w={260} h={32} /> : 'Supplier Dashboard'}
              </h1>
              {!loading && profile && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: profile.is_active ? '#10B981' : '#F87171', background: profile.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(248,113,113,0.12)', padding: '3px 10px', borderRadius: 999 }}>
                    {profile.is_active ? '● Active' : '● Inactive'}
                  </span>
                  {profile.is_verified && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#38BDF8', background: 'rgba(56,189,248,0.1)', padding: '3px 10px', borderRadius: 999 }}>
                      ✓ Verified
                    </span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>
                    {profile.city}
                  </span>
                </div>
              )}
            </div>

            {/* Tier progress card */}
            {!loading && profile && tier && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${tier.color}33`, borderRadius: 14, padding: '14px 18px', minWidth: 220, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: tier.color }}>🏆 {tier.label} Tier</span>
                  {profile.tier !== 'platinum' && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Next: {tier.next}</span>
                  )}
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${tierProgress}%`, background: tier.color, borderRadius: 99, transition: 'width 0.8s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{profile.total_deliveries} deliveries</span>
                  {profile.tier !== 'platinum' && (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{tier.target} needed</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── STATS GRID ─────────────────────────────────────────────── */}
          <div
            className="stats-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 28 }}
          >
            <StatCard
              icon={Icon.truck(17)}
              label="Today's Orders"
              value={stats?.todayOrders.toString() ?? '—'}
              sub="Scheduled for today"
              accent="#0D9B6C"
              loading={loading}
            />
            <StatCard
              icon={Icon.drop(17)}
              label="Active Orders"
              value={stats?.pendingOrders.toString() ?? '—'}
              sub="Pending + In-progress"
              accent="#38BDF8"
              loading={loading}
            />
            <StatCard
              icon={Icon.wallet(17)}
              label="This Week"
              value={stats ? INR(stats.weekEarnings) : '—'}
              sub="Earnings (7 days)"
              accent="#A78BFA"
              loading={loading}
            />
            <StatCard
              icon={Icon.chart(17)}
              label="This Month"
              value={stats ? INR(stats.monthEarnings) : '—'}
              sub={`${stats?.completionRate ?? 0}% completion rate`}
              accent="#F59E0B"
              loading={loading}
            />
            <StatCard
              icon={<>{Icon.star(16)}</>}
              label="Your Rating"
              value={profile ? `${profile.rating.toFixed(1)} ★` : '—'}
              sub={`Based on ${profile?.rating_count ?? 0} reviews`}
              accent="#F59E0B"
              loading={loading}
            />
            <StatCard
              icon={Icon.truck(17)}
              label="Total Deliveries"
              value={profile ? profile.total_deliveries.toLocaleString('en-IN') : '—'}
              sub={`${INR(profile?.total_earnings ?? 0)} total earned`}
              accent="#0D9B6C"
              loading={loading}
            />
          </div>

          {/* ── ORDERS SECTION ─────────────────────────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
                {(['active', 'history'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 9,
                      border: 'none',
                      background: tab === t ? 'rgba(13,155,108,0.9)' : 'transparent',
                      color: tab === t ? '#fff' : 'rgba(255,255,255,0.5)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.18s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {t === 'active' ? 'Active Orders' : 'History'}
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      background: tab === t ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                      color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)',
                      padding: '1px 7px',
                      borderRadius: 999,
                      minWidth: 22,
                      textAlign: 'center',
                    }}>
                      {t === 'active' ? activeOrders.length : historyOrders.length}
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
                {tab === 'active' ? 'Live updates via Supabase Realtime' : `${historyOrders.length} completed orders`}
              </div>
            </div>

            {/* Orders grid */}
            {loadingOrders ? (
              <div className="orders-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <Skeleton h={16} w="60%" />
                    <Skeleton h={60} />
                    <Skeleton h={12} w="80%" />
                    <Skeleton h={38} r={10} />
                  </div>
                ))}
              </div>
            ) : displayOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 24px', background: 'rgba(255,255,255,0.02)', border: '1.5px dashed rgba(255,255,255,0.08)', borderRadius: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>{tab === 'active' ? '💧' : '📦'}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#F0F4FF', marginBottom: 6 }}>
                  {tab === 'active' ? 'No active orders right now' : 'No order history yet'}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                  {tab === 'active'
                    ? 'New orders will appear here automatically when assigned.'
                    : 'Completed and cancelled orders will show up here.'}
                </div>
              </div>
            ) : (
              <div
                className="order-col orders-grid"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}
              >
                {displayOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    onAccept={handleAcceptOrder}
                    onUpdateStatus={handleUpdateStatus}
                    onRequestComplete={(order) => {
                      setCompletionOrder(order);
                      setPaymentReference('');
                      setPaymentConfirmed(false);
                    }}
                    updating={updatingOrder}
                  />
                ))}
              </div>
            )}
          </div>

          {completionOrder && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="complete-order-title"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                background: 'rgba(0,0,0,0.72)',
                backdropFilter: 'blur(10px)',
              }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !updatingOrder) {
                  setCompletionOrder(null);
                }
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 460,
                  maxHeight: 'min(720px, calc(100vh - 32px))',
                  overflowY: 'auto',
                  background: '#0A1220',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 20,
                  boxShadow: '0 28px 90px rgba(0,0,0,0.55)',
                  padding: 22,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#0D9B6C', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                      Final delivery step
                    </div>
                    <h2 id="complete-order-title" style={{ margin: '6px 0 0', fontSize: 20, fontWeight: 900, color: '#F0F4FF' }}>
                      Confirm completion
                    </h2>
                    <p style={{ margin: '7px 0 0', fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.45)' }}>
                      Confirm the service is complete and record payment before closing this order.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close completion dialog"
                    disabled={Boolean(updatingOrder)}
                    onClick={() => setCompletionOrder(null)}
                    style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', cursor: updatingOrder ? 'wait' : 'pointer', fontSize: 18 }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#F0F4FF' }}>{completionOrder.service_type}</div>
                      <div style={{ marginTop: 3, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                        #{completionOrder.booking_id.slice(0, 8).toUpperCase()} · {completionOrder.customer_name}
                      </div>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: '#0D9B6C' }}>{INR(completionOrder.amount)}</div>
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    Payment method: <strong style={{ color: '#F0F4FF' }}>{completionOrder.payment_method?.toUpperCase() || 'CASH'}</strong>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    Payment status: <strong style={{ color: completionOrder.payment_status === 'paid' ? '#10B981' : '#F59E0B' }}>
                      {completionOrder.payment_status === 'paid' ? 'Already paid' : 'Confirmation required'}
                    </strong>
                  </div>
                </div>

                {completionOrder.payment_status !== 'paid' && (
                  <>
                    {completionOrder.payment_method?.toLowerCase() === 'upi' && (
                      <label style={{ display: 'block', marginTop: 16 }}>
                        <span style={{ display: 'block', marginBottom: 7, fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.62)' }}>
                          UPI transaction reference
                        </span>
                        <input
                          value={paymentReference}
                          onChange={(event) => setPaymentReference(event.target.value.slice(0, 100))}
                          placeholder="Enter UPI / transaction ID"
                          maxLength={100}
                          disabled={Boolean(updatingOrder)}
                          autoComplete="off"
                          style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', borderRadius: 11, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', color: '#F0F4FF', padding: '0 12px', outline: 'none', fontFamily: 'inherit' }}
                        />
                      </label>
                    )}

                    <label style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      marginTop: 16,
                      padding: 12,
                      borderRadius: 12,
                      background: paymentConfirmed ? 'rgba(13,155,108,0.08)' : 'rgba(255,255,255,0.035)',
                      border: paymentConfirmed ? '1px solid rgba(13,155,108,0.25)' : '1px solid rgba(255,255,255,0.07)',
                      cursor: updatingOrder ? 'wait' : 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={paymentConfirmed}
                        onChange={(event) => setPaymentConfirmed(event.target.checked)}
                        disabled={Boolean(updatingOrder)}
                        style={{ marginTop: 2, accentColor: '#0D9B6C' }}
                      />
                      <span style={{ fontSize: 12, lineHeight: 1.55, color: 'rgba(255,255,255,0.68)' }}>
                        I confirm the customer has paid the order amount and the payment details are accurate.
                      </span>
                    </label>
                  </>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button
                    type="button"
                    disabled={Boolean(updatingOrder)}
                    onClick={() => setCompletionOrder(null)}
                    style={{ flex: 1, minHeight: 46, borderRadius: 11, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.72)', fontWeight: 800, cursor: updatingOrder ? 'wait' : 'pointer', fontFamily: 'inherit' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(updatingOrder) || (completionOrder.payment_status !== 'paid' && (!paymentConfirmed || (completionOrder.payment_method?.toLowerCase() === 'upi' && !paymentReference.trim())))}
                    onClick={async () => {
                      const ok = await handleUpdateStatus(
                        completionOrder.id,
                        'delivered',
                        completionOrder.payment_status === 'paid'
                          ? undefined
                          : {
                              payment_confirmed: true,
                              payment_reference: paymentReference.trim() || undefined,
                            },
                      );

                      if (ok) {
                        setCompletionOrder(null);
                        setPaymentReference('');
                        setPaymentConfirmed(false);
                      }
                    }}
                    style={{
                      flex: 1.35,
                      minHeight: 46,
                      borderRadius: 11,
                      border: 'none',
                      background: 'linear-gradient(135deg,#0D9B6C,#059652)',
                      color: '#fff',
                      fontWeight: 900,
                      cursor: updatingOrder ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                      boxShadow: '0 8px 24px rgba(13,155,108,0.25)',
                    }}
                  >
                    {updatingOrder ? 'Completing…' : 'Confirm & Complete'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── EARNINGS TABLE ─────────────────────────────────────────── */}
          {earnings.length > 0 && (
            <div>
              <h2 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: '#F0F4FF', letterSpacing: '-0.3px' }}>
                Recent Earnings
              </h2>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1.5px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
                {/* Table head */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '12px 18px', background: '#0A1220', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Order', 'Amount', 'Status', 'Date'].map((h) => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>
                {earnings.slice(0, 10).map((e, i) => (
                  <div
                    key={e.id}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '13px 18px', borderBottom: i < 9 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background 0.15s' }}
                    onMouseEnter={(el) => { (el.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)'; }}
                    onMouseLeave={(el) => { (el.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>#{e.order_id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0D9B6C' }}>{INR(e.amount)}</div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: e.status === 'paid' ? '#10B981' : '#F59E0B', background: e.status === 'paid' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', padding: '2px 8px', borderRadius: 999, letterSpacing: '0.04em' }}>
                        {e.status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      {e.paid_at ? fmtDate(e.paid_at) : fmtDate(e.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
