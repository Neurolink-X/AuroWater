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
  supplierEarningsSummary,
  supplierPayoutRequest,
  supplierSettingsGet,
  supplierSettingsUpdate,
  supplierStockGet,
  supplierStockUpdate,
  supplierProfileGet,
  supplierProfileUpdate,
  supplierFleetList,
  supplierFleetCreate,
  supplierFleetUpdate,
  supplierFleetDelete,
  supplierDocumentsList,
  supplierDocumentUpload,
  supplierDocumentUrl,
  supplierDocumentDelete,
  getApiErrorMessage,
  type ApiOrder,
  type SupplierEarningsSummary,
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
  customerPhone?: string | null;
  area: string;
  address: string;
  size: string;
  date: string;
  eta: string;
  amount: number;
  status: 'pending' | 'active' | 'delivered' | 'cancelled';
  phase: 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'pending';
};

function mapApiOrderToSupplierOrder(o: ApiOrder): SupplierOrder {
  const snap = (o.address_snapshot ?? {}) as Record<string, unknown>;
  const area = [snap.area, snap.city].filter(Boolean).join(', ') || '—';
  const addr = [snap.house_flat, snap.area, snap.city, snap.pincode].filter(Boolean).join(', ') || '—';
  const st = String(o.status ?? '').toUpperCase();
  let status: SupplierOrder['status'] = 'pending';
  if (st === 'IN_PROGRESS' || (st === 'ASSIGNED' && Boolean(o.accepted_at))) status = 'active';
  else if (st === 'COMPLETED') status = 'delivered';
  else if (st === 'CANCELLED') status = 'cancelled';
  else status = 'pending';

  const sk = String(o.service_type_key ?? '').toLowerCase();
  let size = 'Service';
  if (sk === 'water_can') {
    const qty = Math.max(1, Number(o.can_quantity ?? 1));
    size = `20L cans × ${qty}`;
  } else if (sk.includes('1000')) size = '1000L tanker';
  else if (sk.includes('5000')) size = '5000L tanker';
  else if (sk.includes('10000')) size = '10000L tanker';
  else if (sk.includes('3000')) size = '3000L tanker';

  return {
    apiId: o.id,
    label: String(o.order_number ?? o.id).slice(0, 32),
    customer: String(o.customer_name ?? 'Customer'),
    customerPhone: o.customer_phone ?? null,
    area,
    address: addr,
    size,
    date: String(o.scheduled_date ?? (typeof o.created_at === 'string' ? o.created_at.slice(0, 10) : '—')),
    eta: String(o.time_slot ?? '—'),
    amount: Number(o.supplier_payout ?? o.total_amount ?? 0),
    status,
    phase:
      st === 'IN_PROGRESS'
        ? 'in_progress'
        : st === 'COMPLETED'
          ? 'completed'
          : st === 'CANCELLED'
            ? 'cancelled'
            : st === 'ASSIGNED'
              ? o.accepted_at
                ? 'assigned'
                : 'pending'
              : 'pending',
  };
}

type Tanker = {
  id: string;
  vehicleNumber: string;
  name: string;
  size: '1000L' | '3000L' | '5000L' | '10000L';
  status: 'available' | 'in_use' | 'maintenance';
  price: number;
  driver: string;
};

type SupplierProfile = {
  businessName: string;
  ownerName: string;
  gst: string;
  phone: string;
  email: string;
  serviceCities: string[];
  aurotapId: string;
  prices: Record<'1000L' | '3000L' | '5000L', number>;
};

