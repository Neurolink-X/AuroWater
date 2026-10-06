'use client';

import React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import {
  supplierOrdersList,
  supplierOrderAccept,
  supplierOrderReject,
  supplierOrderUpdateStatus,
  supplierProfileGet,
  supplierProfileUpdate,
  supplierEarningsSummary,
  supplierPayoutRequest,
  supplierSettingsGet,
  supplierSettingsUpdate,
  supplierStockGet,
  supplierStockUpdate,
  supplierFleetList,
  supplierFleetCreate,
  supplierFleetUpdate,
  supplierFleetDelete,
  getApiErrorMessage,
  type ApiOrder,
  type SupplierEarningsSummary,
  type SupplierSettings,
  type SupplierStock,
} from '@/lib/api-client';
import { DatabaseErrorBanner } from '@/components/ui/DatabaseErrorBanner';

type TabKey =
  | 'overview'
  | 'orders'
  | 'fleet'
  | 'revenue'
  | 'aurotap'
  | 'profile'
  | 'documents';

type SupplierOrder = {
  /** Supabase order UUID — use for API calls */
  apiId: string;
  /** Human-readable order_number */
  label: string;
  customer: string;
  area: string;
  address: string;
  size: '1000L' | '3000L' | '5000L' | '10000L';
  date: string;
  eta: string;
  amount: number;
  status: 'pending' | 'active' | 'delivered' | 'cancelled';
  workflowStatus: string;
  canCount: number;
  acceptedAt: string | null;
  paymentMethod: string;
  paymentStatus: string;
};

function mapApiOrderToSupplierOrder(o: ApiOrder): SupplierOrder {
  const snap = (o.address_snapshot ?? {}) as Record<string, unknown>;
  const area = [snap.area, snap.city].filter(Boolean).join(', ') || '—';
  const addr = [snap.house_flat, snap.area, snap.city, snap.pincode].filter(Boolean).join(', ') || '—';
  const st = String(o.status ?? '').toUpperCase();
  const canCount = Math.max(0, Number(o.can_quantity ?? 0));
  let status: SupplierOrder['status'] = 'pending';
  if (st === 'IN_PROGRESS') status = 'active';
  else if (st === 'COMPLETED') status = 'delivered';
  else if (st === 'CANCELLED') status = 'cancelled';
  else status = 'pending';

  const sk = String(o.service_type_key ?? '').toLowerCase();
  let size: SupplierOrder['size'] = '3000L';
  if (sk.includes('1000')) size = '1000L';
  else if (sk.includes('5000')) size = '5000L';
  else if (sk.includes('10000')) size = '10000L';

  return {
    apiId: o.id,
    label: String(o.order_number ?? o.id).slice(0, 32),
    customer: 'Customer',
    area,
    address: addr,
    size,
    date: String(o.scheduled_date ?? (typeof o.created_at === 'string' ? o.created_at.slice(0, 10) : '—')),
    eta: String(o.time_slot ?? '—'),
    amount: Number(o.total_amount ?? 0),
    status,
    workflowStatus: st,
    canCount,
    acceptedAt: (o as ApiOrder & { accepted_at?: string | null }).accepted_at ?? null,
    paymentMethod: String(o.payment_method ?? 'cash').toLowerCase(),
    paymentStatus: String(o.payment_status ?? 'pending').toLowerCase(),
  };
}

type SupplierProfile = {
  businessName: string;
  ownerName: string;
  gst: string;
  phone: string;
  email: string;
  city: string;
  pincode: string;
  businessType: string;
  gstNumber: string;
  vehicleType: string;
  serviceRadiusKm: number;
  serviceCities: string[];
  aurotapId: string;
  prices: Record<'1000L' | '3000L' | '5000L', number>;
};

