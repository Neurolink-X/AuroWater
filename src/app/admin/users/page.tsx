'use client';

/**
 * AuroTap admin users (v2)
 *
 * Problems fixed from v1
 * - Race condition: a slow response for an old filter could overwrite a newer one.
 *   Requests are now sequenced and stale results are dropped.
 * - Only the first 200 users were ever reachable. Now properly paginated (server offset).
 * - window.prompt() for rejections replaced by an accessible dialog with a required reason.
 * - The `selectNonce` remount hack for the role <select> is gone (controlled select + dialog).
 * - "Deactivate" never matched the Suspended tab. Suspend / Reactivate now set both status
 *   and is_active, and a suspended user can actually be reactivated.
 * - Deactivating or changing a role had weak or no confirmation. Both are confirmed, and
 *   granting admin shows an explicit warning.
 * - Every filter change flashed a full skeleton. The previous rows now stay visible
 *   (dimmed, with a progress bar) until new data arrives.
 * - A single global "processing" slot blocked all rows. Busy state is now per row.
 * - Filters, search and page live in the URL, so reload, back and shared links keep state.
 *
 * New: optimistic updates, tab counts, bulk approve, copy ID, "/" to search, light theme.
 */

import React, {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  adminUsersWithMeta,
  adminUserUpdate,
  type AdminUserRow,
} from '@/lib/api-client';

/* ───────────────────────────── Types and constants ───────────────────────────── */

type RoleFilter = 'ALL' | 'CUSTOMER' | 'TECHNICIAN' | 'SUPPLIER' | 'ADMIN';
type UserView = 'pending' | 'all' | 'suspended';
type RowAction = 'approve' | 'reject' | 'role' | 'active' | 'suspend';
type UserPatch = Parameters<typeof adminUserUpdate>[1];
type DialogState =
  | { type: 'reject'; user: AdminUserRow }
  | { type: 'role'; user: AdminUserRow; nextRole: string }
  | { type: 'suspend'; user: AdminUserRow }
  | { type: 'bulk'; ids: string[] }
  | null;

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;
const BULK_CONCURRENCY = 4;

const VIEWS: { key: UserView; label: string; status?: string; hint: string }[] = [
  { key: 'pending', label: 'Pending approval', status: 'pending_approval', hint: 'Accounts waiting for an admin decision' },
  { key: 'all', label: 'All users', hint: 'Every account that matches your filters' },
  { key: 'suspended', label: 'Suspended', status: 'suspended', hint: 'Accounts that are currently suspended' },
];
const ROLE_FILTERS: RoleFilter[] = ['ALL', 'CUSTOMER', 'TECHNICIAN', 'SUPPLIER', 'ADMIN'];
const ROLES = ['customer', 'technician', 'supplier', 'admin'];

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600/40 focus-visible:ring-offset-1';
const btn = `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
const btnSm = `inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
const btnSuccess = `${btnSm} bg-emerald-600 text-white hover:bg-emerald-700`;
const btnDanger = `${btnSm} bg-red-600 text-white hover:bg-red-700`;
const btnOutline = `${btnSm} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;

/* ───────────────────────────── Helpers ───────────────────────────── */

const statusOf = (u: AdminUserRow) => String(u.status ?? '').toLowerCase();
const roleOf = (u: AdminUserRow) => String(u.role ?? '').toLowerCase();
const isPending = (u: AdminUserRow) => ['pending', 'pending_approval'].includes(statusOf(u));
const isRejected = (u: AdminUserRow) => statusOf(u) === 'rejected';
const isSuspended = (u: AdminUserRow) => statusOf(u) === 'suspended';
const isLive = (u: AdminUserRow) => !isPending(u) && !isRejected(u) && !isSuspended(u) && u.is_active !== false;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');
const displayName = (u: AdminUserRow) => u.full_name || u.email || u.phone || 'this user';
const shortId = (id: string) => `${String(id).slice(0, 8)}…`;

function statusMeta(u: AdminUserRow): { label: string; tone: Tone } {
  if (isPending(u)) return { label: 'Pending approval', tone: 'amber' };
  if (isRejected(u)) return { label: 'Rejected', tone: 'red' };
  if (isSuspended(u)) return { label: 'Suspended', tone: 'red' };
  if (u.is_active === false) return { label: 'Inactive', tone: 'slate' };
  return { label: 'Active', tone: 'green' };
}

function roleTone(role: string): Tone {
  if (role === 'admin') return 'violet';
  if (role === 'technician') return 'sky';
  if (role === 'supplier') return 'amber';
  return 'slate';
}

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function inr(value: unknown): string {
  const n = Number(value);
  return `₹${(Number.isFinite(n) ? Math.round(n) : 0).toLocaleString('en-IN')}`;
}

function matchesFilters(u: AdminUserRow, view: UserView, role: RoleFilter): boolean {
  if (view === 'pending' && !isPending(u)) return false;
  if (view === 'suspended' && !isSuspended(u)) return false;
  if (role !== 'ALL' && roleOf(u) !== role.toLowerCase()) return false;
  return true;
}

function totalFrom(meta: unknown): number | null {
  const value = (meta as Record<string, unknown> | undefined)?.total;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia('(min-width: 768px)');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia('(min-width: 768px)').matches,
    () => false,
  );
}

/* ───────────────────────────── Small UI pieces ───────────────────────────── */

type Tone = 'green' | 'red' | 'sky' | 'slate' | 'amber' | 'violet';

const TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  sky: 'bg-sky-50 text-sky-800 ring-sky-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
};

function Badge({ children, tone }: { children: React.ReactNode; tone: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
    />
  );
}

function CountPill({ value, active }: { value: number | null; active: boolean }) {
  if (value === null || value <= 0) return null;
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
        active ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-900'
      }`}
    >
      {value > 99 ? '99+' : value}
    </span>
  );
}