type SupplierDoc = {
  key: string;
  label: string;
  required: boolean;
  documentId?: string;
  fileName?: string;
  fileSizeKb?: number;
  status: 'not_uploaded' | 'submitted' | 'verified' | 'rejected';
  rejectionReason?: string | null;
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

function mapApiProfile(
  p: Awaited<ReturnType<typeof supplierProfileGet>>,
): SupplierProfile {
  const price = 0;
  return {
    businessName: p.business_name ?? '',
    ownerName: p.full_name ?? '',
    gst: p.gstin ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    serviceCities: p.service_cities ?? [],
    aurotapId: p.aurotap_id ?? '',
    prices: {
      '1000L': price,
      '3000L': price,
      '5000L': price,
    },
  };
}

function mapApiFleet(
  rows: Awaited<ReturnType<typeof supplierFleetList>>,
): Tanker[] {
  return rows.map((row) => ({
    id: row.id,
    vehicleNumber: row.vehicle_number,
    name: row.vehicle_name ?? `Vehicle ${row.vehicle_number}`,
    size:
      row.capacity_litres >= 10000
        ? '10000L'
        : row.capacity_litres >= 5000
          ? '5000L'
          : row.capacity_litres >= 3000
            ? '3000L'
            : '1000L',
    status:
      row.status === 'inactive'
        ? 'maintenance'
        : row.status === 'in_use' || row.status === 'maintenance' || row.status === 'available'
          ? row.status
          : 'available',
    price: Number(row.price_per_trip ?? 0),
    driver: row.driver_name ?? '',
  }));
}

function mapDocs(
  rows: Awaited<ReturnType<typeof supplierDocumentsList>>,
): SupplierDoc[] {
  const definitions = seedDocs();
  return definitions.map((definition) => {
    const row = rows.find((item) => item.document_type === definition.key);
    return row ? mapApiDocument(row, definition) : definition;
  });
}

function seedProfile(session?: { name?: string; email?: string; phone?: string; aurotapId?: string }): SupplierProfile {
  return {
    businessName: '',
    ownerName: session?.name ?? '',
    gst: '',
    phone: session?.phone ?? '',
    email: session?.email ?? '',
    serviceCities: [],
    aurotapId: session?.aurotapId ?? '',
    prices: {
      '1000L': 0,
      '3000L': 0,
      '5000L': 0,
    },
  };
}

function seedDocs(): SupplierDoc[] {
  return [
    { key: 'gst', label: 'GST Certificate', required: true, status: 'not_uploaded' },
    { key: 'reg', label: 'Business Registration', required: true, status: 'not_uploaded' },
    { key: 'aadhaar', label: 'Owner Aadhaar', required: true, status: 'not_uploaded' },
    { key: 'insurance', label: 'Fleet Insurance', required: true, status: 'not_uploaded' },
    { key: 'bank', label: 'Bank Statement', required: true, status: 'not_uploaded' },
  ];
}

export default function SupplierDashboardPage() {
  const { settings } = useSettings();
  const { session, hydrated: authHydrated, isLoggedIn, isSupplier } = useAuth();
  const [tab, setTab] = React.useState<TabKey>('overview');
  const [orders, setOrders] = React.useState<SupplierOrder[]>([]);
  const [earningsSummary, setEarningsSummary] = React.useState<SupplierEarningsSummary | null>(null);
  const [todayEarnings, setTodayEarnings] = React.useState<SupplierEarningsSummary | null>(null);
  const [weekEarnings, setWeekEarnings] = React.useState<SupplierEarningsSummary | null>(null);
  const [supplierSettings, setSupplierSettings] = React.useState<Awaited<ReturnType<typeof supplierSettingsGet>>>(null);
  const [stock, setStock] = React.useState<Awaited<ReturnType<typeof supplierStockGet>> | null>(null);
  const [stockInput, setStockInput] = React.useState('');
  const [stockSaving, setStockSaving] = React.useState(false);
  const [settingsSaving, setSettingsSaving] = React.useState(false);
  const [ordersLoading, setOrdersLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [fleet, setFleet] = React.useState<Tanker[]>([]);
  const [profile, setProfile] = React.useState<SupplierProfile>(() => seedProfile(session ?? undefined));
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [docs, setDocs] = React.useState<SupplierDoc[]>([]);
  const [documentsSaving, setDocumentsSaving] = React.useState(false);
  const [orderFilter, setOrderFilter] = React.useState<'all' | 'pending' | 'active' | 'delivered' | 'cancelled'>('all');
  const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(null);
  const [newTanker, setNewTanker] = React.useState({ id: '', size: '3000L' as Tanker['size'], price: '399', driver: '' });
  const [boardError, setBoardError] = React.useState<string | null>(null);

  const fetchSupplierBoard = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setBoardError(null);
    try {
      const [list, monthEarn, todayEarn, weekEarn, settingsResult, stockResult, profileResult, fleetResult, documentsResult] = await Promise.allSettled([
        supplierOrdersList(),
        supplierEarningsSummary('month'),
        supplierEarningsSummary('today'),
        supplierEarningsSummary('week'),
        supplierSettingsGet(),
        supplierStockGet(),
        supplierProfileGet(),
        supplierFleetList(),
        supplierDocumentsList(),
      ]);

      let primaryErr: string | null = null;

      if (list.status === 'fulfilled') {
        setOrders((list.value ?? []).map(mapApiOrderToSupplierOrder));
      } else {
        primaryErr = getApiErrorMessage(list.reason);
      }

      if (monthEarn.status === 'fulfilled' && monthEarn.value) {
        setEarningsSummary(monthEarn.value);
      } else if (monthEarn.status === 'rejected' && !primaryErr) {
        toast.error(`Could not load earnings: ${getApiErrorMessage(monthEarn.reason)}`);
      }
      if (todayEarn.status === 'fulfilled' && todayEarn.value) setTodayEarnings(todayEarn.value);
      if (weekEarn.status === 'fulfilled' && weekEarn.value) setWeekEarnings(weekEarn.value);

      if (settingsResult.status === 'fulfilled') {
        setSupplierSettings(settingsResult.value);
      } else if (!primaryErr) {
        toast.error(`Could not load supplier settings: ${getApiErrorMessage(settingsResult.reason)}`);
      }

      if (stockResult.status === 'fulfilled') {
        setStock(stockResult.value);
      } else if (!primaryErr) {
        toast.error(`Could not load stock: ${getApiErrorMessage(stockResult.reason)}`);
      }

      if (profileResult.status === 'fulfilled') {
        setProfile(mapApiProfile(profileResult.value));
      } else if (!primaryErr) {
        toast.error(`Could not load supplier profile: ${getApiErrorMessage(profileResult.reason)}`);
      }

      if (fleetResult.status === 'fulfilled') {
        setFleet(mapApiFleet(fleetResult.value));
      } else if (!primaryErr) {
        toast.error(`Could not load fleet: ${getApiErrorMessage(fleetResult.reason)}`);
      }

      if (documentsResult.status === 'fulfilled') {
        setDocs(mapDocs(documentsResult.value));
      } else if (!primaryErr) {
        toast.error(`Could not load documents: ${getApiErrorMessage(documentsResult.reason)}`);
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

  const persistOrders = (next: SupplierOrder[]) => setOrders(next);

  const persistProfile = (next: SupplierProfile) => setProfile(next);

  const saveProfile = React.useCallback(async () => {
    setProfileSaving(true);
    try {
      const updated = await supplierProfileUpdate({
        business_name: profile.businessName,
        gstin: profile.gst,
        service_cities: profile.serviceCities,
      });
      setProfile(mapApiProfile(updated));
      toast.success('Supplier profile saved.');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setProfileSaving(false);
    }
  }, [profile]);

  const persistFleet = async (next: Tanker[]) => {
    setFleet(next);
  };

  const persistDocs = (next: SupplierDoc[]) => setDocs(next);

  const filteredOrders = React.useMemo(() => {
    if (orderFilter === 'all') return orders;
    return orders.filter((o) => o.status === orderFilter);
  }, [orders, orderFilter]);

  const stats = React.useMemo(() => {
    const todayKey = new Date().toDateString();
    const todayOrders = orders.filter((o) => {
      if (o.date === '—') return false;
      const parsed = new Date(o.date);
      return !Number.isNaN(parsed.getTime()) && parsed.toDateString() === todayKey;
    }).length;
    const active = orders.filter((o) => o.status === 'active').length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const delivered = orders.filter((o) => o.status === 'delivered').length;
    const monthRevenue =
      earningsSummary != null
        ? earningsSummary.gross_amount
        : orders.filter((o) => o.status === 'delivered').reduce((sum, o) => sum + o.amount, 0);
    return { active, pending, delivered, todayOrders, monthRevenue };
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

  const toggleOnline = React.useCallback(async () => {
    const next = !(supplierSettings?.is_online ?? false);
    setSettingsSaving(true);
    try {
      const updated = await supplierSettingsUpdate({ is_online: next });
      setSupplierSettings(updated);
      toast.success(next ? 'You are now online and eligible for new orders.' : 'You are offline. New orders will not be assigned to you.');
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSettingsSaving(false);
    }
  }, [supplierSettings?.is_online]);

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

              <button
                type="button"
                onClick={() => void toggleOnline()}
                disabled={settingsSaving || supplierSettings == null}
                aria-pressed={supplierSettings?.is_online ?? false}
                className="mt-4 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-extrabold tracking-wide text-white/80">AVAILABILITY</span>
                  <span className={[
                    'rounded-full px-2.5 py-1 text-[11px] font-extrabold',
                    supplierSettings?.is_online ? 'bg-emerald-300 text-emerald-950' : 'bg-slate-200 text-slate-700',
                  ].join(' ')}>
                    {settingsSaving ? 'Updating…' : supplierSettings?.is_online ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/65">
                  {supplierSettings?.is_online ? 'New eligible deliveries may be offered to you.' : 'Go online when you are ready to accept work.'}
                </div>
              </button>

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
                      <div className="mt-2 text-3xl md:text-4xl font-black font-mono">{profile.aurotapId}</div>
                      <div className="mt-2 text-sm text-white/85">
                        Your partner ID is ready. Direct customer routing is enabled by operations for live zones.
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(profile.aurotapId);
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

                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    title="Orders Today"
                    value={ordersLoading ? '…' : `${stats.todayOrders}`}
                    color="#003049"
                  />
                  <StatCard title="Active Deliveries" value={`${stats.active}`} color="#2A9D8F" />
                  <StatCard title="Month Revenue" value={fmtMoney(stats.monthRevenue)} color="#F4A261" />
                  <StatCard title="Available Stock" value={stock ? String(stock.cans_available) : '—'} color="#7C3AED" />
                  <StatCard title="Fleet Available" value={`${fleet.filter((f) => f.status === 'available').length}`} color="#1D4ED8" />
                </section>
                {refreshing ? (
                  <p className="text-xs text-slate-500 -mt-2">Syncing latest orders…</p>
                ) : null}

                <section className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-card p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">Inventory control</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Available cans can be updated here. Reserved cans stay protected while an accepted delivery is active.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={stockInput}
                        onChange={(e) => setStockInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder={stock ? String(stock.cans_available) : '0'}
                        className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
                        aria-label="Available water cans"
                      />
                      <button
                        type="button"
                        disabled={stockSaving || stock == null || stockInput === ''}
                        onClick={async () => {
                          const next = Number(stockInput);
                          if (!Number.isInteger(next) || next < 0) {
                            toast.error('Enter a valid whole-can stock count.');
                            return;
                          }
                          if (next < Number(stock.reserved_cans ?? 0)) {
                            toast.error(`Keep at least ${stock.reserved_cans ?? 0} cans available for accepted orders.`);
                            return;
                          }
                          setStockSaving(true);
                          try {
                            const updated = await supplierStockUpdate({ cans_available: next });
                            setStock(updated);
                            setStockInput('');
                            toast.success('Inventory updated.');
                          } catch (error) {
                            toast.error(getApiErrorMessage(error));
                          } finally {
                            setStockSaving(false);
                          }
                        }}
                        className="rounded-xl bg-[#003049] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {stockSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Available</div>
                      <div className="mt-1 text-lg font-black text-slate-900">{stock?.cans_available ?? '—'}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Reserved</div>
                      <div className="mt-1 text-lg font-black text-amber-700">{stock?.reserved_cans ?? 0}</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Low stock at</div>
                      <div className="mt-1 text-lg font-black text-rose-700">{stock?.low_stock_alert ?? 10}</div>
                    </div>
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
                              await supplierOrderUpdateStatus(o.apiId, 'COMPLETED');
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
                          {o.customerPhone && o.status !== 'pending' ? (
                            <a href={`tel:${o.customerPhone}`} className="text-sm font-bold text-[#003049] mt-1 inline-flex hover:underline">
                              Customer: {o.customerPhone}
                            </a>
                          ) : null}
                          {o.status === 'pending' && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await supplierOrderAccept(o.apiId);
                                    toast.success('Order accepted and stock reserved.');
                                    void fetchSupplierBoard(true);
                                  } catch (error) {
                                    toast.error(getApiErrorMessage(error));
                                  }
                                }}
                                className="rounded-xl bg-[#2A9D8F] text-white px-4 py-2 text-sm font-bold"
                              >
                                Accept order ✓
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await supplierOrderReject(o.apiId, 'Supplier declined');
                                    toast.success('Order declined. We are finding another supplier.');
                                    void fetchSupplierBoard(true);
                                  } catch (error) {
                                    toast.error(getApiErrorMessage(error));
                                  }
                                }}
                                className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 px-4 py-2 text-sm font-bold"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          {o.status === 'active' && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    if (o.phase === 'assigned') {
                                      await supplierOrderUpdateStatus(o.apiId, 'IN_PROGRESS');
                                      toast.success('Delivery started.');
                                    } else {
                                      await supplierOrderUpdateStatus(o.apiId, 'COMPLETED');
                                      toast.success('Order completed.');
                                    }
                                    void fetchSupplierBoard(true);
                                  } catch (error) {
                                    toast.error(getApiErrorMessage(error));
                                  }
                                }}
                                className="rounded-xl bg-[#003049] text-white px-4 py-2 text-sm font-bold"
                              >
                                {o.phase === 'assigned' ? 'Start delivery →' : 'Mark complete ✓'}
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
                <h3 className="text-lg font-extrabold text-slate-900">Fleet</h3>
                <div className="mt-4 grid md:grid-cols-2 gap-4">
                  {fleet.map((t) => (
                    <div key={t.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">{t.name}</div>
                          <div className="text-sm text-slate-600">{t.vehicleNumber} · {t.size}</div>
                        </div>
                        <select
                          value={t.status}
                          onChange={async (e) => {
                            const status = e.target.value as Tanker['status'];
                            try {
                              const updated = await supplierFleetUpdate(t.id, { status });
                              setFleet((prev) => prev.map((x) => (
                                x.id === t.id
                                  ? { ...x, status: updated.status === 'inactive' ? 'maintenance' : updated.status }
                                  : x
                              )));
                              toast.success('Fleet status updated.');
                            } catch (error) {
                              toast.error(getApiErrorMessage(error));
                            }
                          }}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        >
                          <option value="available">Available</option>
                          <option value="in_use">In Use</option>
                          <option value="maintenance">Maintenance</option>
                        </select>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-sm text-slate-600">Price</span>
                        <input
                          value={t.price}
                          type="number"
                          min="0"
                          onChange={(e) => {
                            const p = Number(e.target.value || 0);
                            setFleet((prev) => prev.map((x) => (x.id === t.id ? { ...x, price: p } : x)));
                          }}
                          onBlur={async () => {
                            try {
                              const updated = await supplierFleetUpdate(t.id, { price_per_trip: Math.max(0, t.price) });
                              setFleet((prev) => prev.map((x) => (x.id === t.id ? { ...x, price: Number(updated.price_per_trip ?? 0) } : x)));
                            } catch (error) {
                              toast.error(getApiErrorMessage(error));
                            }
                          }}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        />
                        <span className="text-sm text-slate-600">Driver: {t.driver || 'Unassigned'}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await supplierFleetDelete(t.id);
                              setFleet((prev) => prev.filter((x) => x.id !== t.id));
                              toast.success('Vehicle removed.');
                            } catch (error) {
                              toast.error(getApiErrorMessage(error));
                            }
                          }}
                          className="ml-auto rounded-lg border border-rose-200 px-2 py-1 text-xs font-bold text-rose-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="font-bold text-slate-900">+ Add Tanker</div>
                  <div className="mt-3 grid sm:grid-cols-4 gap-3">
                    <input
                      placeholder="Tanker ID"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={newTanker.id}
                      onChange={(e) => setNewTanker((x) => ({ ...x, id: e.target.value }))}
                    />
                    <select
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={newTanker.size}
                      onChange={(e) => setNewTanker((x) => ({ ...x, size: e.target.value as Tanker['size'] }))}
                    >
                      <option>1000L</option>
                      <option>3000L</option>
                      <option>5000L</option>
                      <option>10000L</option>
                    </select>
                    <input
                      placeholder="Price"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={newTanker.price}
                      onChange={(e) => setNewTanker((x) => ({ ...x, price: e.target.value }))}
                    />
                    <input
                      placeholder="Driver"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={newTanker.driver}
                      onChange={(e) => setNewTanker((x) => ({ ...x, driver: e.target.value }))}
                    />
                  </div>
                  <button
                    type="button"
                    className="mt-3 rounded-xl bg-[#003049] text-white px-4 py-2 text-sm font-bold"
                    onClick={async () => {
                      if (!newTanker.id.trim()) {
                        toast.error('Enter vehicle number');
                        return;
                      }
                      const price = Number(newTanker.price || 0);
                      if (!Number.isFinite(price) || price < 0) {
                        toast.error('Enter a valid trip price');
                        return;
                      }
                      const capacity = Number(newTanker.size.replace('L', ''));
                      try {
                        const created = await supplierFleetCreate({
                          vehicle_number: newTanker.id.trim().toUpperCase(),
                          vehicle_name: `Tanker ${newTanker.id.trim().toUpperCase()}`,
                          capacity_litres: capacity,
                          driver_name: newTanker.driver || undefined,
                          price_per_trip: price,
                        });
                        setFleet((prev) => [mapApiFleet([created])[0], ...prev]);
                        setNewTanker({ id: '', size: '3000L', price: '399', driver: '' });
                        toast.success('Tanker added to fleet.');
                      } catch (error) {
                        toast.error(getApiErrorMessage(error));
                      }
                    }}
                  >
                    Add to Fleet
                  </button>
                </div>
              </section>
            )}

            {tab === 'revenue' && (
              <section className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-card p-6">
                <h3 className="text-lg font-extrabold text-slate-900">Revenue</h3>
                <p className="text-xs text-slate-500 mt-1">Month figures from platform earnings summary; daily breakdown coming soon.</p>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard title="Today" value={fmtMoney(todayEarnings?.gross_amount ?? 0)} color="#003049" />
                  <StatCard title="Week" value={fmtMoney(weekEarnings?.gross_amount ?? 0)} color="#2A9D8F" />
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
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="text-xs font-bold text-slate-500">Completed orders</div>
                    <div className="mt-1 text-2xl font-black text-slate-900">{earningsSummary?.order_count ?? 0}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="text-xs font-bold text-slate-500">Available to request</div>
                    <div className="mt-1 text-2xl font-black text-emerald-700">{fmtMoney(earningsSummary?.pending_payout ?? 0)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="text-xs font-bold text-slate-500">Payout destination</div>
                    <div className="mt-1 text-sm font-black text-slate-900">
                      {supplierSettings?.upi_id
                        ? supplierSettings.upi_id
                        : supplierSettings?.bank_account
                          ? `Bank •••• ${String(supplierSettings.bank_account).slice(-4)}`
                          : 'Not configured'}
                    </div>
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
                    Keep this partner ID for operations and customer support. Direct routing is enabled only when the zone is activated.
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
                <h3 className="text-lg font-extrabold text-slate-900">Profile</h3>
                <div className="mt-4 grid sm:grid-cols-2 gap-3">
                  <Input label="Business Name" value={profile.businessName} onChange={(v) => persistProfile({ ...profile, businessName: v })} />
                  <Input label="Owner Name" value={profile.ownerName} onChange={(v) => persistProfile({ ...profile, ownerName: v })} />
                  <Input label="GST" value={profile.gst} onChange={(v) => persistProfile({ ...profile, gst: v })} />
                  <Input label="Phone" value={profile.phone} onChange={(v) => persistProfile({ ...profile, phone: v })} />
                  <Input label="Email" value={profile.email} onChange={(v) => persistProfile({ ...profile, email: v })} />
                </div>

                <div className="mt-5">
                  <div className="text-sm font-bold text-slate-800">Service Cities</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CITIES.map((c) => {
                      const active = profile.serviceCities.includes(c);
                      return (
                        <button
                          key={c}
                          onClick={() => {
                            const next = active
                              ? profile.serviceCities.filter((x) => x !== c)
                              : [...profile.serviceCities, c];
                            persistProfile({ ...profile, serviceCities: next });
                          }}
                          className={[
                            'rounded-full px-3 py-1.5 text-xs font-bold border',
                            active ? 'bg-[#003049] text-white border-[#003049]' : 'bg-white text-slate-700 border-slate-200',
                          ].join(' ')}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4">
                  <div className="text-sm font-bold text-slate-900">Pricing Table</div>
                  <div className="mt-3 space-y-2 text-sm">
                    {(['1000L', '3000L', '5000L'] as const).map((size) => {
                      const supplierPrice = profile.prices[size];
                      const platformFee = 29;
                      const customerPays = supplierPrice + platformFee;
                      return (
                        <div key={size} className="grid grid-cols-4 gap-2 items-center">
                          <div className="font-semibold text-slate-700">{size}</div>
                          <input
                            value={supplierPrice}
                            onChange={(e) => {
                              const val = Number(e.target.value || 0);
                              persistProfile({ ...profile, prices: { ...profile.prices, [size]: val } });
                            }}
                            className="rounded-lg border border-slate-200 px-2 py-1"
                          />
                          <div className="text-slate-600">₹{platformFee}</div>
                          <div className="font-bold text-[#2A9D8F]">₹{customerPays}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-sm font-bold text-slate-800">Profile completion: {completion}%</div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-[#2A9D8F] transition-all" style={{ width: `${completion}%` }} />
                  </div>
                </div>
              </section>
            )}

            {tab === 'documents' && (
              <section className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white shadow-card p-6">
                <h3 className="text-lg font-extrabold text-slate-900">Documents</h3>
                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  {docs.map((d) => (
                    <div key={d.key} className="rounded-2xl border border-[#2A9D8F]/20 border-dashed bg-white p-4">
                      <div className="font-bold text-slate-900">{d.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{d.required ? 'Required' : 'Optional'} · JPG, PNG, PDF (max 5MB)</div>
                      <div className="mt-3 text-sm text-slate-700">
                        {d.fileName ? `${d.fileName} (${d.fileSizeKb} KB)` : 'No file selected'}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <StatusBadge status={d.status} />
                        <button
                          className="text-xs font-bold text-[#003049] hover:underline"
                          onClick={() => {
                            const next = docs.map((x) =>
                              x.key === d.key
                                ? { ...x, fileName: `${d.key}_doc.pdf`, fileSizeKb: 420, status: 'submitted' as const }
                                : x
                            );
                            persistDocs(next);
                            toast.success(`${d.label} uploaded`);
                          }}
                        >
                          Upload
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="mt-5 rounded-xl bg-[#003049] text-white px-5 py-3 text-sm font-bold"
                  disabled={docs.some((d) => d.required && d.status === 'not_uploaded')}
                  onClick={() => toast.success('Documents submitted for verification.')}
                >
                  Submit for Verification
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

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
    </label>
  );
}

function StatusBadge({ status }: { status: SupplierDoc['status'] }) {
  if (status === 'verified') return <span className="text-xs font-bold rounded-full px-3 py-1 bg-emerald-100 text-emerald-700">✓ Verified</span>;
  if (status === 'submitted') return <span className="text-xs font-bold rounded-full px-3 py-1 bg-blue-100 text-blue-700">↑ Submitted</span>;
  if (status === 'rejected') return <span className="text-xs font-bold rounded-full px-3 py-1 bg-rose-100 text-rose-700">✗ Rejected</span>;
  return <span className="text-xs font-bold rounded-full px-3 py-1 bg-slate-100 text-slate-600">○ Not uploaded</span>;
}

