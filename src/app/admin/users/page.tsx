'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { adminUsersWithMeta, adminUserUpdate, type AdminUserRow } from '@/lib/api-client';

type RoleTab = 'ALL' | 'CUSTOMER' | 'TECHNICIAN' | 'SUPPLIER' | 'ADMIN';

function Badge({ children, tone }: { children: React.ReactNode; tone: 'green' | 'rose' | 'sky' | 'slate' }) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20'
      : tone === 'rose'
        ? 'bg-rose-500/10 text-rose-200 border-rose-500/20'
        : tone === 'sky'
          ? 'bg-sky-500/10 text-sky-200 border-sky-500/20'
          : 'bg-white/5 text-slate-200 border-white/10';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${cls}`}>{children}</span>
  );
}

export default function AdminUsersPage() {
  const [roleTab, setRoleTab] = useState<RoleTab>('ALL');
  const [q, setQ] = useState('');
  const [rawRows, setRawRows] = useState<AdminUserRow[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; nextRole: string } | null>(null);
  const [selectNonce, setSelectNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { role?: string; search?: string; limit: number; offset: number } = {
        limit: 200,
        offset: 0,
      };
      if (roleTab !== 'ALL') params.role = roleTab.toLowerCase();
      if (q.trim()) params.search = q.trim();
      const res = await adminUsersWithMeta(params);
      setRawRows(res.data ?? []);
      setMeta(res.meta ?? {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [roleTab, q]);

  useEffect(() => {
    if (!q.trim()) {
      void load();
      return;
    }
    const t = setTimeout(() => void load(), 350);
    return () => clearTimeout(t);
  }, [load, q, roleTab]);

  const rows = useMemo(() => rawRows, [rawRows]);

  const totalCount = useMemo(() => {
    const t = meta.total;
    return typeof t === 'number' ? t : rows.length;
  }, [meta, rows.length]);

  const applyRoleChange = async (id: string, nextRole: string) => {
    try {
      await adminUserUpdate(id, { role: nextRole.toLowerCase() });
      toast.success('Role updated');
      setConfirm(null);
      setSelectNonce((n) => n + 1);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const toggleActive = async (u: AdminUserRow) => {
    const next = !(u.is_active !== false);
    try {
      await adminUserUpdate(u.id, { is_active: next });
      toast.success(next ? 'User activated' : 'User suspended');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-sm text-slate-300 mt-1">
          {totalCount} account(s) on server · showing {rows.length} for this tab/search.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'CUSTOMER', 'TECHNICIAN', 'SUPPLIER', 'ADMIN'] as RoleTab[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleTab(r)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  roleTab === r
                    ? 'bg-[#4361EE] text-white'
                    : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
                }`}
              >
                {r === 'ALL' ? 'All' : r.charAt(0) + r.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="flex-1 lg:max-w-md">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, email…"
              className="w-full rounded-xl border border-white/10 bg-slate-950/30 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/40"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-200">
          {error}
        </div>
      )}

      {confirm ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>
            Change role to <strong>{confirm.nextRole}</strong> for this user?
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-white/10 font-semibold"
              onClick={() => {
                setConfirm(null);
                setSelectNonce((n) => n + 1);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold"
              onClick={() => void applyRoleChange(confirm.id, confirm.nextRole)}
            >
              Confirm
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-card overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="text-sm text-slate-300">{loading ? 'Loading…' : `${rows.length} user(s)`}</div>
          <div className="text-xs text-slate-500">Admin-only</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/30">
              <tr className="border-b border-white/10">
                <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">User</th>
                <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Role</th>
                <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Active</th>
                <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Stats</th>
                <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Created</th>
                <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Orders</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="h-4 w-44 bg-white/10 rounded animate-pulse" />
                      <div className="h-3 w-64 bg-white/10 rounded mt-2 animate-pulse" />
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="h-6 w-20 bg-white/10 rounded animate-pulse" />
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="h-6 w-20 bg-white/10 rounded animate-pulse" />
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 sm:px-6 py-12 text-center text-slate-300">
                    No users found for this filter/search.
                  </td>
                </tr>
              ) : (
                rows.map((u) => {
                  const rUpper = u.role.toUpperCase();
                  return (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="font-semibold text-white">{u.full_name ?? '—'}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          <span className="text-slate-300 font-mono text-[11px]">{u.id.slice(0, 8)}…</span>
                          {u.phone ? <span> · {u.phone}</span> : null}
                          {u.email ? <span className="text-slate-500"> · {u.email}</span> : null}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex flex-col gap-2 max-w-[200px]">
                          <Badge tone={rUpper === 'ADMIN' ? 'sky' : rUpper === 'TECHNICIAN' ? 'slate' : 'green'}>
                            {u.role}
                          </Badge>
                          <select
                            key={`${u.id}-${u.role}-${selectNonce}`}
                            defaultValue={u.role}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v !== u.role) setConfirm({ id: u.id, nextRole: v });
                            }}
                            className="rounded-lg border border-white/10 bg-slate-950/40 text-slate-100 text-xs py-1.5 px-2"
                          >
                            {['customer', 'technician', 'supplier', 'admin'].map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <button
                          type="button"
                          onClick={() => void toggleActive(u)}
                          className="text-left"
                        >
                          {u.is_active !== false ? (
                            <Badge tone="green">Active</Badge>
                          ) : (
                            <Badge tone="rose">Suspended</Badge>
                          )}
                        </button>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-xs text-slate-400">
                        {u.order_count != null ? (
                          <span>
                            Orders: <span className="text-slate-200 font-semibold">{u.order_count}</span>
                            <br />
                            Spent:{' '}
                            <span className="text-slate-200 font-semibold">
                              ₹{Number(u.total_spent ?? 0).toLocaleString('en-IN')}
                            </span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-slate-300 text-xs">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        {u.role === 'customer' ? (
                          <Link
                            href={`/admin/orders?search=${encodeURIComponent(u.full_name ?? u.id)}`}
                            className="text-sky-300 hover:underline text-xs font-semibold"
                          >
                            View orders
                          </Link>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
