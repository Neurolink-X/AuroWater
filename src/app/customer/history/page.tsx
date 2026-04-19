'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, authLogout } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import GlassCard from '@/components/ui/GlassCard';

interface OrderRow {
  id: string;
  service_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  time_slot?: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ASSIGNED: 'bg-sky-100 text-sky-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-violet-100 text-violet-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-rose-100 text-rose-800',
};

export default function OrderHistory() {
  const router = useRouter();
  const { hydrated, isLoggedIn, isCustomer } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const loadOrders = useCallback(async () => {
    if (!isLoggedIn || !isCustomer) return;
    try {
      setLoading(true);
      const rows = await api.customer.orders.list({
        status: statusFilter || undefined,
        limit: 50,
        offset: 0,
      });
      setOrders(
        rows.map((o) => ({
          id: o.id,
          service_name: String(o.service_type_key ?? 'service'),
          total_amount: Number(o.total_amount),
          status: o.status,
          created_at: o.created_at,
          time_slot: o.time_slot ?? undefined,
        }))
      );
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, isCustomer, statusFilter]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isLoggedIn || !isCustomer) {
      setLoading(false);
      return;
    }
    void loadOrders();
  }, [hydrated, isLoggedIn, isCustomer, loadOrders]);

  if (!hydrated) {
    return (
      <div className="min-h-screen gradient-section flex items-center justify-center px-4">
        <p className="text-slate-600">Loading…</p>
      </div>
    );
  }

  if (!isLoggedIn || !isCustomer) {
    return (
      <div className="min-h-screen gradient-section flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Order history</h1>
          <p className="text-slate-600 mb-4">Sign in as a customer to see your bookings.</p>
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const filters = [
    { value: '', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'IN_PROGRESS', label: 'In progress' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="min-h-screen gradient-section">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Order history</h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/book"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              Book again
            </Link>
            <Link
              href="/customer/home"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={() => {
                void authLogout();
                router.push('/');
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {filters.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                statusFilter === f.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/80 border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-slate-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <GlassCard className="p-12 text-center rounded-2xl">
            <p className="text-slate-600 mb-4">
              {statusFilter ? 'No orders with this status' : 'No orders yet'}
            </p>
            <Link
              href="/book"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
            >
              Book your first order
            </Link>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <GlassCard key={order.id} className="p-6 rounded-2xl shadow-soft hover-lift">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-slate-800">Order #{order.id.slice(0, 8)}…</span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_CLASS[order.status] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="text-slate-600">{order.service_name?.replace(/_/g, ' ')}</p>
                    {order.time_slot ? <p className="text-sm text-slate-500 mt-1">Slot: {order.time_slot}</p> : null}
                    <p className="text-sm text-slate-500 mt-1">
                      {new Date(order.created_at).toLocaleDateString()} at{' '}
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-xl font-bold text-emerald-700">
                      ₹{order.total_amount?.toLocaleString('en-IN')}
                    </span>
                    <Link
                      href={`/customer/track/${order.id}`}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                    >
                      Track
                    </Link>
                    <Link
                      href="/book"
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                      Reorder
                    </Link>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
