'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  adminUsersWithMeta,
  adminUserUpdate,
  type AdminUserRow,
} from '@/lib/api-client';

type RoleTab = 'ALL' | 'CUSTOMER' | 'TECHNICIAN' | 'SUPPLIER' | 'ADMIN';
type UserView = 'pending' | 'all' | 'suspended';
type ProcessingAction = 'approve' | 'reject' | 'role' | 'active';
type ProcessingState = { id: string; action: ProcessingAction } | null;

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'green' | 'rose' | 'sky' | 'slate' | 'amber';
}) {
  const cls =
    tone === 'green'
      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
      : tone === 'rose'
        ? 'border-rose-400/20 bg-rose-400/10 text-rose-200'
        : tone === 'sky'
          ? 'border-sky-400/20 bg-sky-400/10 text-sky-200'
          : tone === 'amber'
            ? 'border-amber-400/20 bg-amber-400/10 text-amber-200'
            : 'border-white/10 bg-white/5 text-slate-200';
  return (
    <span className={'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ' + cls}>
      {children}
    </span>
  );
}

function Spinner() {
  return <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

function roleTone(role: string): 'green' | 'sky' | 'slate' {
  const normalized = role.toLowerCase();
  if (normalized === 'admin') return 'sky';
  if (normalized === 'technician') return 'slate';
  return 'green';
}

function statusMeta(user: AdminUserRow) {
  const status = String(user.status ?? '').toLowerCase();
  if (status === 'pending' || status === 'pending_approval') return { label: 'Pending approval', tone: 'amber' as const };
  if (status === 'rejected') return { label: 'Rejected', tone: 'rose' as const };
  if (status === 'suspended') return { label: 'Suspended', tone: 'rose' as const };
  if (user.is_active === false) return { label: 'Inactive', tone: 'rose' as const };
  return { label: 'Active', tone: 'green' as const };
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminUsersPage() {
  const [view, setView] = useState<UserView>('pending');
  const [roleTab, setRoleTab] = useState<RoleTab>('ALL');
  const [q, setQ] = useState('');
  const [rawRows, setRawRows] = useState<AdminUserRow[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string; nextRole: string } | null>(null);
  const [selectNonce, setSelectNonce] = useState(0);
  const [processing, setProcessing] = useState<ProcessingState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { role?: string; search?: string; status?: string; limit: number; offset: number } = { limit: 200, offset: 0 };
      if (view === 'pending') params.status = 'pending_approval';
      if (view === 'suspended') params.status = 'suspended';
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
  }, [roleTab, q, view]);

  useEffect(() => {
    if (!q.trim()) { void load(); return; }
    const timer = setTimeout(() => void load(), 350);
    return () => clearTimeout(timer);
  }, [load, q, roleTab]);

  const rows = useMemo(() => rawRows, [rawRows]);
  const totalCount = useMemo(() => typeof meta.total === 'number' ? meta.total : rows.length, [meta, rows.length]);
  const pendingCount = useMemo(() => rows.filter((user) => {
    const status = String(user.status ?? '').toLowerCase();
    return status === 'pending' || status === 'pending_approval';
  }).length, [rows]);

  const runUserUpdate = async (
    id: string,
    action: ProcessingAction,
    patch: Parameters<typeof adminUserUpdate>[1],
    successMessage: string,
  ) => {
    try {
      setProcessing({ id, action });
      setError(null);
      await adminUserUpdate(id, patch);
      toast.success(successMessage);
      await load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'User update failed';
      setError(message);
      toast.error(message);
    } finally {
      setProcessing(null);
    }
  };

  const approveUser = async (id: string) => {
    await runUserUpdate(id, 'approve', { status: 'active', is_active: true }, 'User approved successfully');
  };

  const rejectUser = async (id: string) => {
    const reason = window.prompt('Reason for rejection');
    if (!reason?.trim()) return;
    await runUserUpdate(
      id,
      'reject',
      { status: 'rejected', rejection_reason: reason.trim(), is_active: false },
      'User rejected successfully',
    );
  };

  const applyRoleChange = async (id: string, nextRole: string) => {
    try {
      setProcessing({ id, action: 'role' });
      setError(null);
      await adminUserUpdate(id, { role: nextRole.toLowerCase() });
      toast.success('Role updated successfully');
      setConfirm(null);
      setSelectNonce((value) => value + 1);
      await load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Role update failed';
      setError(message);
      toast.error(message);
    } finally {
      setProcessing(null);
    }
  };

  const toggleActive = async (user: AdminUserRow) => {
    const next = !(user.is_active !== false);
    await runUserUpdate(user.id, 'active', { is_active: next }, next ? 'User activated' : 'User deactivated');
  };

  const isProcessing = (id: string, action?: ProcessingAction) =>
    processing?.id === id && (action ? processing.action === action : true);

  return (
    <div className="space-y-6 pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-white/[0.04] to-indigo-500/10 p-5 shadow-2xl sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="sky">Admin Control Center</Badge>
              {view === 'pending' && pendingCount > 0 ? <Badge tone="amber">{pendingCount} awaiting review</Badge> : null}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">User management</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Review accounts, approve registrations, manage roles, and control account access from one secure admin workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Spinner /> : null}
            {loading ? 'Refreshing…' : 'Refresh users'}
          </button>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Showing</p><p className="mt-1 text-2xl font-black text-white">{totalCount}</p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending</p><p className="mt-1 text-2xl font-black text-amber-300">{view === 'pending' ? pendingCount : '—'}</p></div>
          <div className="col-span-2 rounded-2xl border border-white/10 bg-slate-950/20 p-4 sm:col-span-1"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Access</p><p className="mt-1 text-sm font-bold text-emerald-300">Admin-only</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-xl backdrop-blur-xl sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="User status views">
            {(['pending', 'all', 'suspended'] as const).map((value) => {
              const active = view === value;
              const label = value === 'pending' ? 'Pending approval' : value === 'all' ? 'All users' : 'Suspended';
              return <button key={value} type="button" role="tab" aria-selected={active} onClick={() => setView(value)} className={'rounded-xl px-4 py-2.5 text-sm font-bold transition ' + (active ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20' : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10')}>{label}</button>;
            })}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="User role filters">
              {(['ALL', 'CUSTOMER', 'TECHNICIAN', 'SUPPLIER', 'ADMIN'] as RoleTab[]).map((role) => {
                const active = roleTab === role;
                return <button key={role} type="button" role="tab" aria-selected={active} onClick={() => setRoleTab(role)} className={'rounded-xl border px-4 py-2 text-sm font-bold transition ' + (active ? 'border-indigo-400/40 bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10')}>{role === 'ALL' ? 'All' : role.charAt(0) + role.slice(1).toLowerCase()}</button>;
              })}
            </div>
            <div className="relative w-full lg:max-w-md">
              <label htmlFor="user-search" className="sr-only">Search users</label>
              <input id="user-search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, phone, email…" autoComplete="off" className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-2.5 pr-20 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10" />
              {q ? <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white">Clear</button> : null}
            </div>
          </div>
        </div>
      </section>

      {error ? <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">User management action failed</p><p className="mt-1 text-rose-200/80">{error}</p></div><button type="button" onClick={() => setError(null)} className="self-start rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10">Dismiss</button></div> : null}

      {confirm ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-100 shadow-lg"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-300">Confirm role change</p><p className="mt-1 text-sm">Change <strong className="text-white">{confirm.name}</strong> to <strong className="text-white">{confirm.nextRole}</strong>?</p></div><div className="flex gap-2"><button type="button" disabled={processing?.id === confirm.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50" onClick={() => { setConfirm(null); setSelectNonce((value) => value + 1); }}>Cancel</button><button type="button" disabled={processing?.id === confirm.id} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50" onClick={() => void applyRoleChange(confirm.id, confirm.nextRole)}>{isProcessing(confirm.id, 'role') ? <Spinner /> : null}{isProcessing(confirm.id, 'role') ? 'Updating…' : 'Confirm change'}</button></div></div></div> : null}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div><p className="font-bold text-white">{loading ? 'Loading users…' : rows.length + ' user' + (rows.length === 1 ? '' : 's')}</p><p className="mt-0.5 text-xs text-slate-500">{view === 'pending' ? 'Accounts awaiting admin approval' : view === 'suspended' ? 'Accounts currently marked as suspended' : 'All accounts matching your filters'}</p></div>
          <Badge tone="slate">{view === 'pending' ? 'Approval queue' : 'Admin-only'}</Badge>
        </div>

        <div className="space-y-3 p-3 md:hidden">
          {loading ? [...Array(4)].map((_, index) => <div key={index} className="animate-pulse rounded-2xl border border-white/10 bg-slate-950/20 p-4"><div className="h-4 w-40 rounded bg-white/10" /><div className="mt-3 h-3 w-56 rounded bg-white/10" /><div className="mt-4 h-8 w-full rounded bg-white/10" /></div>) : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center"><p className="font-bold text-white">No users found</p><p className="mt-1 text-sm text-slate-500">Try another filter or search term.</p></div> : rows.map((user) => {
            const status = statusMeta(user);
            const pending = status.tone === 'amber';
            return <article key={user.id} className="rounded-2xl border border-white/10 bg-slate-950/20 p-4 shadow-lg">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-bold text-white">{user.full_name ?? 'Unnamed user'}</h2><p className="mt-1 truncate text-xs text-slate-500">{user.email ?? user.phone ?? user.id}</p></div><Badge tone={status.tone}>{status.label}</Badge></div>
              <div className="mt-4 flex flex-wrap gap-2"><Badge tone={roleTone(user.role)}>{user.role}</Badge>{user.city ? <Badge tone="slate">{user.city}</Badge> : null}</div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-white/[0.03] p-3"><p className="text-slate-500">Orders</p><p className="mt-1 font-bold text-white">{user.order_count ?? '—'}</p></div><div className="rounded-xl bg-white/[0.03] p-3"><p className="text-slate-500">Total spent</p><p className="mt-1 font-bold text-white">{user.total_spent != null ? '₹' + Number(user.total_spent).toLocaleString('en-IN') : '—'}</p></div></div>
              {pending ? <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={processing?.id === user.id} onClick={() => void approveUser(user.id)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{isProcessing(user.id, 'approve') ? <Spinner /> : null}{isProcessing(user.id, 'approve') ? 'Approving…' : 'Approve'}</button><button type="button" disabled={processing?.id === user.id} onClick={() => void rejectUser(user.id)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-500 px-3 py-2 text-sm font-black text-white hover:bg-rose-400 disabled:opacity-50">{isProcessing(user.id, 'reject') ? <Spinner /> : null}{isProcessing(user.id, 'reject') ? 'Rejecting…' : 'Reject'}</button></div> : null}
              <div className="mt-4 grid grid-cols-2 gap-2"><select key={user.id + '-' + user.role + '-' + selectNonce} defaultValue={user.role} disabled={processing?.id === user.id} onChange={(event) => { const nextRole = event.target.value; if (nextRole !== user.role) setConfirm({ id: user.id, name: user.full_name ?? user.email ?? 'this user', nextRole }); }} className="min-h-10 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-400/40" aria-label={'Change role for ' + (user.full_name ?? user.id)}>{['customer', 'technician', 'supplier', 'admin'].map((option) => <option key={option} value={option}>{option}</option>)}</select><button type="button" disabled={pending || processing?.id === user.id} onClick={() => void toggleActive(user)} className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">{isProcessing(user.id, 'active') ? 'Updating…' : user.is_active !== false ? 'Deactivate' : 'Activate'}</button></div>
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-slate-500"><span>ID {user.id.slice(0, 8)}…</span><span>{formatCreatedAt(user.created_at)}</span></div>
              {user.role === 'customer' ? <Link href={'/admin/orders?search=' + encodeURIComponent(user.full_name ?? user.id)} className="mt-3 block text-center text-xs font-bold text-sky-300 hover:text-sky-200">View customer orders →</Link> : null}
            </article>;
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[1050px] w-full text-sm">
            <thead className="bg-slate-950/30"><tr className="border-b border-white/10"><th className="px-5 py-3 text-left font-semibold text-slate-300">User</th><th className="px-5 py-3 text-left font-semibold text-slate-300">Role</th><th className="px-5 py-3 text-left font-semibold text-slate-300">Account</th><th className="px-5 py-3 text-left font-semibold text-slate-300">Stats</th><th className="px-5 py-3 text-left font-semibold text-slate-300">Created</th><th className="px-5 py-3 text-left font-semibold text-slate-300">Orders</th></tr></thead>
            <tbody>
              {loading ? [...Array(6)].map((_, index) => <tr key={index} className="border-b border-white/5">{['w-56', 'w-28', 'w-24', 'w-28', 'w-24', 'w-20'].map((width, cell) => <td key={cell} className="px-5 py-5"><div className={'h-4 ' + width + ' max-w-full animate-pulse rounded bg-white/10'} /></td>)}</tr>) : rows.length === 0 ? <tr><td colSpan={6} className="px-5 py-16 text-center"><p className="font-bold text-white">No users found</p><p className="mt-1 text-sm text-slate-500">Try another filter or search term.</p></td></tr> : rows.map((user) => {
                const status = statusMeta(user);
                const pending = status.tone === 'amber';
                return <tr key={user.id} className="border-b border-white/5 transition hover:bg-white/[0.035]">
                  <td className="px-5 py-4 align-top"><div className="font-bold text-white">{user.full_name ?? 'Unnamed user'}</div><div className="mt-1 max-w-[380px] text-xs text-slate-400"><span className="font-mono text-[11px] text-slate-500">{user.id.slice(0, 8)}…</span>{user.phone ? <span> · {user.phone}</span> : null}{user.email ? <span className="text-slate-500"> · {user.email}</span> : null}</div>{pending ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={processing?.id === user.id} onClick={() => void approveUser(user.id)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{isProcessing(user.id, 'approve') ? <Spinner /> : null}{isProcessing(user.id, 'approve') ? 'Approving…' : 'Approve'}</button><button type="button" disabled={processing?.id === user.id} onClick={() => void rejectUser(user.id)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-rose-500 px-3 py-2 text-xs font-black text-white hover:bg-rose-400 disabled:opacity-50">{isProcessing(user.id, 'reject') ? <Spinner /> : null}{isProcessing(user.id, 'reject') ? 'Rejecting…' : 'Reject'}</button></div> : null}{user.status ? <div className="mt-2"><Badge tone={status.tone}>{status.label}</Badge></div> : null}</td>
                  <td className="px-5 py-4 align-top"><div className="flex max-w-[200px] flex-col gap-2"><Badge tone={roleTone(user.role)}>{user.role}</Badge><select key={user.id + '-' + user.role + '-' + selectNonce} defaultValue={user.role} disabled={processing?.id === user.id} onChange={(event) => { const nextRole = event.target.value; if (nextRole !== user.role) setConfirm({ id: user.id, name: user.full_name ?? user.email ?? 'this user', nextRole }); }} className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-400/40" aria-label={'Change role for ' + (user.full_name ?? user.id)}>{['customer', 'technician', 'supplier', 'admin'].map((option) => <option key={option} value={option}>{option}</option>)}</select></div></td>
                  <td className="px-5 py-4 align-top"><button type="button" disabled={pending || processing?.id === user.id} onClick={() => void toggleActive(user)} className="text-left disabled:cursor-not-allowed disabled:opacity-50" title={pending ? 'Approve or reject the pending account first' : undefined}><Badge tone={status.tone}>{isProcessing(user.id, 'active') ? <Spinner /> : null}{isProcessing(user.id, 'active') ? 'Updating…' : status.label}</Badge></button></td>
                  <td className="px-5 py-4 align-top text-xs text-slate-400">{user.order_count != null ? <div className="space-y-1"><p>Orders: <span className="font-bold text-slate-200">{user.order_count}</span></p><p>Spent: <span className="font-bold text-slate-200">₹{Number(user.total_spent ?? 0).toLocaleString('en-IN')}</span></p></div> : '—'}</td>
                  <td className="px-5 py-4 align-top text-xs text-slate-300">{formatCreatedAt(user.created_at)}</td>
                  <td className="px-5 py-4 align-top">{user.role === 'customer' ? <Link href={'/admin/orders?search=' + encodeURIComponent(user.full_name ?? user.id)} className="text-xs font-bold text-sky-300 transition hover:text-sky-200 hover:underline">View orders →</Link> : <span className="text-xs text-slate-600">—</span>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}