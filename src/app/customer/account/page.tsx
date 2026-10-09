'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import BottomNav from '@/components/customer/BottomNav';
import LanguageToggle from '@/components/LanguageToggle';
import { clearSession, getInitials, useAuth } from '@/hooks/useAuth';
import { getToken } from '@/lib/api-client';

/* ------------------------------------------------------------------------ */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type NotificationSettings = {
  whatsapp?: boolean;
  sms?: boolean;
  email?: boolean;
  push?: boolean;
};

type AccountSettings = {
  notifications?: NotificationSettings;
  language?: 'en' | 'hi';
  default_payment?: 'cash' | 'upi' | 'online';
  marketing_opt_in?: boolean;
  default_address_id?: string | null;

  /*
   * Legacy compatibility.
   * The backend does not use this key for new writes, but older records
   * may still contain it.
   */
  notifications_enabled?: boolean;

  [key: string]: unknown;
};

type ProfilePayload = {
  id: string;
  full_name: string | null;
  city: string | null;
  phone: string | null;
  created_at: string | null;
  settings?: AccountSettings | null;
};

type StatsPayload = {
  total_orders?: number;
  total_spent?: number;
  cans_ordered?: number;
  member_since?: string | null;
  avg_rating?: number | null;
  total_reviews?: number;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

type FormErrors = {
  full_name?: string;
  city?: string;
  phone?: string;
};

type Toast = { kind: 'success' | 'error' | 'info'; text: string };

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const SUPPORT_PHONE = '+919889305803';

const WHATSAPP_URL = `https://wa.me/919889305803?text=${encodeURIComponent(
  'Hi AuroTap! I need help with my account.'
)}`;

const CHANGE_CONTACT_URL = `https://wa.me/919889305803?text=${encodeURIComponent(
  'Hi AuroTap, I would like to update my login email or mobile number.'
)}`;

const DELETE_REQUEST_URL = `https://wa.me/919889305803?text=${encodeURIComponent(
  'Hi AuroTap, I would like to request deletion of my account and data.'
)}`;

const SERVICE_CITIES = [
  'Kanpur',
  'Gorakhpur',
  'Lucknow',
  'Varanasi',
  'Prayagraj',
  'Agra',
  'Meerut',
  'Bareilly',
  'Aligarh',
  'Mathura',
  'Delhi',
  'Noida',
  'Ghaziabad',
] as const;

const NAME_MAX = 80;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatINR(value: number | string | null | undefined): string {
  const amount = Math.round(Number(value) || 0);

  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatMemberSince(iso: string | null | undefined): string {
  if (!iso) return '—';

  const timestamp = new Date(iso).getTime();

  if (Number.isNaN(timestamp)) return '—';

  return new Date(timestamp).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

function maskPhone(value: string | null | undefined): string {
  if (!value) return '—';

  const digits = value.replace(/\D/g, '');

  if (digits.length < 6) return value;

  return `${digits.slice(0, 2)}••••${digits.slice(-4)}`;
}

function getNotificationPreference(settings: AccountSettings | null | undefined): boolean {
  if (!settings) return true;

  if (typeof settings.notifications_enabled === 'boolean') {
    return settings.notifications_enabled;
  }

  const notifications = settings.notifications;

  if (!notifications) return true;

  const values = [
    notifications.whatsapp,
    notifications.sms,
    notifications.email,
    notifications.push,
  ].filter((value) => typeof value === 'boolean') as boolean[];

  if (!values.length) return true;

  return values.some(Boolean);
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

function HomeIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path strokeLinecap="round" d="M8 11V8a4 4 0 118 0v3" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Small UI components                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Persistent top bar. The public site header is not rendered inside the customer area,
 * so this gives a one-tap route back to the main site (Home) without losing the dashboard.
 */
function TopBar() {
  const navItem =
    'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100';
  const activeItem = 'bg-sky-50 text-sky-800';
  const idleItem = 'text-slate-600 hover:bg-slate-50 hover:text-sky-800';

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 pt-[env(safe-area-inset-top)] shadow-[0_1px_12px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-2 px-3 sm:px-6 lg:px-8">
        <Link
          href="/customer/account"
          className="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
          aria-label="AuroTap account"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-sky-100 transition-transform group-hover:scale-105">
            <Image
              src="/splash-logo.svg"
              alt=""
              width={36}
              height={36}
              className="h-full w-full object-contain"
              unoptimized
            />
          </span>

          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-sm font-black tracking-tight text-slate-950">
              Auro<span className="text-sky-600">Tap</span>
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Account
            </span>
          </span>
        </Link>

        <nav aria-label="Account navigation" className="ml-auto flex items-center gap-1">
          <Link href="/" className={`${navItem} ${idleItem}`}>
            <HomeIcon />
            <span className="hidden sm:inline">Home</span>
          </Link>

          <Link href="/customer/home" className={`${navItem} ${idleItem}`}>
            <GridIcon />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <Link href="/customer/history" className={`${navItem} ${idleItem}`}>
            <ListIcon />
            <span className="hidden sm:inline">Orders</span>
          </Link>

          <span
            aria-current="page"
            className={`${navItem} ${activeItem} ml-0.5`}
          >
            <span className="hidden sm:inline">Account</span>
            <span className="sm:hidden" aria-hidden="true">●</span>
            <span className="sr-only sm:hidden">Account</span>
          </span>
        </nav>
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>

        {description ? <p className="mt-0.5 text-sm leading-5 text-slate-500">{description}</p> : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function StrengthRing({ pct, loading }: { pct: number; loading: boolean }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - (loading ? 0 : pct) / 100);

  return (
    <div
      className="relative h-[76px] w-[76px] shrink-0"
      role="progressbar"
      aria-label="Profile strength"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={loading ? 0 : pct}
    >
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="aurotap-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
        </defs>
        <circle cx="38" cy="38" r={radius} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
        <circle
          cx="38"
          cy="38"
          r={radius}
          fill="none"
          stroke="url(#aurotap-ring)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>

      <span className="absolute inset-0 flex items-center justify-center text-sm font-black">
        {loading ? '—' : `${pct}%`}
      </span>
    </div>
  );
}

const STAT_TONES = {
  sky: 'from-sky-100 to-sky-50 text-sky-700',
  cyan: 'from-cyan-100 to-cyan-50 text-cyan-700',
  emerald: 'from-emerald-100 to-emerald-50 text-emerald-700',
  amber: 'from-amber-100 to-amber-50 text-amber-700',
} as const;

function StatCard({
  icon,
  value,
  label,
  hint,
  tone,
  loading,
}: {
  icon: string;
  value: string;
  label: string;
  hint?: string;
  tone: keyof typeof STAT_TONES;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div
        className="h-[132px] animate-pulse rounded-2xl border border-slate-100 bg-white motion-reduce:animate-none"
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
      <div
        className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-lg ${STAT_TONES[tone]}`}
        aria-hidden="true"
      >
        {icon}
      </div>

      <p className="mt-3 truncate text-2xl font-black tracking-tight text-slate-950">{value}</p>

      <p className="mt-0.5 text-sm font-semibold text-slate-600">{label}</p>

      {hint ? <p className="mt-0.5 truncate text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

/** One row used for shortcuts and support. Internal links use <Link>, others a plain <a>. */
function ActionRow({
  href,
  icon,
  title,
  description,
  external,
  tone = 'sky',
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  external?: boolean;
  tone?: 'sky' | 'emerald' | 'violet' | 'rose';
}) {
  const tones: Record<string, string> = {
    sky: 'bg-sky-50',
    emerald: 'bg-emerald-50',
    violet: 'bg-violet-50',
    rose: 'bg-rose-50',
  };

  const className =
    'group flex min-h-[68px] items-center gap-3 border-b border-slate-100 px-4 py-3 transition last:border-b-0 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50';

  const body = (
    <>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${tones[tone]}`}
        aria-hidden="true"
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{description}</span>
      </span>

      <span
        className="text-lg text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-500"
        aria-hidden="true"
      >
        →
      </span>
    </>
  );

  if (external) {
    const isWeb = href.startsWith('http');
    return (
      <a href={href} className={className} {...(isWeb ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {body}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

function ReadOnlyRow({
  icon,
  title,
  value,
  actions,
}: {
  icon: string;
  title: string;
  value: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 last:border-b-0 sm:px-6">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-lg" aria-hidden="true">
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
          {title}
          <span className="text-slate-300">
            <LockIcon />
          </span>
        </p>

        <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{value}</p>
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}

function MiniButton({
  onClick,
  children,
  label,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="min-h-9 rounded-lg px-2.5 text-xs font-bold text-sky-700 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
    >
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100',
        checked ? 'bg-emerald-600' : 'bg-slate-300',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm" aria-hidden="true">
      <div className="h-5 w-28 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
      <div className="mt-3 h-12 w-full animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
      <div className="mt-5 h-5 w-20 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
      <div className="mt-3 h-12 w-full animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
      <div className="mt-5 h-20 w-full animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5" role="alert">
      <div className="flex items-start gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 font-black text-rose-700"
          aria-hidden="true"
        >
          !
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-black text-rose-900">We couldn&apos;t load your account</p>

          <p className="mt-1 text-sm leading-6 text-rose-700">{message}</p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastView({ toast, lifted }: { toast: Toast | null; lifted: boolean }) {
  const tone =
    toast?.kind === 'error' ? 'bg-rose-600' : toast?.kind === 'success' ? 'bg-emerald-600' : 'bg-slate-900';

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-[90] flex justify-center px-4 ${
        lifted
          ? 'bottom-[calc(10.5rem+env(safe-area-inset-bottom))]'
          : 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))]'
      }`}
      role="status"
      aria-live="polite"
    >
      {toast ? (
        <div
          className={`pointer-events-auto rounded-full px-5 py-3 text-sm font-bold text-white shadow-xl shadow-slate-900/20 ${tone}`}
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}

/** Floating save bar. Sits above the bottom navigation so Save is always one tap away. */
function UnsavedBar({
  saving,
  onDiscard,
  onSave,
}: {
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[45] flex justify-center px-3"
      role="region"
      aria-label="Unsaved changes"
    >
      <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-2.5 pl-4 shadow-2xl shadow-slate-900/15 backdrop-blur-xl">
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>

        <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">Unsaved changes</p>

        <button
          type="button"
          onClick={onDiscard}
          disabled={saving}
          className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100 disabled:opacity-60"
        >
          Discard
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="min-h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 text-sm font-black text-white shadow-md shadow-emerald-500/25 transition hover:opacity-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function SignOutModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    cancelRef.current?.focus();

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-out-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-2xl" aria-hidden="true">
          👋
        </div>

        <h2 id="sign-out-title" className="mt-5 text-center text-xl font-black text-slate-950">
          Sign out of AuroTap?
        </h2>

        <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-slate-500">
          You can sign in again whenever you need your orders, addresses, and account details.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function CustomerAccountPage() {
  const router = useRouter();
  const pathname = usePathname() ?? '/customer/account';

  const { hydrated, isLoggedIn, isCustomer, session, updateSession, logout } = useAuth();

  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [signOutOpen, setSignOutOpen] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [copied, setCopied] = useState<'phone' | 'email' | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const toastTimer = useRef<number | null>(null);
  const copyTimer = useRef<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLElement | null>(null);

  const ready = hydrated && isLoggedIn && isCustomer;

  const showToast = useCallback((next: Toast) => {
    setToast(next);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    []
  );

  /* ── Auth guard ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (!hydrated) return;

    if (!isLoggedIn) {
      router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isLoggedIn, router, pathname]);

  /* ── Load account data in parallel ───────────────────────────────── */
  const load = useCallback(
    async (showRefreshState = false) => {
      if (!hydrated) return;

      if (!isLoggedIn || !isCustomer) {
        router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }

      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const token = await getToken();

        if (!token) {
          clearSession();
          router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        const [profileResponse, statsResponse] = await Promise.all([
          fetch('/api/customer/profile', {
            credentials: 'include',
            headers,
            cache: 'no-store',
          }),
          fetch('/api/customer/stats', {
            credentials: 'include',
            headers,
            cache: 'no-store',
          }),
        ]);

        if (profileResponse.status === 401 || statsResponse.status === 401) {
          clearSession();
          router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }

        const profileJson = await readJson<ApiEnvelope<ProfilePayload>>(profileResponse);
        const statsJson = await readJson<ApiEnvelope<StatsPayload>>(statsResponse);

        if (!profileResponse.ok || profileJson.success === false) {
          throw new Error(profileJson.error ?? 'Could not load your profile.');
        }

        if (!statsResponse.ok || statsJson.success === false) {
          throw new Error(statsJson.error ?? 'Could not load your account activity.');
        }

        const nextProfile = profileJson.data ?? null;
        const nextStats = statsJson.data ?? null;

        setProfile(nextProfile);
        setStats(nextStats);

        setFullName(nextProfile?.full_name?.trim() ?? '');
        setCity(nextProfile?.city?.trim() ?? '');
        setPhoneInput(nextProfile?.phone?.trim() ?? session?.phone?.trim() ?? '');
        setNotificationsEnabled(getNotificationPreference(nextProfile?.settings));
        setSaveError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load your account.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [hydrated, isLoggedIn, isCustomer, pathname, router]
  );

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  /* ── Form state ──────────────────────────────────────────────────── */
  const originalName = profile?.full_name?.trim() ?? '';
  const originalCity = profile?.city?.trim() ?? '';
  const originalPhone = profile?.phone?.trim() ?? session?.phone?.trim() ?? '';
  const originalNotifications = getNotificationPreference(profile?.settings);

  const hasChanges =
    fullName.trim() !== originalName ||
    city.trim() !== originalCity ||
    phoneInput.replace(/\D/g, '') !== originalPhone.replace(/\D/g, '') ||
    notificationsEnabled !== originalNotifications;

  const initials = useMemo(
    () => getInitials(profile?.full_name ?? session?.name ?? 'AuroTap'),
    [profile?.full_name, session?.name]
  );

  const email = session?.email?.trim() ?? '';
  const phone = profile?.phone?.trim() ?? session?.phone?.trim() ?? '';

  const memberSince = formatMemberSince(stats?.member_since ?? profile?.created_at);

  /* ── Profile strength (from saved data, not unsaved edits) ───────── */
  const completeness = useMemo(() => {
    const items = [
      { key: 'name', label: 'full name', done: originalName.length >= 2 },
      { key: 'city', label: 'city', done: originalCity.length >= 2 },
      { key: 'phone', label: 'mobile number', done: phone.length > 0 },
      { key: 'email', label: 'email', done: email.length > 0 },
    ];
    const doneCount = items.filter((item) => item.done).length;

    return {
      pct: Math.round((doneCount / items.length) * 100),
      missing: items.filter((item) => !item.done),
    };
  }, [originalName, originalCity, phone, email]);

  /* ── Warn before closing the tab with unsaved edits ──────────────── */
  useEffect(() => {
    if (!hasChanges) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasChanges]);

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};

    const name = fullName.trim();
    const selectedCity = city.trim();
    const normalizedPhone = phoneInput.replace(/\D/g, '');

    if (name.length < 2) {
      nextErrors.full_name = 'Enter at least 2 characters.';
    } else if (name.length > NAME_MAX) {
      nextErrors.full_name = `Name must be ${NAME_MAX} characters or fewer.`;
    }

    if (selectedCity.length < 2) {
      nextErrors.city = 'Select your city.';
    }

    if (normalizedPhone && !/^[6-9]\d{9}$/.test(normalizedPhone)) {
      nextErrors.phone = 'Enter a valid 10-digit Indian mobile number.';
    }

    setFormErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  /* ── Save ────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!validateForm() || saving) return;

    setSaving(true);
    setSaveError(null);

    try {
      const token = await getToken();

      if (!token) {
        clearSession();
        router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }

      const existingSettings = profile?.settings ?? {};
      const existingNotifications = existingSettings.notifications ?? {};

      /*
       * IMPORTANT:
       * The backend profile API accepts the nested `settings.notifications` structure.
       * Do NOT send `notifications_enabled` as a new backend field because it is not
       * part of the API whitelist.
       */
      const nextSettings: AccountSettings = {
        ...existingSettings,
        notifications: {
          ...existingNotifications,
          whatsapp: notificationsEnabled,
          sms: notificationsEnabled,
          email: notificationsEnabled,
          push: notificationsEnabled,
        },
      };

      const response = await fetch('/api/customer/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          city: city.trim(),
          phone: phoneInput.trim(),
          settings: nextSettings,
        }),
      });

      if (response.status === 401) {
        clearSession();
        router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }

      const json = await readJson<ApiEnvelope<ProfilePayload>>(response);

      if (!response.ok || json.success === false) {
        throw new Error(json.error ?? 'Could not save your profile.');
      }

      const savedProfile =
        json.data ??
        ({
          ...profile,
          full_name: fullName.trim(),
          city: city.trim(),
          phone: phoneInput.trim(),
          settings: nextSettings,
        } as ProfilePayload);

      setProfile(savedProfile);

      updateSession({
        name: savedProfile.full_name ?? session?.name ?? '',
        phone: savedProfile.phone ?? '',
      });

      setFormErrors({});
      showToast({ kind: 'success', text: 'Profile saved' });

      window.dispatchEvent(new CustomEvent('aurotap-profile-saved'));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not save your profile.';

      setSaveError(message);
      showToast({ kind: 'error', text: 'Could not save changes' });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setFullName(originalName);
    setCity(originalCity);
    setPhoneInput(originalPhone);
    setNotificationsEnabled(originalNotifications);
    setFormErrors({});
    setSaveError(null);
  };

  const handleEditProfile = () => {
    const reduce =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    formRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });

    window.setTimeout(() => nameInputRef.current?.focus({ preventScroll: true }), reduce ? 0 : 350);
  };

  /* ── Clipboard ───────────────────────────────────────────────────── */
  const handleCopy = async (kind: 'phone' | 'email', value: string) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);

      setCopied(kind);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(null), 1800);

      showToast({ kind: 'info', text: kind === 'phone' ? 'Number copied' : 'Email copied' });
    } catch {
      setCopied(null);
      showToast({ kind: 'error', text: 'Copy is not available in this browser' });
    }
  };

  /* ── States ──────────────────────────────────────────────────────── */
  if (!hydrated || (hydrated && !isLoggedIn)) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-sky-50 px-4">
        <div className="text-center">
          <div
            className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600 motion-reduce:animate-none"
            aria-hidden="true"
          />

          <p className="mt-4 text-sm font-semibold text-slate-500" role="status">
            Loading your account…
          </p>
        </div>
      </main>
    );
  }

  if (!isCustomer) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div
            className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-xl font-black text-rose-600"
            aria-hidden="true"
          >
            !
          </div>

          <h1 className="mt-5 text-xl font-black text-slate-950">Customer account required</h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            This account area is only available to customer accounts.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800"
          >
            Back to AuroTap
          </Link>
        </div>
      </main>
    );
  }

  const displayName = profile?.full_name || session?.name || 'Welcome';
  const reviewCount = stats?.total_reviews ?? 0;

  const inputBase =
    'mt-2 min-h-12 w-full rounded-xl border bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:bg-white focus:ring-4';

  return (
    <>
      <style>{`
        .aurotap-account {
          min-height: 100dvh;
          background:
            radial-gradient(circle at top right, rgba(14,165,233,0.10), transparent 28%),
            linear-gradient(180deg, #eff8ff 0%, #f8fbff 32%, #ffffff 100%);
        }

        .aurotap-account *,
        .aurotap-account *::before,
        .aurotap-account *::after {
          box-sizing: border-box;
        }

        @media (prefers-reduced-motion: reduce) {
          .aurotap-account *,
          .aurotap-account *::before,
          .aurotap-account *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <TopBar />

      <main
        className={`aurotap-account ${
          hasChanges
            ? 'pb-[calc(11rem+env(safe-area-inset-bottom))]'
            : 'pb-[calc(6rem+env(safe-area-inset-bottom))]'
        }`}
      >
        <div className="mx-auto w-full max-w-6xl px-3 pt-4 sm:px-5 sm:pt-6 lg:px-8">
          {/* ---------------------------------------------------------------- */}
          {/* Profile hero                                                     */}
          {/* ---------------------------------------------------------------- */}
          <header className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#071f38] via-[#0f4a8f] to-[#0ea5e9] p-4 text-white shadow-xl shadow-sky-300/30 sm:rounded-3xl sm:p-7">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl" />
              <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-5 sm:gap-6 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-5">
                <div
                  className="shrink-0 rounded-full bg-gradient-to-br from-cyan-200 via-white/70 to-sky-300 p-[3px] shadow-lg shadow-black/20"
                  aria-hidden="true"
                >
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-[#0a3a6b] text-xl font-black sm:h-20 sm:w-20 sm:text-2xl">
                    {initials}
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white/65">My account</p>

                  <h1 className="mt-0.5 truncate text-2xl font-black tracking-tight sm:text-3xl">
                    {loading && !session?.name ? (
                      <span
                        className="inline-block h-7 w-44 animate-pulse rounded-lg bg-white/20 align-middle motion-reduce:animate-none"
                        aria-label="Loading name"
                      />
                    ) : (
                      displayName
                    )}
                  </h1>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-white/90">
                      <PinIcon />
                      {profile?.city || 'City not set'}
                    </span>

                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-white/90">
                      Member since {memberSince}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-3 pr-4 backdrop-blur sm:w-auto sm:gap-4 sm:p-3.5 sm:pr-5">
                <StrengthRing pct={completeness.pct} loading={loading} />

                <div className="min-w-0">
                  <p className="text-sm font-black">Profile strength</p>

                  <p className="mt-0.5 max-w-[11rem] text-xs leading-4 text-white/70">
                    {loading
                      ? 'Checking your details…'
                      : completeness.missing.length === 0
                        ? 'All set for faster booking'
                        : `Add your ${completeness.missing.map((item) => item.label).join(', ')}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={handleEditProfile}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-3 text-sm font-black text-[#0a3a6b] shadow-md shadow-black/10 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/40 sm:w-auto sm:px-5"
              >
                Edit profile
              </button>

              <Link
                href="/customer/history"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/30 sm:w-auto sm:px-5"
              >
                My orders
              </Link>
            </div>
          </header>

          {error ? (
            <div className="mt-5">
              <ErrorCard message={error} onRetry={() => void load()} />
            </div>
          ) : null}

          {/* Activity */}
          <section className="mt-6 sm:mt-8" aria-labelledby="account-activity">
            <SectionTitle
              title="Your activity"
              description="A quick view of your AuroTap usage."
              action={
                <Link href="/customer/history" className="text-sm font-black text-sky-700 hover:underline">
                  View orders →
                </Link>
              }
            />
            <span id="account-activity" className="sr-only">
              Your activity
            </span>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
              <StatCard
                icon="📦"
                tone="sky"
                value={String(stats?.total_orders ?? 0)}
                label="Orders"
                hint="All time"
                loading={loading}
              />

              <StatCard
                icon="💧"
                tone="cyan"
                value={String(stats?.cans_ordered ?? 0)}
                label="Cans"
                hint="Delivered to you"
                loading={loading}
              />

              <StatCard
                icon="₹"
                tone="emerald"
                value={formatINR(stats?.total_spent ?? 0)}
                label="Total spent"
                hint="On completed orders"
                loading={loading}
              />

              <StatCard
                icon="⭐"
                tone="amber"
                value={stats?.avg_rating != null ? String(stats.avg_rating) : '—'}
                label="Your rating"
                hint={reviewCount > 0 ? `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : 'No ratings yet'}
                loading={loading}
              />
            </div>
          </section>

          <div className="mt-6 grid gap-6 sm:mt-8 sm:gap-8 lg:grid-cols-5">
            {/* ───────── Left column: profile + preferences ───────── */}
            <div className="space-y-8 lg:col-span-3">
              <section ref={formRef} className="scroll-mt-20" aria-label="Profile details">
                <SectionTitle title="Profile details" description="Keep your delivery information up to date." />

                {loading ? (
                  <LoadingCard />
                ) : (
                  <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.14)]">
                    <div className="space-y-5 p-5 sm:p-6">
                      <div>
                        <div className="flex items-baseline justify-between">
                          <label htmlFor="customer-full-name" className="text-sm font-bold text-slate-700">
                            Full name
                          </label>

                          <span className="text-xs font-medium text-slate-400" aria-hidden="true">
                            {fullName.length}/{NAME_MAX}
                          </span>
                        </div>

                        <input
                          ref={nameInputRef}
                          id="customer-full-name"
                          value={fullName}
                          onChange={(event) => {
                            setFullName(event.target.value);

                            if (formErrors.full_name) {
                              setFormErrors((current) => ({ ...current, full_name: undefined }));
                            }

                            setSaveError(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && hasChanges) {
                              event.preventDefault();
                              void handleSave();
                            }
                          }}
                          autoComplete="name"
                          maxLength={NAME_MAX}
                          className={[
                            inputBase,
                            formErrors.full_name
                              ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
                              : 'border-slate-200 focus:border-sky-400 focus:ring-sky-50',
                          ].join(' ')}
                          placeholder="Enter your full name"
                          aria-invalid={Boolean(formErrors.full_name)}
                          aria-describedby={formErrors.full_name ? 'full-name-error' : undefined}
                        />

                        {formErrors.full_name ? (
                          <p id="full-name-error" className="mt-1.5 text-xs font-bold text-rose-600">
                            {formErrors.full_name}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label htmlFor="customer-city" className="text-sm font-bold text-slate-700">
                          City
                        </label>

                        <div className="relative">
                          <select
                            id="customer-city"
                            value={city}
                            onChange={(event) => {
                              setCity(event.target.value);
                              setFormErrors((current) => ({ ...current, city: undefined }));
                              setSaveError(null);
                            }}
                            className={[
                              inputBase,
                              'cursor-pointer appearance-none pr-11',
                              formErrors.city
                                ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
                                : 'border-slate-200 focus:border-sky-400 focus:ring-sky-50',
                            ].join(' ')}
                            aria-invalid={Boolean(formErrors.city)}
                            aria-describedby={formErrors.city ? 'city-error' : undefined}
                          >
                            <option value="">Select your city</option>

                            {SERVICE_CITIES.map((serviceCity) => (
                              <option key={serviceCity} value={serviceCity}>
                                {serviceCity}
                              </option>
                            ))}

                            {city && !SERVICE_CITIES.includes(city as (typeof SERVICE_CITIES)[number]) ? (
                              <option value={city}>{city}</option>
                            ) : null}
                          </select>

                          <span className="pointer-events-none absolute right-4 top-1/2 mt-1 -translate-y-1/2 text-slate-400">
                            <ChevronDown />
                          </span>
                        </div>

                        {formErrors.city ? (
                          <p id="city-error" className="mt-1.5 text-xs font-bold text-rose-600">
                            {formErrors.city}
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900">Order notifications</p>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Updates about your bookings and orders.
                            </p>
                          </div>

                          <Toggle
                            checked={notificationsEnabled}
                            disabled={saving}
                            label="Toggle order notifications"
                            onChange={(value) => {
                              setNotificationsEnabled(value);
                              setSaveError(null);
                            }}
                          />
                        </div>

                        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Channels">
                          {['WhatsApp', 'SMS', 'Email', 'Push'].map((channel) => (
                            <li
                              key={channel}
                              className={[
                                'rounded-full border px-2.5 py-1 text-[11px] font-bold transition',
                                notificationsEnabled
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-white text-slate-400',
                              ].join(' ')}
                            >
                              {channel}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {saveError ? (
                        <p
                          className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
                          role="alert"
                        >
                          {saveError}
                        </p>
                      ) : null}
                    </div>

                    {/* Read-only identity */}
                    <div className="border-t border-slate-100 bg-slate-50/40">
                      <ReadOnlyRow
                        icon="✉️"
                        title="Login email"
                        value={email || 'Not available'}
                        actions={
                          email ? (
                            <MiniButton onClick={() => void handleCopy('email', email)} label="Copy email">
                              {copied === 'email' ? 'Copied' : 'Copy'}
                            </MiniButton>
                          ) : null
                        }
                      />

                      <ReadOnlyRow
                        icon="📱"
                        title="Mobile number"
                        value={showPhone ? phone || '—' : maskPhone(phone)}
                        actions={
                          phone ? (
                            <>
                              <MiniButton
                                onClick={() => setShowPhone((current) => !current)}
                                label={showPhone ? 'Hide mobile number' : 'Show mobile number'}
                              >
                                {showPhone ? 'Hide' : 'Show'}
                              </MiniButton>

                              <MiniButton onClick={() => void handleCopy('phone', phone)} label="Copy mobile number">
                                {copied === 'phone' ? 'Copied' : 'Copy'}
                              </MiniButton>
                            </>
                          ) : null
                        }
                      />

                      <p className="px-5 pb-4 pt-1 text-xs leading-5 text-slate-500 sm:px-6">
                        Your login email and number are protected.{' '}
                        <a
                          href={CHANGE_CONTACT_URL}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-sky-700 hover:underline"
                        >
                          Ask support to change them
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Language */}
              <section aria-label="Language">
                <SectionTitle title="Language" description="Choose how AuroTap is displayed." />

                <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-lg" aria-hidden="true">
                      🌐
                    </span>

                    <div>
                      <p className="text-sm font-black text-slate-900">App language</p>

                      <p className="mt-0.5 text-xs font-medium text-slate-500">English or Hindi</p>
                    </div>
                  </div>

                  <LanguageToggle />
                </div>
              </section>
            </div>

            {/* ───────── Right column: shortcuts + support ───────── */}
            <div className="space-y-8 lg:col-span-2">
              <section aria-label="Account shortcuts">
                <SectionTitle title="Account shortcuts" description="Quick access to the things you use most." />

                <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
                  <ActionRow
                    href="/"
                    icon="🏠"
                    title="AuroTap home"
                    description="Back to the main website"
                    tone="emerald"
                  />

                  <ActionRow
                    href="/customer/home"
                    icon="📊"
                    title="Customer dashboard"
                    description="Orders, tracking and quick actions"
                  />

                  <ActionRow
                    href="/customer/addresses"
                    icon="📍"
                    title="My addresses"
                    description="Your saved delivery locations"
                  />

                  <ActionRow
                    href="/customer/history"
                    icon="📋"
                    title="Order history"
                    description="Previous and current orders"
                  />

                  <ActionRow
                    href="/customer/subscriptions"
                    icon="🔄"
                    title="My subscriptions"
                    description="Pause, resume or cancel deliveries"
                  />

                  <ActionRow href="/pricing" icon="🏷️" title="Pricing" description="Available service pricing" />
                </div>
              </section>

              <section aria-label="Support">
                <SectionTitle title="AuroTap support" description="Reach us for anything about your account or orders." />

                <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
                  <ActionRow
                    href="/customer/support"
                    icon="🎧"
                    title="Get support"
                    description="Help centre and tickets"
                  />

                  <ActionRow
                    href={WHATSAPP_URL}
                    external
                    icon="💬"
                    title="Chat on WhatsApp"
                    description="Fastest way to reach us"
                    tone="emerald"
                  />

                  <ActionRow
                    href={`tel:${SUPPORT_PHONE}`}
                    external
                    icon="📞"
                    title="Call support"
                    description={SUPPORT_PHONE}
                  />

                  <ActionRow
                    href="/terms"
                    icon="📄"
                    title="Terms & Privacy"
                    description="Review AuroTap policies"
                    tone="violet"
                  />

                  <ActionRow
                    href={DELETE_REQUEST_URL}
                    external
                    icon="🗑️"
                    title="Request account deletion"
                    description="We will confirm on WhatsApp"
                    tone="rose"
                  />
                </div>
              </section>
            </div>
          </div>

          {/* Refresh */}
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex min-h-9 items-center rounded-xl px-3 text-xs font-bold text-slate-400 hover:bg-white hover:text-slate-600 disabled:opacity-60"
            >
              <span
                className={refreshing ? 'mr-1.5 animate-spin motion-reduce:animate-none' : 'mr-1.5'}
                aria-hidden="true"
              >
                ↻
              </span>

              {refreshing ? 'Refreshing…' : 'Refresh account'}
            </button>
          </div>

          {/* Sign out */}
          <section className="mt-4" aria-label="Sign out">
            <button
              type="button"
              onClick={() => setSignOutOpen(true)}
              className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3.5 text-sm font-black text-rose-700 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
            >
              Sign out
            </button>
          </section>

          <footer className="px-2 pb-4 pt-6 text-center">
            <p className="text-xs font-bold tracking-wide text-slate-300">aurotap.in</p>

            <p className="mt-1 text-xs font-medium text-slate-400">
              Your account, orders, and preferences in one place.
            </p>
          </footer>
        </div>
      </main>

      {hasChanges && !loading ? (
        <UnsavedBar saving={saving} onDiscard={handleDiscard} onSave={() => void handleSave()} />
      ) : null}

      <ToastView toast={toast} lifted={hasChanges && !loading} />

      {signOutOpen ? (
        <SignOutModal
          onCancel={() => setSignOutOpen(false)}
          onConfirm={() => {
            setSignOutOpen(false);
            logout({ redirectTo: '/' });
          }}
        />
      ) : null}

      <BottomNav />
    </>
  );
}













// 'use client';

// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from 'react';
// import Image from 'next/image';
// import Link from 'next/link';
// import { usePathname, useRouter } from 'next/navigation';

// import BottomNav from '@/components/customer/BottomNav';
// import LanguageToggle from '@/components/LanguageToggle';
// import { clearSession, getInitials, useAuth } from '@/hooks/useAuth';
// import { getToken } from '@/lib/api-client';

// /* -------------------------------------------------------------------------- */
// /* Types                                                                      */
// /* -------------------------------------------------------------------------- */

// type NotificationSettings = {
//   whatsapp?: boolean;
//   sms?: boolean;
//   email?: boolean;
//   push?: boolean;
// };

// type AccountSettings = {
//   notifications?: NotificationSettings;
//   language?: 'en' | 'hi';
//   default_payment?: 'cash' | 'upi' | 'online';
//   marketing_opt_in?: boolean;
//   default_address_id?: string | null;

//   /*
//    * Legacy compatibility.
//    * The backend does not use this key for new writes, but older records
//    * may still contain it.
//    */
//   notifications_enabled?: boolean;

//   [key: string]: unknown;
// };

// type ProfilePayload = {
//   id: string;
//   full_name: string | null;
//   city: string | null;
//   phone: string | null;
//   created_at: string | null;
//   settings?: AccountSettings | null;
// };

// type StatsPayload = {
//   total_orders?: number;
//   total_spent?: number;
//   cans_ordered?: number;
//   member_since?: string | null;
//   avg_rating?: number | null;
//   total_reviews?: number;
// };

// type ApiEnvelope<T> = {
//   success?: boolean;
//   data?: T;
//   error?: string;
// };

// type FormErrors = {
//   full_name?: string;
//   city?: string;
// };

// type Toast = { kind: 'success' | 'error' | 'info'; text: string };

// /* -------------------------------------------------------------------------- */
// /* Constants                                                                  */
// /* -------------------------------------------------------------------------- */

// const SUPPORT_PHONE = '+919889305803';

// const WHATSAPP_URL = `https://wa.me/919889305803?text=${encodeURIComponent(
//   'Hi AuroTap! I need help with my account.'
// )}`;

// const DELETE_REQUEST_URL = `https://wa.me/919889305803?text=${encodeURIComponent(
//   'Hi AuroTap, I would like to request deletion of my account and data.'
// )}`;

// const SERVICE_CITIES = [
//   'Kanpur',
//   'Gorakhpur',
//   'Lucknow',
//   'Varanasi',
//   'Prayagraj',
//   'Agra',
//   'Meerut',
//   'Bareilly',
//   'Aligarh',
//   'Mathura',
//   'Delhi',
//   'Noida',
//   'Ghaziabad',
// ] as const;

// /* -------------------------------------------------------------------------- */
// /* Helpers                                                                    */
// /* -------------------------------------------------------------------------- */

// function formatINR(value: number | string | null | undefined): string {
//   const amount = Math.round(Number(value) || 0);

//   return `₹${amount.toLocaleString('en-IN')}`;
// }

// function formatMemberSince(iso: string | null | undefined): string {
//   if (!iso) return '—';

//   const timestamp = new Date(iso).getTime();

//   if (Number.isNaN(timestamp)) return '—';

//   return new Date(timestamp).toLocaleDateString('en-IN', {
//     month: 'short',
//     year: 'numeric',
//   });
// }

// function maskPhone(value: string | null | undefined): string {
//   if (!value) return '—';

//   const digits = value.replace(/\D/g, '');

//   if (digits.length < 6) return value;

//   return `${digits.slice(0, 2)}••••${digits.slice(-4)}`;
// }

// function getNotificationPreference(settings: AccountSettings | null | undefined): boolean {
//   if (!settings) return true;

//   if (typeof settings.notifications_enabled === 'boolean') {
//     return settings.notifications_enabled;
//   }

//   const notifications = settings.notifications;

//   if (!notifications) return true;

//   const values = [
//     notifications.whatsapp,
//     notifications.sms,
//     notifications.email,
//     notifications.push,
//   ].filter((value) => typeof value === 'boolean') as boolean[];

//   if (!values.length) return true;

//   return values.some(Boolean);
// }

// async function readJson<T>(response: Response): Promise<T> {
//   try {
//     return (await response.json()) as T;
//   } catch {
//     return {} as T;
//   }
// }

// /* -------------------------------------------------------------------------- */
// /* Small UI components                                                        */
// /* -------------------------------------------------------------------------- */

// function HomeIcon() {
//   return (
//     <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
//       <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
//     </svg>
//   );
// }

// function GridIcon() {
//   return (
//     <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
//       <rect x="4" y="4" width="7" height="7" rx="1.5" />
//       <rect x="13" y="4" width="7" height="7" rx="1.5" />
//       <rect x="4" y="13" width="7" height="7" rx="1.5" />
//       <rect x="13" y="13" width="7" height="7" rx="1.5" />
//     </svg>
//   );
// }

// /**
//  * Persistent top bar. The public site header is not rendered inside the customer area,
//  * so this gives a one-tap route back to the main site (Home) without losing the dashboard.
//  */
// function TopBar() {
//   const pill =
//     'inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-bold text-slate-600 transition hover:bg-sky-50 hover:text-sky-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 sm:px-3';

//   return (
//     <div className="sticky top-0 z-40 border-b border-sky-100 bg-white/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
//       <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
//         <Link
//           href="/"
//           className="group flex shrink-0 items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
//           aria-label="AuroTap home"
//         >
//           <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md shadow-sky-200/60 ring-1 ring-sky-100 transition-transform group-hover:scale-105">
//             <Image
//               src="/splash-logo.svg"
//               alt=""
//               width={36}
//               height={36}
//               className="h-full w-full object-contain"
//               unoptimized
//             />
//           </span>
//           <span className="hidden text-base font-black tracking-tight text-slate-900 sm:block">
//             Auro<span className="text-sky-600">Tap</span>
//           </span>
//         </Link>

//         <nav aria-label="Account navigation" className="flex items-center gap-1">
//           <Link href="/" className={pill}>
//             <HomeIcon />
//             Home
//           </Link>

//           <Link href="/customer/home" className={pill}>
//             <GridIcon />
//             Dashboard
//           </Link>

//           <Link
//             href="/book"
//             className="ml-1 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-black text-white shadow-md shadow-cyan-500/25 transition hover:opacity-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 active:scale-95"
//           >
//             Book
//             <span aria-hidden="true">→</span>
//           </Link>
//         </nav>
//       </div>
//     </div>
//   );
// }

// function SectionTitle({
//   eyebrow,
//   title,
//   description,
// }: {
//   eyebrow: string;
//   title: string;
//   description?: string;
// }) {
//   return (
//     <div className="mb-3">
//       <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">{eyebrow}</p>

//       <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">{title}</h2>

//       {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
//     </div>
//   );
// }

// function StatCard({
//   icon,
//   value,
//   label,
//   loading,
// }: {
//   icon: string;
//   value: string;
//   label: string;
//   loading: boolean;
// }) {
//   if (loading) {
//     return (
//       <div
//         className="h-[104px] animate-pulse rounded-2xl border border-slate-100 bg-white motion-reduce:animate-none"
//         aria-hidden="true"
//       />
//     );
//   }

//   return (
//     <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
//       <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-lg" aria-hidden="true">
//         {icon}
//       </div>

//       <p className="mt-2 truncate text-lg font-black text-slate-950 sm:text-xl">{value}</p>

//       <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
//     </div>
//   );
// }

// /** One row used for shortcuts and support. Internal links use <Link>, others a plain <a>. */
// function ActionRow({
//   href,
//   icon,
//   title,
//   description,
//   external,
//   tone = 'sky',
// }: {
//   href: string;
//   icon: string;
//   title: string;
//   description: string;
//   external?: boolean;
//   tone?: 'sky' | 'emerald' | 'violet' | 'rose';
// }) {
//   const tones: Record<string, string> = {
//     sky: 'bg-sky-50 group-hover:text-sky-500',
//     emerald: 'bg-emerald-50 group-hover:text-emerald-500',
//     violet: 'bg-violet-50 group-hover:text-violet-500',
//     rose: 'bg-rose-50 group-hover:text-rose-500',
//   };

//   const className =
//     'group flex min-h-[70px] items-center gap-3 border-b border-slate-100 px-4 py-3.5 transition last:border-b-0 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50';

//   const body = (
//     <>
//       <span
//         className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${tones[tone].split(' ')[0]}`}
//         aria-hidden="true"
//       >
//         {icon}
//       </span>

//       <span className="min-w-0 flex-1">
//         <span className="block text-sm font-extrabold text-slate-900">{title}</span>
//         <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">{description}</span>
//       </span>

//       <span
//         className="text-lg font-bold text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-500"
//         aria-hidden="true"
//       >
//         →
//       </span>
//     </>
//   );

//   if (external) {
//     const isWeb = href.startsWith('http');
//     return (
//       <a
//         href={href}
//         className={className}
//         {...(isWeb ? { target: '_blank', rel: 'noreferrer' } : {})}
//       >
//         {body}
//       </a>
//     );
//   }

//   return (
//     <Link href={href} className={className}>
//       {body}
//     </Link>
//   );
// }

// function ReadOnlyRow({
//   icon,
//   title,
//   value,
//   actions,
// }: {
//   icon: string;
//   title: string;
//   value: string;
//   actions?: React.ReactNode;
// }) {
//   return (
//     <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0">
//       <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-lg" aria-hidden="true">
//         {icon}
//       </span>

//       <div className="min-w-0 flex-1">
//         <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{title}</p>

//         <p className="mt-1 truncate text-sm font-extrabold text-slate-900">{value}</p>
//       </div>

//       {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
//     </div>
//   );
// }

// function MiniButton({
//   onClick,
//   children,
//   label,
// }: {
//   onClick: () => void;
//   children: React.ReactNode;
//   label?: string;
// }) {
//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       aria-label={label}
//       className="min-h-9 rounded-lg px-2.5 text-[11px] font-black text-sky-700 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
//     >
//       {children}
//     </button>
//   );
// }

// function Toggle({
//   checked,
//   onChange,
//   disabled,
//   label,
// }: {
//   checked: boolean;
//   onChange: (value: boolean) => void;
//   disabled?: boolean;
//   label: string;
// }) {
//   return (
//     <button
//       type="button"
//       role="switch"
//       aria-checked={checked}
//       aria-label={label}
//       disabled={disabled}
//       onClick={() => onChange(!checked)}
//       className={[
//         'relative h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100',
//         checked ? 'bg-emerald-600' : 'bg-slate-300',
//         disabled ? 'cursor-not-allowed opacity-60' : '',
//       ].join(' ')}
//     >
//       <span
//         className={[
//           'absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
//           checked ? 'translate-x-6' : 'translate-x-1',
//         ].join(' ')}
//       />
//     </button>
//   );
// }

// function LoadingCard() {
//   return (
//     <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm" aria-hidden="true">
//       <div className="h-6 w-32 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
//       <div className="mt-3 h-4 w-56 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
//       <div className="mt-6 h-12 w-full animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
//       <div className="mt-3 h-12 w-full animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />
//     </div>
//   );
// }

// function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
//   return (
//     <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5" role="alert">
//       <div className="flex items-start gap-3">
//         <span
//           className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 font-black text-rose-700"
//           aria-hidden="true"
//         >
//           !
//         </span>

//         <div className="min-w-0 flex-1">
//           <p className="font-black text-rose-900">We couldn&apos;t load your account</p>

//           <p className="mt-1 text-sm leading-6 text-rose-700">{message}</p>

//           <button
//             type="button"
//             onClick={onRetry}
//             className="mt-3 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
//           >
//             Try again
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// function ToastView({ toast }: { toast: Toast | null }) {
//   const tone =
//     toast?.kind === 'error'
//       ? 'bg-rose-600'
//       : toast?.kind === 'success'
//         ? 'bg-emerald-600'
//         : 'bg-slate-900';

//   return (
//     <div
//       className="pointer-events-none fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-[90] flex justify-center px-4"
//       role="status"
//       aria-live="polite"
//     >
//       {toast ? (
//         <div
//           className={`pointer-events-auto rounded-full px-5 py-3 text-sm font-bold text-white shadow-xl shadow-slate-900/20 ${tone}`}
//         >
//           {toast.text}
//         </div>
//       ) : null}
//     </div>
//   );
// }

// function SignOutModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
//   const cancelRef = useRef<HTMLButtonElement | null>(null);

//   useEffect(() => {
//     const onKeyDown = (event: KeyboardEvent) => {
//       if (event.key === 'Escape') onCancel();
//     };

//     const previous = document.body.style.overflow;
//     document.body.style.overflow = 'hidden';
//     document.addEventListener('keydown', onKeyDown);
//     cancelRef.current?.focus();

//     return () => {
//       document.body.style.overflow = previous;
//       document.removeEventListener('keydown', onKeyDown);
//     };
//   }, [onCancel]);

//   return (
//     <div
//       className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center"
//       role="dialog"
//       aria-modal="true"
//       aria-labelledby="sign-out-title"
//       onMouseDown={(event) => {
//         if (event.target === event.currentTarget) onCancel();
//       }}
//     >
//       <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
//         <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-2xl" aria-hidden="true">
//           👋
//         </div>

//         <h2 id="sign-out-title" className="mt-5 text-center text-xl font-black text-slate-950">
//           Sign out of AuroTap?
//         </h2>

//         <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-slate-500">
//           You can sign in again whenever you need your orders, addresses, and account details.
//         </p>

//         <div className="mt-6 grid grid-cols-2 gap-3">
//           <button
//             ref={cancelRef}
//             type="button"
//             onClick={onCancel}
//             className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
//           >
//             Cancel
//           </button>

//           <button
//             type="button"
//             onClick={onConfirm}
//             className="min-h-11 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
//           >
//             Sign out
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* -------------------------------------------------------------------------- */
// /* Page                                                                       */
// /* -------------------------------------------------------------------------- */

// export default function CustomerAccountPage() {
//   const router = useRouter();
//   const pathname = usePathname() ?? '/customer/account';

//   const { hydrated, isLoggedIn, isCustomer, session, updateSession, logout } = useAuth();

//   const [profile, setProfile] = useState<ProfilePayload | null>(null);
//   const [stats, setStats] = useState<StatsPayload | null>(null);

//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [refreshing, setRefreshing] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [saveError, setSaveError] = useState<string | null>(null);

//   const [fullName, setFullName] = useState('');
//   const [city, setCity] = useState('');
//   const [notificationsEnabled, setNotificationsEnabled] = useState(true);
//   const [formErrors, setFormErrors] = useState<FormErrors>({});

//   const [signOutOpen, setSignOutOpen] = useState(false);
//   const [showPhone, setShowPhone] = useState(false);
//   const [copied, setCopied] = useState<'phone' | 'email' | null>(null);
//   const [toast, setToast] = useState<Toast | null>(null);

//   const toastTimer = useRef<number | null>(null);
//   const copyTimer = useRef<number | null>(null);

//   const ready = hydrated && isLoggedIn && isCustomer;

//   const showToast = useCallback((next: Toast) => {
//     setToast(next);
//     if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
//     toastTimer.current = window.setTimeout(() => setToast(null), 2800);
//   }, []);

//   useEffect(
//     () => () => {
//       if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
//       if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
//     },
//     []
//   );

//   /* ── Auth guard ───────────────────────────────────────────────────── */
//   useEffect(() => {
//     if (!hydrated) return;

//     if (!isLoggedIn) {
//       router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//     }
//   }, [hydrated, isLoggedIn, router, pathname]);

//   /* ── Load account data in parallel ───────────────────────────────── */
//   const load = useCallback(
//     async (showRefreshState = false) => {
//       if (!hydrated) return;

//       if (!isLoggedIn || !isCustomer) {
//         router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//         return;
//       }

//       if (showRefreshState) {
//         setRefreshing(true);
//       } else {
//         setLoading(true);
//       }

//       setError(null);

//       try {
//         const token = await getToken();

//         if (!token) {
//           clearSession();
//           router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//           return;
//         }

//         const headers = { Authorization: `Bearer ${token}` };

//         const [profileResponse, statsResponse] = await Promise.all([
//           fetch('/api/customer/profile', {
//             credentials: 'include',
//             headers,
//             cache: 'no-store',
//           }),
//           fetch('/api/customer/stats', {
//             credentials: 'include',
//             headers,
//             cache: 'no-store',
//           }),
//         ]);

//         if (profileResponse.status === 401 || statsResponse.status === 401) {
//           clearSession();
//           router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//           return;
//         }

//         const profileJson = await readJson<ApiEnvelope<ProfilePayload>>(profileResponse);
//         const statsJson = await readJson<ApiEnvelope<StatsPayload>>(statsResponse);

//         if (!profileResponse.ok || profileJson.success === false) {
//           throw new Error(profileJson.error ?? 'Could not load your profile.');
//         }

//         if (!statsResponse.ok || statsJson.success === false) {
//           throw new Error(statsJson.error ?? 'Could not load your account activity.');
//         }

//         const nextProfile = profileJson.data ?? null;
//         const nextStats = statsJson.data ?? null;

//         setProfile(nextProfile);
//         setStats(nextStats);

//         setFullName(nextProfile?.full_name?.trim() ?? '');
//         setCity(nextProfile?.city?.trim() ?? '');
//         setNotificationsEnabled(getNotificationPreference(nextProfile?.settings));
//         setSaveError(null);
//       } catch (cause) {
//         setError(cause instanceof Error ? cause.message : 'Could not load your account.');
//       } finally {
//         setLoading(false);
//         setRefreshing(false);
//       }
//     },
//     [hydrated, isLoggedIn, isCustomer, pathname, router]
//   );

//   useEffect(() => {
//     if (ready) void load();
//   }, [ready, load]);

//   /* ── Form state ──────────────────────────────────────────────────── */
//   const originalName = profile?.full_name?.trim() ?? '';
//   const originalCity = profile?.city?.trim() ?? '';
//   const originalNotifications = getNotificationPreference(profile?.settings);

//   const hasChanges =
//     fullName.trim() !== originalName ||
//     city.trim() !== originalCity ||
//     notificationsEnabled !== originalNotifications;

//   const initials = useMemo(
//     () => getInitials(profile?.full_name ?? session?.name ?? 'AuroTap'),
//     [profile?.full_name, session?.name]
//   );

//   const email = session?.email?.trim() ?? '';
//   const phone = profile?.phone?.trim() ?? session?.phone?.trim() ?? '';

//   const memberSince = formatMemberSince(stats?.member_since ?? profile?.created_at);

//   /* ── Profile completeness (derived from saved data, not unsaved edits) ── */
//   const completeness = useMemo(() => {
//     const items = [
//       { key: 'name', label: 'Full name', done: originalName.length >= 2 },
//       { key: 'city', label: 'City', done: originalCity.length >= 2 },
//       { key: 'phone', label: 'Mobile number', done: phone.length > 0 },
//       { key: 'email', label: 'Email', done: email.length > 0 },
//     ];
//     const doneCount = items.filter((item) => item.done).length;

//     return {
//       pct: Math.round((doneCount / items.length) * 100),
//       missing: items.filter((item) => !item.done),
//     };
//   }, [originalName, originalCity, phone, email]);

//   /* ── Warn before closing the tab with unsaved edits ──────────────── */
//   useEffect(() => {
//     if (!hasChanges) return;

//     const onBeforeUnload = (event: BeforeUnloadEvent) => {
//       event.preventDefault();
//       event.returnValue = '';
//     };

//     window.addEventListener('beforeunload', onBeforeUnload);
//     return () => window.removeEventListener('beforeunload', onBeforeUnload);
//   }, [hasChanges]);

//   const validateForm = (): boolean => {
//     const nextErrors: FormErrors = {};

//     const name = fullName.trim();
//     const selectedCity = city.trim();

//     if (name.length < 2) {
//       nextErrors.full_name = 'Enter at least 2 characters.';
//     } else if (name.length > 80) {
//       nextErrors.full_name = 'Name must be 80 characters or fewer.';
//     }

//     if (selectedCity.length < 2) {
//       nextErrors.city = 'Select your city.';
//     }

//     setFormErrors(nextErrors);

//     return Object.keys(nextErrors).length === 0;
//   };

//   /* ── Save ────────────────────────────────────────────────────────── */
//   const handleSave = async () => {
//     if (!validateForm() || saving) return;

//     setSaving(true);
//     setSaveError(null);

//     try {
//       const token = await getToken();

//       if (!token) {
//         clearSession();
//         router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//         return;
//       }

//       const existingSettings = profile?.settings ?? {};
//       const existingNotifications = existingSettings.notifications ?? {};

//       /*
//        * IMPORTANT:
//        * The backend profile API accepts the nested `settings.notifications` structure.
//        * Do NOT send `notifications_enabled` as a new backend field because it is not
//        * part of the API whitelist.
//        */
//       const nextSettings: AccountSettings = {
//         ...existingSettings,
//         notifications: {
//           ...existingNotifications,
//           whatsapp: notificationsEnabled,
//           sms: notificationsEnabled,
//           email: notificationsEnabled,
//           push: notificationsEnabled,
//         },
//       };

//       const response = await fetch('/api/customer/profile', {
//         method: 'PUT',
//         credentials: 'include',
//         headers: {
//           'Content-Type': 'application/json',
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify({
//           full_name: fullName.trim(),
//           city: city.trim(),
//           settings: nextSettings,
//         }),
//       });

//       if (response.status === 401) {
//         clearSession();
//         router.replace(`/auth/login?returnTo=${encodeURIComponent(pathname)}`);
//         return;
//       }

//       const json = await readJson<ApiEnvelope<ProfilePayload>>(response);

//       if (!response.ok || json.success === false) {
//         throw new Error(json.error ?? 'Could not save your profile.');
//       }

//       const savedProfile =
//         json.data ??
//         ({
//           ...profile,
//           full_name: fullName.trim(),
//           city: city.trim(),
//           settings: nextSettings,
//         } as ProfilePayload);

//       setProfile(savedProfile);

//       updateSession({
//         name: savedProfile.full_name ?? session?.name ?? '',
//       });

//       setFormErrors({});
//       showToast({ kind: 'success', text: 'Profile saved' });

//       window.dispatchEvent(new CustomEvent('aurotap-profile-saved'));
//     } catch (cause) {
//       const message = cause instanceof Error ? cause.message : 'Could not save your profile.';

//       setSaveError(message);
//       showToast({ kind: 'error', text: 'Could not save changes' });
//     } finally {
//       setSaving(false);
//     }
//   };

//   const handleDiscard = () => {
//     setFullName(originalName);
//     setCity(originalCity);
//     setNotificationsEnabled(originalNotifications);
//     setFormErrors({});
//     setSaveError(null);
//   };

//   /* ── Clipboard ───────────────────────────────────────────────────── */
//   const handleCopy = async (kind: 'phone' | 'email', value: string) => {
//     if (!value) return;

//     try {
//       await navigator.clipboard.writeText(value);

//       setCopied(kind);
//       if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
//       copyTimer.current = window.setTimeout(() => setCopied(null), 1800);

//       showToast({ kind: 'info', text: kind === 'phone' ? 'Number copied' : 'Email copied' });
//     } catch {
//       setCopied(null);
//       showToast({ kind: 'error', text: 'Copy is not available in this browser' });
//     }
//   };

//   /* ── States ──────────────────────────────────────────────────────── */
//   if (!hydrated || (hydrated && !isLoggedIn)) {
//     return (
//       <main className="flex min-h-[100dvh] items-center justify-center bg-sky-50 px-4">
//         <div className="text-center">
//           <div
//             className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600 motion-reduce:animate-none"
//             aria-hidden="true"
//           />

//           <p className="mt-4 text-sm font-semibold text-slate-500" role="status">
//             Loading your account…
//           </p>
//         </div>
//       </main>
//     );
//   }

//   if (!isCustomer) {
//     return (
//       <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
//         <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
//           <div
//             className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-xl font-black text-rose-600"
//             aria-hidden="true"
//           >
//             !
//           </div>

//           <h1 className="mt-5 text-xl font-black text-slate-950">Customer account required</h1>

//           <p className="mt-2 text-sm leading-6 text-slate-500">
//             This account area is only available to customer accounts.
//           </p>

//           <Link
//             href="/"
//             className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800"
//           >
//             Back to AuroTap
//           </Link>
//         </div>
//       </main>
//     );
//   }

//   const displayName = profile?.full_name || session?.name || 'Welcome';

//   return (
//     <>
//       <style>{`
//         .aurotap-account {
//           min-height: 100dvh;
//           background:
//             radial-gradient(circle at top right, rgba(14,165,233,0.10), transparent 28%),
//             linear-gradient(180deg, #eff8ff 0%, #f8fbff 32%, #ffffff 100%);
//         }

//         .aurotap-account *,
//         .aurotap-account *::before,
//         .aurotap-account *::after {
//           box-sizing: border-box;
//         }

//         @media (prefers-reduced-motion: reduce) {
//           .aurotap-account *,
//           .aurotap-account *::before,
//           .aurotap-account *::after {
//             scroll-behavior: auto !important;
//             animation-duration: 0.01ms !important;
//             animation-iteration-count: 1 !important;
//             transition-duration: 0.01ms !important;
//           }
//         }
//       `}</style>

//       <TopBar />

//       <main className="aurotap-account pb-[calc(6rem+env(safe-area-inset-bottom))]">
//         <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
//           {/* ---------------------------------------------------------------- */}
//           {/* Profile hero                                                     */}
//           {/* ---------------------------------------------------------------- */}
//           <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#092844] via-[#1155A6] to-[#0EA5E9] p-5 text-white shadow-xl shadow-sky-200/60 sm:p-7">
//             <div
//               className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl"
//               aria-hidden="true"
//             />

//             <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
//               <div
//                 className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[3px] border-white/40 bg-white/10 text-2xl font-black shadow-inner"
//                 aria-hidden="true"
//               >
//                 {initials}
//               </div>

//               <div className="min-w-0 flex-1">
//                 <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">
//                   My account
//                 </p>

//                 <h1 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-3xl">
//                   {loading ? 'Loading…' : displayName}
//                 </h1>

//                 <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-white/75">
//                   <span>Member since {memberSince}</span>

//                   <span className="h-1 w-1 rounded-full bg-white/40" aria-hidden="true" />

//                   <span>{profile?.city || 'City not set'}</span>
//                 </div>
//               </div>

//               <div className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur sm:w-52">
//                 <div className="flex items-baseline justify-between">
//                   <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
//                     Profile
//                   </p>
//                   <p className="text-sm font-black">{loading ? '—' : `${completeness.pct}%`}</p>
//                 </div>

//                 <div
//                   className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"
//                   role="progressbar"
//                   aria-label="Profile completeness"
//                   aria-valuemin={0}
//                   aria-valuemax={100}
//                   aria-valuenow={loading ? 0 : completeness.pct}
//                 >
//                   <div
//                     className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-[width] duration-500"
//                     style={{ width: `${loading ? 0 : completeness.pct}%` }}
//                   />
//                 </div>

//                 <p className="mt-2 text-[11px] font-medium leading-4 text-white/70">
//                   {loading
//                     ? 'Checking details…'
//                     : completeness.missing.length === 0
//                       ? 'All set for faster booking'
//                       : `Add ${completeness.missing.map((item) => item.label.toLowerCase()).join(', ')}`}
//                 </p>
//               </div>
//             </div>
//           </header>

//           {error ? (
//             <div className="mt-5">
//               <ErrorCard message={error} onRetry={() => void load()} />
//             </div>
//           ) : null}

//           {/* Activity */}
//           <section className="mt-6" aria-labelledby="account-activity">
//             <div className="mb-3">
//               <h2 id="account-activity" className="text-lg font-black tracking-tight text-slate-950">
//                 Your activity
//               </h2>
//               <p className="mt-1 text-xs leading-5 text-slate-500">A quick view of your AuroTap usage.</p>
//             </div>

//             <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
//               <StatCard icon="📦" value={String(stats?.total_orders ?? 0)} label="Orders" loading={loading} />

//               <StatCard icon="💧" value={String(stats?.cans_ordered ?? 0)} label="Cans" loading={loading} />

//               <StatCard icon="₹" value={formatINR(stats?.total_spent ?? 0)} label="Total spent" loading={loading} />

//               <StatCard
//                 icon="⭐"
//                 value={stats?.avg_rating != null ? String(stats.avg_rating) : '—'}
//                 label="Your rating"
//                 loading={loading}
//               />
//             </div>
//           </section>

//           <div className="mt-6 grid gap-6 lg:grid-cols-5">
//             {/* ───────── Left column: profile + preferences ───────── */}
//             <div className="space-y-6 lg:col-span-3">
//               <section aria-labelledby="account-profile">
//                 <SectionTitle
//                   eyebrow="Personal information"
//                   title="Profile details"
//                   description="Keep your delivery information up to date."
//                 />
//                 <span id="account-profile" className="sr-only">
//                   Profile details
//                 </span>

//                 {loading ? (
//                   <LoadingCard />
//                 ) : (
//                   <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
//                     <div className="space-y-5 p-5 sm:p-6">
//                       <div>
//                         <label
//                           htmlFor="customer-full-name"
//                           className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
//                         >
//                           Full name
//                         </label>

//                         <input
//                           id="customer-full-name"
//                           value={fullName}
//                           onChange={(event) => {
//                             setFullName(event.target.value);

//                             if (formErrors.full_name) {
//                               setFormErrors((current) => ({ ...current, full_name: undefined }));
//                             }

//                             setSaveError(null);
//                           }}
//                           autoComplete="name"
//                           maxLength={80}
//                           className={[
//                             'mt-2 min-h-12 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition',
//                             'focus:bg-white focus:ring-4',
//                             formErrors.full_name
//                               ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
//                               : 'border-slate-200 focus:border-sky-400 focus:ring-sky-50',
//                           ].join(' ')}
//                           placeholder="Enter your full name"
//                           aria-invalid={Boolean(formErrors.full_name)}
//                           aria-describedby={formErrors.full_name ? 'full-name-error' : undefined}
//                         />

//                         {formErrors.full_name ? (
//                           <p id="full-name-error" className="mt-1.5 text-xs font-bold text-rose-600">
//                             {formErrors.full_name}
//                           </p>
//                         ) : null}
//                       </div>

//                       <div>
//                         <label
//                           htmlFor="customer-city"
//                           className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
//                         >
//                           City
//                         </label>

//                         <select
//                           id="customer-city"
//                           value={city}
//                           onChange={(event) => {
//                             setCity(event.target.value);
//                             setFormErrors((current) => ({ ...current, city: undefined }));
//                             setSaveError(null);
//                           }}
//                           className={[
//                             'mt-2 min-h-12 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition',
//                             'focus:bg-white focus:ring-4',
//                             formErrors.city
//                               ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
//                               : 'border-slate-200 focus:border-sky-400 focus:ring-sky-50',
//                           ].join(' ')}
//                           aria-invalid={Boolean(formErrors.city)}
//                           aria-describedby={formErrors.city ? 'city-error' : undefined}
//                         >
//                           <option value="">Select your city</option>

//                           {SERVICE_CITIES.map((serviceCity) => (
//                             <option key={serviceCity} value={serviceCity}>
//                               {serviceCity}
//                             </option>
//                           ))}

//                           {city && !SERVICE_CITIES.includes(city as (typeof SERVICE_CITIES)[number]) ? (
//                             <option value={city}>{city}</option>
//                           ) : null}
//                         </select>

//                         {formErrors.city ? (
//                           <p id="city-error" className="mt-1.5 text-xs font-bold text-rose-600">
//                             {formErrors.city}
//                           </p>
//                         ) : null}
//                       </div>

//                       <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
//                         <div className="min-w-0">
//                           <p className="text-sm font-black text-slate-900">Order notifications</p>

//                           <p className="mt-1 text-xs leading-5 text-slate-500">
//                             Receive important updates about your bookings and orders.
//                           </p>
//                         </div>

//                         <Toggle
//                           checked={notificationsEnabled}
//                           disabled={saving}
//                           label="Toggle order notifications"
//                           onChange={(value) => {
//                             setNotificationsEnabled(value);
//                             setSaveError(null);
//                           }}
//                         />
//                       </div>

//                       {saveError ? (
//                         <p
//                           className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700"
//                           role="alert"
//                         >
//                           {saveError}
//                         </p>
//                       ) : null}

//                       {hasChanges ? (
//                         <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
//                           <div className="flex items-center justify-between gap-3">
//                             <div>
//                               <p className="text-sm font-black text-emerald-900">Unsaved changes</p>
//                               <p className="mt-1 text-xs text-emerald-700">Save when everything looks right.</p>
//                             </div>

//                             <button
//                               type="button"
//                               onClick={handleDiscard}
//                               disabled={saving}
//                               className="shrink-0 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-black text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
//                             >
//                               Discard
//                             </button>
//                           </div>

//                           <button
//                             type="button"
//                             onClick={() => void handleSave()}
//                             disabled={saving}
//                             className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
//                           >
//                             {saving ? 'Saving changes…' : 'Save changes'}
//                           </button>
//                         </div>
//                       ) : null}
//                     </div>

//                     {/* Read-only identity */}
//                     <div className="border-t border-slate-100">
//                       <ReadOnlyRow
//                         icon="✉️"
//                         title="Login email"
//                         value={email || 'Not available'}
//                         actions={
//                           email ? (
//                             <MiniButton onClick={() => void handleCopy('email', email)} label="Copy email">
//                               {copied === 'email' ? 'Copied' : 'Copy'}
//                             </MiniButton>
//                           ) : null
//                         }
//                       />

//                       <ReadOnlyRow
//                         icon="📱"
//                         title="Mobile number"
//                         value={showPhone ? phone || '—' : maskPhone(phone)}
//                         actions={
//                           phone ? (
//                             <>
//                               <MiniButton
//                                 onClick={() => setShowPhone((current) => !current)}
//                                 label={showPhone ? 'Hide mobile number' : 'Show mobile number'}
//                               >
//                                 {showPhone ? 'Hide' : 'Show'}
//                               </MiniButton>

//                               <MiniButton onClick={() => void handleCopy('phone', phone)} label="Copy mobile number">
//                                 {copied === 'phone' ? 'Copied' : 'Copy'}
//                               </MiniButton>
//                             </>
//                           ) : null
//                         }
//                       />
//                     </div>
//                   </div>
//                 )}
//               </section>

//               {/* Language */}
//               <section>
//                 <SectionTitle
//                   eyebrow="Preferences"
//                   title="Language"
//                   description="Choose how AuroTap is displayed."
//                 />

//                 <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
//                   <div className="flex min-w-0 items-center gap-3">
//                     <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-lg" aria-hidden="true">
//                       🌐
//                     </span>

//                     <div>
//                       <p className="text-sm font-black text-slate-900">App language</p>

//                       <p className="mt-1 text-xs font-medium text-slate-500">English or Hindi</p>
//                     </div>
//                   </div>

//                   <LanguageToggle />
//                 </div>
//               </section>
//             </div>

//             {/* ───────── Right column: shortcuts + support ───────── */}
//             <div className="space-y-6 lg:col-span-2">
//               <section>
//                 <SectionTitle
//                   eyebrow="Manage"
//                   title="Account shortcuts"
//                   description="Quick access to the things you use most."
//                 />

//                 <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
//                   <ActionRow
//                     href="/"
//                     icon="🏠"
//                     title="AuroTap home"
//                     description="Back to the main website"
//                     tone="emerald"
//                   />

//                   <ActionRow
//                     href="/customer/home"
//                     icon="📊"
//                     title="Customer dashboard"
//                     description="Orders, tracking and quick actions"
//                   />

//                   <ActionRow
//                     href="/customer/addresses"
//                     icon="📍"
//                     title="My addresses"
//                     description="Your saved delivery locations"
//                   />

//                   <ActionRow
//                     href="/customer/history"
//                     icon="📋"
//                     title="Order history"
//                     description="Previous and current orders"
//                   />

//                   <ActionRow
//                     href="/customer/subscriptions"
//                     icon="🔄"
//                     title="My subscriptions"
//                     description="Pause, resume or cancel deliveries"
//                   />

//                   <ActionRow
//                     href="/pricing"
//                     icon="🏷️"
//                     title="Pricing"
//                     description="Available service pricing"
//                   />
//                 </div>
//               </section>

//               <section>
//                 <SectionTitle
//                   eyebrow="Need help?"
//                   title="AuroTap support"
//                   description="Reach us for anything about your account or orders."
//                 />

//                 <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
//                   <ActionRow
//                     href="/customer/support"
//                     icon="🎧"
//                     title="Get support"
//                     description="Help centre and tickets"
//                   />

//                   <ActionRow
//                     href={WHATSAPP_URL}
//                     external
//                     icon="💬"
//                     title="Chat on WhatsApp"
//                     description="Fastest way to reach us"
//                     tone="emerald"
//                   />

//                   <ActionRow
//                     href={`tel:${SUPPORT_PHONE}`}
//                     external
//                     icon="📞"
//                     title="Call support"
//                     description={SUPPORT_PHONE}
//                   />

//                   <ActionRow
//                     href="/terms"
//                     icon="📄"
//                     title="Terms & Privacy"
//                     description="Review AuroTap policies"
//                     tone="violet"
//                   />

//                   <ActionRow
//                     href={DELETE_REQUEST_URL}
//                     external
//                     icon="🗑️"
//                     title="Request account deletion"
//                     description="We will confirm on WhatsApp"
//                     tone="rose"
//                   />
//                 </div>
//               </section>
//             </div>
//           </div>

//           {/* Refresh */}
//           <div className="mt-6 flex justify-center">
//             <button
//               type="button"
//               onClick={() => void load(true)}
//               disabled={refreshing}
//               className="inline-flex min-h-9 items-center rounded-xl px-3 text-xs font-bold text-slate-400 hover:bg-white hover:text-slate-600 disabled:opacity-60"
//             >
//               <span
//                 className={refreshing ? 'mr-1.5 animate-spin motion-reduce:animate-none' : 'mr-1.5'}
//                 aria-hidden="true"
//               >
//                 ↻
//               </span>

//               {refreshing ? 'Refreshing…' : 'Refresh account'}
//             </button>
//           </div>

//           {/* Sign out */}
//           <section className="mt-4">
//             <button
//               type="button"
//               onClick={() => setSignOutOpen(true)}
//               className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3.5 text-sm font-black text-rose-700 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
//             >
//               Sign out
//             </button>
//           </section>

//           <footer className="px-2 pb-4 pt-5 text-center">
//             <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">AUROTAP.IN</p>

//             <p className="mt-1 text-[11px] font-medium text-slate-400">
//               Your account, orders, and preferences in one place.
//             </p>
//           </footer>
//         </div>
//       </main>

//       <ToastView toast={toast} />

//       {signOutOpen ? (
//         <SignOutModal
//           onCancel={() => setSignOutOpen(false)}
//           onConfirm={() => {
//             setSignOutOpen(false);
//             logout({ redirectTo: '/' });
//           }}
//         />
//       ) : null}

//       <BottomNav />
//     </>
//   );
// }














// // 'use client';

// // import React, {
// //   useCallback,
// //   useEffect,
// //   useMemo,
// //   useState,
// // } from 'react';
// // import Link from 'next/link';
// // import { usePathname, useRouter } from 'next/navigation';

// // import BottomNav from '@/components/customer/BottomNav';
// // import LanguageToggle from '@/components/LanguageToggle';
// // import {
// //   clearSession,
// //   getInitials,
// //   useAuth,
// // } from '@/hooks/useAuth';
// // import { getToken } from '@/lib/api-client';

// // /* -------------------------------------------------------------------------- */
// // /* Types                                                                      */
// // /* -------------------------------------------------------------------------- */

// // type NotificationSettings = {
// //   whatsapp?: boolean;
// //   sms?: boolean;
// //   email?: boolean;
// //   push?: boolean;
// // };

// // type AccountSettings = {
// //   notifications?: NotificationSettings;
// //   language?: 'en' | 'hi';
// //   default_payment?: 'cash' | 'upi' | 'online';
// //   marketing_opt_in?: boolean;
// //   default_address_id?: string | null;

// //   /*
// //    * Legacy compatibility.
// //    * The backend does not use this key for new writes, but older records
// //    * may still contain it.
// //    */
// //   notifications_enabled?: boolean;

// //   [key: string]: unknown;
// // };

// // type ProfilePayload = {
// //   id: string;
// //   full_name: string | null;
// //   city: string | null;
// //   phone: string | null;
// //   created_at: string | null;
// //   settings?: AccountSettings | null;
// // };

// // type StatsPayload = {
// //   total_orders?: number;
// //   total_spent?: number;
// //   cans_ordered?: number;
// //   member_since?: string | null;
// //   avg_rating?: number | null;
// //   total_reviews?: number;
// // };

// // type ApiEnvelope<T> = {
// //   success?: boolean;
// //   data?: T;
// //   error?: string;
// // };

// // type FormErrors = {
// //   full_name?: string;
// //   city?: string;
// // };

// // /* -------------------------------------------------------------------------- */
// // /* Constants                                                                  */
// // /* -------------------------------------------------------------------------- */

// // const SUPPORT_PHONE = '+919889305803';

// // const WHATSAPP_URL = `https://wa.me/919889305803?text=${encodeURIComponent(
// //   'Hi AuroTap! I need help with my account.'
// // )}`;

// // const SERVICE_CITIES = [
// //   'Kanpur',
// //   'Gorakhpur',
// //   'Lucknow',
// //   'Varanasi',
// //   'Prayagraj',
// //   'Agra',
// //   'Meerut',
// //   'Bareilly',
// //   'Aligarh',
// //   'Mathura',
// //   'Delhi',
// //   'Noida',
// //   'Ghaziabad',
// // ] as const;

// // /* -------------------------------------------------------------------------- */
// // /* Helpers                                                                    */
// // /* -------------------------------------------------------------------------- */

// // function formatINR(value: number | string | null | undefined): string {
// //   const amount = Math.round(Number(value) || 0);

// //   return `₹${amount.toLocaleString('en-IN')}`;
// // }

// // function formatMemberSince(
// //   iso: string | null | undefined
// // ): string {
// //   if (!iso) return '—';

// //   const timestamp = new Date(iso).getTime();

// //   if (Number.isNaN(timestamp)) return '—';

// //   return new Date(timestamp).toLocaleDateString('en-IN', {
// //     month: 'short',
// //     year: 'numeric',
// //   });
// // }

// // function maskPhone(value: string | null | undefined): string {
// //   if (!value) return '—';

// //   const digits = value.replace(/\D/g, '');

// //   if (digits.length < 6) return value;

// //   return `${digits.slice(0, 2)}••••${digits.slice(-4)}`;
// // }

// // function getNotificationPreference(
// //   settings: AccountSettings | null | undefined
// // ): boolean {
// //   if (!settings) return true;

// //   if (typeof settings.notifications_enabled === 'boolean') {
// //     return settings.notifications_enabled;
// //   }

// //   const notifications = settings.notifications;

// //   if (!notifications) return true;

// //   const values = [
// //     notifications.whatsapp,
// //     notifications.sms,
// //     notifications.email,
// //     notifications.push,
// //   ].filter((value) => typeof value === 'boolean') as boolean[];

// //   if (!values.length) return true;

// //   return values.some(Boolean);
// // }

// // async function readJson<T>(response: Response): Promise<T> {
// //   try {
// //     return (await response.json()) as T;
// //   } catch {
// //     return {} as T;
// //   }
// // }

// // async function copyText(
// //   value: string,
// //   successMessage: string
// // ): Promise<void> {
// //   try {
// //     await navigator.clipboard.writeText(value);
// //     window.dispatchEvent(
// //       new CustomEvent('aurotap-copy-success', {
// //         detail: successMessage,
// //       })
// //     );
// //   } catch {
// //     window.dispatchEvent(
// //       new CustomEvent('aurotap-copy-failed')
// //     );
// //   }
// // }

// // /* -------------------------------------------------------------------------- */
// // /* Small UI components                                                        */
// // /* -------------------------------------------------------------------------- */

// // function SectionTitle({
// //   eyebrow,
// //   title,
// //   description,
// // }: {
// //   eyebrow: string;
// //   title: string;
// //   description?: string;
// // }) {
// //   return (
// //     <div className="mb-3">
// //       <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
// //         {eyebrow}
// //       </p>

// //       <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">
// //         {title}
// //       </h2>

// //       {description ? (
// //         <p className="mt-1 text-xs leading-5 text-slate-500">
// //           {description}
// //         </p>
// //       ) : null}
// //     </div>
// //   );
// // }

// // function StatCard({
// //   icon,
// //   value,
// //   label,
// //   loading,
// // }: {
// //   icon: string;
// //   value: string;
// //   label: string;
// //   loading: boolean;
// // }) {
// //   if (loading) {
// //     return (
// //       <div
// //         className="h-[104px] animate-pulse rounded-2xl border border-slate-100 bg-white"
// //         aria-hidden="true"
// //       />
// //     );
// //   }

// //   return (
// //     <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
// //       <div
// //         className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-lg"
// //         aria-hidden="true"
// //       >
// //         {icon}
// //       </div>

// //       <p className="mt-2 truncate text-lg font-black text-slate-950 sm:text-xl">
// //         {value}
// //       </p>

// //       <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
// //         {label}
// //       </p>
// //     </div>
// //   );
// // }

// // function MenuRow({
// //   href,
// //   icon,
// //   title,
// //   description,
// // }: {
// //   href: string;
// //   icon: string;
// //   title: string;
// //   description: string;
// // }) {
// //   return (
// //     <Link
// //       href={href}
// //       className="group flex min-h-[70px] items-center gap-3 border-b border-slate-100 px-4 py-3.5 transition hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
// //     >
// //       <span
// //         className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-lg"
// //         aria-hidden="true"
// //       >
// //         {icon}
// //       </span>

// //       <span className="min-w-0 flex-1">
// //         <span className="block text-sm font-extrabold text-slate-900">
// //           {title}
// //         </span>

// //         <span className="mt-0.5 block text-xs font-medium text-slate-500">
// //           {description}
// //         </span>
// //       </span>

// //       <span
// //         className="text-lg font-bold text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-500"
// //         aria-hidden="true"
// //       >
// //         →
// //       </span>
// //     </Link>
// //   );
// // }

// // function ReadOnlyRow({
// //   icon,
// //   title,
// //   value,
// //   action,
// // }: {
// //   icon: string;
// //   title: string;
// //   value: string;
// //   action?: React.ReactNode;
// // }) {
// //   return (
// //     <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0">
// //       <span
// //         className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-lg"
// //         aria-hidden="true"
// //       >
// //         {icon}
// //       </span>

// //       <div className="min-w-0 flex-1">
// //         <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
// //           {title}
// //         </p>

// //         <p className="mt-1 truncate text-sm font-extrabold text-slate-900">
// //           {value}
// //         </p>
// //       </div>

// //       {action}
// //     </div>
// //   );
// // }

// // function Toggle({
// //   checked,
// //   onChange,
// //   disabled,
// // }: {
// //   checked: boolean;
// //   onChange: (value: boolean) => void;
// //   disabled?: boolean;
// // }) {
// //   return (
// //     <button
// //       type="button"
// //       role="switch"
// //       aria-checked={checked}
// //       disabled={disabled}
// //       onClick={() => onChange(!checked)}
// //       className={[
// //         'relative h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100',
// //         checked ? 'bg-emerald-600' : 'bg-slate-300',
// //         disabled ? 'cursor-not-allowed opacity-60' : '',
// //       ].join(' ')}
// //       aria-label="Toggle order notifications"
// //     >
// //       <span
// //         className={[
// //           'absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
// //           checked ? 'translate-x-6' : 'translate-x-1',
// //         ].join(' ')}
// //       />
// //     </button>
// //   );
// // }

// // function LoadingCard() {
// //   return (
// //     <div
// //       className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"
// //       aria-hidden="true"
// //     >
// //       <div className="h-6 w-32 animate-pulse rounded bg-slate-100" />
// //       <div className="mt-3 h-4 w-56 animate-pulse rounded bg-slate-100" />
// //       <div className="mt-6 h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
// //       <div className="mt-3 h-12 w-full animate-pulse rounded-2xl bg-slate-100" />
// //     </div>
// //   );
// // }

// // function ErrorCard({
// //   message,
// //   onRetry,
// // }: {
// //   message: string;
// //   onRetry: () => void;
// // }) {
// //   return (
// //     <div
// //       className="rounded-3xl border border-rose-100 bg-rose-50 p-5"
// //       role="alert"
// //     >
// //       <div className="flex items-start gap-3">
// //         <span
// //           className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-100 font-black text-rose-700"
// //           aria-hidden="true"
// //         >
// //           !
// //         </span>

// //         <div className="min-w-0 flex-1">
// //           <p className="font-black text-rose-900">
// //             We couldn&apos;t load your account
// //           </p>

// //           <p className="mt-1 text-sm leading-6 text-rose-700">
// //             {message}
// //           </p>

// //           <button
// //             type="button"
// //             onClick={onRetry}
// //             className="mt-3 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
// //           >
// //             Try again
// //           </button>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }

// // function SignOutModal({
// //   onCancel,
// //   onConfirm,
// // }: {
// //   onCancel: () => void;
// //   onConfirm: () => void;
// // }) {
// //   useEffect(() => {
// //     const onKeyDown = (event: KeyboardEvent) => {
// //       if (event.key === 'Escape') {
// //         onCancel();
// //       }
// //     };

// //     document.addEventListener('keydown', onKeyDown);

// //     return () => {
// //       document.removeEventListener('keydown', onKeyDown);
// //     };
// //   }, [onCancel]);

// //   return (
// //     <div
// //       className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-sm sm:items-center"
// //       role="dialog"
// //       aria-modal="true"
// //       aria-labelledby="sign-out-title"
// //       onMouseDown={(event) => {
// //         if (event.target === event.currentTarget) {
// //           onCancel();
// //         }
// //       }}
// //     >
// //       <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
// //         <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-2xl">
// //           👋
// //         </div>

// //         <h2
// //           id="sign-out-title"
// //           className="mt-5 text-center text-xl font-black text-slate-950"
// //         >
// //           Sign out of AuroTap?
// //         </h2>

// //         <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-slate-500">
// //           You can sign in again whenever you need your orders,
// //           addresses, and account details.
// //         </p>

// //         <div className="mt-6 grid grid-cols-2 gap-3">
// //           <button
// //             type="button"
// //             onClick={onCancel}
// //             className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"
// //           >
// //             Cancel
// //           </button>

// //           <button
// //             type="button"
// //             onClick={onConfirm}
// //             className="min-h-11 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
// //           >
// //             Sign out
// //           </button>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }

// // /* -------------------------------------------------------------------------- */
// // /* Page                                                                       */
// // /* -------------------------------------------------------------------------- */

// // export default function CustomerAccountPage() {
// //   const router = useRouter();
// //   const pathname =
// //     usePathname() ?? '/customer/account';

// //   const {
// //     hydrated,
// //     isLoggedIn,
// //     isCustomer,
// //     session,
// //     updateSession,
// //     logout,
// //   } = useAuth();

// //   const [profile, setProfile] =
// //     useState<ProfilePayload | null>(null);

// //   const [stats, setStats] =
// //     useState<StatsPayload | null>(null);

// //   const [loading, setLoading] = useState(true);
// //   const [saving, setSaving] = useState(false);
// //   const [refreshing, setRefreshing] = useState(false);
// //   const [error, setError] = useState<string | null>(null);

// //   const [fullName, setFullName] = useState('');
// //   const [city, setCity] = useState('');

// //   const [notificationsEnabled, setNotificationsEnabled] =
// //     useState(true);

// //   const [formErrors, setFormErrors] =
// //     useState<FormErrors>({});

// //   const [signOutOpen, setSignOutOpen] =
// //     useState(false);

// //   const [copied, setCopied] = useState<
// //     'phone' | 'email' | null
// //   >(null);

// //   const ready =
// //     hydrated && isLoggedIn && isCustomer;

// //   /* ── SEO / account page should never compete with public SEO pages ── */
// //   useEffect(() => {
// //     document.title = 'My AuroTap Account';

// //     let robots = document.querySelector(
// //       'meta[name="robots"]'
// //     ) as HTMLMetaElement | null;

// //     if (!robots) {
// //       robots = document.createElement('meta');
// //       robots.name = 'robots';
// //       document.head.appendChild(robots);
// //     }

// //     robots.content = 'noindex,nofollow';
// //   }, []);

// //   /* ── Auth guard ───────────────────────────────────────────────────── */
// //   useEffect(() => {
// //     if (!hydrated) return;

// //     if (!isLoggedIn) {
// //       router.replace(
// //         `/auth/login?returnTo=${encodeURIComponent(pathname)}`
// //       );
// //     }
// //   }, [
// //     hydrated,
// //     isLoggedIn,
// //     router,
// //     pathname,
// //   ]);

// //   /* ── Load account data in parallel ───────────────────────────────── */
// //   const load = useCallback(
// //     async (showRefreshState = false) => {
// //       if (!hydrated) return;

// //       if (!isLoggedIn || !isCustomer) {
// //         router.replace(
// //           `/auth/login?returnTo=${encodeURIComponent(pathname)}`
// //         );
// //         return;
// //       }

// //       if (showRefreshState) {
// //         setRefreshing(true);
// //       } else {
// //         setLoading(true);
// //       }

// //       setError(null);

// //       try {
// //         const token = await getToken();

// //         if (!token) {
// //           clearSession();

// //           router.replace(
// //             `/auth/login?returnTo=${encodeURIComponent(pathname)}`
// //           );

// //           return;
// //         }

// //         const headers = {
// //           Authorization: `Bearer ${token}`,
// //         };

// //         const [profileResponse, statsResponse] =
// //           await Promise.all([
// //             fetch('/api/customer/profile', {
// //               credentials: 'include',
// //               headers,
// //               cache: 'no-store',
// //             }),
// //             fetch('/api/customer/stats', {
// //               credentials: 'include',
// //               headers,
// //               cache: 'no-store',
// //             }),
// //           ]);

// //         if (
// //           profileResponse.status === 401 ||
// //           statsResponse.status === 401
// //         ) {
// //           clearSession();

// //           router.replace(
// //             `/auth/login?returnTo=${encodeURIComponent(pathname)}`
// //           );

// //           return;
// //         }

// //         const profileJson =
// //           await readJson<ApiEnvelope<ProfilePayload>>(
// //             profileResponse
// //           );

// //         const statsJson =
// //           await readJson<ApiEnvelope<StatsPayload>>(
// //             statsResponse
// //           );

// //         if (
// //           !profileResponse.ok ||
// //           profileJson.success === false
// //         ) {
// //           throw new Error(
// //             profileJson.error ??
// //               'Could not load your profile.'
// //           );
// //         }

// //         if (
// //           !statsResponse.ok ||
// //           statsJson.success === false
// //         ) {
// //           throw new Error(
// //             statsJson.error ??
// //               'Could not load your account activity.'
// //           );
// //         }

// //         const nextProfile =
// //           profileJson.data ?? null;

// //         const nextStats =
// //           statsJson.data ?? null;

// //         setProfile(nextProfile);
// //         setStats(nextStats);

// //         const nextName =
// //           nextProfile?.full_name?.trim() ?? '';

// //         const nextCity =
// //           nextProfile?.city?.trim() ?? '';

// //         setFullName(nextName);
// //         setCity(nextCity);

// //         setNotificationsEnabled(
// //           getNotificationPreference(
// //             nextProfile?.settings
// //           )
// //         );
// //       } catch (cause) {
// //         const message =
// //           cause instanceof Error
// //             ? cause.message
// //             : 'Could not load your account.';

// //         setError(message);
// //       } finally {
// //         setLoading(false);
// //         setRefreshing(false);
// //       }
// //     },
// //     [
// //       hydrated,
// //       isLoggedIn,
// //       isCustomer,
// //       pathname,
// //       router,
// //     ]
// //   );

// //   useEffect(() => {
// //     if (ready) {
// //       void load();
// //     }
// //   }, [ready, load]);

// //   /* ── Form state ──────────────────────────────────────────────────── */
// //   const originalName =
// //     profile?.full_name?.trim() ?? '';

// //   const originalCity =
// //     profile?.city?.trim() ?? '';

// //   const originalNotifications =
// //     getNotificationPreference(
// //       profile?.settings
// //     );

// //   const hasChanges =
// //     fullName.trim() !== originalName ||
// //     city.trim() !== originalCity ||
// //     notificationsEnabled !== originalNotifications;

// //   const initials = useMemo(
// //     () =>
// //       getInitials(
// //         profile?.full_name ??
// //           session?.name ??
// //           'AuroTap'
// //       ),
// //     [
// //       profile?.full_name,
// //       session?.name,
// //     ]
// //   );

// //   const email =
// //     session?.email?.trim() ?? '';

// //   const phone =
// //     profile?.phone?.trim() ??
// //     session?.phone?.trim() ??
// //     '';

// //   const memberSince =
// //     formatMemberSince(
// //       stats?.member_since ??
// //         profile?.created_at
// //     );

// //   const validateForm = (): boolean => {
// //     const nextErrors: FormErrors = {};

// //     const name = fullName.trim();
// //     const selectedCity = city.trim();

// //     if (name.length < 2) {
// //       nextErrors.full_name =
// //         'Enter at least 2 characters.';
// //     } else if (name.length > 80) {
// //       nextErrors.full_name =
// //         'Name must be 80 characters or fewer.';
// //     }

// //     if (selectedCity.length < 2) {
// //       nextErrors.city =
// //         'Select your city.';
// //     }

// //     setFormErrors(nextErrors);

// //     return Object.keys(nextErrors).length === 0;
// //   };

// //   /* ── Save ────────────────────────────────────────────────────────── */
// //   const handleSave = async () => {
// //     if (!validateForm() || saving) {
// //       return;
// //     }

// //     setSaving(true);

// //     try {
// //       const token = await getToken();

// //       if (!token) {
// //         clearSession();

// //         router.replace(
// //           `/auth/login?returnTo=${encodeURIComponent(pathname)}`
// //         );

// //         return;
// //       }

// //       const existingSettings =
// //         profile?.settings ?? {};

// //       const existingNotifications =
// //         existingSettings.notifications ?? {};

// //       /*
// //        * IMPORTANT:
// //        * The backend profile API accepts the nested
// //        * `settings.notifications` structure.
// //        *
// //        * Do NOT send `notifications_enabled` as a new
// //        * backend field because it is not part of the API
// //        * whitelist.
// //        */
// //       const nextSettings: AccountSettings = {
// //         ...existingSettings,
// //         notifications: {
// //           ...existingNotifications,
// //           whatsapp: notificationsEnabled,
// //           sms: notificationsEnabled,
// //           email: notificationsEnabled,
// //           push: notificationsEnabled,
// //         },
// //       };

// //       const response = await fetch(
// //         '/api/customer/profile',
// //         {
// //           method: 'PUT',
// //           credentials: 'include',
// //           headers: {
// //             'Content-Type': 'application/json',
// //             Authorization: `Bearer ${token}`,
// //           },
// //           body: JSON.stringify({
// //             full_name: fullName.trim(),
// //             city: city.trim(),
// //             settings: nextSettings,
// //           }),
// //         }
// //       );

// //       if (response.status === 401) {
// //         clearSession();

// //         router.replace(
// //           `/auth/login?returnTo=${encodeURIComponent(pathname)}`
// //         );

// //         return;
// //       }

// //       const json =
// //         await readJson<ApiEnvelope<ProfilePayload>>(
// //           response
// //         );

// //       if (!response.ok || json.success === false) {
// //         throw new Error(
// //           json.error ??
// //             'Could not save your profile.'
// //         );
// //       }

// //       const savedProfile =
// //         json.data ??
// //         ({
// //           ...profile,
// //           full_name: fullName.trim(),
// //           city: city.trim(),
// //           settings: nextSettings,
// //         } as ProfilePayload);

// //       setProfile(savedProfile);

// //       updateSession({
// //         name:
// //           savedProfile.full_name ??
// //           session?.name ??
// //           '',
// //       });

// //       setFormErrors({});

// //       window.dispatchEvent(
// //         new CustomEvent('aurotap-profile-saved')
// //       );
// //     } catch (cause) {
// //       const message =
// //         cause instanceof Error
// //           ? cause.message
// //           : 'Could not save your profile.';

// //       setError(message);
// //     } finally {
// //       setSaving(false);
// //     }
// //   };

// //   /* ── Clipboard feedback ──────────────────────────────────────────── */
// //   useEffect(() => {
// //     const onSuccess = (
// //       event: Event
// //     ) => {
// //       const customEvent =
// //         event as CustomEvent<string>;

// //       const message =
// //         customEvent.detail ?? 'Copied';

// //       setCopied(
// //         message.includes('email')
// //           ? 'email'
// //           : 'phone'
// //       );

// //       window.setTimeout(() => {
// //         setCopied(null);
// //       }, 1800);
// //     };

// //     const onFailed = () => {
// //       setCopied(null);
// //     };

// //     window.addEventListener(
// //       'aurotap-copy-success',
// //       onSuccess
// //     );

// //     window.addEventListener(
// //       'aurotap-copy-failed',
// //       onFailed
// //     );

// //     return () => {
// //       window.removeEventListener(
// //         'aurotap-copy-success',
// //         onSuccess
// //       );

// //       window.removeEventListener(
// //         'aurotap-copy-failed',
// //         onFailed
// //       );
// //     };
// //   }, []);

// //   const handleCopyPhone = async () => {
// //     if (!phone) return;

// //     try {
// //       await navigator.clipboard.writeText(
// //         phone
// //       );

// //       setCopied('phone');

// //       window.setTimeout(() => {
// //         setCopied(null);
// //       }, 1800);
// //     } catch {
// //       setCopied(null);
// //     }
// //   };

// //   const handleCopyEmail = async () => {
// //     if (!email) return;

// //     try {
// //       await navigator.clipboard.writeText(
// //         email
// //       );

// //       setCopied('email');

// //       window.setTimeout(() => {
// //         setCopied(null);
// //       }, 1800);
// //     } catch {
// //       setCopied(null);
// //     }
// //   };

// //   /* ── States ──────────────────────────────────────────────────────── */
// //   if (
// //     !hydrated ||
// //     (hydrated && !isLoggedIn)
// //   ) {
// //     return (
// //       <main className="flex min-h-[100dvh] items-center justify-center bg-sky-50 px-4">
// //         <div className="text-center">
// //           <div
// //             className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600"
// //             aria-hidden="true"
// //           />

// //           <p className="mt-4 text-sm font-semibold text-slate-500">
// //             Loading your account…
// //           </p>
// //         </div>
// //       </main>
// //     );
// //   }

// //   if (!isCustomer) {
// //     return (
// //       <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4">
// //         <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
// //           <div
// //             className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-xl font-black text-rose-600"
// //             aria-hidden="true"
// //           >
// //             !
// //           </div>

// //           <h1 className="mt-5 text-xl font-black text-slate-950">
// //             Customer account required
// //           </h1>

// //           <p className="mt-2 text-sm leading-6 text-slate-500">
// //             This account area is only available to
// //             customer accounts.
// //           </p>

// //           <Link
// //             href="/"
// //             className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800"
// //           >
// //             Back to AuroTap
// //           </Link>
// //         </div>
// //       </main>
// //     );
// //   }

// //   return (
// //     <>
// //       <style>{`
// //         .aurotap-account {
// //           min-height: 100dvh;
// //           background:
// //             radial-gradient(circle at top right, rgba(14,165,233,0.10), transparent 28%),
// //             linear-gradient(180deg, #eff8ff 0%, #f8fbff 32%, #ffffff 100%);
// //         }

// //         .aurotap-account *,
// //         .aurotap-account *::before,
// //         .aurotap-account *::after {
// //           box-sizing: border-box;
// //         }

// //         @media (prefers-reduced-motion: reduce) {
// //           .aurotap-account *,
// //           .aurotap-account *::before,
// //           .aurotap-account *::after {
// //             scroll-behavior: auto !important;
// //             animation-duration: 0.01ms !important;
// //             animation-iteration-count: 1 !important;
// //             transition-duration: 0.01ms !important;
// //           }
// //         }
// //       `}</style>

// //       <main className="aurotap-account pb-[calc(6rem+env(safe-area-inset-bottom))]">
// //         {/* ---------------------------------------------------------------- */}
// //         {/* Header                                                           */}
// //         {/* ---------------------------------------------------------------- */}
// //         <header className="border-b border-sky-100 bg-white/90 backdrop-blur-xl">
// //           <div className="mx-auto max-w-4xl px-4 pb-5 pt-4 sm:px-6 sm:pt-6 lg:px-8">
// //             <div className="flex items-start justify-between gap-4">
// //               <div className="min-w-0">
// //                 <Link
// //                   href="/"
// //                   className="inline-flex items-center gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
// //                 >
// //                   <span aria-hidden="true">←</span>
// //                   AuroTap Home
// //                 </Link>

// //                 <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
// //                   My account
// //                 </p>

// //                 <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
// //                   Account &amp; profile
// //                 </h1>

// //                 <p className="mt-1 text-sm leading-6 text-slate-500">
// //                   Manage your personal details, preferences,
// //                   and account activity.
// //                 </p>
// //               </div>

// //               <Link
// //                 href="/customer/home"
// //                 className="shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-100"
// //               >
// //                 Dashboard
// //               </Link>
// //             </div>

// //             {/* Profile hero */}
// //             <div className="mt-6 rounded-3xl bg-gradient-to-br from-[#092844] via-[#1155A6] to-[#0EA5E9] p-5 text-white shadow-lg shadow-sky-200/50 sm:p-6">
// //               <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
// //                 <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[3px] border-white/40 bg-white/10 text-2xl font-black shadow-inner">
// //                   {initials}
// //                 </div>

// //                 <div className="min-w-0 flex-1">
// //                   <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
// //                     Customer profile
// //                   </p>

// //                   <h2 className="mt-1 truncate text-2xl font-black sm:text-3xl">
// //                     {loading
// //                       ? 'Loading…'
// //                       : profile?.full_name ||
// //                         session?.name ||
// //                         'Welcome'}
// //                   </h2>

// //                   <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-white/70">
// //                     <span>
// //                       Member since {memberSince}
// //                     </span>

// //                     <span
// //                       className="h-1 w-1 rounded-full bg-white/35"
// //                       aria-hidden="true"
// //                     />

// //                     <span>
// //                       {profile?.city || 'City not set'}
// //                     </span>
// //                   </div>
// //                 </div>

// //                 <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
// //                   <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/50">
// //                     Account
// //                   </p>

// //                   <p className="mt-1 text-sm font-black text-white">
// //                     Customer
// //                   </p>

// //                   <p className="mt-0.5 text-[11px] font-medium text-white/60">
// //                     AuroTap
// //                   </p>
// //                 </div>
// //               </div>
// //             </div>
// //           </div>
// //         </header>

// //         {/* ---------------------------------------------------------------- */}
// //         {/* Body                                                             */}
// //         {/* ---------------------------------------------------------------- */}
// //         <div className="mx-auto max-w-4xl px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8">
// //           {error ? (
// //             <div className="mb-5">
// //               <ErrorCard
// //                 message={error}
// //                 onRetry={() => void load()}
// //               />
// //             </div>
// //           ) : null}

// //           {/* Activity */}
// //           <section>
// //             <SectionTitle
// //               eyebrow="Overview"
// //               title="Your activity"
// //               description="A quick view of your AuroTap usage."
// //             />

// //             <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
// //               <StatCard
// //                 icon="📦"
// //                 value={String(
// //                   stats?.total_orders ?? 0
// //                 )}
// //                 label="Orders"
// //                 loading={loading}
// //               />

// //               <StatCard
// //                 icon="💧"
// //                 value={String(
// //                   stats?.cans_ordered ?? 0
// //                 )}
// //                 label="Cans"
// //                 loading={loading}
// //               />

// //               <StatCard
// //                 icon="₹"
// //                 value={formatINR(
// //                   stats?.total_spent ?? 0
// //                 )}
// //                 label="Total spent"
// //                 loading={loading}
// //               />

// //               <StatCard
// //                 icon="⭐"
// //                 value={
// //                   stats?.avg_rating != null
// //                     ? String(stats.avg_rating)
// //                     : '—'
// //                 }
// //                 label="Your rating"
// //                 loading={loading}
// //               />
// //             </div>
// //           </section>

// //           {/* Profile */}
// //           <section className="mt-6">
// //             <SectionTitle
// //               eyebrow="Personal information"
// //               title="Profile details"
// //               description="Keep your delivery information up to date."
// //             />

// //             {loading ? (
// //               <LoadingCard />
// //             ) : (
// //               <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
// //                 {/* Editable */}
// //                 <div className="space-y-5 p-5 sm:p-6">
// //                   <div>
// //                     <label
// //                       htmlFor="customer-full-name"
// //                       className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
// //                     >
// //                       Full name
// //                     </label>

// //                     <input
// //                       id="customer-full-name"
// //                       value={fullName}
// //                       onChange={(event) => {
// //                         setFullName(
// //                           event.target.value
// //                         );

// //                         if (formErrors.full_name) {
// //                           setFormErrors((current) => ({
// //                             ...current,
// //                             full_name: undefined,
// //                           }));
// //                         }

// //                         setError(null);
// //                       }}
// //                       autoComplete="name"
// //                       maxLength={80}
// //                       className={[
// //                         'mt-2 min-h-12 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition',
// //                         'focus:bg-white focus:ring-4',
// //                         formErrors.full_name
// //                           ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
// //                           : 'border-slate-200 focus:border-sky-400 focus:ring-sky-50',
// //                       ].join(' ')}
// //                       placeholder="Enter your full name"
// //                       aria-invalid={Boolean(
// //                         formErrors.full_name
// //                       )}
// //                     />

// //                     {formErrors.full_name ? (
// //                       <p className="mt-1.5 text-xs font-bold text-rose-600">
// //                         {formErrors.full_name}
// //                       </p>
// //                     ) : null}
// //                   </div>

// //                   <div>
// //                     <label
// //                       htmlFor="customer-city"
// //                       className="text-xs font-black uppercase tracking-[0.14em] text-slate-500"
// //                     >
// //                       City
// //                     </label>

// //                     <select
// //                       id="customer-city"
// //                       value={city}
// //                       onChange={(event) => {
// //                         setCity(event.target.value);
// //                         setFormErrors((current) => ({
// //                           ...current,
// //                           city: undefined,
// //                         }));
// //                         setError(null);
// //                       }}
// //                       className={[
// //                         'mt-2 min-h-12 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition',
// //                         'focus:bg-white focus:ring-4',
// //                         formErrors.city
// //                           ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-50'
// //                           : 'border-slate-200 focus:border-sky-400 focus:ring-sky-50',
// //                       ].join(' ')}
// //                       aria-invalid={Boolean(
// //                         formErrors.city
// //                       )}
// //                     >
// //                       <option value="">
// //                         Select your city
// //                       </option>

// //                       {SERVICE_CITIES.map(
// //                         (serviceCity) => (
// //                           <option
// //                             key={serviceCity}
// //                             value={serviceCity}
// //                           >
// //                             {serviceCity}
// //                           </option>
// //                         )
// //                       )}

// //                       {city &&
// //                       !SERVICE_CITIES.includes(
// //                         city as (typeof SERVICE_CITIES)[number]
// //                       ) ? (
// //                         <option value={city}>
// //                           {city}
// //                         </option>
// //                       ) : null}
// //                     </select>

// //                     {formErrors.city ? (
// //                       <p className="mt-1.5 text-xs font-bold text-rose-600">
// //                         {formErrors.city}
// //                       </p>
// //                     ) : null}
// //                   </div>

// //                   <div>
// //                     <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
// //                       <div className="min-w-0">
// //                         <p className="text-sm font-black text-slate-900">
// //                           Order notifications
// //                         </p>

// //                         <p className="mt-1 text-xs leading-5 text-slate-500">
// //                           Receive important updates about your
// //                           bookings and orders.
// //                         </p>
// //                       </div>

// //                       <Toggle
// //                         checked={
// //                           notificationsEnabled
// //                         }
// //                         disabled={saving}
// //                         onChange={(
// //                           value
// //                         ) => {
// //                           setNotificationsEnabled(
// //                             value
// //                           );
// //                           setError(null);
// //                         }}
// //                       />
// //                     </div>
// //                   </div>

// //                   {hasChanges ? (
// //                     <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
// //                       <div>
// //                         <p className="text-sm font-black text-emerald-900">
// //                           Unsaved changes
// //                         </p>

// //                         <p className="mt-1 text-xs text-emerald-700">
// //                           Save when everything looks right.
// //                         </p>
// //                       </div>

// //                       <button
// //                         type="button"
// //                         onClick={() => {
// //                           setFullName(
// //                             originalName
// //                           );

// //                           setCity(
// //                             originalCity
// //                           );

// //                           setNotificationsEnabled(
// //                             originalNotifications
// //                           );

// //                           setFormErrors({});
// //                           setError(null);
// //                         }}
// //                         disabled={saving}
// //                         className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-black text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
// //                       >
// //                         Discard
// //                       </button>
// //                     </div>
// //                   ) : null}

// //                   {hasChanges ? (
// //                     <button
// //                       type="button"
// //                       onClick={() =>
// //                         void handleSave()
// //                       }
// //                       disabled={saving}
// //                       className="flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
// //                     >
// //                       {saving
// //                         ? 'Saving changes…'
// //                         : 'Save changes'}
// //                     </button>
// //                   ) : null}
// //                 </div>

// //                 {/* Read-only identity */}
// //                 <div className="border-t border-slate-100">
// //                   <ReadOnlyRow
// //                     icon="✉️"
// //                     title="Login email"
// //                     value={
// //                       email || 'Not available'
// //                     }
// //                     action={
// //                       email ? (
// //                         <button
// //                           type="button"
// //                           onClick={() =>
// //                             void handleCopyEmail()
// //                           }
// //                           className="rounded-lg px-2.5 py-2 text-[11px] font-black text-sky-700 hover:bg-sky-50"
// //                         >
// //                           {copied === 'email'
// //                             ? 'Copied'
// //                             : 'Copy'}
// //                         </button>
// //                       ) : null
// //                     }
// //                   />

// //                   <ReadOnlyRow
// //                     icon="📱"
// //                     title="Mobile number"
// //                     value={
// //                       maskPhone(phone)
// //                     }
// //                     action={
// //                       phone ? (
// //                         <button
// //                           type="button"
// //                           onClick={() =>
// //                             void handleCopyPhone()
// //                           }
// //                           className="rounded-lg px-2.5 py-2 text-[11px] font-black text-sky-700 hover:bg-sky-50"
// //                         >
// //                           {copied === 'phone'
// //                             ? 'Copied'
// //                             : 'Copy'}
// //                         </button>
// //                       ) : null
// //                     }
// //                   />
// //                 </div>
// //               </div>
// //             )}
// //           </section>

// //           {/* Navigation */}
// //           <section className="mt-6">
// //             <SectionTitle
// //               eyebrow="Manage"
// //               title="Account shortcuts"
// //               description="Quick access to the things you use most."
// //             />

// //             <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
// //               <MenuRow
// //                 href="/"
// //                 icon="🏠"
// //                 title="AuroTap home"
// //                 description="Return to the public AuroTap homepage"
// //               />

// //               <MenuRow
// //                 href="/customer/home"
// //                 icon="📊"
// //                 title="Customer dashboard"
// //                 description="Orders, activity, tracking, and quick actions"
// //               />

// //               <MenuRow
// //                 href="/customer/addresses"
// //                 icon="📍"
// //                 title="My addresses"
// //                 description="Manage your saved delivery locations"
// //               />

// //               <MenuRow
// //                 href="/customer/history"
// //                 icon="📋"
// //                 title="Order history"
// //                 description="View your previous and current orders"
// //               />

// //               <MenuRow
// //                 href="/customer/subscriptions"
// //                 icon="🔄"
// //                 title="My subscriptions"
// //                 description="Pause, resume, or cancel recurring water deliveries"
// //               />

// //               <MenuRow
// //                 href="/pricing"
// //                 icon="🏷️"
// //                 title="Pricing"
// //                 description="Review available service pricing"
// //               />
// //             </div>
// //           </section>

// //           {/* Language */}
// //           <section className="mt-6">
// //             <SectionTitle
// //               eyebrow="Preferences"
// //               title="Language"
// //               description="Choose how AuroTap is displayed."
// //             />

// //             <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
// //               <div className="flex min-w-0 items-center gap-3">
// //                 <span
// //                   className="grid h-10 w-10 place-items-center rounded-xl bg-slate-50 text-lg"
// //                   aria-hidden="true"
// //                 >
// //                   🌐
// //                 </span>

// //                 <div>
// //                   <p className="text-sm font-black text-slate-900">
// //                     App language
// //                   </p>

// //                   <p className="mt-1 text-xs font-medium text-slate-500">
// //                     English or Hindi
// //                   </p>
// //                 </div>
// //               </div>

// //               <LanguageToggle />
// //             </div>
// //           </section>

// //           {/* Support */}
// //           <section className="mt-6">
// //             <SectionTitle
// //               eyebrow="Need help?"
// //               title="AuroTap support"
// //               description="Reach us when you need assistance with your account or order."
// //             />

// //             <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
// //             <Link
// //   href="/customer/support"
// //   className="group flex min-h-[72px] items-center gap-3 border-b border-slate-100 px-4 py-3.5 hover:bg-slate-50"
// // >
// //   <span
// //     className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-lg"
// //     aria-hidden="true"
// //   >
// //     🎧
// //   </span>

// //   <span className="min-w-0 flex-1">
// //     <span className="block text-sm font-extrabold text-slate-900">
// //       Get support
// //     </span>

// //     <span className="mt-0.5 block text-xs font-medium text-slate-500">
// //       WhatsApp, phone, or email support
// //     </span>
// //   </span>

// //   <span
// //     className="text-lg text-slate-300 group-hover:text-sky-500"
// //     aria-hidden="true"
// //   >
// //     →
// //   </span>
// // </Link>

// //               <a
// //                 href={`tel:${SUPPORT_PHONE}`}
// //                 className="group flex min-h-[72px] items-center gap-3 border-b border-slate-100 px-4 py-3.5 hover:bg-slate-50"
// //               >
// //                 <span
// //                   className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-lg"
// //                   aria-hidden="true"
// //                 >
// //                   📞
// //                 </span>

// //                 <span className="min-w-0 flex-1">
// //                   <span className="block text-sm font-extrabold text-slate-900">
// //                     Call support
// //                   </span>

// //                   <span className="mt-0.5 block text-xs font-medium text-slate-500">
// //                     {SUPPORT_PHONE}
// //                   </span>
// //                 </span>

// //                 <span
// //                   className="text-lg text-slate-300 group-hover:text-sky-500"
// //                   aria-hidden="true"
// //                 >
// //                   →
// //                 </span>
// //               </a>

// //               <Link
// //                 href="/terms"
// //                 className="group flex min-h-[72px] items-center gap-3 px-4 py-3.5 hover:bg-slate-50"
// //               >
// //                 <span
// //                   className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-lg"
// //                   aria-hidden="true"
// //                 >
// //                   📄
// //                 </span>

// //                 <span className="min-w-0 flex-1">
// //                   <span className="block text-sm font-extrabold text-slate-900">
// //                     Terms &amp; Privacy
// //                   </span>

// //                   <span className="mt-0.5 block text-xs font-medium text-slate-500">
// //                     Review AuroTap policies
// //                   </span>
// //                 </span>

// //                 <span
// //                   className="text-lg text-slate-300 group-hover:text-violet-500"
// //                   aria-hidden="true"
// //                 >
// //                   →
// //                 </span>
// //               </Link>
// //             </div>
// //           </section>

// //           {/* Refresh */}
// //           <div className="mt-6 flex justify-center">
// //             <button
// //               type="button"
// //               onClick={() =>
// //                 void load(true)
// //               }
// //               disabled={refreshing}
// //               className="inline-flex min-h-9 items-center rounded-xl px-3 text-xs font-bold text-slate-400 hover:bg-white hover:text-slate-600 disabled:opacity-60"
// //             >
// //               <span
// //                 className={
// //                   refreshing
// //                     ? 'mr-1.5 animate-spin'
// //                     : 'mr-1.5'
// //                 }
// //                 aria-hidden="true"
// //               >
// //                 ↻
// //               </span>

// //               {refreshing
// //                 ? 'Refreshing…'
// //                 : 'Refresh account'}
// //             </button>
// //           </div>

// //           {/* Sign out */}
// //           <section className="mt-4">
// //             <button
// //               type="button"
// //               onClick={() =>
// //                 setSignOutOpen(true)
// //               }
// //               className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3.5 text-sm font-black text-rose-700 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-100"
// //             >
// //               Sign out
// //             </button>
// //           </section>

// //           <footer className="px-2 pb-4 pt-5 text-center">
// //             <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
// //               AUROTAP.IN
// //             </p>

// //             <p className="mt-1 text-[11px] font-medium text-slate-400">
// //               Your account, orders, and preferences in one place.
// //             </p>
// //           </footer>
// //         </div>
// //       </main>

// //       {signOutOpen ? (
// //         <SignOutModal
// //           onCancel={() =>
// //             setSignOutOpen(false)
// //           }
// //           onConfirm={() => {
// //             setSignOutOpen(false);
// //             logout({ redirectTo: '/' });
// //           }}
// //         />
// //       ) : null}

// //       <BottomNav />
// //     </>
// //   );
// // }
