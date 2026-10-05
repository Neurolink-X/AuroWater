'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  adminUsersWithMeta,
  adminUserUpdate,
  authMe,
  type AdminUserRow,
} from '@/lib/api-client';

type RoleTab = 'ALL' | 'CUSTOMER' | 'TECHNICIAN' | 'SUPPLIER' | 'ADMIN';
type ViewTab = 'pending' | 'all' | 'suspended';

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'green' | 'rose' | 'sky' | 'amber' | 'slate';
}) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20'
      : tone === 'rose'
        ? 'bg-rose-500/10 text-rose-200 border-rose-500/20'
        : tone === 'sky'
          ? 'bg-sky-500/10 text-sky-200 border-sky-500/20'
          : tone === 'amber'
            ? 'bg-amber-500/10 text-amber-200 border-amber-500/20'
            : 'bg-white/5 text-slate-200 border-white/10';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${cls}`}
    >
      {children}
    </span>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminUsersPage() {
  const [view, setView] = useState<ViewTab>('pending');
  const [roleTab, setRoleTab] = useState<RoleTab>('ALL');
  const [q, setQ] = useState('');
  const [rawRows, setRawRows] = useState<AdminUserRow[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    id: string;
    nextRole: string;
  } | null>(null);
  const [selectNonce, setSelectNonce] = useState(0);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);

      setError(null);

      try {
        const params: {
          role?: string;
          search?: string;
          status?: string;
          limit: number;
          offset: number;
        } = {
          limit: 200,
          offset: 0,
        };

        if (view === 'pending') params.status = 'pending_approval';
        if (view === 'suspended') params.status = 'suspended';
        if (roleTab !== 'ALL') params.role = roleTab.toLowerCase();

        if (q.trim()) {
          params.search = q.trim();
        }

        const res = await adminUsersWithMeta(params);

        setRawRows(res.data ?? []);
        setMeta(res.meta ?? {});
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load users');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [roleTab, q, view],
  );

  useEffect(() => {
    void authMe()
      .then((profile) => setCurrentAdminId(profile.id))
      .catch(() => setCurrentAdminId(null));
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      void load();
      return;
    }

    const timer = window.setTimeout(() => {
      void load();
    }, 350);

    return () => window.clearTimeout(timer);
  }, [load, q]);

  const rows = useMemo(() => rawRows, [rawRows]);

  const totalCount = useMemo(() => {
    const total = meta.total;
    return typeof total === 'number' ? total : rows.length;
  }, [meta, rows.length]);

  const pendingCount = useMemo(
    () => rows.filter((u) => u.status === 'pending_approval').length,
    [rows],
  );

  const activeCount = useMemo(
    () => rows.filter((u) => u.is_active !== false).length,
    [rows],
  );

  const suspendedCount = useMemo(
    () => rows.filter((u) => u.is_active === false).length,
    [rows],
  );

  const applyRoleChange = async (id: string, nextRole: string) => {
    if (id === currentAdminId) {
      toast.error('You cannot change your own admin role here.');
      setConfirm(null);
      setSelectNonce((n) => n + 1);
      return;
    }

    try {
      await adminUserUpdate(id, { role: nextRole.toLowerCase() });
      toast.success('Role updated');
      setConfirm(null);
      setSelectNonce((n) => n + 1);
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Role update failed');
      setSelectNonce((n) => n + 1);
    }
  };

  const toggleActive = async (u: AdminUserRow) => {
    if (u.id === currentAdminId) {
      toast.error('You cannot suspend your own admin account.');
      return;
    }

    const next = u.is_active === false;

    try {
      await adminUserUpdate(u.id, { is_active: next });
      toast.success(next ? 'User activated' : 'User suspended');
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Status update failed');
    }
  };

  const approveUser = async (id: string) => {
    try {
      await adminUserUpdate(id, {
        status: 'active',
        is_active: true,
      });
      toast.success('User approved');
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Approval failed');
    }
  };

  const rejectUser = async (id: string) => {
    const reason = window.prompt('Reason for rejection');

    if (!reason?.trim()) return;

    try {
      await adminUserUpdate(id, {
        status: 'rejected',
        rejection_reason: reason.trim(),
        is_active: false,
      });
      toast.success('User rejected');
      await load(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Rejection failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <Badge tone="sky">ADMIN ONLY</Badge>
          </div>

          <p className="text-sm text-slate-300 mt-1">
            Manage customer, technician, supplier and admin accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={refreshing ? 'animate-spin' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Showing', value: totalCount, tone: 'sky' as const },
          { label: 'Pending', value: pendingCount, tone: 'amber' as const },
          { label: 'Active', value: activeCount, tone: 'green' as const },
          { label: 'Suspended', value: suspendedCount, tone: 'rose' as const },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl"
          >
            <p className="text-[11px] uppercase tracking-widest text-slate-500">
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-black text-white">{item.value}</p>
          </div>
        ))}
      </div>

      {/* View filters */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-card p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(['pending', 'all', 'suspended'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  view === v
                    ? 'bg-cyan-500 text-slate-950'
                    : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                {v === 'pending'
                  ? 'Pending approval'
                  : v === 'all'
                    ? 'All users'
                    : 'Suspended'}
              </button>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(['ALL', 'CUSTOMER', 'TECHNICIAN', 'SUPPLIER', 'ADMIN'] as RoleTab[]).map(
                (r) => (
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
                    {r === 'ALL'
                      ? 'All'
                      : r.charAt(0) + r.slice(1).toLowerCase()}
                  </button>
                ),
              )}
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
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-200 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-bold hover:bg-rose-500/30"
          >
            Retry
          </button>
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
              onClick={() =>
                void applyRoleChange(confirm.id, confirm.nextRole)
              }
            >
              Confirm
            </button>
          </div>
        </div>
      ) : null}

      {/* Users table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-card overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="text-sm text-slate-300">
            {loading ? 'Loading…' : `${rows.length} user(s)`}
          </div>

          <div className="text-xs text-slate-500">
            {q.trim() ? `Search: “${q.trim()}”` : 'AuroWater accounts'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/30">
              <tr className="border-b border-white/10">
                {['User', 'Role', 'Status', 'Stats', 'Created', 'Orders'].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300"
                    >
                      {heading}
                    </th>
                  ),
                )}
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
                  <td
                    colSpan={6}
                    className="px-4 sm:px-6 py-14 text-center text-slate-300"
                  >
                    <div className="text-3xl mb-2">👥</div>
                    <p className="font-semibold text-white">No users found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Try another role, status or search term.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((u) => {
                  const role = (u.role ?? 'customer').toLowerCase();
                  const isSelf = u.id === currentAdminId;
                  const isPending = u.status === 'pending_approval';
                  const isRejected = u.status === 'rejected';

                  return (
                    <tr
                      key={u.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-4">
                        <div className="font-semibold text-white">
                          {u.full_name ?? '—'}
                        </div>

                        <div className="text-xs text-slate-400 mt-1">
                          <span className="text-slate-300 font-mono text-[11px]">
                            {u.id.slice(0, 8)}…
                          </span>

                          {u.phone ? <span> · {u.phone}</span> : null}

                          {u.email ? (
                            <span className="text-slate-500"> · {u.email}</span>
                          ) : null}
                        </div>

                        {u.city ? (
                          <div className="text-[11px] text-slate-500 mt-1">
                            {u.city}
                          </div>
                        ) : null}

                        {isSelf ? (
                          <div className="mt-2">
                            <Badge tone="sky">Your account</Badge>
                          </div>
                        ) : null}

                        {view === 'pending' && isPending ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-500"
                              onClick={() => void approveUser(u.id)}
                            >
                              Approve
                            </button>

                            <button
                              type="button"
                              className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white hover:bg-rose-500"
                              onClick={() => void rejectUser(u.id)}
                            >
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex flex-col gap-2 max-w-[200px]">
                          <Badge
                            tone={
                              role === 'admin'
                                ? 'sky'
                                : role === 'technician'
                                  ? 'slate'
                                  : 'green'
                            }
                          >
                            {role}
                          </Badge>

                          <select
                            key={`${u.id}-${u.role}-${selectNonce}`}
                            defaultValue={role}
                            disabled={isSelf}
                            aria-label={`Change role for ${u.full_name ?? 'user'}`}
                            onChange={(e) => {
                              const value = e.target.value;

                              if (value !== role) {
                                setConfirm({
                                  id: u.id,
                                  nextRole: value,
                                });
                              }
                            }}
                            className="rounded-lg border border-white/10 bg-slate-950/40 text-slate-100 text-xs py-1.5 px-2 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {['customer', 'technician', 'supplier', 'admin'].map(
                              (option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      </td>

                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex flex-col gap-2 items-start">
                          {isPending ? (
                            <Badge tone="amber">Pending approval</Badge>
                          ) : isRejected ? (
                            <Badge tone="rose">Rejected</Badge>
                          ) : u.is_active !== false ? (
                            <Badge tone="green">Active</Badge>
                          ) : (
                            <Badge tone="rose">Suspended</Badge>
                          )}

                          <button
                            type="button"
                            onClick={() => void toggleActive(u)}
                            disabled={isSelf}
                            className="text-left text-xs font-semibold text-sky-300 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {u.is_active === false ? 'Activate' : 'Suspend'}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 sm:px-6 py-4 text-xs text-slate-400">
                        {u.order_count != null ? (
                          <span>
                            Orders:{' '}
                            <span className="text-slate-200 font-semibold">
                              {u.order_count}
                            </span>
                            <br />
                            Spent:{' '}
                            <span className="text-slate-200 font-semibold">
                              ₹
                              {Number(u.total_spent ?? 0).toLocaleString(
                                'en-IN',
                              )}
                            </span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="px-4 sm:px-6 py-4 text-slate-300 text-xs">
                        {formatDate(u.created_at)}
                      </td>

                      <td className="px-4 sm:px-6 py-4">
                        {role === 'customer' ? (
                          <Link
                            href={`/admin/orders?search=${encodeURIComponent(
                              u.full_name ?? u.id,
                            )}`}
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
