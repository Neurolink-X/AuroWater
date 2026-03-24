'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUser, getOrders, logout } from '@/lib/api-client';
import type { User } from '@/types';
import GlassCard from '@/components/ui/GlassCard';

interface Order {
  id: number;
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
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role !== 'CUSTOMER') {
      setUser(null);
      setLoading(false);
      return;
    }
    setUser(currentUser);
    loadOrders();
  }, [router, statusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await getOrders(statusFilter || undefined, 50, 0);
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen gradient-section flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Your order history</h1>
          <p className="text-slate-600 mb-4">
            This page shows past orders after you place bookings on this device. For now, start a new
            booking and we’ll keep the experience frictionless.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/book"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
            >
              Try booking now
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Back to home
            </Link>
          </div>
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
                logout();
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
              key={f.value}
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
          <p className="text-slate-500">Loading orders...</p>
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
                      <span className="font-bold text-slate-800">Order #{order.id}</span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_CLASS[order.status] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {order.service_name?.replace(/_/g, ' ')}
                    </p>
                    {order.time_slot && (
                      <p className="text-sm text-slate-500 mt-1">Slot: {order.time_slot}</p>
                    )}
                    <p className="text-sm text-slate-500 mt-1">
                      {new Date(order.created_at).toLocaleDateString()} at{' '}
                      {new Date(order.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-bold text-emerald-700">
                      ₹{order.total_amount?.toFixed(2)}
                    </span>
                    <Link
                      href={`/customer/track/${order.id}`}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                    >
                      View details
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
