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

export default function CustomerHome() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getUser();

    // If logged in as customer, load their orders. Otherwise, show a guest view.
    if (currentUser && currentUser.role === 'CUSTOMER') {
      setUser(currentUser);
      (async () => {
        try {
          const data = await getOrders(undefined, 20, 0);
          setOrders(data);
        } catch {
          setOrders([]);
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setUser(null);
      setLoading(false);
    }
  }, []);

  const activeOrders = orders.filter((o) =>
    ['PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS'].includes(o.status)
  );
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="min-h-screen gradient-section">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
            <p className="text-slate-600">
              Welcome{user ? `, ${user.full_name}` : ''}!
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/book" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold shadow-md hover:bg-emerald-700 transition-colors">
              Book a service
            </Link>
            {user && (
              <>
                <Link href="/customer/addresses" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors">
                  Addresses
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.push('/');
                  }}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading orders...</p>
        ) : (
          <>
            {activeOrders.length > 0 && (
              <GlassCard className="p-6 mb-8 rounded-2xl shadow-card">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Active orders</h2>
                <div className="space-y-4">
                  {activeOrders.map((order) => (
                    <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white/80 border border-slate-100">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-slate-800">Order #{order.id}</span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[order.status] ?? 'bg-slate-100 text-slate-700'}`}>
                            {STATUS_LABELS[order.status] ?? order.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">{order.service_name?.replace(/_/g, ' ')} · ₹{order.total_amount?.toFixed(2)}</p>
                        {order.time_slot && <p className="text-xs text-slate-500 mt-1">Slot: {order.time_slot}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/customer/track/${order.id}`} className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">Track</Link>
                        <Link href="/book" className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">Reorder</Link>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {recentOrders.length > 0 && (
              <GlassCard className="p-6 mb-8 rounded-2xl shadow-card">
                <h2 className="text-lg font-semibold text-slate-800 mb-2">Recent order summary</h2>
                <p className="text-sm text-slate-600 mb-4">Last order: #{recentOrders[0].id} — ₹{recentOrders[0].total_amount?.toFixed(2)} · {recentOrders[0].service_name?.replace(/_/g, ' ')}</p>
                <Link href="/customer/history" className="text-sm font-medium text-emerald-600 hover:underline">View full order history →</Link>
              </GlassCard>
            )}

            <GlassCard className="p-6 rounded-2xl shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Order history</h2>
                <Link href="/customer/history" className="text-sm font-medium text-emerald-600 hover:underline">View all</Link>
              </div>
              {recentOrders.length === 0 ? (
                <p className="text-slate-600 py-6 text-center">No orders yet. Book your first service to get started.</p>
              ) : (
                <ul className="space-y-3">
                  {recentOrders.map((order) => (
                    <li key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors">
                      <div>
                        <span className="font-medium text-slate-800">#{order.id}</span>
                        <span className="text-slate-600 ml-2">{order.service_name?.replace(/_/g, ' ')}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS[order.status] ?? 'bg-slate-200'}`}>{STATUS_LABELS[order.status] ?? order.status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-emerald-700">₹{order.total_amount?.toFixed(2)}</span>
                        <Link href={`/customer/track/${order.id}`} className="text-sm text-emerald-600 hover:underline">Details</Link>
                        <Link href="/book" className="text-sm font-medium text-slate-600 hover:underline">Reorder</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>

            <GlassCard className="p-6 mt-8 rounded-2xl shadow-card">
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Notifications</h2>
              <p className="text-sm text-slate-600">Order and job updates will appear here. Check your order history for status changes.</p>
            </GlassCard>
          </>
        )}
      </div>
    </div>
  );
}
