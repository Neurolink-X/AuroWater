'use client';

import React, { useEffect, useState } from 'react';
import { getAdminOrders, assignTechnician } from '@/lib/api-client';

interface AdminOrder {
  id: number;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-200 border-amber-500/30',
  ASSIGNED: 'bg-sky-500/10 text-sky-200 border-sky-500/30',
  ACCEPTED: 'bg-blue-500/10 text-blue-200 border-blue-500/30',
  IN_PROGRESS: 'bg-violet-500/10 text-violet-200 border-violet-500/30',
  COMPLETED: 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30',
  CANCELLED: 'bg-rose-500/10 text-rose-200 border-rose-500/30',
};

export default function AdminOrdersPage() {
  const [rows, setRows] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await getAdminOrders(status || undefined, 50, 0);
        setRows(list as AdminOrder[]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-sm text-slate-300 mt-1">
            Live operations board for all customer orders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { value: '', label: 'All' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'ASSIGNED', label: 'Assigned' },
            { value: 'IN_PROGRESS', label: 'In progress' },
            { value: 'COMPLETED', label: 'Completed' },
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
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-100 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-card overflow-hidden">
        <div className="px-4 sm:px-6 py-3 border-b border-white/10 flex items-center justify-between">
          <p className="text-sm text-slate-300">
            {loading ? 'Loading orders…' : `${rows.length} order(s)`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/40">
              <tr className="border-b border-white/10">
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-300">
                  Order
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-300">
                  Customer
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-300">
                  Service
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-300">
                  Amount
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-300">
                  Status
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-slate-300">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
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
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 sm:px-6 py-10 text-center text-slate-300"
                  >
                    No orders found for this filter.
                  </td>
                </tr>
              ) : (
                rows.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-4 text-slate-100 font-semibold">
                      #{order.id}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-slate-200">
                      <div>{order.customer_name}</div>
                      <div className="text-xs text-slate-400">
                        {order.customer_phone}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-slate-200">
                      {order.service_name?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-emerald-200 font-semibold">
                      ₹{Number(order.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                          STATUS_CLASS[order.status] ??
                          'bg-white/5 text-slate-200 border-white/20'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-slate-400 text-xs">
                      {new Date(order.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

