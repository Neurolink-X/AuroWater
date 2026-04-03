'use client';

import React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';

type TabKey =
  | 'overview'
  | 'orders'
  | 'fleet'
  | 'revenue'
  | 'aurotap'
  | 'profile'
  | 'documents';

type SupplierOrder = {
  id: string;
  customer: string;
  area: string;
  address: string;
  size: '1000L' | '3000L' | '5000L' | '10000L';
  date: string;
  eta: string;
  amount: number;
  status: 'pending' | 'active' | 'delivered' | 'cancelled';
};

type Tanker = {
  id: string;
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
  fileName?: string;
  fileSizeKb?: number;
  status: 'not_uploaded' | 'submitted' | 'verified' | 'rejected';
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

const ORDER_KEY = 'aurowater_supplier_orders';
const FLEET_KEY = 'aurowater_supplier_fleet';
const PROFILE_KEY = 'aurowater_supplier_profile';
const DOCS_KEY = 'aurowater_supplier_docs';

const fmtMoney = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const maskPhone = (p: string) => (p.length < 6 ? p : `${p.slice(0, 2)}XXXXXX${p.slice(-2)}`);

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function seedOrders(): SupplierOrder[] {
  return [
    {
      id: 'AW-00000034',
      customer: 'Priya Sharma',
      area: 'Barra, Kanpur',
      address: 'Flat 402, Barra 8, Kanpur 208027',
      size: '3000L',
      date: '2026-04-12',
      eta: '45 min',
      amount: 429,
      status: 'active',
    },
    {
      id: 'AW-00000035',
      customer: 'Rajesh Kumar',
      area: 'Civil Lines, Kanpur',
      address: '19 Civil Lines, Near Post Office',
      size: '5000L',
      date: '2026-04-12',
      eta: '70 min',
      amount: 629,
      status: 'pending',
    },
    {
      id: 'AW-00000036',
      customer: 'Anita Mishra',
      area: 'Kidwai Nagar, Kanpur',
      address: 'H-21, Kidwai Nagar, Kanpur',
      size: '1000L',
      date: '2026-04-11',
      eta: 'Delivered',
      amount: 329,
      status: 'delivered',
    },
  ];
}

function seedFleet(): Tanker[] {
  return [
    { id: 'TK-001', name: 'Tanker Alpha', size: '3000L', status: 'available', price: 399, driver: 'Ramesh Kumar' },
    { id: 'TK-002', name: 'Tanker Beta', size: '5000L', status: 'in_use', price: 599, driver: 'Suresh Pal' },
    { id: 'TK-003', name: 'Tanker Gamma', size: '1000L', status: 'available', price: 299, driver: 'Mahesh Singh' },
  ];
}

function seedProfile(): SupplierProfile {
  return {
    businessName: 'Auro Water Kanpur',
    ownerName: 'Arjun Chaurasiya',
    gst: '09ABCDE1234F1Z5',
    phone: '9889305803',
    email: 'supplier@aurowater.in',
    serviceCities: ['Kanpur', 'Lucknow'],
    aurotapId: '9889305803@aurotap',
    prices: {
      '1000L': 299,
      '3000L': 399,
      '5000L': 599,
    },
  };
}

function seedDocs(): SupplierDoc[] {
  return [
    { key: 'gst', label: 'GST Certificate', required: true, status: 'submitted', fileName: 'gst_cert.pdf', fileSizeKb: 381 },
    { key: 'reg', label: 'Business Registration', required: true, status: 'not_uploaded' },
    { key: 'aadhaar', label: 'Owner Aadhaar', required: true, status: 'verified', fileName: 'aadhaar_owner.jpg', fileSizeKb: 812 },
    { key: 'insurance', label: 'Fleet Insurance', required: true, status: 'not_uploaded' },
    { key: 'bank', label: 'Bank Statement', required: true, status: 'not_uploaded' },
  ];
}

export default function SupplierDashboardPage() {
  const { settings } = useSettings();
  const [tab, setTab] = React.useState<TabKey>('overview');
  const [orders, setOrders] = React.useState<SupplierOrder[]>([]);
  const [fleet, setFleet] = React.useState<Tanker[]>([]);
  const [profile, setProfile] = React.useState<SupplierProfile>(seedProfile());
  const [docs, setDocs] = React.useState<SupplierDoc[]>([]);
  const [orderFilter, setOrderFilter] = React.useState<'all' | 'pending' | 'active' | 'delivered' | 'cancelled'>('all');
  const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(null);
  const [newTanker, setNewTanker] = React.useState({ id: '', size: '3000L' as Tanker['size'], price: '399', driver: '' });

  React.useEffect(() => {
    const o = safeParse<SupplierOrder[]>(localStorage.getItem(ORDER_KEY));
    const f = safeParse<Tanker[]>(localStorage.getItem(FLEET_KEY));
    const p = safeParse<SupplierProfile>(localStorage.getItem(PROFILE_KEY));
    const d = safeParse<SupplierDoc[]>(localStorage.getItem(DOCS_KEY));

    const nextOrders = Array.isArray(o) && o.length ? o : seedOrders();
    const nextFleet = Array.isArray(f) && f.length ? f : seedFleet();
    const nextProfile = p ?? seedProfile();
    const nextDocs = Array.isArray(d) && d.length ? d : seedDocs();

    setOrders(nextOrders);
    setFleet(nextFleet);
    setProfile(nextProfile);
    setDocs(nextDocs);

    localStorage.setItem(ORDER_KEY, JSON.stringify(nextOrders));
    localStorage.setItem(FLEET_KEY, JSON.stringify(nextFleet));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
    localStorage.setItem(DOCS_KEY, JSON.stringify(nextDocs));
  }, []);

  const persistOrders = (next: SupplierOrder[]) => {
    setOrders(next);
    localStorage.setItem(ORDER_KEY, JSON.stringify(next));
  };
  const persistFleet = (next: Tanker[]) => {
    setFleet(next);
    localStorage.setItem(FLEET_KEY, JSON.stringify(next));
  };
  const persistProfile = (next: SupplierProfile) => {
    setProfile(next);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  };
  const persistDocs = (next: SupplierDoc[]) => {
    setDocs(next);
    localStorage.setItem(DOCS_KEY, JSON.stringify(next));
  };

  const filteredOrders = React.useMemo(() => {
    if (orderFilter === 'all') return orders;
    return orders.filter((o) => o.status === orderFilter);
  }, [orders, orderFilter]);

  const stats = React.useMemo(() => {
    const active = orders.filter((o) => o.status === 'active').length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const delivered = orders.filter((o) => o.status === 'delivered').length;
    const monthRevenue = orders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + o.amount, 0);
    return { active, pending, delivered, monthRevenue };
  }, [orders]);

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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,#dbeafe_0%,#eff6ff_35%,#f8fafc_100%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
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
                      <div className="mt-2 text-3xl md:text-4xl font-black font-mono">{profile.aurotapId}</div>
                      <div className="mt-2 text-sm text-white/85">
                        Customers can order directly using your AuroTap ID.
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
                  <StatCard title="Orders Today" value={`${stats.pending + stats.active}`} color="#003049" />
                  <StatCard title="Active Deliveries" value={`${stats.active}`} color="#2A9D8F" />
                  <StatCard title="Month Revenue" value={fmtMoney(stats.monthRevenue)} color="#F4A261" />
                  <StatCard title="Fleet Available" value={`${fleet.filter((f) => f.status === 'available').length}`} color="#1D4ED8" />
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
                      <div key={o.id} className="rounded-2xl border border-slate-100 p-4 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-900">{o.id} · {o.size}</div>
                          <div className="text-sm text-slate-600">{o.area} · ETA {o.eta}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            persistOrders(orders.map((x) => (x.id === o.id ? { ...x, status: 'delivered', eta: 'Delivered' } : x)));
                            toast.success(`Order ${o.id} marked delivered.`);
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
                    <div key={o.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                      <button className="w-full text-left" onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div className="font-bold text-slate-900">{o.id} · {o.customer} · {o.size}</div>
                          <div className="text-sm font-bold text-[#2A9D8F]">{fmtMoney(o.amount)}</div>
                        </div>
                        <div className="text-sm text-slate-600 mt-1">{o.area} · {o.date}</div>
                      </button>
                      {expandedOrderId === o.id && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="text-sm text-slate-700">Address: {o.address}</div>
                          <div className="text-sm text-slate-700 mt-1">Contact: {maskPhone(profile.phone)}</div>
                          {o.status === 'pending' && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => {
                                  persistOrders(orders.map((x) => (x.id === o.id ? { ...x, status: 'active' } : x)));
                                  toast.success('Order accepted!');
                                }}
                                className="rounded-xl bg-[#2A9D8F] text-white px-4 py-2 text-sm font-bold"
                              >
                                Accept Order ✓
                              </button>
                              <button
                                onClick={() => {
                                  persistOrders(orders.map((x) => (x.id === o.id ? { ...x, status: 'cancelled' } : x)));
                                  toast.error('Order rejected.');
                                }}
                                className="rounded-xl border border-rose-300 text-rose-700 px-4 py-2 text-sm font-bold"
                              >
                                Reject ✗
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
                          <div className="text-sm text-slate-600">{t.id} · {t.size}</div>
                        </div>
                        <select
                          value={t.status}
                          onChange={(e) => persistFleet(fleet.map((x) => (x.id === t.id ? { ...x, status: e.target.value as Tanker['status'] } : x)))}
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
                          onChange={(e) => {
                            const p = Number(e.target.value || 0);
                            persistFleet(fleet.map((x) => (x.id === t.id ? { ...x, price: p } : x)));
                          }}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        />
                        <span className="text-sm text-slate-600">Driver: {t.driver}</span>
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
                    className="mt-3 rounded-xl bg-[#003049] text-white px-4 py-2 text-sm font-bold"
                    onClick={() => {
                      if (!newTanker.id.trim()) return toast.error('Enter tanker ID');
                      const add: Tanker = {
                        id: newTanker.id.trim().toUpperCase(),
                        name: `Tanker ${newTanker.id.trim().toUpperCase()}`,
                        size: newTanker.size,
                        price: Number(newTanker.price || 0),
                        driver: newTanker.driver || 'Unassigned',
                        status: 'available',
                      };
                      persistFleet([add, ...fleet]);
                      setNewTanker({ id: '', size: '3000L', price: '399', driver: '' });
                      toast.success('Tanker added to fleet.');
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
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard title="Today" value={fmtMoney(1240)} color="#003049" />
                  <StatCard title="Week" value={fmtMoney(5240)} color="#2A9D8F" />
                  <StatCard title="Month" value={fmtMoney(stats.monthRevenue)} color="#F4A261" />
                  <StatCard title="Total" value={fmtMoney(stats.monthRevenue + 18240)} color="#1D4ED8" />
                </div>
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
                      Payout account: <span className="font-bold text-slate-900">Account ending in XXXX4521</span>
                    </div>
                    <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">
                      Update bank details
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
                    Share this with your regular customers to route orders directly to your fleet.
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

function StatusBadge({ status }: { status: SupplierDoc['status'] }) {
  if (status === 'verified') return <span className="text-xs font-bold rounded-full px-3 py-1 bg-emerald-100 text-emerald-700">✓ Verified</span>;
  if (status === 'submitted') return <span className="text-xs font-bold rounded-full px-3 py-1 bg-blue-100 text-blue-700">↑ Submitted</span>;
  if (status === 'rejected') return <span className="text-xs font-bold rounded-full px-3 py-1 bg-rose-100 text-rose-700">✗ Rejected</span>;
  return <span className="text-xs font-bold rounded-full px-3 py-1 bg-slate-100 text-slate-600">○ Not uploaded</span>;
}

