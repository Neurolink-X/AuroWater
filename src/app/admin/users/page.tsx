'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getAdminUsers } from '@/lib/api-client';

type Role = 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';

interface UserRow {
  id: number;
  phone: string;
  email?: string | null;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'green' | 'rose' | 'sky' | 'slate' }) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/20'
      : tone === 'rose'
        ? 'bg-rose-500/10 text-rose-200 border-rose-500/20'
        : tone === 'sky'
          ? 'bg-sky-500/10 text-sky-200 border-sky-500/20'
          : 'bg-white/5 text-slate-200 border-white/10';
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${cls}`}>{children}</span>;
}

export default function AdminUsersPage() {
  const [role, setRole] = useState<Role | 'ALL'>('ALL');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await getAdminUsers(role === 'ALL' ? undefined : role);
        setRows(list as UserRow[]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [role]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((u) => {
      return (
        String(u.id).includes(needle) ||
        (u.full_name || '').toLowerCase().includes(needle) ||
        (u.phone || '').toLowerCase().includes(needle) ||
        (u.email || '').toLowerCase().includes(needle)
      );
    });
  }, [q, rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-sm text-slate-300 mt-1">Search, filter, and manage platform accounts.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'CUSTOMER', 'TECHNICIAN', 'ADMIN'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  role === r ? 'bg-emerald-600 text-white' : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
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
              placeholder="Search by name, phone, email, ID…"
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

      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-card overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="text-sm text-slate-300">
            {loading ? 'Loading…' : `${filtered.length} user(s)`}
          </div>
          <div className="text-xs text-slate-500">Admin-only</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-950/30">
              <tr className="border-b border-white/10">
                <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">User</th>
                <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Role</th>
                <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Status</th>
                <th className="text-left px-4 sm:px-6 py-3 font-medium text-slate-300">Created</th>
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
                    <td className="px-4 sm:px-6 py-4"><div className="h-6 w-20 bg-white/10 rounded animate-pulse" /></td>
                    <td className="px-4 sm:px-6 py-4"><div className="h-6 w-20 bg-white/10 rounded animate-pulse" /></td>
                    <td className="px-4 sm:px-6 py-4"><div className="h-4 w-24 bg-white/10 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 sm:px-6 py-12 text-center text-slate-300">
                    No users found for this filter/search.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="font-semibold text-white">{u.full_name}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        <span className="text-slate-300">#{u.id}</span> · {u.phone}
                        {u.email ? <span className="text-slate-500"> · {u.email}</span> : null}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <Badge tone={u.role === 'ADMIN' ? 'sky' : u.role === 'TECHNICIAN' ? 'slate' : 'green'}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      {u.is_active ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="rose">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-slate-300 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
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

