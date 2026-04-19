'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  adminOrdersWithMeta,
  adminOrderGet,
  adminTechniciansList,
  assignTechnician,
  adminOrderUpdate,
  type AdminOrderRow,
  type AdminOrderDetail,
  type AdminTechnicianRow,
} from '@/lib/api-client';

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-200 border-amber-500/30',
  ASSIGNED: 'bg-sky-500/10 text-sky-200 border-sky-500/30',
  ACCEPTED: 'bg-blue-500/10 text-blue-200 border-blue-500/30',
  IN_PROGRESS: 'bg-violet-500/10 text-violet-200 border-violet-500/30',
  COMPLETED: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30',
  CANCELLED: 'bg-rose-500/10 text-rose-200 border-rose-500/30',
  FAILED: 'bg-rose-500/10 text-rose-200 border-rose-500/30',
};

const ADMIN_STATUS_OPTIONS = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function AdminOrdersPage() {
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [emergencyOnly, setEmergencyOnly] = useState(false);

  const [rawRows, setRawRows] = useState<AdminOrderRow[]>([]);

  const [drawerOrder, setDrawerOrder] = useState<AdminOrderDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [techList, setTechList] = useState<AdminTechnicianRow[]>([]);
  const [techPickerOpen, setTechPickerOpen] = useState(false);
  const [techSearch, setTechSearch] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | undefined> = { limit: '50', offset: '0' };
      if (status) params.status = status;
      if (from) params.from = new Date(from).toISOString();
      if (to) params.to = new Date(to).toISOString();
      const res = await adminOrdersWithMeta(params);
      setRawRows(res.data ?? []);
      setMeta(res.meta ?? {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [status, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    let data = rawRows;
    if (search.trim()) {
      const n = search.trim().toLowerCase();
      data = data.filter(
        (o) =>
          o.id.toLowerCase().includes(n) ||
          (o.customer_name ?? '').toLowerCase().includes(n) ||
          (o.address ?? '').toLowerCase().includes(n)
      );
    }
    if (emergencyOnly) data = data.filter((o) => Boolean(o.is_emergency));
    return data;
  }, [rawRows, search, emergencyOnly]);

  const totalCount = useMemo(() => {
    const t = meta.total;
    return typeof t === 'number' ? t : rawRows.length;
  }, [meta, rawRows.length]);

  const listParams = useMemo((): Record<string, string | undefined> => {
    const params: Record<string, string | undefined> = {};
    if (status) params.status = status;
    if (from) params.from = new Date(from).toISOString();
    if (to) params.to = new Date(to).toISOString();
    return params;
  }, [status, from, to]);

  const fetchTechs = useCallback(async () => {
    try {
      const list = await adminTechniciansList();
      setTechList(list ?? []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load technicians');
    }
  }, []);

  const openDrawer = useCallback(async (orderId: string) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setTechPickerOpen(false);
    setTechSearch('');
    setCancelOpen(false);
    setCancelNote('');
    try {
      const detail = await adminOrderGet(orderId);
      setDrawerOrder(detail);
      const st = String(detail.status ?? '');
      if (st === 'PENDING' || st === 'ASSIGNED') {
        void fetchTechs();
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load order');
      setDrawerOpen(false);
      setDrawerOrder(null);
    } finally {
      setDrawerLoading(false);
    }
  }, [fetchTechs]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerOrder(null);
    setTechPickerOpen(false);
  }, []);

  const handleAssign = useCallback(
    async (technicianId: string) => {
      if (!drawerOrder?.id) return;
      setAssigning(true);
      try {
        await assignTechnician(drawerOrder.id, technicianId);
        toast.success('Technician assigned. Customer notified.');
        setTechPickerOpen(false);
        const detail = await adminOrderGet(drawerOrder.id);
        setDrawerOrder(detail);
        void load();
      } catch {
        toast.error('Assignment failed.');
      } finally {
        setAssigning(false);
      }
    },
    [drawerOrder?.id, load]
  );

  const handleStatusUpdate = useCallback(
    async (newStatus: string) => {
      if (!drawerOrder?.id) return;
      try {
        await adminOrderUpdate(drawerOrder.id, { status: newStatus });
        toast.success(`Status updated to ${newStatus}`);
        setDrawerOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
        void load();
      } catch {
        toast.error('Failed to update status.');
      }
    },
    [drawerOrder?.id, load]
  );

  const handleCancelOrder = useCallback(async () => {
    if (!drawerOrder?.id) return;
    try {
      const prevNotes = typeof drawerOrder.notes === 'string' ? drawerOrder.notes : '';
      const stamp = `[Admin cancel ${new Date().toISOString()}] ${cancelNote.trim() || 'no note'}`;
      const notes = prevNotes ? `${prevNotes}\n${stamp}` : stamp;
      await adminOrderUpdate(drawerOrder.id, { status: 'CANCELLED', notes });
      toast.success('Order cancelled.');
      setCancelOpen(false);
      setCancelNote('');
      setDrawerOrder((prev) => (prev ? { ...prev, status: 'CANCELLED', notes } : null));
      void load();
    } catch {
      toast.error('Cancel failed.');
    }
  }, [drawerOrder, cancelNote, load]);

  const handleExportCSV = useCallback(async () => {
    setExporting(true);
    try {
      const all: AdminOrderRow[] = [];
      let offset = 0;
      const pageSize = 200;
      for (;;) {
        const params: Record<string, string | undefined> = {
          ...listParams,
          limit: String(pageSize),
          offset: String(offset),
        };
        const res = await adminOrdersWithMeta(params);
        const batch = res.data ?? [];
        all.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
        if (offset > 20000) break;
      }

      const headers = [
        'Order #',
        'Customer',
        'Service',
        'Amount',
        'Status',
        'Payment',
        'Emergency',
        'Date',
      ];
      const csvRows = all.map((o) => [
        o.id,
        o.customer_name ?? '',
        (o.service_type ?? '').replace(/_/g, ' '),
        Number(o.total_amount || 0),
        o.status,
        o.payment_status ?? 'unpaid',
        o.is_emergency ? 'Yes' : 'No',
        new Date(o.created_at).toLocaleDateString('en-IN'),
      ]);

      const csv = [headers, ...csvRows]
        .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aurowater-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} orders.`);
    } catch {
      toast.error('Export failed.');
    } finally {
      setExporting(false);
    }
  }, [listParams]);

  const filteredTechs = useMemo(() => {
    const q = techSearch.trim().toLowerCase();
    if (!q) return techList;
    return techList.filter(
      (t) =>
        (t.full_name ?? '').toLowerCase().includes(q) ||
        (t.phone ?? '').toLowerCase().includes(q) ||
        (t.email ?? '').toLowerCase().includes(q)
    );
  }, [techList, techSearch]);

  const paymentLabel = (o: AdminOrderDetail) => {
    const method = String(o.payment_method ?? 'cash').replace(/_/g, ' ');
    const ps = String(o.payment_status ?? 'unpaid');
    return `${method} · ${ps}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-sm text-slate-300 mt-1">
            Live operations board — {totalCount} total (server) · showing {rows.length} after local filters.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExportCSV()}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          {[
            { value: '', label: 'All' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'ASSIGNED', label: 'Assigned' },
            { value: 'IN_PROGRESS', label: 'In progress' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ].map((f) => (
            <button
              key={f.value || 'ALL'}
              type="button"
              onClick={() => setStatus(f.value)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                status === f.value
                  ? 'bg-[#4361EE] text-white'
                  : 'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEmergencyOnly((v) => !v)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
              emergencyOnly
                ? 'bg-rose-600 text-white'
                : 'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10'
            }`}
          >
            Emergency
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex-1 grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Search</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order id, customer, address…"
              className="w-full rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-sm text-slate-100"
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl bg-white/10 border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-100 text-sm">{error}</div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-card overflow-hidden">
        <div className="px-4 sm:px-6 py-3 border-b border-white/10 flex items-center justify-between">
          <p className="text-sm text-slate-300">
            {loading ? 'Loading orders…' : `${rows.length} row(s) on this page`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/40">
              <tr className="border-b border-white/10">
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-300">Order</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-300">Customer</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-300">Service</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-300">Amount</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-300">Status</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-300">Created</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-slate-300"> </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-white/5">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="h-4 w-28 bg-white/10 rounded animate-pulse" />
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="h-6 w-20 bg-white/10 rounded-full animate-pulse" />
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                    </td>
                    <td className="px-4 sm:px-6 py-4" />
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 sm:px-6 py-10 text-center text-slate-300">
                    No orders found for this filter.
                  </td>
                </tr>
              ) : (
                rows.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => void openDrawer(order.id)}
                  >
                    <td className="px-4 sm:px-6 py-4 text-slate-100 font-semibold font-mono text-xs">
                      {order.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-slate-200">
                      <div>{order.customer_name ?? '—'}</div>
                      {order.is_emergency ? (
                        <div className="text-[10px] uppercase tracking-wide text-rose-300 mt-0.5">Emergency</div>
                      ) : null}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-slate-200">
                      {(order.service_type ?? '—').replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-emerald-200 font-semibold">
                      {formatInr(Number(order.total_amount || 0))}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                          STATUS_CLASS[order.status] ?? 'bg-white/5 text-slate-200 border-white/20'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-slate-400 text-xs">
                      {new Date(order.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <button
                        type="button"
                        className="text-sky-400 text-xs font-medium hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openDrawer(order.id);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {drawerOpen && (
        <div
          role="presentation"
          onClick={closeDrawer}
          onKeyDown={(e) => e.key === 'Escape' && closeDrawer()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(10,22,40,0.5)',
            backdropFilter: 'blur(4px)',
          }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          width: 'min(480px, 100vw)',
          background: '#fff',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: drawerOpen ? 'auto' : 'none',
        }}
        aria-hidden={!drawerOpen}
      >
        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
          <div>
            <button
              type="button"
              className="text-sm text-slate-600 hover:text-slate-900 mb-2"
              onClick={closeDrawer}
            >
              ← Back
            </button>
            <p className="text-xs text-slate-500 font-mono">
              Order #
              {typeof drawerOrder?.order_number === 'string' && drawerOrder.order_number
                ? drawerOrder.order_number
                : drawerOrder?.id?.slice(0, 8) ?? '—'}
            </p>
            {drawerOrder?.status ? (
              <span
                className={`inline-flex mt-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
                  STATUS_CLASS[String(drawerOrder.status)] ?? 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {String(drawerOrder.status)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="p-5 flex-1 text-slate-800 text-sm space-y-6">
          {drawerLoading ? (
            <p className="text-slate-500">Loading…</p>
          ) : drawerOrder ? (
            <>
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Service details</h3>
                <dl className="space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Service</dt>
                    <dd className="font-medium text-right">
                      {(drawerOrder.service_name ?? drawerOrder.service_key ?? '—').toString()}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Sub-option</dt>
                    <dd className="text-right">{String(drawerOrder.sub_option_key ?? '—')}</dd>
                  </div>
                  {drawerOrder.is_emergency ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Emergency</dt>
                      <dd className="text-rose-600 font-medium">Yes</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Scheduled</dt>
                    <dd className="text-right">
                      {drawerOrder.scheduled_date
                        ? `${new Date(String(drawerOrder.scheduled_date)).toLocaleDateString('en-IN')}${
                            drawerOrder.time_slot ? ` · ${String(drawerOrder.time_slot)}` : ''
                          }`
                        : '—'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Customer</h3>
                <dl className="space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Name</dt>
                    <dd className="font-medium text-right">{String(drawerOrder.customer_name ?? '—')}</dd>
                  </div>
                  <div className="flex justify-between gap-2 items-center">
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="text-right flex items-center gap-2">
                      {drawerOrder.customer_phone ? (
                        <>
                          <span className="font-mono">{String(drawerOrder.customer_phone)}</span>
                          <a
                            href={`tel:${String(drawerOrder.customer_phone)}`}
                            className="text-sky-600 text-xs font-semibold"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Call
                          </a>
                        </>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Address</dt>
                    <dd className="text-right max-w-[240px]">{String(drawerOrder.address_text ?? '—')}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Price breakdown</h3>
                <dl className="space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Base price</dt>
                    <dd>{formatInr(num(drawerOrder.base_amount))}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Convenience</dt>
                    <dd>{formatInr(num(drawerOrder.convenience_fee))}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">GST</dt>
                    <dd>{formatInr(num(drawerOrder.gst_amount))}</dd>
                  </div>
                  {num(drawerOrder.emergency_charge) > 0 ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Emergency</dt>
                      <dd>{formatInr(num(drawerOrder.emergency_charge))}</dd>
                    </div>
                  ) : null}
                  <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between gap-2 font-semibold">
                    <dt>Total</dt>
                    <dd>{formatInr(num(drawerOrder.total_amount))}</dd>
                  </div>
                  <div className="flex justify-between gap-2 text-slate-600">
                    <dt>Payment</dt>
                    <dd>{paymentLabel(drawerOrder)}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Technician</h3>
                {(() => {
                  const dStatus = String(drawerOrder.status ?? '');
                  const showAssignUi = dStatus === 'PENDING' || dStatus === 'ASSIGNED';
                  const hasTech = Boolean(drawerOrder.technician_id);

                  const techPicker = (
                    <div className="space-y-2">
                      <input
                        value={techSearch}
                        onChange={(e) => setTechSearch(e.target.value)}
                        placeholder="Search by name, phone…"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2">
                        {filteredTechs.length === 0 ? (
                          <p className="text-slate-500 text-xs p-2">No technicians.</p>
                        ) : (
                          filteredTechs.map((t) => {
                            const activeJobs = t.active_jobs ?? t.stats?.active ?? 0;
                            return (
                              <div
                                key={t.id}
                                className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200"
                              >
                                <div>
                                  <p className="font-medium text-sm">{t.full_name ?? '—'}</p>
                                  <p className="text-[11px] text-slate-500">
                                    Active jobs {activeJobs} · Done {t.stats?.done ?? 0}
                                    {t.is_online ? ' · Online' : ''}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={assigning}
                                  onClick={() => void handleAssign(t.id)}
                                  className="shrink-0 text-xs font-semibold bg-sky-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                                >
                                  Assign
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <button type="button" className="text-xs text-slate-500" onClick={() => setTechPickerOpen(false)}>
                        Close picker
                      </button>
                    </div>
                  );

                  if (!showAssignUi && hasTech) {
                    return (
                      <div className="rounded-xl border border-slate-200 p-3">
                        <p className="font-semibold">{String(drawerOrder.technician_name ?? 'Assigned')}</p>
                        {drawerOrder.technician_phone ? (
                          <p className="text-slate-600 font-mono text-xs mt-1">{String(drawerOrder.technician_phone)}</p>
                        ) : null}
                        <p className="text-xs text-slate-500 mt-1">Status mirrors order: {String(drawerOrder.status)}</p>
                      </div>
                    );
                  }

                  if (!showAssignUi && !hasTech) {
                    return <p className="text-sm text-slate-500">No technician on this order.</p>;
                  }

                  return (
                    <div className="space-y-3">
                      {hasTech ? (
                        <div className="rounded-xl border border-slate-200 p-3">
                          <p className="font-semibold">{String(drawerOrder.technician_name ?? 'Assigned')}</p>
                          {drawerOrder.technician_phone ? (
                            <p className="text-slate-600 font-mono text-xs mt-1">{String(drawerOrder.technician_phone)}</p>
                          ) : null}
                          {!techPickerOpen ? (
                            <button
                              type="button"
                              className="mt-2 text-sm text-sky-600 font-semibold"
                              onClick={() => {
                                setTechPickerOpen(true);
                                void fetchTechs();
                              }}
                            >
                              Change assignment
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {techPickerOpen ? (
                        techPicker
                      ) : !hasTech ? (
                        <button
                          type="button"
                          disabled={assigning}
                          onClick={() => {
                            setTechPickerOpen(true);
                            void fetchTechs();
                          }}
                          className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-800 font-medium hover:bg-slate-50"
                        >
                          Assign technician ↓
                        </button>
                      ) : null}
                    </div>
                  );
                })()}
              </section>

              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Admin actions</h3>
                <div className="space-y-3">
                  <label className="block text-xs text-slate-500">Update status</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                    value={String(drawerOrder.status ?? '')}
                    onChange={(e) => void handleStatusUpdate(e.target.value)}
                  >
                    {Array.from(
                      new Set<string>([
                        ...ADMIN_STATUS_OPTIONS,
                        String(drawerOrder.status || ''),
                      ])
                    )
                      .filter(Boolean)
                      .map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                  {!cancelOpen ? (
                    <button
                      type="button"
                      onClick={() => setCancelOpen(true)}
                      className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-700 font-medium hover:bg-rose-50"
                    >
                      Cancel & add note
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        value={cancelNote}
                        onChange={(e) => setCancelNote(e.target.value)}
                        placeholder="Reason (optional)"
                        rows={3}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleCancelOrder()}
                          className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium"
                        >
                          Confirm cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCancelOpen(false);
                            setCancelNote('');
                          }}
                          className="px-4 py-2 rounded-xl border border-slate-300 text-sm"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <p className="text-slate-500">Select an order</p>
          )}
        </div>
      </div>
    </div>
  );
}