function ConfirmDialog({
  title,
  tone = 'primary',
  confirmLabel,
  busy,
  error,
  confirmDisabled,
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  tone?: 'primary' | 'danger' | 'success';
  confirmLabel: string;
  busy: boolean;
  error: string | null;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const target =
      panelRef.current?.querySelector<HTMLElement>('textarea, input, select') ??
      panelRef.current?.querySelector<HTMLElement>('[data-confirm]');
    target?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !busy) {
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key === 'Tab' && panelRef.current) {
      const items = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea, input, select, [href]',
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const confirmClass =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : tone === 'success'
        ? 'bg-emerald-600 hover:bg-emerald-700'
        : 'bg-cyan-700 hover:bg-cyan-800';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" onKeyDown={onKeyDown}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={() => !busy && onCancel()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="space-y-3 px-5 pb-4 pt-5">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {children}
          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
              {error}
            </div>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3.5 sm:flex-row sm:justify-end">
          <button type="button" className={btn} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            data-confirm
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${confirmClass} ${focusRing}`}
          >
            {busy && <Spinner />}
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectDialog({
  user,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  user: AdminUserRow;
  busy: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const id = useId();
  const valid = reason.trim().length >= 3;
  return (
    <ConfirmDialog
      title="Reject this account?"
      tone="danger"
      confirmLabel="Reject account"
      busy={busy}
      error={error}
      confirmDisabled={!valid}
      onConfirm={() => valid && onConfirm(reason.trim())}
      onCancel={onCancel}
    >
      <p className="text-sm text-slate-600">
        <strong className="font-semibold text-slate-900">{displayName(user)}</strong> will be marked as rejected and
        won’t be able to use the account.
      </p>
      <div>
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-800">
          Reason for rejection
        </label>
        <textarea
          id={id}
          rows={3}
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder="For example: documents are unclear or the phone number could not be verified"
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 hover:border-slate-400 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20"
        />
        <p className="mt-1 text-xs text-slate-500">Required. This is saved with the account.</p>
      </div>
    </ConfirmDialog>
  );
}

/* ───────────────────────────── Row actions and rows ───────────────────────────── */

interface RowHandlers {
  onApprove: (user: AdminUserRow) => void;
  onReject: (user: AdminUserRow) => void;
  onSuspend: (user: AdminUserRow) => void;
  onReactivate: (user: AdminUserRow) => void;
  onRole: (user: AdminUserRow, nextRole: string) => void;
  onCopy: (user: AdminUserRow) => void;
  onSelect: (id: string, checked: boolean) => void;
}

function RowActions({
  user,
  busy,
  handlers,
}: {
  user: AdminUserRow;
  busy?: RowAction;
  handlers: RowHandlers;
}) {
  const disabled = Boolean(busy);

  if (isPending(user) || isRejected(user)) {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSuccess} disabled={disabled} onClick={() => handlers.onApprove(user)}>
          {busy === 'approve' && <Spinner />}
          {busy === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        {isPending(user) && (
          <button type="button" className={btnDanger} disabled={disabled} onClick={() => handlers.onReject(user)}>
            Reject
          </button>
        )}
      </div>
    );
  }

  if (isLive(user)) {
    return (
      <button type="button" className={btnOutline} disabled={disabled} onClick={() => handlers.onSuspend(user)}>
        {busy === 'suspend' && <Spinner />}
        {busy === 'suspend' ? 'Suspending…' : 'Suspend'}
      </button>
    );
  }

  return (
    <button type="button" className={btnOutline} disabled={disabled} onClick={() => handlers.onReactivate(user)}>
      {busy === 'active' && <Spinner />}
      {busy === 'active' ? 'Reactivating…' : 'Reactivate'}
    </button>
  );
}

function RoleSelect({
  user,
  disabled,
  onRole,
  className = '',
}: {
  user: AdminUserRow;
  disabled: boolean;
  onRole: RowHandlers['onRole'];
  className?: string;
}) {
  const current = roleOf(user);
  const options = ROLES.includes(current) || !current ? ROLES : [current, ...ROLES];
  return (
    <select
      aria-label={`Change role for ${displayName(user)}`}
      value={current}
      disabled={disabled}
      onChange={(e) => onRole(user, e.target.value)}
      className={`rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-400 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20 disabled:opacity-50 ${className}`}
    >
      {options.map((r) => (
        <option key={r} value={r}>
          {cap(r)}
        </option>
      ))}
    </select>
  );
}

const ordersHref = (u: AdminUserRow) => `/admin/orders?search=${encodeURIComponent(u.full_name ?? u.id)}`;

const UserTableRow = memo(function UserTableRow({
  user,
  busy,
  selected,
  selectable,
  handlers,
}: {
  user: AdminUserRow;
  busy?: RowAction;
  selected: boolean;
  selectable: boolean;
  handlers: RowHandlers;
}) {
  const status = statusMeta(user);
  const role = roleOf(user);
  return (
    <tr className={`border-t border-slate-100 align-top transition-colors hover:bg-slate-50 ${selected ? 'bg-cyan-50/50' : ''}`}>
      {selectable && (
        <td className="w-10 py-4 pl-5">
          <input
            type="checkbox"
            checked={selected}
            disabled={Boolean(busy)}
            onChange={(e) => handlers.onSelect(user.id, e.target.checked)}
            aria-label={`Select ${displayName(user)}`}
            className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600"
          />
        </td>
      )}
      <td className="px-5 py-4">
        <p className="font-semibold text-slate-900">{user.full_name ?? 'Unnamed user'}</p>
        <p className="mt-0.5 max-w-[320px] truncate text-xs text-slate-500">
          {[user.email, user.phone].filter(Boolean).join(' · ') || 'No contact details'}
        </p>
        <button
          type="button"
          onClick={() => handlers.onCopy(user)}
          title="Copy full user ID"
          className={`mt-1 rounded font-mono text-[11px] text-slate-400 hover:text-slate-700 ${focusRing}`}
        >
          {shortId(user.id)} <span className="font-sans">Copy</span>
        </button>
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-col items-start gap-2">
          <Badge tone={roleTone(role)}>{cap(role) || 'No role'}</Badge>
          <RoleSelect user={user} disabled={Boolean(busy)} onRole={handlers.onRole} />
        </div>
      </td>
      <td className="px-5 py-4">
        <Badge tone={status.tone}>{status.label}</Badge>
        {user.city && <p className="mt-1.5 text-xs text-slate-500">{user.city}</p>}
      </td>
      <td className="px-5 py-4 text-xs text-slate-500">
        {user.order_count != null ? (
          <div className="space-y-0.5 tabular-nums">
            <p>
              Orders <span className="font-semibold text-slate-800">{user.order_count}</span>
            </p>
            <p>
              Spent <span className="font-semibold text-slate-800">{inr(user.total_spent)}</span>
            </p>
          </div>
        ) : (
          '—'
        )}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">{formatDate(user.created_at)}</td>
      <td className="px-5 py-4">
        <div className="flex flex-col items-start gap-2">
          <RowActions user={user} busy={busy} handlers={handlers} />
          {role === 'customer' && (
            <Link href={ordersHref(user)} className="text-xs font-semibold text-cyan-800 hover:underline">
              View orders
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
});

const UserCard = memo(function UserCard({
  user,
  busy,
  selected,
  selectable,
  handlers,
}: {
  user: AdminUserRow;
  busy?: RowAction;
  selected: boolean;
  selectable: boolean;
  handlers: RowHandlers;
}) {
  const status = statusMeta(user);
  const role = roleOf(user);
  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm ${selected ? 'border-cyan-400 ring-1 ring-cyan-300' : 'border-slate-200'}`}
    >
      <div className="flex items-start gap-3">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            disabled={Boolean(busy)}
            onChange={(e) => handlers.onSelect(user.id, e.target.checked)}
            aria-label={`Select ${displayName(user)}`}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-semibold text-slate-900">{user.full_name ?? 'Unnamed user'}</h3>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {[user.email, user.phone].filter(Boolean).join(' · ') || 'No contact details'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={roleTone(role)}>{cap(role) || 'No role'}</Badge>
        {user.city && <Badge tone="slate">{user.city}</Badge>}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 p-2.5">
          <dt className="text-slate-500">Orders</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{user.order_count ?? '—'}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5">
          <dt className="text-slate-500">Spent</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{user.total_spent != null ? inr(user.total_spent) : '—'}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2.5">
          <dt className="text-slate-500">Joined</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{formatDate(user.created_at)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <RowActions user={user} busy={busy} handlers={handlers} />
        <RoleSelect user={user} disabled={Boolean(busy)} onRole={handlers.onRole} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
        <button
          type="button"
          onClick={() => handlers.onCopy(user)}
          className={`rounded font-mono text-[11px] text-slate-400 hover:text-slate-700 ${focusRing}`}
        >
          {shortId(user.id)} <span className="font-sans">Copy</span>
        </button>
        {role === 'customer' && (
          <Link href={ordersHref(user)} className="font-semibold text-cyan-800 hover:underline">
            View orders
          </Link>
        )}
      </div>
    </article>
  );
});