const CITIES = [
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


const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const maskPhone = (p: string) => (p.length < 6 ? p : `${p.slice(0, 2)}XXXXXX${p.slice(-2)}`);

function seedProfile(): SupplierProfile {
  return {
    businessName: 'Auro Water Kanpur',
    ownerName: 'Arjun Chaurasiya',
    gst: '09ABCDE1234F1Z5',
    phone: '9889305803',
    email: 'supplier@aurowater.in',
    city: 'Kanpur',
    pincode: '',
    businessType: 'Water Service Supplier',
    gstNumber: '09ABCDE1234F1Z5',
    vehicleType: 'Bike',
    serviceRadiusKm: 5,
    serviceCities: ['Kanpur'],
    aurotapId: '9889305803@aurotap',
    prices: {
      '1000L': 299,
      '3000L': 399,
      '5000L': 599,
    },
  };
}


export default function SupplierDashboardPage() {
  const { settings } = useSettings();
  const { session, hydrated: authHydrated, isLoggedIn, isSupplier } = useAuth();
  const [tab, setTab] = React.useState<TabKey>('overview');
  const [orders, setOrders] = React.useState<SupplierOrder[]>([]);
  const [earningsSummary, setEarningsSummary] = React.useState<SupplierEarningsSummary | null>(null);
  const [supplierSettings, setSupplierSettings] = React.useState<SupplierSettings | null>(null);
  const [supplierStock, setSupplierStock] = React.useState<SupplierStock | null>(null);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [ordersLoading, setOrdersLoading] = React.useState(true);
  const [availabilitySaving, setAvailabilitySaving] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [fleet, setFleet] = React.useState<import('@/lib/api-client').SupplierFleetItem[]>([]);
  const [profile, setProfile] = React.useState<SupplierProfile>(seedProfile());
  const [orderFilter, setOrderFilter] = React.useState<'all' | 'pending' | 'active' | 'delivered' | 'cancelled'>('all');
  const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(null);
  const [newTanker, setNewTanker] = React.useState({ name: '', vehicleType: 'Bike', capacity: '20', plateNumber: '', driverName: '' });
  const [boardError, setBoardError] = React.useState<string | null>(null);

  const fetchSupplierBoard = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setBoardError(null);
    try {
      const [list, earn, settingsResult, stockResult, fleetResult, profileResult] = await Promise.allSettled([
        supplierOrdersList(),
        supplierEarningsSummary('month'),
        supplierSettingsGet(),
        supplierStockGet(),
        supplierFleetList(),
        supplierProfileGet(),
      ]);

      let primaryErr: string | null = null;

      if (list.status === 'fulfilled') {
        setOrders((list.value ?? []).map(mapApiOrderToSupplierOrder));
      } else {
        primaryErr = getApiErrorMessage(list.reason);
      }

      if (earn.status === 'fulfilled' && earn.value) {
        setEarningsSummary(earn.value);
      } else if (earn.status === 'rejected' && !primaryErr) {
        toast.error(`Could not load earnings: ${getApiErrorMessage(earn.reason)}`);
      }

      if (settingsResult.status === 'fulfilled') {
        setSupplierSettings(settingsResult.value);
      } else if (!primaryErr) {
        toast.error(`Could not load supplier availability: ${getApiErrorMessage(settingsResult.reason)}`);
      }

      if (stockResult.status === 'fulfilled') {
        setSupplierStock(stockResult.value);
      } else if (!primaryErr) {
        toast.error(`Could not load stock: ${getApiErrorMessage(stockResult.reason)}`);
      }
      if (fleetResult.status === 'fulfilled') {
        setFleet(fleetResult.value ?? []);
      } else if (!primaryErr) {
        toast.error(`Could not load fleet: ${getApiErrorMessage(fleetResult.reason)}`);
      }

      if (profileResult.status === 'fulfilled') {
        const p = profileResult.value;
        setProfile((prev) => ({
          ...prev,
          businessName: p.business_name ?? prev.businessName,
          ownerName: p.full_name ?? prev.ownerName,
          gst: p.gst_number ?? prev.gst,
          phone: p.phone ?? prev.phone,
          email: p.email ?? prev.email,
          city: p.city ?? prev.city,
          pincode: p.pincode ?? prev.pincode,
          businessType: p.business_type ?? prev.businessType,
          gstNumber: p.gst_number ?? prev.gstNumber,
          vehicleType: p.vehicle_type ?? prev.vehicleType,
          serviceRadiusKm: Number(p.service_area_km ?? prev.serviceRadiusKm),
          aurotapId: p.aurotap_id ?? prev.aurotapId,
          serviceCities: p.city ? [p.city] : prev.serviceCities,
        }));
      } else if (!primaryErr) {
        toast.error(`Could not load supplier profile: ${getApiErrorMessage(profileResult.reason)}`);
      }

      if (primaryErr) setBoardError(primaryErr);
    } catch (e) {
      setBoardError(getApiErrorMessage(e));
      console.error('[SupplierDashboard] fetch failed:', e);
    } finally {
      setOrdersLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    if (!authHydrated || !isLoggedIn || !isSupplier) return;
    void fetchSupplierBoard();
  }, [authHydrated, isLoggedIn, isSupplier, fetchSupplierBoard]);

  /* Live refresh when ops assigns or updates supplier orders */
  React.useEffect(() => {
    if (!session?.userId || typeof window === 'undefined') return;
    let ch: ReturnType<ReturnType<typeof import('@/lib/db/supabase').supabaseBrowser>['channel']> | null = null;
    void import('@/lib/db/supabase').then(({ supabaseBrowser }) => {
      ch = supabaseBrowser()
        .channel(`supplier-orders-${session.userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `supplier_id=eq.${session.userId}`,
          },
          () => {
            void fetchSupplierBoard(true);
          }
        )
        .subscribe();
    });
    return () => {
      void ch?.unsubscribe();
    };
  }, [session?.userId, fetchSupplierBoard]);

  const saveLiveProfile = async (patch: Record<string, unknown>) => {
    if (profileSaving) return;
    setProfileSaving(true);
    try {
      const updated = await supplierProfileUpdate(patch);
      setProfile((prev) => ({
        ...prev,
        businessName: updated.business_name ?? prev.businessName,
        ownerName: updated.full_name ?? prev.ownerName,
        gst: updated.gst_number ?? prev.gst,
        phone: updated.phone ?? prev.phone,
        email: updated.email ?? prev.email,
        city: updated.city ?? prev.city,
        pincode: updated.pincode ?? prev.pincode ?? '',
        businessType: updated.business_type ?? prev.businessType,
        gstNumber: updated.gst_number ?? prev.gstNumber,
        vehicleType: updated.vehicle_type ?? prev.vehicleType,
        serviceRadiusKm: Number(updated.service_area_km ?? prev.serviceRadiusKm),
        aurotapId: updated.aurotap_id ?? prev.aurotapId,
        serviceCities: updated.city ? [updated.city] : prev.serviceCities,
      }));
      toast.success('Profile saved.');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setProfileSaving(false);
    }
  };

  const toggleAvailability = async () => {
    if (availabilitySaving) return;
    setAvailabilitySaving(true);
    const nextOnline = !(supplierSettings?.is_online ?? false);
    try {
      const updated = await supplierSettingsUpdate({ is_online: nextOnline });
      setSupplierSettings(updated);
      toast.success(nextOnline ? 'You are now accepting new delivery offers.' : 'You are now offline. New offers are paused.');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const updateStock = async (value: number) => {
    if (!Number.isInteger(value) || value < 0 || value > 100000 || !supplierStock) return;
    try {
      const updated = await supplierStockUpdate({ cans_available: value });
      setSupplierStock(updated);
      toast.success('Stock updated.');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const persistOrders = (next: SupplierOrder[]) => {
    setOrders(next);
  };
  const persistProfile = (next: SupplierProfile) => {
    setProfile(next);
  };

  const filteredOrders = React.useMemo(() => {
    if (orderFilter === 'all') return orders;
    return orders.filter((o) => o.status === orderFilter);
  }, [orders, orderFilter]);

  const stats = React.useMemo(() => {
    const active = orders.filter((o) => o.status === 'active').length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const delivered = orders.filter((o) => o.status === 'delivered').length;
    const monthRevenue =
      earningsSummary != null
        ? earningsSummary.gross_amount
        : orders.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + o.amount, 0);
    return { active, pending, delivered, monthRevenue };
  }, [orders, earningsSummary]);

  const completion = React.useMemo(() => {
    const fields = [
      profile.businessName,
      profile.ownerName,
      profile.phone,
      profile.email,
      profile.gst,
      profile.serviceCities.length ? 'ok' : '',
      profile.prices['1000L'] > 0 ? 'ok' : '',
      profile.prices['3000L'] > 0 ? 'ok' : '',
      profile.prices['5000L'] > 0 ? 'ok' : '',
      profile.aurotapId,
    ];
    const done = fields.filter((x) => String(x).trim().length > 0).length;
    return Math.round((done / fields.length) * 100);
  }, [profile]);

  const barItems = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'orders', label: 'Orders', icon: '📦' },
    { key: 'fleet', label: 'Fleet', icon: '🚚' },
    { key: 'revenue', label: 'Revenue', icon: '₹' },
    { key: 'aurotap', label: 'My AuroTap ID', icon: '🏷️' },
    { key: 'profile', label: 'Profile', icon: '👤' },
    { key: 'documents', label: 'Documents', icon: '📄' },
  ] as const;

  if (!authHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600 text-sm font-medium">Loading workspace…</p>
      </div>
    );
  }

  if (!isLoggedIn || !isSupplier) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white shadow-card p-8 text-center">
          <p className="font-bold text-slate-900">Supplier sign-in required</p>
          <p className="text-sm text-slate-600 mt-2">Log in with a supplier account to manage deliveries.</p>
          <Link
            href="/auth/login"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#003049] text-white font-bold px-6 py-3 text-sm"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,#dbeafe_0%,#eff6ff_35%,#f8fafc_100%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
        {boardError && (
          <div className="mb-6 space-y-2">
            <DatabaseErrorBanner message={boardError} />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void fetchSupplierBoard(true)}
                className="rounded-xl bg-[#003049] px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-3">
            <div className="rounded-3xl bg-[#003049] text-white p-5 shadow-card sticky top-24">
              <div className="text-sm text-white/70">Supplier Workspace</div>
              <div className="text-lg font-extrabold mt-1">{profile.businessName}</div>
              <div className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wide">
                AUROTAP PARTNER
              </div>

              <div className="mt-6 space-y-2">
                {barItems.map((i) => {
                  const active = tab === i.key;
                  return (
                    <button
                      key={i.key}
                      type="button"
                      onClick={() => setTab(i.key)}
                      className={[
                        'w-full text-left rounded-2xl px-4 py-3 text-sm font-bold transition-all',
                        active ? 'bg-white text-[#003049]' : 'text-white/85 hover:bg-white/10',
                      ].join(' ')}
                    >
                      <span className="mr-2">{i.icon}</span>
                      {i.label}
                    </button>
                  );
                })}
              </div>
              <Link href="/" className="mt-6 inline-flex text-sm font-bold text-[#F4A261] hover:underline">
                ⬅ Back to Site
              </Link>
            </div>
          </aside>

          <main className="lg:col-span-9 space-y-5">
            {tab === 'overview' && (
              <>
                <section className="rounded-3xl bg-gradient-to-br from-[#2A9D8F] to-[#003049] text-white p-6 shadow-card">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <div className="text-xs tracking-wider text-white/80">YOUR AUROTAP ID</div>
                      <div className="mt-2 text-3xl md:text-4xl font-black font-mono">{session?.aurotapId ?? profile.aurotapId}</div>
                      <div className="mt-2 text-sm text-white/85">
                        Share your AuroTap ID with repeat customers; direct-order routing is being connected to the marketplace dispatch flow.
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(session?.aurotapId ?? profile.aurotapId);
                          toast.success('AuroTap ID copied! Share it with customers.');
                        }}
                        className="rounded-xl border border-white/30 px-4 py-2 font-bold hover:bg-white/10"
                      >
                        Copy
                      </button>
                      <div className="w-20 h-20 rounded-xl bg-white/20 flex items-center justify-center text-xs font-bold">
                        QR Soon
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-[1.3fr_.7fr]">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">Delivery availability</p>
                        <h2 className="mt-2 text-xl font-black text-slate-900">
                          {supplierSettings?.is_online ? 'Online and accepting orders' : 'Offline — new offers paused'}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Go online only when you have stock, delivery capacity and a driver/vehicle ready to fulfil an assignment.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void toggleAvailability()}
                        disabled={availabilitySaving}
                        className={supplierSettings?.is_online
                          ? 'rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50'
                          : 'rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50'}
                      >
                        {availabilitySaving ? 'Saving…' : supplierSettings?.is_online ? 'Go offline' : 'Go online'}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[.18em] text-slate-500">Water inventory</p>
                    <div className="mt-2 flex items-end justify-between gap-4">
                      <div>
                        <div className="text-3xl font-black text-slate-900">{supplierStock ? Math.max(0, supplierStock.cans_available - supplierStock.reserved_cans) : '—'}</div>
                        <div className="text-xs font-semibold text-slate-500">available cans</div>
                      </div>
                      <div className="text-right text-xs font-bold text-slate-500">Reserved: {supplierStock?.reserved_cans ?? 0}</div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        aria-label="Available water cans"
                        defaultValue={supplierStock?.cans_available ?? 0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void updateStock(Number((e.target as HTMLInputElement).value));
                        }}
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = (e.currentTarget.previousElementSibling as HTMLInputElement | null);
                          if (input) void updateStock(Number(input.value));
                        }}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-900"
                      >
                        Save stock
                      </button>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    title="Orders Today"
                    value={ordersLoading ? '…' : `${stats.pending + stats.active}`}
                    color="#003049"
                  />
                  <StatCard title="Active Deliveries" value={`${stats.active}`} color="#2A9D8F" />
                  <StatCard title="Month Revenue" value={fmtMoney(stats.monthRevenue)} color="#F4A261" />
                  <StatCard title="Fleet Available" value={`${fleet.filter((f) => f.status === 'available').length}`} color="#1D4ED8" />
                </section>
                {refreshing ? (
                  <p className="text-xs text-slate-500 -mt-2">Syncing latest orders…</p>
                ) : null}

                <section className="rounded-3xl bg-white/80 backdrop-blur-xl border border-amber-200 bg-amber-50/70 shadow-sm p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.18em] text-amber-700">Action required</p>
                      <h3 className="mt-1 text-lg font-extrabold text-slate-900">Incoming assignments</h3>
                    </div>
                    <button type="button" onClick={() => setTab('orders')} className="text-sm font-black text-amber-800 hover:underline">Open orders</button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {orders.filter((o) => o.workflowStatus === 'ASSIGNED').slice(0, 3).map((o) => (
                      <div key={o.apiId} className="rounded-2xl border border-amber-200 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="font-black text-slate-900">{o.label} · {o.canCount || o.size}</div>
                            <div className="mt-1 text-sm text-slate-600">{o.area} · {o.eta} · {fmtMoney(o.amount)}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={async () => { try { await supplierOrderAccept(o.apiId); toast.success('Order accepted. Stock reserved.'); void fetchSupplierBoard(true); } catch (e) { toast.error(getApiErrorMessage(e)); } }} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">Accept</button>
                            <button type="button" onClick={async () => { try { await supplierOrderReject(o.apiId, 'Supplier unavailable'); toast.success('Order declined and released.'); void fetchSupplierBoard(true); } catch (e) { toast.error(getApiErrorMessage(e)); } }} className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-black text-rose-700">Reject</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {orders.filter((o) => o.workflowStatus === 'ASSIGNED').length === 0 ? <p className="text-sm text-slate-500">No new assignments right now.</p> : null}
                  </div>
                </section>

                <section className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-card p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-slate-900">Active Orders</h3>
                    <button type="button" onClick={() => setTab('orders')} className="text-sm font-bold text-[#003049] hover:underline">
                      View all
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {orders.filter((o) => o.status === 'active').slice(0, 3).map((o) => (
                      <div key={o.apiId} className="rounded-2xl border border-slate-100 p-4 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-900">{o.label} · {o.size}</div>
                          <div className="text-sm text-slate-600">{o.area} · ETA {o.eta}</div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await supplierOrderUpdateStatus(o.apiId, 'COMPLETED', o.paymentStatus === 'cash' ? { payment_collected: true } : undefined);
                              persistOrders(orders.map((x) => (x.apiId === o.apiId ? { ...x, status: 'delivered', eta: 'Delivered' } : x)));
                              toast.success(`Order ${o.label} marked delivered.`);
                              void fetchSupplierBoard(true);
                            } catch {
                              toast.error('Could not update order.');
                            }
                          }}
                          className="rounded-xl bg-[#2A9D8F] text-white px-4 py-2 font-bold hover:opacity-90"
                        >
                          Mark Delivered
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {tab === 'orders' && (
              <section className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-extrabold text-slate-900">Orders</h3>
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'pending', 'active', 'delivered', 'cancelled'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setOrderFilter(s)}
                        className={[
                          'rounded-full px-3 py-1.5 text-xs font-bold border',
                          orderFilter === s ? 'bg-[#003049] text-white border-[#003049]' : 'bg-white text-slate-700 border-slate-200',
                        ].join(' ')}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {filteredOrders.map((o) => (
                    <div key={o.apiId} className="rounded-2xl border border-slate-100 bg-white p-4">
                      <button type="button" className="w-full text-left" onClick={() => setExpandedOrderId(expandedOrderId === o.apiId ? null : o.apiId)}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div className="font-bold text-slate-900">{o.label} · {o.customer} · {o.size}</div>
                          <div className="text-sm font-bold text-[#2A9D8F]">{fmtMoney(o.amount)}</div>
                        </div>
                        <div className="text-sm text-slate-600 mt-1">{o.area} · {o.date}</div>
                      </button>
                      {expandedOrderId === o.apiId && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="text-sm text-slate-700">Address: {o.address}</div>
                          <div className="text-sm text-slate-700 mt-1">Partner phone: {maskPhone(profile.phone)}</div>
                          {o.workflowStatus === 'ASSIGNED' && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await supplierOrderAccept(o.apiId);
                                    toast.success('Order accepted and stock reserved.');
                                    void fetchSupplierBoard(true);
                                  } catch (e) {
                                    toast.error(getApiErrorMessage(e));
                                  }
                                }}
                                className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-black"
                              >
                                Accept order ✓
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await supplierOrderReject(o.apiId, 'Supplier unavailable');
                                    toast.success('Order declined.');
                                    void fetchSupplierBoard(true);
                                  } catch (e) {
                                    toast.error(getApiErrorMessage(e));
                                  }
                                }}
                                className="rounded-xl border border-rose-300 text-rose-700 px-4 py-2 text-sm font-black"
                              >
                                Reject ✗
                              </button>
                            </div>
                          )}
                          {o.workflowStatus === 'ASSIGNED' && o.acceptedAt && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await supplierOrderUpdateStatus(o.apiId, 'IN_PROGRESS');
                                    toast.success('Delivery started.');
                                    void fetchSupplierBoard(true);
                                  } catch (e) {
                                    toast.error(getApiErrorMessage(e));
                                  }
                                }}
                                className="rounded-xl bg-[#2A9D8F] text-white px-4 py-2 text-sm font-black"
                              >
                                Start delivery →
                              </button>
                            </div>
                          )}
                          {o.status === 'active' && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await supplierOrderUpdateStatus(o.apiId, 'COMPLETED');
                                    persistOrders(orders.map((x) => (x.apiId === o.apiId ? { ...x, status: 'delivered', eta: 'Delivered' } : x)));
                                    toast.success('Marked complete.');
                                    void fetchSupplierBoard(true);
                                  } catch {
                                    toast.error('Could not complete order.');
                                  }
                                }}
                                className="rounded-xl bg-[#003049] text-white px-4 py-2 text-sm font-bold"
                              >
                                Mark complete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {tab === 'fleet' && (
              <section className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-card p-6">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.18em] text-[#2A9D8F]">Live fleet</p>
                    <h3 className="mt-1 text-xl font-extrabold text-slate-900">Vehicles available for fulfilment</h3>
                    <p className="mt-1 text-sm text-slate-500">Fleet records are stored in the supplier database and can be used by operations for dispatch capacity.</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{fleet.length} vehicle{fleet.length === 1 ? '' : 's'}</div>
                </div>

                <div className="mt-6 space-y-3">
                  {fleet.map((vehicle) => (
                    <div key={vehicle.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="grid gap-3 md:grid-cols-[1.1fr_.8fr_.7fr_.9fr_auto] md:items-center">
                        <div>
                          <div className="font-black text-slate-900">{vehicle.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{vehicle.vehicle_type} · {vehicle.capacity_cans} can capacity · {vehicle.plate_number ?? 'Plate not added'}</div>
                        </div>
                        <div className="text-sm text-slate-700">
                          <span className="font-bold">Driver</span><br />
                          {vehicle.driver_name ?? 'Unassigned'}
                        </div>
                        <select
                          value={vehicle.status}
                          onChange={async (e) => {
                            try {
                              const updated = await supplierFleetUpdate(vehicle.id, { status: e.target.value as import('@/lib/api-client').SupplierFleetItem['status'] });
                              setFleet((prev) => prev.map((x) => x.id === vehicle.id ? updated : x));
                            } catch (err) {
                              toast.error(getApiErrorMessage(err));
                            }
                          }}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                        >
                          <option value="available">Available</option>
                          <option value="in_use">In use</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="offline">Offline</option>
                        </select>
                        <div className="text-sm text-slate-600">Updated {new Date(vehicle.updated_at).toLocaleString('en-IN')}</div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await supplierFleetDelete(vehicle.id);
                              setFleet((prev) => prev.filter((x) => x.id !== vehicle.id));
                              toast.success('Vehicle removed.');
                            } catch (err) {
                              toast.error(getApiErrorMessage(err));
                            }
                          }}
                          className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {fleet.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                      <p className="font-black text-slate-900">No vehicle registered yet</p>
                      <p className="mt-1 text-sm text-slate-500">Add the vehicle you actually use for AuroWater deliveries.</p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="font-black text-slate-900">Add delivery vehicle</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <input placeholder="Vehicle name" value={newTanker.name} onChange={(e) => setNewTanker((x) => ({ ...x, name: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                    <input placeholder="Type e.g. Mini-truck" value={newTanker.vehicleType} onChange={(e) => setNewTanker((x) => ({ ...x, vehicleType: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                    <input type="number" min={1} max={5000} placeholder="Can capacity" value={newTanker.capacity} onChange={(e) => setNewTanker((x) => ({ ...x, capacity: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                    <input placeholder="Plate number" value={newTanker.plateNumber} onChange={(e) => setNewTanker((x) => ({ ...x, plateNumber: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                    <input placeholder="Driver name" value={newTanker.driverName} onChange={(e) => setNewTanker((x) => ({ ...x, driverName: e.target.value }))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const name = newTanker.name.trim();
                      const capacity = Math.floor(Number(newTanker.capacity));
                      if (name.length < 2) return toast.error('Enter vehicle name.');
                      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000) return toast.error('Enter a valid can capacity.');
                      try {
                        const created = await supplierFleetCreate({
                          name,
                          vehicle_type: newTanker.vehicleType.trim() || 'Vehicle',
                          capacity_cans: capacity,
                          plate_number: newTanker.plateNumber.trim() || null,
                          driver_name: newTanker.driverName.trim() || null,
                          status: 'available',
                        });
                        setFleet((prev) => [...prev, created]);
                        setNewTanker({ name: '', vehicleType: 'Bike', capacity: '20', plateNumber: '', driverName: '' });
                        toast.success('Vehicle added.');
                      } catch (err) {
                        toast.error(getApiErrorMessage(err));
                      }
                    }}
                    className="mt-4 rounded-xl bg-[#003049] px-5 py-3 text-sm font-black text-white"
                  >
                    Add vehicle
                  </button>
                </div>
              </section>
            )}

            {tab === 'revenue' && (
              <section className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-card p-6">
                <h3 className="text-lg font-extrabold text-slate-900">Revenue</h3>
                <p className="text-xs text-slate-500 mt-1">Month figures from platform earnings summary; daily breakdown coming soon.</p>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard title="Today" value="—" color="#003049" />
                  <StatCard title="Week" value="—" color="#2A9D8F" />
                  <StatCard title="Month" value={fmtMoney(stats.monthRevenue)} color="#F4A261" />
                  <StatCard title="Orders (period)" value={`${earningsSummary?.order_count ?? 0}`} color="#1D4ED8" />
                </div>
                {earningsSummary != null && earningsSummary.pending_payout > 0 ? (
                  <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-amber-950">Pending payout</p>
                      <p className="text-lg font-black text-amber-900">{fmtMoney(earningsSummary.pending_payout)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await supplierPayoutRequest({ amount: earningsSummary.pending_payout, notes: 'bank_transfer' });
                          toast.success('Payout request submitted. Processing in 2–3 business days.');
                          void fetchSupplierBoard(true);
                        } catch {
                          toast.error('Could not submit payout request.');
                        }
                      }}
                      className="rounded-xl bg-[#003049] text-white font-bold px-5 py-2.5 text-sm shrink-0"
                    >
                      Request payout
                    </button>
                  </div>
                ) : null}
                <div className="mt-6 flex flex-col md:flex-row gap-6">
                  <div className="w-44 h-44 rounded-full mx-auto md:mx-0 bg-[conic-gradient(#2A9D8F_0_70%,#38BDF8_70%_85%,#F4A261_85%_100%)] grid place-items-center">
                    <div className="w-24 h-24 rounded-full bg-white grid place-items-center">
                      <div className="text-xs text-slate-500">This month</div>
                      <div className="text-sm font-black text-slate-900">{fmtMoney(stats.monthRevenue)}</div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <LegendRow c="#2A9D8F" label="Tanker Delivery" pct="70%" />
                    <LegendRow c="#38BDF8" label="Emergency" pct="15%" />
                    <LegendRow c="#F4A261" label="AMC/Subscription" pct="15%" />
                    <div className="pt-3 text-sm text-slate-600">
                      Payout account: <span className="font-bold text-slate-900">{supplierSettings?.upi_id ?? (supplierSettings?.bank_account ? `Bank ••••${String(supplierSettings.bank_account).slice(-4)}` : 'Not configured')}
                    </div>
                    <button type="button" onClick={() => setTab('profile')} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">
                      Manage payout account
                    </button>
                  </div>
                </div>
              </section>
            )}

            {tab === 'aurotap' && (
              <section className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-card p-6">
                <h3 className="text-lg font-extrabold text-slate-900">My AuroTap ID</h3>
                <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#2A9D8F] to-[#003049] text-white p-5">
                  <div className="text-xs text-white/80">YOUR AUROTAP ID</div>
                  <div className="text-3xl font-black font-mono mt-1">{profile.aurotapId}</div>
                  <div className="mt-2 text-sm text-white/85">
                    Share this with repeat customers as your supplier identity. Orders are assigned through the AuroWater dispatch network.
                  </div>
                </div>
                <div className="mt-5 space-y-2 text-sm text-slate-700">
                  <div>1. Share your ID with customers.</div>
                  <div>2. They mention this ID while booking on AuroWater.</div>
                  <div>3. Orders route directly to your supply network.</div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    className="rounded-xl bg-[#003049] text-white px-4 py-2 text-sm font-bold"
                    onClick={async () => {
                      await navigator.clipboard.writeText(profile.aurotapId);
                      toast.success('ID copied.');
                    }}
                  >
                    Copy ID
                  </button>
                  <a
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold"
                    href={`https://wa.me/${settings.phone_primary.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Share on WhatsApp
                  </a>
                </div>
              </section>
            )}

            {tab === 'profile' && (
              <section className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-card p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.18em] text-[#2A9D8F]">Partner profile</p>
                    <h3 className="mt-1 text-xl font-extrabold text-slate-900">Business & payout identity</h3>
                    <p className="mt-1 text-sm text-slate-500">These fields are stored in your supplier profile. Operational availability and stock are managed separately above.</p>
                  </div>
                  <div className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-black text-emerald-700">
                    {profileSaving ? 'Saving…' : 'Live profile'}
                  </div>
                </div>

                <div className="mt-5 grid sm:grid-cols-2 gap-3">
                  <Input label="Business Name" value={profile.businessName} onChange={(v) => persistProfile({ ...profile, businessName: v })} />
                  <Input label="Owner Name" value={profile.ownerName} onChange={(v) => persistProfile({ ...profile, ownerName: v })} />
                  <Input label="GST Number" value={profile.gstNumber} onChange={(v) => persistProfile({ ...profile, gstNumber: v, gst: v })} />
                  <Input label="Phone" value={profile.phone} onChange={(v) => persistProfile({ ...profile, phone: v })} />
                  <div className="block">
                    <span className="text-xs font-bold text-slate-600">Account email</span>
                    <div className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{profile.email || 'Not available'}</div>
                    <p className="mt-1 text-[11px] text-slate-500">Managed by your authentication account.</p>
                  </div>
                  <Input label="City" value={profile.city} onChange={(v) => persistProfile({ ...profile, city: v, serviceCities: v ? [v] : [] })} />
                  <Input label="Pincode" value={profile.pincode} onChange={(v) => persistProfile({ ...profile, pincode: v })} />
                  <Input label="Vehicle Type" value={profile.vehicleType} onChange={(v) => persistProfile({ ...profile, vehicleType: v })} />
                </div>

                <div className="mt-5 grid sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-bold text-slate-600">Service Radius (km)</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={profile.serviceRadiusKm}
                      onChange={(e) => persistProfile({ ...profile, serviceRadiusKm: Number(e.target.value || 1) })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">AuroTap ID</p>
                    <p className="mt-1 font-mono font-black text-slate-900">{session?.aurotapId ?? profile.aurotapId}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-black text-slate-900">Marketplace pricing</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Customer checkout uses the platform pricing engine. The old local-only editable price table is no longer treated as operational pricing.</p>
                </div>

                <button
                  type="button"
                  onClick={() => void saveLiveProfile({
                    business_name: profile.businessName,
                    full_name: profile.ownerName,
                    gst_number: profile.gstNumber,
                    phone: profile.phone,
                    email: profile.email,
                    city: profile.city,
                    pincode: profile.pincode,
                    vehicle_type: profile.vehicleType,
                    service_area_km: Math.min(100, Math.max(1, Math.round(profile.serviceRadiusKm || 1))),
                  })}
                  className="mt-5 rounded-xl bg-[#003049] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                  disabled={profileSaving}
                >
                  {profileSaving ? 'Saving profile…' : 'Save profile'}
                </button>
              </section>
            )}

            {tab === 'documents' && (
              <section className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-card p-6">
                <p className="text-xs font-black uppercase tracking-[.18em] text-[#2A9D8F]">Compliance</p>
                <h3 className="mt-1 text-xl font-extrabold text-slate-900">Supplier verification</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Verification status is controlled by the AuroWater operations team. File storage and document-review workflows are intentionally not simulated in the supplier UI.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  ,,,
                </div>
                <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-black text-amber-950">Operational rule</p>
                  <p className="mt-1 text-sm leading-6 text-amber-900">Do not show a supplier as fully verified until required documents are stored, reviewed and approved by admin.</p>
                </div>
                <button type="button" onClick={() => toast.message('Document verification is handled by the operations team.')} className="mt-5 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-900">
                  Contact operations
                </button>
              </section>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl p-4 shadow-soft">
      <div className="text-xs font-bold text-slate-500">{title}</div>
      <div className="text-xl font-black mt-1" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function LegendRow({ c, label, pct }: { c: string; label: string; pct: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full" style={{ background: c }} />
        <span className="text-sm text-slate-700">{label}</span>
      </div>
      <span className="text-sm font-bold text-slate-900">{pct}</span>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
    </label>
  );
}