function SkeletonRows({ desktop }: { desktop: boolean }) {
  if (desktop) {
    return (
      <div className="divide-y divide-slate-100" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-5 py-5">
            <div className="h-4 w-56 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3 p-3" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-3 w-56 animate-pulse rounded bg-slate-100" />
          <div className="mt-4 h-9 w-full animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── Page ───────────────────────────── */

function UsersContent() {
  const searchParams = useSearchParams();

  const [view, setView] = useState<UserView>(() => {
    const v = searchParams.get('view');
    return v === 'all' || v === 'suspended' || v === 'pending' ? v : 'pending';
  });
  const [role, setRole] = useState<RoleFilter>(() => {
    const r = (searchParams.get('role') ?? '').toUpperCase() as RoleFilter;
    return ROLE_FILTERS.includes(r) ? r : 'ALL';
  });
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [page, setPage] = useState(() => Math.max(0, (Number(searchParams.get('page')) || 1) - 1));

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ pending: number | null; suspended: number | null }>({
    pending: null,
    suspended: null,
  });
  const [busy, setBusy] = useState<Record<string, RowAction>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const isDesktop = useIsDesktop();
  const debouncedQ = useDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);
  const requestRef = useRef(0);
  const mountedRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  /* ── URL sync (no navigation, no re-render of the router) ── */
  useEffect(() => {
    const params = new URLSearchParams();
    if (view !== 'pending') params.set('view', view);
    if (role !== 'ALL') params.set('role', role.toLowerCase());
    if (debouncedQ) params.set('q', debouncedQ);
    if (page > 0) params.set('page', String(page + 1));
    const qs = params.toString();
    try {
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    } catch {
      /* non-critical */
    }
  }, [view, role, debouncedQ, page]);

  /* ── Data loading: sequenced so stale responses are ignored ── */
  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const id = ++requestRef.current;
      if (opts.silent) setRefreshing(true);
      else setLoading(true);

      try {
        const params: { role?: string; search?: string; status?: string; limit: number; offset: number } = {
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        };
        const status = VIEWS.find((v) => v.key === view)?.status;
        if (status) params.status = status;
        if (role !== 'ALL') params.role = role.toLowerCase();
        if (debouncedQ) params.search = debouncedQ;

        const res = await adminUsersWithMeta(params);
        if (!mountedRef.current || id !== requestRef.current) return;

        const data = res.data ?? [];
        // The last page may have emptied out (for example after approving its only row).
        if (data.length === 0 && page > 0) {
          setPage((p) => Math.max(0, p - 1));
          return;
        }
        setRows(data);
        setTotal(totalFrom(res.meta));
        setError(null);
      } catch (cause: unknown) {
        if (!mountedRef.current || id !== requestRef.current) return;
        setError(cause instanceof Error ? cause.message : 'Failed to load users');
      } finally {
        if (mountedRef.current && id === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [view, role, debouncedQ, page],
  );

  const loadCounts = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        adminUsersWithMeta({ status: 'pending_approval', limit: 1, offset: 0 }),
        adminUsersWithMeta({ status: 'suspended', limit: 1, offset: 0 }),
      ]);
      if (mountedRef.current) setCounts({ pending: totalFrom(p.meta), suspended: totalFrom(s.meta) });
    } catch {
      /* counts are a nicety; ignore failures */
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  // Selection never survives a filter or page change.
  useEffect(() => {
    setSelected(new Set());
  }, [view, role, debouncedQ, page]);

  /* ── Shortcut: "/" focuses search ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !dialog) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  /* ── Filter handlers (always reset to the first page) ── */
  const changeView = useCallback((next: UserView) => {
    setView(next);
    setPage(0);
  }, []);
  const changeRole = useCallback((next: RoleFilter) => {
    setRole(next);
    setPage(0);
  }, []);
  const changeQuery = useCallback((next: string) => {
    setQ(next);
    setPage(0);
  }, []);

  /* ── Updates: optimistic, per-row busy, background reconcile ── */
  const setBusyFor = useCallback((id: string, action?: RowAction) => {
    setBusy((current) => {
      const next = { ...current };
      if (action) next[id] = action;
      else delete next[id];
      return next;
    });
  }, []);

  /** Returns an error message, or null on success. */
  const runUpdate = useCallback(
    async (user: AdminUserRow, action: RowAction, patch: UserPatch, success: string): Promise<string | null> => {
      setBusyFor(user.id, action);
      setRows((current) =>
        current.flatMap((r) => {
          if (r.id !== user.id) return [r];
          const merged = { ...r, ...patch } as AdminUserRow;
          return matchesFilters(merged, view, role) ? [merged] : [];
        }),
      );
      try {
        await adminUserUpdate(user.id, patch);
        toast.success(success);
        void loadCounts();
        void load({ silent: true });
        return null;
      } catch (cause: unknown) {
        const message = cause instanceof Error ? cause.message : 'User update failed';
        toast.error(message);
        void load({ silent: true }); // restores the real server state
        return message;
      } finally {
        setBusyFor(user.id);
      }
    },
    [load, loadCounts, role, setBusyFor, view],
  );

  const handlers = useMemo<RowHandlers>(
    () => ({
      onApprove: async (user) => {
        const err = await runUpdate(user, 'approve', { status: 'active', is_active: true }, `Approved ${displayName(user)}`);
        if (err) setError(err);
      },
      onReject: (user) => {
        setDialogError(null);
        setDialog({ type: 'reject', user });
      },
      onSuspend: (user) => {
        setDialogError(null);
        setDialog({ type: 'suspend', user });
      },
      onReactivate: async (user) => {
        const err = await runUpdate(user, 'active', { status: 'active', is_active: true }, `Reactivated ${displayName(user)}`);
        if (err) setError(err);
      },
      onRole: (user, nextRole) => {
        if (nextRole === roleOf(user)) return;
        setDialogError(null);
        setDialog({ type: 'role', user, nextRole });
      },
      onCopy: async (user) => {
        try {
          await navigator.clipboard.writeText(user.id);
          toast.success('User ID copied');
        } catch {
          toast.error('Could not copy. Select the ID and copy it manually.');
        }
      },
      onSelect: (id, checked) =>
        setSelected((current) => {
          const next = new Set(current);
          if (checked) next.add(id);
          else next.delete(id);
          return next;
        }),
    }),
    [runUpdate],
  );

  const closeDialog = useCallback(() => {
    if (!dialogBusy) setDialog(null);
  }, [dialogBusy]);

  const bulkApprove = useCallback(
    async (ids: string[]) => {
      let ok = 0;
      let failed = 0;
      const queue = [...ids];
      const worker = async () => {
        while (queue.length) {
          const id = queue.shift() as string;
          setBusyFor(id, 'approve');
          try {
            await adminUserUpdate(id, { status: 'active', is_active: true });
            ok += 1;
            setRows((current) => current.filter((r) => r.id !== id));
          } catch {
            failed += 1;
          } finally {
            setBusyFor(id);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(BULK_CONCURRENCY, ids.length) }, worker));
      setSelected(new Set());
      if (ok) toast.success(`Approved ${ok} ${ok === 1 ? 'account' : 'accounts'}`);
      if (failed) toast.error(`${failed} ${failed === 1 ? 'account' : 'accounts'} couldn’t be approved. They’re still pending.`);
      void loadCounts();
      void load({ silent: true });
      return failed === 0;
    },
    [load, loadCounts, setBusyFor],
  );

  const submitDialog = useCallback(
    async (reason?: string) => {
      if (!dialog) return;
      setDialogBusy(true);
      setDialogError(null);
      let message: string | null = null;

      if (dialog.type === 'reject') {
        message = await runUpdate(
          dialog.user,
          'reject',
          { status: 'rejected', rejection_reason: reason ?? '', is_active: false },
          `Rejected ${displayName(dialog.user)}`,
        );
      } else if (dialog.type === 'role') {
        message = await runUpdate(dialog.user, 'role', { role: dialog.nextRole.toLowerCase() }, `${displayName(dialog.user)} is now ${dialog.nextRole}`);
      } else if (dialog.type === 'suspend') {
        message = await runUpdate(dialog.user, 'suspend', { status: 'suspended', is_active: false }, `Suspended ${displayName(dialog.user)}`);
      } else {
        const allOk = await bulkApprove(dialog.ids);
        message = allOk ? null : 'Some accounts could not be approved. See the notification for details.';
      }

      setDialogBusy(false);
      if (message) setDialogError(message);
      else setDialog(null);
    },
    [bulkApprove, dialog, runUpdate],
  );

  /* ── Derived ── */
  const selectableIds = useMemo(
    () => (view === 'pending' ? rows.filter((r) => isPending(r) && !busy[r.id]).map((r) => r.id) : []),
    [rows, busy, view],
  );
  const selectable = view === 'pending';
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleAll = useCallback(
    (checked: boolean) => setSelected(checked ? new Set(selectableIds) : new Set()),
    [selectableIds],
  );

  const hasMore = total !== null ? (page + 1) * PAGE_SIZE < total : rows.length === PAGE_SIZE;
  const from = rows.length ? page * PAGE_SIZE + 1 : 0;
  const to = page * PAGE_SIZE + rows.length;
  const pageCount = total !== null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null;
  const filtersActive = role !== 'ALL' || Boolean(q);
  const currentView = VIEWS.find((v) => v.key === view) ?? VIEWS[0];
  const showSkeleton = loading && rows.length === 0;
  const dimmed = (loading || refreshing) && rows.length > 0;

  const countFor = (key: UserView) => (key === 'pending' ? counts.pending : key === 'suspended' ? counts.suspended : null);

  /* ───────────────────────────── Render ───────────────────────────── */

  return (
    <div className="min-h-screen bg-[#F3F6FA] text-slate-900">
      <div className="mx-auto w-full max-w-7xl space-y-5 px-3 pb-28 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Users</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Review registrations, manage roles and control who can access their accounts.
              </p>
            </div>
            <button
              type="button"
              className={btn}
              onClick={() => {
                void load({ silent: true });
                void loadCounts();
              }}
              disabled={loading || refreshing}
            >
              {loading || refreshing ? <Spinner /> : <span aria-hidden="true">↻</span>}
              {loading || refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>

          {view !== 'pending' && (counts.pending ?? 0) > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>
                <strong className="font-semibold">{counts.pending}</strong>{' '}
                {counts.pending === 1 ? 'account is' : 'accounts are'} waiting for approval.
              </span>
              <button type="button" className={btnOutline} onClick={() => changeView('pending')}>
                Review now
              </button>
            </div>
          )}

          <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Account status">
              {VIEWS.map((v) => {
                const active = view === v.key;
                return (
                  <button
                    key={v.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => changeView(v.key)}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${focusRing} ${
                      active
                        ? 'bg-cyan-700 text-white shadow-sm'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {v.label}
                    <CountPill value={countFor(v.key)} active={active} />
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Role">
                {ROLE_FILTERS.map((r) => {
                  const active = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={active}
                      onClick={() => changeRole(r)}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${focusRing} ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {r === 'ALL' ? 'All roles' : cap(r)}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full lg:max-w-sm">
                <label htmlFor="user-search" className="sr-only">
                  Search users
                </label>
                <input
                  id="user-search"
                  ref={searchRef}
                  type="search"
                  value={q}
                  onChange={(e) => changeQuery(e.target.value)}
                  placeholder="Search name, phone or email"
                  autoComplete="off"
                  className="block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-16 text-sm shadow-sm placeholder:text-slate-400 hover:border-slate-400 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20"
                />
                {q ? (
                  <button
                    type="button"
                    onClick={() => changeQuery('')}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 ${focusRing}`}
                  >
                    Clear
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px] text-slate-400">
                    /
                  </kbd>
                )}
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-semibold">Something went wrong</p>
              <p className="mt-0.5 text-red-800">{error}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className={btn} onClick={() => void load()}>
                Try again
              </button>
              <button type="button" className={btn} onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        <section
          className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          aria-busy={loading || refreshing}
        >
          {dimmed && (
            <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-cyan-100" aria-hidden="true">
              <div className="h-full w-1/3 animate-pulse bg-cyan-600 motion-reduce:animate-none" />
            </div>
          )}

          <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div aria-live="polite">
              <p className="font-semibold text-slate-900">
                {showSkeleton
                  ? 'Loading users…'
                  : total !== null
                    ? `${total.toLocaleString('en-IN')} ${total === 1 ? 'user' : 'users'}`
                    : `${rows.length} ${rows.length === 1 ? 'user' : 'users'} on this page`}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{currentView.hint}</p>
            </div>
            {selectable && selectableIds.length > 0 && isDesktop === false && (
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600"
                />
                Select all on this page
              </label>
            )}
          </div>

          <div className={dimmed ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {showSkeleton ? (
              <SkeletonRows desktop={isDesktop} />
            ) : rows.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <p className="font-semibold text-slate-900">
                  {view === 'pending' && !filtersActive ? 'The approval queue is clear' : 'No users found'}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                  {view === 'pending' && !filtersActive
                    ? 'New registrations that need review will appear here.'
                    : 'Try a different filter or search term.'}
                </p>
                {filtersActive && (
                  <button
                    type="button"
                    className={`${btn} mt-4`}
                    onClick={() => {
                      setRole('ALL');
                      setQ('');
                      setPage(0);
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : isDesktop ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      {selectable && (
                        <th scope="col" className="w-10 py-3 pl-5">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            disabled={selectableIds.length === 0}
                            onChange={(e) => toggleAll(e.target.checked)}
                            aria-label="Select all pending users on this page"
                            className="h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600"
                          />
                        </th>
                      )}
                      {['User', 'Role', 'Account', 'Activity', 'Joined', 'Actions'].map((h) => (
                        <th key={h} scope="col" className="px-5 py-3 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((user) => (
                      <UserTableRow
                        key={user.id}
                        user={user}
                        busy={busy[user.id]}
                        selected={selected.has(user.id)}
                        selectable={selectable}
                        handlers={handlers}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-50 p-3">
                {rows.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    busy={busy[user.id]}
                    selected={selected.has(user.id)}
                    selectable={selectable}
                    handlers={handlers}
                  />
                ))}
              </div>
            )}
          </div>

          {(rows.length > 0 || page > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-6">
              <span>
                {total !== null
                  ? `Showing ${from}–${to} of ${total.toLocaleString('en-IN')}`
                  : `Showing ${from}–${to}`}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" className={btn} disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span className="tabular-nums">
                  Page {page + 1}
                  {pageCount ? ` of ${pageCount}` : ''}
                </span>
                <button type="button" className={btn} disabled={!hasMore || loading} onClick={() => setPage(page + 1)}>
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-6 sm:pb-4">
          <div className="pointer-events-auto mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.18)] sm:px-5">
            <p className="text-sm font-semibold text-slate-900">
              {selected.size} {selected.size === 1 ? 'account' : 'accounts'} selected
            </p>
            <div className="flex gap-2">
              <button type="button" className={btn} onClick={() => setSelected(new Set())}>
                Clear
              </button>
              <button
                type="button"
                className={`inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 ${focusRing}`}
                onClick={() => {
                  setDialogError(null);
                  setDialog({ type: 'bulk', ids: [...selected] });
                }}
              >
                Approve selected
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog?.type === 'reject' && (
        <RejectDialog
          user={dialog.user}
          busy={dialogBusy}
          error={dialogError}
          onConfirm={(reason) => void submitDialog(reason)}
          onCancel={closeDialog}
        />
      )}

      {dialog?.type === 'role' && (
        <ConfirmDialog
          title="Change role?"
          tone={dialog.nextRole === 'admin' ? 'danger' : 'primary'}
          confirmLabel="Change role"
          busy={dialogBusy}
          error={dialogError}
          onConfirm={() => void submitDialog()}
          onCancel={closeDialog}
        >
          <p className="text-sm text-slate-600">
            Change <strong className="font-semibold text-slate-900">{displayName(dialog.user)}</strong> from{' '}
            <strong className="font-semibold text-slate-900">{cap(roleOf(dialog.user)) || 'no role'}</strong> to{' '}
            <strong className="font-semibold text-slate-900">{cap(dialog.nextRole)}</strong>?
          </p>
          {dialog.nextRole === 'admin' && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
              Admins can change pricing, settings and other users’ accounts. Only grant this to trusted staff.
            </div>
          )}
          {roleOf(dialog.user) === 'admin' && dialog.nextRole !== 'admin' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              They will lose access to the admin area.
            </div>
          )}
        </ConfirmDialog>
      )}

      {dialog?.type === 'suspend' && (
        <ConfirmDialog
          title="Suspend this account?"
          tone="danger"
          confirmLabel="Suspend account"
          busy={dialogBusy}
          error={dialogError}
          onConfirm={() => void submitDialog()}
          onCancel={closeDialog}
        >
          <p className="text-sm text-slate-600">
            <strong className="font-semibold text-slate-900">{displayName(dialog.user)}</strong> will be marked as
            suspended and lose access until you reactivate the account. You can find them under the Suspended filter.
          </p>
        </ConfirmDialog>
      )}

      {dialog?.type === 'bulk' && (
        <ConfirmDialog
          title={`Approve ${dialog.ids.length} ${dialog.ids.length === 1 ? 'account' : 'accounts'}?`}
          tone="success"
          confirmLabel={`Approve ${dialog.ids.length}`}
          busy={dialogBusy}
          error={dialogError}
          onConfirm={() => void submitDialog()}
          onCancel={closeDialog}
        >
          <p className="text-sm text-slate-600">
            Approved accounts become active straight away. Check the selection first if you haven’t reviewed each
            registration.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

/** useSearchParams must sit under a Suspense boundary for production builds. */
export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 p-6">
          <div className="mx-auto h-40 max-w-7xl animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      }
    >
      <UsersContent />
    </Suspense>
  );
}








// 'use client';

// import React, { useCallback, useEffect, useMemo, useState } from 'react';
// import Link from 'next/link';
// import { toast } from 'sonner';
// import {
//   adminUsersWithMeta,
//   adminUserUpdate,
//   type AdminUserRow,
// } from '@/lib/api-client';

// type RoleTab = 'ALL' | 'CUSTOMER' | 'TECHNICIAN' | 'SUPPLIER' | 'ADMIN';
// type UserView = 'pending' | 'all' | 'suspended';
// type ProcessingAction = 'approve' | 'reject' | 'role' | 'active';
// type ProcessingState = { id: string; action: ProcessingAction } | null;

// function Badge({
//   children,
//   tone,
// }: {
//   children: React.ReactNode;
//   tone: 'green' | 'rose' | 'sky' | 'slate' | 'amber';
// }) {
//   const cls =
//     tone === 'green'
//       ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
//       : tone === 'rose'
//         ? 'border-rose-400/20 bg-rose-400/10 text-rose-200'
//         : tone === 'sky'
//           ? 'border-sky-400/20 bg-sky-400/10 text-sky-200'
//           : tone === 'amber'
//             ? 'border-amber-400/20 bg-amber-400/10 text-amber-200'
//             : 'border-white/10 bg-white/5 text-slate-200';
//   return (
//     <span className={'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ' + cls}>
//       {children}
//     </span>
//   );
// }

// function Spinner() {
//   return <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />;
// }

// function roleTone(role: string): 'green' | 'sky' | 'slate' {
//   const normalized = role.toLowerCase();
//   if (normalized === 'admin') return 'sky';
//   if (normalized === 'technician') return 'slate';
//   return 'green';
// }

// function statusMeta(user: AdminUserRow) {
//   const status = String(user.status ?? '').toLowerCase();
//   if (status === 'pending' || status === 'pending_approval') return { label: 'Pending approval', tone: 'amber' as const };
//   if (status === 'rejected') return { label: 'Rejected', tone: 'rose' as const };
//   if (status === 'suspended') return { label: 'Suspended', tone: 'rose' as const };
//   if (user.is_active === false) return { label: 'Inactive', tone: 'rose' as const };
//   return { label: 'Active', tone: 'green' as const };
// }

// function formatCreatedAt(value: string) {
//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return '—';
//   return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
// }

// export default function AdminUsersPage() {
//   const [view, setView] = useState<UserView>('pending');
//   const [roleTab, setRoleTab] = useState<RoleTab>('ALL');
//   const [q, setQ] = useState('');
//   const [rawRows, setRawRows] = useState<AdminUserRow[]>([]);
//   const [meta, setMeta] = useState<Record<string, unknown>>({});
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [confirm, setConfirm] = useState<{ id: string; name: string; nextRole: string } | null>(null);
//   const [selectNonce, setSelectNonce] = useState(0);
//   const [processing, setProcessing] = useState<ProcessingState>(null);

//   const load = useCallback(async () => {
//     setLoading(true);
//     setError(null);
//     try {
//       const params: { role?: string; search?: string; status?: string; limit: number; offset: number } = { limit: 200, offset: 0 };
//       if (view === 'pending') params.status = 'pending_approval';
//       if (view === 'suspended') params.status = 'suspended';
//       if (roleTab !== 'ALL') params.role = roleTab.toLowerCase();
//       if (q.trim()) params.search = q.trim();
//       const res = await adminUsersWithMeta(params);
//       setRawRows(res.data ?? []);
//       setMeta(res.meta ?? {});
//     } catch (e: unknown) {
//       setError(e instanceof Error ? e.message : 'Failed to load users');
//     } finally {
//       setLoading(false);
//     }
//   }, [roleTab, q, view]);

//   useEffect(() => {
//     if (!q.trim()) { void load(); return; }
//     const timer = setTimeout(() => void load(), 350);
//     return () => clearTimeout(timer);
//   }, [load, q, roleTab]);

//   const rows = useMemo(() => rawRows, [rawRows]);
//   const totalCount = useMemo(() => typeof meta.total === 'number' ? meta.total : rows.length, [meta, rows.length]);
//   const pendingCount = useMemo(() => rows.filter((user) => {
//     const status = String(user.status ?? '').toLowerCase();
//     return status === 'pending' || status === 'pending_approval';
//   }).length, [rows]);

//   const runUserUpdate = async (
//     id: string,
//     action: ProcessingAction,
//     patch: Parameters<typeof adminUserUpdate>[1],
//     successMessage: string,
//   ) => {
//     try {
//       setProcessing({ id, action });
//       setError(null);
//       await adminUserUpdate(id, patch);
//       toast.success(successMessage);
//       await load();
//     } catch (e: unknown) {
//       const message = e instanceof Error ? e.message : 'User update failed';
//       setError(message);
//       toast.error(message);
//     } finally {
//       setProcessing(null);
//     }
//   };

//   const approveUser = async (id: string) => {
//     await runUserUpdate(id, 'approve', { status: 'active', is_active: true }, 'User approved successfully');
//   };

//   const rejectUser = async (id: string) => {
//     const reason = window.prompt('Reason for rejection');
//     if (!reason?.trim()) return;
//     await runUserUpdate(
//       id,
//       'reject',
//       { status: 'rejected', rejection_reason: reason.trim(), is_active: false },
//       'User rejected successfully',
//     );
//   };

//   const applyRoleChange = async (id: string, nextRole: string) => {
//     try {
//       setProcessing({ id, action: 'role' });
//       setError(null);
//       await adminUserUpdate(id, { role: nextRole.toLowerCase() });
//       toast.success('Role updated successfully');
//       setConfirm(null);
//       setSelectNonce((value) => value + 1);
//       await load();
//     } catch (e: unknown) {
//       const message = e instanceof Error ? e.message : 'Role update failed';
//       setError(message);
//       toast.error(message);
//     } finally {
//       setProcessing(null);
//     }
//   };

//   const toggleActive = async (user: AdminUserRow) => {
//     const next = !(user.is_active !== false);
//     await runUserUpdate(user.id, 'active', { is_active: next }, next ? 'User activated' : 'User deactivated');
//   };

//   const isProcessing = (id: string, action?: ProcessingAction) =>
//     processing?.id === id && (action ? processing.action === action : true);

//   return (
//     <div className="space-y-6 pb-8">
//       <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-white/[0.04] to-indigo-500/10 p-5 shadow-2xl sm:p-7">
//         <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
//         <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
//         <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
//           <div>
//             <div className="mb-3 flex flex-wrap items-center gap-2">
//               <Badge tone="sky">Admin Control Center</Badge>
//               {view === 'pending' && pendingCount > 0 ? <Badge tone="amber">{pendingCount} awaiting review</Badge> : null}
//             </div>
//             <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">User management</h1>
//             <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
//               Review accounts, approve registrations, manage roles, and control account access from one secure admin workspace.
//             </p>
//           </div>
//           <button
//             type="button"
//             onClick={() => void load()}
//             disabled={loading}
//             className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
//           >
//             {loading ? <Spinner /> : null}
//             {loading ? 'Refreshing…' : 'Refresh users'}
//           </button>
//         </div>
//         <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
//           <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Showing</p><p className="mt-1 text-2xl font-black text-white">{totalCount}</p></div>
//           <div className="rounded-2xl border border-white/10 bg-slate-950/20 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending</p><p className="mt-1 text-2xl font-black text-amber-300">{view === 'pending' ? pendingCount : '—'}</p></div>
//           <div className="col-span-2 rounded-2xl border border-white/10 bg-slate-950/20 p-4 sm:col-span-1"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Access</p><p className="mt-1 text-sm font-bold text-emerald-300">Admin-only</p></div>
//         </div>
//       </section>

//       <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-xl backdrop-blur-xl sm:p-5">
//         <div className="flex flex-col gap-4">
//           <div className="flex flex-wrap gap-2" role="tablist" aria-label="User status views">
//             {(['pending', 'all', 'suspended'] as const).map((value) => {
//               const active = view === value;
//               const label = value === 'pending' ? 'Pending approval' : value === 'all' ? 'All users' : 'Suspended';
//               return <button key={value} type="button" role="tab" aria-selected={active} onClick={() => setView(value)} className={'rounded-xl px-4 py-2.5 text-sm font-bold transition ' + (active ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20' : 'border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10')}>{label}</button>;
//             })}
//           </div>
//           <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
//             <div className="flex flex-wrap gap-2" role="tablist" aria-label="User role filters">
//               {(['ALL', 'CUSTOMER', 'TECHNICIAN', 'SUPPLIER', 'ADMIN'] as RoleTab[]).map((role) => {
//                 const active = roleTab === role;
//                 return <button key={role} type="button" role="tab" aria-selected={active} onClick={() => setRoleTab(role)} className={'rounded-xl border px-4 py-2 text-sm font-bold transition ' + (active ? 'border-indigo-400/40 bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10')}>{role === 'ALL' ? 'All' : role.charAt(0) + role.slice(1).toLowerCase()}</button>;
//               })}
//             </div>
//             <div className="relative w-full lg:max-w-md">
//               <label htmlFor="user-search" className="sr-only">Search users</label>
//               <input id="user-search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, phone, email…" autoComplete="off" className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-2.5 pr-20 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10" />
//               {q ? <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white">Clear</button> : null}
//             </div>
//           </div>
//         </div>
//       </section>

//       {error ? <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">User management action failed</p><p className="mt-1 text-rose-200/80">{error}</p></div><button type="button" onClick={() => setError(null)} className="self-start rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10">Dismiss</button></div> : null}

//       {confirm ? <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-100 shadow-lg"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-300">Confirm role change</p><p className="mt-1 text-sm">Change <strong className="text-white">{confirm.name}</strong> to <strong className="text-white">{confirm.nextRole}</strong>?</p></div><div className="flex gap-2"><button type="button" disabled={processing?.id === confirm.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50" onClick={() => { setConfirm(null); setSelectNonce((value) => value + 1); }}>Cancel</button><button type="button" disabled={processing?.id === confirm.id} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50" onClick={() => void applyRoleChange(confirm.id, confirm.nextRole)}>{isProcessing(confirm.id, 'role') ? <Spinner /> : null}{isProcessing(confirm.id, 'role') ? 'Updating…' : 'Confirm change'}</button></div></div></div> : null}

//       <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
//         <div className="flex flex-col gap-2 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
//           <div><p className="font-bold text-white">{loading ? 'Loading users…' : rows.length + ' user' + (rows.length === 1 ? '' : 's')}</p><p className="mt-0.5 text-xs text-slate-500">{view === 'pending' ? 'Accounts awaiting admin approval' : view === 'suspended' ? 'Accounts currently marked as suspended' : 'All accounts matching your filters'}</p></div>
//           <Badge tone="slate">{view === 'pending' ? 'Approval queue' : 'Admin-only'}</Badge>
//         </div>

//         <div className="space-y-3 p-3 md:hidden">
//           {loading ? [...Array(4)].map((_, index) => <div key={index} className="animate-pulse rounded-2xl border border-white/10 bg-slate-950/20 p-4"><div className="h-4 w-40 rounded bg-white/10" /><div className="mt-3 h-3 w-56 rounded bg-white/10" /><div className="mt-4 h-8 w-full rounded bg-white/10" /></div>) : rows.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center"><p className="font-bold text-white">No users found</p><p className="mt-1 text-sm text-slate-500">Try another filter or search term.</p></div> : rows.map((user) => {
//             const status = statusMeta(user);
//             const pending = status.tone === 'amber';
//             return <article key={user.id} className="rounded-2xl border border-white/10 bg-slate-950/20 p-4 shadow-lg">
//               <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-bold text-white">{user.full_name ?? 'Unnamed user'}</h2><p className="mt-1 truncate text-xs text-slate-500">{user.email ?? user.phone ?? user.id}</p></div><Badge tone={status.tone}>{status.label}</Badge></div>
//               <div className="mt-4 flex flex-wrap gap-2"><Badge tone={roleTone(user.role)}>{user.role}</Badge>{user.city ? <Badge tone="slate">{user.city}</Badge> : null}</div>
//               <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-white/[0.03] p-3"><p className="text-slate-500">Orders</p><p className="mt-1 font-bold text-white">{user.order_count ?? '—'}</p></div><div className="rounded-xl bg-white/[0.03] p-3"><p className="text-slate-500">Total spent</p><p className="mt-1 font-bold text-white">{user.total_spent != null ? '₹' + Number(user.total_spent).toLocaleString('en-IN') : '—'}</p></div></div>
//               {pending ? <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={processing?.id === user.id} onClick={() => void approveUser(user.id)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{isProcessing(user.id, 'approve') ? <Spinner /> : null}{isProcessing(user.id, 'approve') ? 'Approving…' : 'Approve'}</button><button type="button" disabled={processing?.id === user.id} onClick={() => void rejectUser(user.id)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-500 px-3 py-2 text-sm font-black text-white hover:bg-rose-400 disabled:opacity-50">{isProcessing(user.id, 'reject') ? <Spinner /> : null}{isProcessing(user.id, 'reject') ? 'Rejecting…' : 'Reject'}</button></div> : null}
//               <div className="mt-4 grid grid-cols-2 gap-2"><select key={user.id + '-' + user.role + '-' + selectNonce} defaultValue={user.role} disabled={processing?.id === user.id} onChange={(event) => { const nextRole = event.target.value; if (nextRole !== user.role) setConfirm({ id: user.id, name: user.full_name ?? user.email ?? 'this user', nextRole }); }} className="min-h-10 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-400/40" aria-label={'Change role for ' + (user.full_name ?? user.id)}>{['customer', 'technician', 'supplier', 'admin'].map((option) => <option key={option} value={option}>{option}</option>)}</select><button type="button" disabled={pending || processing?.id === user.id} onClick={() => void toggleActive(user)} className="min-h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">{isProcessing(user.id, 'active') ? 'Updating…' : user.is_active !== false ? 'Deactivate' : 'Activate'}</button></div>
//               <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-slate-500"><span>ID {user.id.slice(0, 8)}…</span><span>{formatCreatedAt(user.created_at)}</span></div>
//               {user.role === 'customer' ? <Link href={'/admin/orders?search=' + encodeURIComponent(user.full_name ?? user.id)} className="mt-3 block text-center text-xs font-bold text-sky-300 hover:text-sky-200">View customer orders →</Link> : null}
//             </article>;
//           })}
//         </div>

//         <div className="hidden overflow-x-auto md:block">
//           <table className="min-w-[1050px] w-full text-sm">
//             <thead className="bg-slate-950/30"><tr className="border-b border-white/10"><th className="px-5 py-3 text-left font-semibold text-slate-300">User</th><th className="px-5 py-3 text-left font-semibold text-slate-300">Role</th><th className="px-5 py-3 text-left font-semibold text-slate-300">Account</th><th className="px-5 py-3 text-left font-semibold text-slate-300">Stats</th><th className="px-5 py-3 text-left font-semibold text-slate-300">Created</th><th className="px-5 py-3 text-left font-semibold text-slate-300">Orders</th></tr></thead>
//             <tbody>
//               {loading ? [...Array(6)].map((_, index) => <tr key={index} className="border-b border-white/5">{['w-56', 'w-28', 'w-24', 'w-28', 'w-24', 'w-20'].map((width, cell) => <td key={cell} className="px-5 py-5"><div className={'h-4 ' + width + ' max-w-full animate-pulse rounded bg-white/10'} /></td>)}</tr>) : rows.length === 0 ? <tr><td colSpan={6} className="px-5 py-16 text-center"><p className="font-bold text-white">No users found</p><p className="mt-1 text-sm text-slate-500">Try another filter or search term.</p></td></tr> : rows.map((user) => {
//                 const status = statusMeta(user);
//                 const pending = status.tone === 'amber';
//                 return <tr key={user.id} className="border-b border-white/5 transition hover:bg-white/[0.035]">
//                   <td className="px-5 py-4 align-top"><div className="font-bold text-white">{user.full_name ?? 'Unnamed user'}</div><div className="mt-1 max-w-[380px] text-xs text-slate-400"><span className="font-mono text-[11px] text-slate-500">{user.id.slice(0, 8)}…</span>{user.phone ? <span> · {user.phone}</span> : null}{user.email ? <span className="text-slate-500"> · {user.email}</span> : null}</div>{pending ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={processing?.id === user.id} onClick={() => void approveUser(user.id)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{isProcessing(user.id, 'approve') ? <Spinner /> : null}{isProcessing(user.id, 'approve') ? 'Approving…' : 'Approve'}</button><button type="button" disabled={processing?.id === user.id} onClick={() => void rejectUser(user.id)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-rose-500 px-3 py-2 text-xs font-black text-white hover:bg-rose-400 disabled:opacity-50">{isProcessing(user.id, 'reject') ? <Spinner /> : null}{isProcessing(user.id, 'reject') ? 'Rejecting…' : 'Reject'}</button></div> : null}{user.status ? <div className="mt-2"><Badge tone={status.tone}>{status.label}</Badge></div> : null}</td>
//                   <td className="px-5 py-4 align-top"><div className="flex max-w-[200px] flex-col gap-2"><Badge tone={roleTone(user.role)}>{user.role}</Badge><select key={user.id + '-' + user.role + '-' + selectNonce} defaultValue={user.role} disabled={processing?.id === user.id} onChange={(event) => { const nextRole = event.target.value; if (nextRole !== user.role) setConfirm({ id: user.id, name: user.full_name ?? user.email ?? 'this user', nextRole }); }} className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-2 text-xs font-semibold text-slate-100 outline-none focus:border-cyan-400/40" aria-label={'Change role for ' + (user.full_name ?? user.id)}>{['customer', 'technician', 'supplier', 'admin'].map((option) => <option key={option} value={option}>{option}</option>)}</select></div></td>
//                   <td className="px-5 py-4 align-top"><button type="button" disabled={pending || processing?.id === user.id} onClick={() => void toggleActive(user)} className="text-left disabled:cursor-not-allowed disabled:opacity-50" title={pending ? 'Approve or reject the pending account first' : undefined}><Badge tone={status.tone}>{isProcessing(user.id, 'active') ? <Spinner /> : null}{isProcessing(user.id, 'active') ? 'Updating…' : status.label}</Badge></button></td>
//                   <td className="px-5 py-4 align-top text-xs text-slate-400">{user.order_count != null ? <div className="space-y-1"><p>Orders: <span className="font-bold text-slate-200">{user.order_count}</span></p><p>Spent: <span className="font-bold text-slate-200">₹{Number(user.total_spent ?? 0).toLocaleString('en-IN')}</span></p></div> : '—'}</td>
//                   <td className="px-5 py-4 align-top text-xs text-slate-300">{formatCreatedAt(user.created_at)}</td>
//                   <td className="px-5 py-4 align-top">{user.role === 'customer' ? <Link href={'/admin/orders?search=' + encodeURIComponent(user.full_name ?? user.id)} className="text-xs font-bold text-sky-300 transition hover:text-sky-200 hover:underline">View orders →</Link> : <span className="text-xs text-slate-600">—</span>}</td>
//                 </tr>;
//               })}
//             </tbody>
//           </table>
//         </div>
//       </section>
//     </div>
//   );
// }
