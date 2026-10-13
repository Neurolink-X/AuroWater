'use client';

/**
 * AuroWater technician / plumber dashboard (v2)
 *
 * Bugs fixed from v1
 * - Queue tab toggle called setOnline directly, so going online/offline there never reached the
 *   server. One handler is used everywhere (optimistic, guarded, reverts on failure).
 * - Offer timers reset on every refetch (expiresAt was Date.now() + 24h each time). Expiry is now
 *   derived from server timestamps and stays stable.
 * - A 1-second ticker re-rendered the whole page. Countdowns now share one external ticker and
 *   only the countdown text re-renders.
 * - The weekly earnings chart labelled the last 7 days as Mon..Sun regardless of the real day.
 * - Fabricated data was shown to real users (seed payouts P-001..P-003, a default UPI id, default
 *   skills and availability). All removed.
 * - "Cancel job" toasted an error on success and had no confirmation. "Get rating" and
 *   "Support request sent" were fake actions. All replaced or removed.
 * - The customer's service code was checked on the client but never sent. It is now sent with the
 *   completion request, and prepaid orders no longer force a "payment received" tick.
 * - Availability and Documents were unreachable on mobile. Added a More menu.
 * - "My jobs" detail showed the technician's first service city instead of the job's area.
 * - Job lists flashed "Queue is clear" before data arrived. Added loading state and a session cache.
 * - Realtime channel was never removed properly and refetched on every burst event.
 *
 * New: full address, call and navigate buttons, new-offer alerts, offline-safe sync, polling
 * fallback, CSV export, accessible tabs and dialogs, plumber role support, per-tab page titles.
 *
 * NOT connected to a backend yet (kept honest in the UI): profile, schedule and document uploads
 * are stored on this device only; payouts have no API. See DOCUMENT_REVIEW_LIVE and the notes
 * next to submitDocumentsToServer().
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Bell,
  Briefcase,
  IndianRupee,
  Clock,
  User,
  FileText,
  ArrowLeft,
  CloudUpload,
  Wifi,
  WifiOff,
  ChevronRight,
  ChevronDown,
  Star,
  MapPin,
  Calendar,
  Zap,
  TrendingUp,
  Award,
  Package,
  CheckCircle,
  XCircle,
  Play,
  Phone,
  Edit3,
  Save,
  X,
  AlertCircle,
  Clock3,
  Loader2,
  Navigation,
  MoreHorizontal,
  Download,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { ApiOrder } from '@/lib/api-client';
import {
  technicianJobsList,
  technicianJobAccept,
  technicianJobReject,
  technicianJobUpdateStatus,
  technicianAvailabilityUpdate,
  getApiErrorMessage,
} from '@/lib/api-client';
import { DatabaseErrorBanner } from '@/components/ui/DatabaseErrorBanner';
import { safeGet as lsGet, safeSet as lsSet, safeRemove as lsRemove } from '@/lib/storage';

/* ───────────────────────────── Types ───────────────────────────── */

type TechnicianOnline = 'online' | 'offline';
type VerificationStatus = 'unverified' | 'pending' | 'verified';
type TechSkill = 'Plumbing' | 'RO Service' | 'Borewell' | 'Motor Repair' | 'Water Tanker' | 'Tank Cleaning Service';
type TechAvailabilitySlot = 'morning' | 'afternoon' | 'evening';
type TechDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type JobStage = 'offer' | 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
type MyJobStage = Exclude<JobStage, 'offer'>;
type TabKey = 'overview' | 'queue' | 'my_jobs' | 'earnings' | 'availability' | 'profile' | 'documents';
type IconType = React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;

interface Job {
  id: string;
  stage: JobStage;
  service: string;
  sub: string;
  area: string;
  address: string;
  lat?: number;
  lng?: number;
  date: string;
  slot: string;
  price: number;
  priceIsPayout: boolean;
  prepaid: boolean;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  offerExpiresAt: number;
  rating?: number;
}

interface UploadMeta {
  name: string;
  size: number;
  status: 'uploaded' | 'submitted' | 'verified' | 'rejected';
}

interface TechDocs {
  aadhaarFront?: UploadMeta;
  aadhaarBack?: UploadMeta;
  profilePhoto?: UploadMeta;
  skillCert?: UploadMeta;
}

interface TechProfile {
  skills: TechSkill[];
  serviceCities: string[];
  bio: string;
  upiId: string;
}

type Availability = Record<string, boolean>;

/* ───────────────────────────── Constants ───────────────────────────── */

const ALLOWED_ROLES = ['technician', 'plumber'];
const SKILLS: TechSkill[] = ['Plumbing', 'RO Service', 'Borewell', 'Motor Repair', 'Water Tanker', 'Tank Cleaning Service'];
const DAYS: TechDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_NAMES: Record<TechDay, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const SLOTS: TechAvailabilitySlot[] = ['morning', 'afternoon', 'evening'];
const SLOT_LABEL: Record<TechAvailabilitySlot, string> = { morning: 'Morning, 8 to 12', afternoon: 'Afternoon, 12 to 5', evening: 'Evening, 5 to 8' };
const UP_CITIES = ['Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj', 'Agra', 'Meerut', 'Bareilly', 'Aligarh', 'Mathura', 'Delhi', 'Noida', 'Ghaziabad'] as const;

const OFFER_WINDOW_MS = 24 * 3600 * 1000;
const POLL_MS = 30_000;
const STALE_SYNC_MS = 15_000;
const JOBS_CACHE_PREFIX = 'aurowater:tech-jobs:v2:';
const JOBS_CACHE_MAX_AGE_MS = 10 * 60_000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
const SEED_UPI = 'rahul.verma@upi'; // v1 wrote this fake default into storage; cleaned up below.

/** Flip to true only after submitDocumentsToServer() is wired to a real upload and review endpoint. */
const DOCUMENT_REVIEW_LIVE = false;

const KEYS = {
  ONLINE: 'aurowater_tech_online',
  VERIFICATION: 'aurowater_tech_verification_status',
  AVAILABILITY: 'aurowater_tech_availability',
  DOCS: 'aurowater_tech_documents',
  PROFILE: 'aurowater_tech_profile',
  USER_PROFILE: 'aurowater_profile',
  // Obsolete keys from v1 (fake or server-owned data). Removed on first load.
  OBSOLETE: ['aurowater_job_queue', 'aurowater_tech_jobs', 'aurowater_tech_payout_history'],
} as const;

const TAB_META: Record<TabKey, { label: string; icon: IconType }> = {
  overview: { label: 'Overview', icon: LayoutDashboard },
  queue: { label: 'Job queue', icon: Bell },
  my_jobs: { label: 'My jobs', icon: Briefcase },
  earnings: { label: 'Earnings', icon: IndianRupee },
  availability: { label: 'Availability', icon: Clock },
  profile: { label: 'Profile', icon: User },
  documents: { label: 'Documents', icon: FileText },
};
const TAB_KEYS = Object.keys(TAB_META) as TabKey[];
const MOBILE_PRIMARY: TabKey[] = ['overview', 'queue', 'my_jobs', 'earnings', 'profile'];

const SERVICE_EMOJI: Record<string, string> = {
  plumbing: '🔧', 'ro service': '💧', ro: '💧', borewell: '🕳️', 'motor repair': '⚙️',
  'water tanker': '🚛', 'tank cleaning service': '🪣', 'tank cleaning': '🪣',
};
const emojiFor = (service: string) => SERVICE_EMOJI[service.toLowerCase()] ?? '🔧';

const ringFocus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-1';
const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const btnBase = `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ringFocus}`;
const btnPrimary = `${btnBase} bg-emerald-600 text-white hover:bg-emerald-700`;
const btnOutline = `${btnBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const btnDanger = `${btnBase} border border-red-200 bg-white text-red-700 hover:bg-red-50`;

/* ───────────────────────────── Helpers ───────────────────────────── */

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : v == null ? fallback : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const optNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const ts = (v: unknown): number | undefined => {
  if (!v) return undefined;
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : undefined;
};
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const money = (n: number) => `₹${Math.round(num(n)).toLocaleString('en-IN')}`;
const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function fmtTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function stageFromStatus(status: string): JobStage {
  switch (status.toUpperCase()) {
    case 'ASSIGNED':
    case 'PENDING':
      return 'offer';
    case 'IN_PROGRESS':
      return 'in_progress';
    case 'COMPLETED':
      return 'completed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'upcoming';
  }
}

/** Maps a live API order into the dashboard job model. Reads defensively: extra fields are optional. */
function orderToJob(o: ApiOrder): Job {
  const r = o as unknown as Record<string, unknown>;
  const snap = (r.address_snapshot ?? {}) as Record<string, unknown>;
  const cust = (r.customer ?? {}) as Record<string, unknown>;
  const createdAt = ts(r.created_at) ?? 0;
  const updatedAt = ts(r.updated_at) ?? createdAt;
  const offerBase = ts(r.assigned_at) ?? updatedAt;
  const payout = optNum(r.technician_payout ?? r.payout_amount);
  const paymentStatus = str(r.payment_status).toUpperCase();

  const area = [snap.area, snap.city].filter(Boolean).map(String).join(', ');
  const address = [snap.line1 ?? snap.address_line1 ?? snap.address ?? snap.street, snap.landmark, snap.area, snap.city, snap.pincode ?? snap.postal_code]
    .filter(Boolean)
    .map(String)
    .join(', ');

  return {
    id: str(r.id),
    stage: stageFromStatus(str(r.status)),
    service: str(r.service_type_key, 'service').replace(/_/g, ' '),
    sub: str(r.sub_option_key).replace(/_/g, ' '),
    area: area || '—',
    address,
    lat: optNum(snap.lat ?? snap.latitude),
    lng: optNum(snap.lng ?? snap.longitude),
    date: str(r.scheduled_date) || (createdAt ? new Date(createdAt).toISOString().slice(0, 10) : ''),
    slot: str(r.time_slot, '—'),
    price: payout ?? num(r.total_amount),
    priceIsPayout: payout !== undefined,
    prepaid: paymentStatus === 'PAID' || r.is_paid === true,
    customerName: str(r.customer_name ?? cust.full_name ?? cust.name) || undefined,
    customerPhone: str(r.customer_phone ?? cust.phone) || undefined,
    notes: str(r.customer_notes ?? r.notes) || undefined,
    createdAt,
    updatedAt,
    completedAt: ts(r.completed_at) ?? (str(r.status).toUpperCase() === 'COMPLETED' ? updatedAt : undefined),
    offerExpiresAt: ts(r.offer_expires_at) ?? ts(r.assignment_expires_at) ?? offerBase + OFFER_WINDOW_MS,
    rating: optNum(r.rating ?? r.customer_rating),
  };
}

function mapsHref(job: Job): string | null {
  if (job.lat !== undefined && job.lng !== undefined) {
    return `https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`;
  }
  const q = job.address || job.area;
  return q && q !== '—' ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

function readJobsCache(userId?: string): Job[] | null {
  if (!userId) return null;
  try {
    const raw = window.sessionStorage.getItem(JOBS_CACHE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; jobs: Job[] };
    if (!Array.isArray(parsed.jobs) || Date.now() - parsed.savedAt > JOBS_CACHE_MAX_AGE_MS) return null;
    return parsed.jobs;
  } catch {
    return null;
  }
}
function writeJobsCache(userId: string | undefined, jobs: Job[]) {
  if (!userId) return;
  try {
    window.sessionStorage.setItem(JOBS_CACHE_PREFIX + userId, JSON.stringify({ savedAt: Date.now(), jobs }));
  } catch {
    /* optional */
  }
}

function uploadError(file: File): string | null {
  if (!ACCEPTED_UPLOAD_TYPES.includes(file.type)) return 'Use a JPG, PNG, WebP or PDF file.';
  if (file.size > MAX_UPLOAD_BYTES) return 'That file is larger than 5 MB. Choose a smaller one.';
  return null;
}

function requiredDocsUploaded(d: TechDocs) {
  return Boolean(d.aadhaarFront && d.aadhaarBack && d.profilePhoto);
}

/**
 * Wire this to your real upload plus review endpoint, then set DOCUMENT_REVIEW_LIVE = true.
 * It should upload each file (not just metadata) and return the server's verification status.
 */
async function submitDocumentsToServer(_docs: TechDocs): Promise<void> {
  throw new Error('Document upload is not connected to the server yet.');
}

/* ── Shared 1 Hz ticker: only subscribed components re-render ── */

const tickListeners = new Set<() => void>();
let tickNow = 0;
let tickTimer: number | undefined;

function subscribeTick(listener: () => void) {
  tickListeners.add(listener);
  if (tickTimer === undefined) {
    tickNow = Date.now();
    tickTimer = window.setInterval(() => {
      tickNow = Date.now();
      tickListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && tickTimer !== undefined) {
      window.clearInterval(tickTimer);
      tickTimer = undefined;
    }
  };
}
const useNow = () => useSyncExternalStore(subscribeTick, () => tickNow, () => 0);

/* ── Persisted state (device-local drafts; hydrates after mount to avoid SSR mismatch) ── */

function usePersisted<T>(key: string, initial: T, normalize: (raw: unknown) => T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const valueRef = useRef(value);
  const readyRef = useRef(false);
  valueRef.current = value;
  const normalizeRef = useRef(normalize);

  useEffect(() => {
    const raw = lsGet(key);
    if (typeof raw === 'string' && raw) {
      try {
        setValue(normalizeRef.current(JSON.parse(raw)));
      } catch {
        /* ignore corrupt data */
      }
    }
    readyRef.current = true;
    setReady(true);
    return () => {
      if (readyRef.current) lsSet(key, JSON.stringify(valueRef.current));
    };
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => lsSet(key, JSON.stringify(value)), 400);
    return () => window.clearTimeout(id);
  }, [key, value, ready]);

  return [value, setValue, ready];
}

const normalizeProfile = (raw: unknown): TechProfile => {
  const p = (raw ?? {}) as Partial<TechProfile>;
  return {
    skills: Array.isArray(p.skills) ? p.skills.filter((s): s is TechSkill => SKILLS.includes(s as TechSkill)) : [],
    serviceCities: Array.isArray(p.serviceCities) ? p.serviceCities.map(String) : [],
    bio: typeof p.bio === 'string' ? p.bio.slice(0, 200) : '',
    upiId: typeof p.upiId === 'string' && p.upiId !== SEED_UPI ? p.upiId : '',
  };
};
const normalizeAvailability = (raw: unknown): Availability => {
  const out: Availability = {};
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[k] = v === true;
  return out;
};
const normalizeDocs = (raw: unknown): TechDocs => {
  const d = (raw ?? {}) as Record<string, unknown>;
  const pick = (v: unknown): UploadMeta | undefined => {
    const m = v as Partial<UploadMeta> | undefined;
    return m && typeof m.name === 'string' ? { name: m.name, size: num(m.size), status: m.status ?? 'uploaded' } : undefined;
  };
  return { aadhaarFront: pick(d.aadhaarFront), aadhaarBack: pick(d.aadhaarBack), profilePhoto: pick(d.profilePhoto), skillCert: pick(d.skillCert) };
};

/* ───────────────────────────── Small UI ───────────────────────────── */

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
const TONES: Record<Tone, string> = {
  default: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  danger: 'bg-red-50 text-red-800 ring-red-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  purple: 'bg-violet-50 text-violet-800 ring-violet-200',
};

function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const STAGE_META: Record<MyJobStage, { label: string; tone: Tone }> = {
  upcoming: { label: 'Upcoming', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'purple' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

const StatCard = memo(function StatCard({ label, value, sub, icon: Icon, accent = false }: { label: string; value: string; sub?: string; icon: IconType; accent?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${accent ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white shadow-sm'}`}>
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${accent ? 'bg-white/20' : 'bg-emerald-50'}`}>
        <Icon size={18} aria-hidden className={accent ? 'text-white' : 'text-emerald-700'} />
      </div>
      <p className={`text-xs font-semibold ${accent ? 'text-emerald-100' : 'text-slate-500'}`}>{label}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${accent ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className={`mt-1 text-xs ${accent ? 'text-emerald-100' : 'text-slate-400'}`}>{sub}</p>}
    </div>
  );
});

function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className={`${card} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

function EmptyState({ emoji, title, message, action }: { emoji: string; title: string; message: string; action?: React.ReactNode }) {
  return (
    <div className={`${card} px-5 py-12 text-center`}>
      <p className="mb-3 text-4xl" aria-hidden="true">{emoji}</p>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none ${className}`} />;
}

function JobsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading jobs">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`${card} p-5`}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-4 w-64" />
          <Skeleton className="mt-5 h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Re-renders itself once per second; the rest of the page does not. */
function Countdown({ expiresAt, className = '' }: { expiresAt: number; className?: string }) {
  const now = useNow();
  if (!now) return <span className={className}>—</span>;
  const remaining = expiresAt - now;
  return <span className={`tabular-nums ${className}`}>{remaining <= 0 ? 'Expired' : fmtTimer(remaining)}</span>;
}

function StatusToggle({ online, busy, onChange }: { online: TechnicianOnline; busy: boolean; onChange: (v: TechnicianOnline) => void }) {
  const opt = (value: TechnicianOnline, label: string, Icon: IconType, activeClass: string) => (
    <button
      type="button"
      aria-pressed={online === value}
      disabled={busy}
      onClick={() => online !== value && onChange(value)}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${ringFocus} ${
        online === value ? `${activeClass} text-white shadow-sm` : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {busy && online !== value ? <Loader2 size={12} aria-hidden className="animate-spin" /> : <Icon size={12} aria-hidden />}
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Availability status" className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
      {opt('online', 'Online', Wifi, 'bg-emerald-600')}
      {opt('offline', 'Offline', WifiOff, 'bg-slate-600')}
    </div>
  );
}

function Dialog({
  title,
  description,
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
  description?: string;
  tone?: 'primary' | 'danger';
  confirmLabel: string;
  busy: boolean;
  error?: string | null;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('input, textarea, select')?.focus() ??
      panelRef.current?.querySelector<HTMLElement>('[data-confirm]')?.focus();
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
    } else if (e.key === 'Tab' && panelRef.current) {
      const items = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, select');
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

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6" onKeyDown={onKeyDown}>
      <button type="button" tabIndex={-1} aria-label="Close dialog" className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={() => !busy && onCancel()} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="space-y-4 px-5 pb-4 pt-5">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {children}
          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">{error}</div>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3.5 sm:flex-row sm:justify-end">
          <button type="button" className={btnOutline} onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            type="button"
            data-confirm
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            className={`${btnBase} text-white ${tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            {busy && <Loader2 size={14} aria-hidden className="animate-spin" />}
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletionDialog({
  job,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  job: Job;
  busy: boolean;
  error: string | null;
  onSubmit: (v: { otp: string; paymentConfirmed: boolean; reference: string }) => void;
  onCancel: () => void;
}) {
  const [otp, setOtp] = useState('');
  const [paid, setPaid] = useState(false);
  const [reference, setReference] = useState('');
  const otpId = useId();
  const needsPayment = !job.prepaid;
  const valid = /^\d{6}$/.test(otp) && (!needsPayment || paid);

  return (
    <Dialog
      title="Verify service before closing"
      description="Ask the customer for the 6-digit service code once the work is finished."
      confirmLabel="Verify and complete"
      busy={busy}
      error={error}
      confirmDisabled={!valid}
      onConfirm={() => valid && onSubmit({ otp, paymentConfirmed: needsPayment ? paid : true, reference: reference.trim() })}
      onCancel={onCancel}
    >
      <div>
        <label htmlFor={otpId} className="text-sm font-semibold text-slate-800">Customer service code</label>
        <input
          id={otpId}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-center text-xl font-bold tracking-[0.35em] text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        />
      </div>
      {needsPayment ? (
        <>
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
            <span className="text-sm leading-5 text-slate-700">I confirm payment of {money(job.price)} was received for this service.</span>
          </label>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value.slice(0, 100))}
            placeholder="UPI reference (optional)"
            aria-label="UPI reference, optional"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-100"
          />
        </>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">Paid online. You don’t need to collect payment.</div>
      )}
    </Dialog>
  );
}

/* ───────────────────────────── Job cards ───────────────────────────── */

interface JobHandlers {
  onAccept: (job: Job) => void;
  onDecline: (job: Job) => void;
  onStart: (job: Job) => void;
  onComplete: (job: Job) => void;
  onCancel: (job: Job) => void;
}

const QueueCard = memo(function QueueCard({ job, canAccept, reason, busy, handlers }: { job: Job; canAccept: boolean; reason: string | null; busy?: string; handlers: JobHandlers }) {
  const now = useNow();
  const urgent = now > 0 && job.offerExpiresAt - now < 5 * 60_000;
  return (
    <article className={`${card} overflow-hidden ${urgent ? 'border-red-300' : ''}`}>
      {urgent && <div className="h-1 bg-gradient-to-r from-red-500 to-orange-400" aria-hidden="true" />}
      <div className="flex flex-col gap-5 p-4 sm:p-5 lg:flex-row lg:items-start">
        <div className="flex-1">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-2xl" aria-hidden="true">{emojiFor(job.service)}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold capitalize text-slate-900">{job.service}</h2>
                <Badge>#{job.id.slice(0, 8)}</Badge>
              </div>
              {job.sub && <p className="mt-0.5 text-sm capitalize text-slate-500">{job.sub}</p>}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><MapPin size={11} aria-hidden /> Area</dt>
              <dd className="mt-1 text-xs font-semibold leading-tight text-slate-800">{job.area}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><Calendar size={11} aria-hidden /> Schedule</dt>
              <dd className="mt-1 text-xs font-semibold text-slate-800">{job.date} · {job.slot}</dd>
            </div>
            <div className="col-span-2 rounded-xl bg-emerald-50 p-3 sm:col-span-1">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700"><IndianRupee size={11} aria-hidden /> {job.priceIsPayout ? 'Your payout' : 'Order value'}</dt>
              <dd className="mt-1 text-sm font-bold text-emerald-800">{money(job.price)}</dd>
            </div>
          </dl>
        </div>
        <div className="lg:w-56 lg:shrink-0">
          <div className={`mb-3 rounded-xl p-3 text-center ${urgent ? 'border border-red-200 bg-red-50' : 'border border-slate-200 bg-slate-50'}`}>
            <p className={`text-[11px] font-semibold ${urgent ? 'text-red-600' : 'text-slate-500'}`}>Offer expires in</p>
            <Countdown expiresAt={job.offerExpiresAt} className={`mt-0.5 block text-2xl font-bold ${urgent ? 'text-red-700' : 'text-slate-900'}`} />
          </div>
          <div className="flex gap-2">
            <button type="button" className={`${btnPrimary} flex-1`} disabled={!canAccept || Boolean(busy)} onClick={() => handlers.onAccept(job)}>
              {busy === 'accept' && <Loader2 size={14} aria-hidden className="animate-spin" />}
              Accept
            </button>
            <button type="button" className={`${btnDanger} flex-1`} disabled={Boolean(busy)} onClick={() => handlers.onDecline(job)}>
              Decline
            </button>
          </div>
          {reason && <p className="mt-2 text-center text-xs text-slate-500">{reason}</p>}
        </div>
      </div>
    </article>
  );
});

const STEPS: { stage: MyJobStage; label: string }[] = [
  { stage: 'upcoming', label: 'Accepted' },
  { stage: 'in_progress', label: 'Started' },
  { stage: 'completed', label: 'Completed' },
];

const MyJobCard = memo(function MyJobCard({ job, expanded, busy, onToggle, handlers }: { job: Job; expanded: boolean; busy?: string; onToggle: (id: string) => void; handlers: JobHandlers }) {
  const stage = job.stage as MyJobStage;
  const meta = STAGE_META[stage];
  const panelId = `job-panel-${job.id}`;
  const maps = mapsHref(job);
  const stepIndex = STEPS.findIndex((s) => s.stage === stage);

  return (
    <article className={`${card} overflow-hidden`}>
      <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => onToggle(job.id)} className={`flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-slate-50 ${ringFocus}`}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xl" aria-hidden="true">{emojiFor(job.service)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold capitalize text-slate-900">{job.service}</h2>
            <Badge tone={meta.tone}>{meta.label}</Badge>
            {stage === 'completed' && job.rating !== undefined && <Badge tone="warning">{job.rating.toFixed(1)} ★</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs capitalize text-slate-500">{[job.sub, job.area].filter(Boolean).join(' · ')}</p>
          <p className="mt-1 text-xs text-slate-400">{job.date} · {job.slot}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-bold tabular-nums text-emerald-700">{money(job.price)}</p>
          <ChevronDown size={14} aria-hidden className={`ml-auto mt-1 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div id={panelId} className="border-t border-slate-100 px-4 pb-4 pt-3">
          {stage !== 'cancelled' && (
            <ol className="mb-4 flex items-center gap-2" aria-label="Job progress">
              {STEPS.map((s, i) => (
                <li key={s.stage} className="flex flex-1 items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i <= stepIndex ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`} aria-hidden="true">
                    {i < stepIndex ? '✓' : i + 1}
                  </span>
                  <span className={`text-xs font-semibold ${i <= stepIndex ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</span>
                  {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < stepIndex ? 'bg-emerald-500' : 'bg-slate-200'}`} aria-hidden="true" />}
                </li>
              ))}
            </ol>
          )}

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
              <dt className="text-[11px] font-semibold text-slate-500">Service address</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{job.address || job.area}</dd>
            </div>
            {(job.customerName || job.customerPhone) && (
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-[11px] font-semibold text-slate-500">Customer</dt>
                <dd className="mt-1 text-sm font-medium text-slate-800">{job.customerName ?? 'Customer'}</dd>
              </div>
            )}
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold text-slate-500">Payment</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{job.prepaid ? 'Paid online' : 'Collect on completion'}</dd>
            </div>
            {job.notes && (
              <div className="rounded-xl bg-amber-50 p-3 sm:col-span-2">
                <dt className="text-[11px] font-semibold text-amber-800">Customer notes</dt>
                <dd className="mt-1 text-sm text-amber-950">{job.notes}</dd>
              </div>
            )}
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {job.customerPhone && stage !== 'completed' && stage !== 'cancelled' && (
              <a href={`tel:${job.customerPhone.replace(/[^\d+]/g, '')}`} className={btnOutline}><Phone size={14} aria-hidden /> Call customer</a>
            )}
            {maps && stage !== 'completed' && stage !== 'cancelled' && (
              <a href={maps} target="_blank" rel="noopener noreferrer" className={btnOutline}><Navigation size={14} aria-hidden /> Navigate</a>
            )}
            {stage === 'upcoming' && (
              <button type="button" className={btnPrimary} disabled={Boolean(busy)} onClick={() => handlers.onStart(job)}>
                {busy === 'start' ? <Loader2 size={14} aria-hidden className="animate-spin" /> : <Play size={14} aria-hidden />} Start job
              </button>
            )}
            {stage === 'in_progress' && (
              <button type="button" className={btnPrimary} disabled={Boolean(busy)} onClick={() => handlers.onComplete(job)}>
                <CheckCircle size={14} aria-hidden /> Complete
              </button>
            )}
            {(stage === 'upcoming' || stage === 'in_progress') && (
              <button type="button" className={btnDanger} disabled={Boolean(busy)} onClick={() => handlers.onCancel(job)}>
                <XCircle size={14} aria-hidden /> Cancel job
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
});

/* ───────────────────────────── Upload area ───────────────────────────── */

function UploadArea({ label, required, current, onPick, onRemove }: { label: string; required: boolean; current?: UploadMeta; onPick: (f: File) => void; onRemove: () => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  const id = useId();
  return (
    <div className={`${card} p-4`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{required ? 'Required' : 'Optional'}</p>
        </div>
        <Badge tone={current ? 'success' : 'default'}>{current ? 'Added on this device' : 'Not added'}</Badge>
      </div>
      <input
        id={id}
        ref={ref}
        type="file"
        accept={ACCEPTED_UPLOAD_TYPES.join(',')}
        className="sr-only"
        aria-label={`${current ? 'Replace' : 'Choose'} file for ${label}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const problem = uploadError(file);
          if (problem) toast.error(`${file.name}: ${problem}`);
          else onPick(file);
          if (ref.current) ref.current.value = '';
        }}
      />
      <button type="button" onClick={() => ref.current?.click()} className={`w-full rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-4 transition-colors hover:bg-emerald-50 ${ringFocus}`}>
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white"><CloudUpload size={16} aria-hidden className="text-emerald-700" /></span>
          <span className="min-w-0 text-left">
            <span className="block text-sm font-semibold text-slate-700">{current ? 'Replace file' : 'Choose file'}</span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {current ? `${current.name} · ${(current.size / 1024).toFixed(1)} KB` : 'JPG, PNG, WebP or PDF, up to 5 MB'}
            </span>
          </span>
        </span>
      </button>
      {current && (
        <button type="button" onClick={onRemove} className={`mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-red-600 hover:text-red-800 ${ringFocus}`}>Remove</button>
      )}
    </div>
  );
}

/* ───────────────────────────── Tab panels ───────────────────────────── */

interface Stats {
  todayCount: number;
  totalCompleted: number;
  monthEarnings: number;
  totalEarnings: number;
  avgRating: number | null;
  anyOrderValueOnly: boolean;
}
interface DayPoint { key: string; label: string; value: number; isToday: boolean }

const OverviewTab = memo(function OverviewTab({
  techName, roleLabel, greeting, online, onlineBusy, onOnline, verification, stats, activeJob, nextJob, offers, onTab, onComplete,
}: {
  techName: string; roleLabel: string; greeting: string; online: TechnicianOnline; onlineBusy: boolean;
  onOnline: (v: TechnicianOnline) => void; verification: VerificationStatus; stats: Stats;
  activeJob: Job | null; nextJob: Job | null; offers: Job[]; onTab: (t: TabKey) => void; onComplete: (j: Job) => void;
}) {
  const banner =
    verification === 'verified'
      ? { cls: 'bg-emerald-600', text: `Verified AuroWater ${roleLabel.toLowerCase()}. You can accept jobs.`, cta: null as string | null }
      : verification === 'pending'
        ? { cls: 'bg-sky-700', text: 'Your ID is under review. This usually takes 1 to 2 business days.', cta: null }
        : { cls: 'bg-amber-600', text: 'Complete your profile and add your ID to start accepting jobs.', cta: 'Add documents' };

  return (
    <div className="space-y-5">
      <div className={`${card} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
        <div>
          <p className="text-sm text-slate-500">{greeting}</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{techName}</h1>
          <p className="mt-1 text-sm text-slate-500">Here’s your work at a glance.</p>
        </div>
        <StatusToggle online={online} busy={onlineBusy} onChange={onOnline} />
      </div>

      <div className={`${banner.cls} flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 text-white`} role="status">
        <p className="text-sm font-semibold">{banner.text}</p>
        {banner.cta && (
          <button type="button" onClick={() => onTab('documents')} className={`rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 ${ringFocus}`}>{banner.cta}</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Jobs today" value={String(stats.todayCount)} icon={Briefcase} />
        <StatCard label="Total completed" value={String(stats.totalCompleted)} icon={CheckCircle} />
        <StatCard label="Average rating" value={stats.avgRating ? `${stats.avgRating.toFixed(1)} ★` : '—'} icon={Star} />
        <StatCard label="This month" value={money(stats.monthEarnings)} icon={IndianRupee} accent />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${card} p-4 sm:p-5`} aria-labelledby="active-job-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="active-job-title" className="text-sm font-bold text-slate-700">{activeJob ? 'Active job' : 'Next job'}</h2>
            {activeJob && <Badge tone="purple">In progress</Badge>}
          </div>
          {activeJob || nextJob ? (
            (() => {
              const j = (activeJob ?? nextJob) as Job;
              return (
                <div>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl" aria-hidden="true">{emojiFor(j.service)}</div>
                    <div className="min-w-0">
                      <p className="font-bold capitalize text-slate-900">{j.service}</p>
                      <p className="truncate text-xs capitalize text-slate-500">{[j.sub, j.area].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                  {activeJob ? (
                    <button type="button" onClick={() => onComplete(j)} className={`${btnPrimary} w-full`}>Mark as completed</button>
                  ) : (
                    <button type="button" onClick={() => onTab('my_jobs')} className={`${btnOutline} w-full`}>Open job details</button>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="py-4 text-center">
              <p className="mb-2 text-3xl" aria-hidden="true">📭</p>
              <p className="text-sm font-semibold text-slate-700">No active job</p>
              <p className="mt-1 text-xs text-slate-500">Accept a job from the queue to get started.</p>
              <button type="button" onClick={() => onTab('queue')} className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline ${ringFocus}`}>Open job queue <ChevronRight size={12} aria-hidden /></button>
            </div>
          )}
        </section>

        <section className={`${card} p-4 sm:p-5`} aria-labelledby="queue-preview-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="queue-preview-title" className="text-sm font-bold text-slate-700">Queue preview</h2>
            <button type="button" onClick={() => onTab('queue')} className={`inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline ${ringFocus}`}>View all <ChevronRight size={12} aria-hidden /></button>
          </div>
          {offers.length === 0 ? (
            <div className="py-4 text-center">
              <p className="mb-2 text-3xl" aria-hidden="true">🌿</p>
              <p className="text-sm font-semibold text-slate-700">Queue is clear</p>
              <p className="mt-1 text-xs text-slate-500">{online === 'online' ? 'New jobs will appear here.' : 'Go online to receive new jobs.'}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {offers.slice(0, 3).map((j) => (
                <li key={j.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                  <span className="text-lg" aria-hidden="true">{emojiFor(j.service)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold capitalize text-slate-800">{[j.service, j.sub].filter(Boolean).join(' · ')}</p>
                    <p className="truncate text-[11px] text-slate-500">{j.area}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold text-emerald-700">{money(j.price)}</p>
                    <Countdown expiresAt={j.offerExpiresAt} className="text-[11px] text-slate-500" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
});

function EarningsTab({
  stats, week, completed, profile, setProfile,
}: {
  stats: Stats; week: DayPoint[]; completed: Job[];
  profile: TechProfile; setProfile: React.Dispatch<React.SetStateAction<TechProfile>>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [upiError, setUpiError] = useState<string | null>(null);
  const weekTotal = week.reduce((s, d) => s + d.value, 0);
  const max = Math.max(1, ...week.map((d) => d.value));
  const best = week.reduce((a, b) => (b.value > a.value ? b : a), week[0]);

  const saveUpi = () => {
    const value = draft.trim();
    if (value && !UPI_PATTERN.test(value)) {
      setUpiError('Enter a valid UPI ID, like name@bank.');
      return;
    }
    setProfile((c) => ({ ...c, upiId: value }));
    setEditing(false);
    setUpiError(null);
    toast.success('UPI ID saved on this device');
  };

  const exportCsv = () => {
    if (!completed.length) return toast.info('No completed jobs to export yet.');
    const esc = (v: unknown) => {
      let s = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [
      ['Job', 'Service', 'Area', 'Completed on', 'Amount (INR)'].join(','),
      ...completed.map((j) => [esc(j.id), esc(j.service), esc(j.area), esc(j.completedAt ? new Date(j.completedAt).toISOString().slice(0, 10) : ''), num(j.price)].join(',')),
    ];
    const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `aurowater-earnings-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Exported ${completed.length} jobs`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Earnings"
        description={stats.anyOrderValueOnly ? 'Based on order value for completed jobs. Your final payout may differ.' : 'Based on your payout for completed jobs.'}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnOutline} onClick={exportCsv}><Download size={14} aria-hidden /> Export CSV</button>
            <button type="button" className={btnPrimary} disabled title="Payout requests are not available yet"><IndianRupee size={14} aria-hidden /> Request payout (soon)</button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Today" value={money(week[week.length - 1]?.value ?? 0)} icon={TrendingUp} />
        <StatCard label="Last 7 days" value={money(weekTotal)} icon={Calendar} />
        <StatCard label="This month" value={money(stats.monthEarnings)} icon={Package} />
        <StatCard label="All time" value={money(stats.totalEarnings)} icon={Award} accent />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className={`${card} p-4 sm:p-5 lg:col-span-2`} aria-labelledby="week-title">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="week-title" className="font-bold text-slate-900">Last 7 days</h2>
            <p className="text-xs text-slate-500">{weekTotal > 0 ? `Best day: ${best.label}, ${money(best.value)}` : 'No completed jobs this week'}</p>
          </div>
          <ul className="flex h-40 items-end gap-2">
            {week.map((d) => (
              <li key={d.key} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" aria-label={`${d.label}: ${money(d.value)}`}>
                <span className="text-[11px] font-semibold text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">{d.value ? money(d.value) : ''}</span>
                <span className="w-full rounded-t-lg" style={{ height: `${Math.max(4, (d.value / max) * 100)}%`, background: d.isToday ? 'linear-gradient(to top,#059669,#34d399)' : '#e2e8f0' }} />
                <span className={`text-[11px] font-semibold ${d.isToday ? 'text-emerald-700' : 'text-slate-500'}`}>{d.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${card} p-4 sm:p-5`} aria-labelledby="payout-title">
          <h2 id="payout-title" className="mb-4 font-bold text-slate-900">Payout details</h2>
          {!editing ? (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 truncate rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700">{profile.upiId || 'No UPI ID added'}</div>
              <button type="button" aria-label="Edit UPI ID" onClick={() => { setEditing(true); setDraft(profile.upiId); setUpiError(null); }} className={`rounded-xl border border-slate-300 p-2.5 hover:bg-slate-50 ${ringFocus}`}><Edit3 size={14} aria-hidden className="text-slate-600" /></button>
            </div>
          ) : (
            <div className="space-y-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="name@bank" aria-label="UPI ID" aria-invalid={Boolean(upiError)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20" />
              {upiError && <p role="alert" className="text-xs font-medium text-red-700">{upiError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={saveUpi} className={`${btnPrimary} flex-1`}><Save size={13} aria-hidden /> Save</button>
                <button type="button" aria-label="Cancel editing" onClick={() => setEditing(false)} className={`${btnOutline} px-3`}><X size={14} aria-hidden /></button>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-slate-500">Stored on this device for now. It isn’t used for payouts until payouts are connected.</p>
        </section>
      </div>

      <section className={`${card} p-4 sm:p-5`} aria-labelledby="completed-title">
        <h2 id="completed-title" className="mb-1 font-bold text-slate-900">Recent completed jobs</h2>
        <p className="mb-4 text-xs text-slate-500">Payout history will appear here once payouts are connected.</p>
        {completed.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Completed jobs will show up here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th scope="col" className="pb-3 font-semibold">Completed</th>
                  <th scope="col" className="pb-3 font-semibold">Service</th>
                  <th scope="col" className="pb-3 font-semibold">Area</th>
                  <th scope="col" className="pb-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {completed.slice(0, 10).map((j) => (
                  <tr key={j.id} className="border-b border-slate-50">
                    <td className="py-3 text-slate-600">{j.completedAt ? new Date(j.completedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                    <td className="py-3 font-medium capitalize text-slate-800">{j.service}</td>
                    <td className="py-3 text-slate-600">{j.area}</td>
                    <td className="py-3 text-right font-semibold tabular-nums text-emerald-700">{money(j.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AvailabilityTab({ availability, setAvailability }: { availability: Availability; setAvailability: React.Dispatch<React.SetStateAction<Availability>> }) {
  const toggle = (key: string) => setAvailability((c) => ({ ...c, [key]: !c[key] }));
  const setWeekdays = () => setAvailability((c) => {
    const next = { ...c };
    for (const d of DAYS) for (const s of SLOTS) next[`${d}:${s}`] = !['sat', 'sun'].includes(d) && s !== 'evening';
    return next;
  });
  const clearAll = () => setAvailability((c) => {
    const next = { ...c };
    for (const d of DAYS) for (const s of SLOTS) next[`${d}:${s}`] = false;
    return next;
  });
  const total = DAYS.flatMap((d) => SLOTS.map((s) => `${d}:${s}`)).filter((k) => availability[k]).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Availability"
        description="Choose when you can take bookings. Changes save automatically on this device."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnOutline} onClick={setWeekdays}>Weekdays, daytime</button>
            <button type="button" className={btnOutline} onClick={clearAll}>Clear all</button>
          </div>
        }
      />
      <section className={`${card} overflow-x-auto p-4 sm:p-5`} aria-label="Weekly schedule">
        <p className="mb-3 text-xs text-slate-500">{total} of 21 slots selected</p>
        <div className="min-w-[640px]">
          <div className="mb-3 grid grid-cols-[150px_repeat(7,1fr)] gap-2">
            <div />
            {DAYS.map((d) => <div key={d} className="text-center text-xs font-semibold text-slate-600">{cap(d)}</div>)}
          </div>
          {SLOTS.map((s) => (
            <div key={s} className="mb-2 grid grid-cols-[150px_repeat(7,1fr)] gap-2">
              <div className="flex items-center text-xs font-semibold text-slate-600">{SLOT_LABEL[s]}</div>
              {DAYS.map((d) => {
                const key = `${d}:${s}`;
                const on = Boolean(availability[key]);
                return (
                  <button key={key} type="button" aria-pressed={on} aria-label={`${DAY_NAMES[d]} ${SLOT_LABEL[s]}`} onClick={() => toggle(key)} className={`h-10 rounded-xl text-xs font-bold transition-colors ${ringFocus} ${on ? 'bg-emerald-600 text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'}`}>
                    {on ? '✓' : '–'}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>
      <section className={`${card} flex items-center justify-between gap-4 p-4 sm:p-5`}>
        <div>
          <p className="flex items-center gap-2 font-bold text-slate-900"><Zap size={16} aria-hidden className="text-amber-500" /> Emergency jobs</p>
          <p className="mt-1 text-xs text-slate-500">Accept urgent requests. A ₹199 emergency surcharge applies to the customer.</p>
        </div>
        <button type="button" aria-pressed={Boolean(availability.emergency)} onClick={() => toggle('emergency')} className={`${btnBase} border ${availability.emergency ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
          {availability.emergency ? 'Enabled' : 'Disabled'}
        </button>
      </section>
    </div>
  );
}

function ProfileTab({ profile, setProfile }: { profile: TechProfile; setProfile: React.Dispatch<React.SetStateAction<TechProfile>> }) {
  const toggleIn = <K extends 'skills' | 'serviceCities'>(field: K, value: TechProfile[K][number]) =>
    setProfile((c) => {
      const list = c[field] as string[];
      const next = list.includes(value as string) ? list.filter((x) => x !== value) : [...list, value as string];
      return { ...c, [field]: next } as TechProfile;
    });

  const checks = [
    { label: 'Skills selected', ok: profile.skills.length > 0 },
    { label: 'Cities selected', ok: profile.serviceCities.length > 0 },
    { label: 'Bio of 30+ characters', ok: profile.bio.trim().length >= 30 },
    { label: 'UPI ID added', ok: UPI_PATTERN.test(profile.upiId) },
  ];
  const done = checks.filter((c) => c.ok).length;
  const pct = Math.round((done / checks.length) * 100);
  const chip = (active: boolean) => `rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${ringFocus} ${active ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`;

  return (
    <div className="space-y-5">
      <PageHeader title="Profile" description="Skills and areas you cover. Changes save automatically on this device." />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={`${card} p-4 sm:p-5`}>
          <h2 className="mb-3 font-bold text-slate-900">Skills</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Skills">
            {SKILLS.map((s) => <button key={s} type="button" aria-pressed={profile.skills.includes(s)} onClick={() => toggleIn('skills', s)} className={chip(profile.skills.includes(s))}>{s}</button>)}
          </div>
          <h2 className="mb-3 mt-6 font-bold text-slate-900">Service cities</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Service cities">
            {UP_CITIES.map((c) => <button key={c} type="button" aria-pressed={profile.serviceCities.includes(c)} onClick={() => toggleIn('serviceCities', c)} className={chip(profile.serviceCities.includes(c))}>{c}</button>)}
          </div>
        </section>
        <section className={`${card} p-4 sm:p-5`}>
          <label htmlFor="bio" className="mb-3 block font-bold text-slate-900">Bio</label>
          <textarea id="bio" value={profile.bio} onChange={(e) => setProfile((c) => ({ ...c, bio: e.target.value.slice(0, 200) }))} rows={5} placeholder="Tell customers what you specialise in and how you work." className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20" />
          <p className="mt-1 text-right text-xs text-slate-500">{profile.bio.length}/200</p>
          <h2 className="mb-3 mt-5 font-bold text-slate-900">Profile completeness</h2>
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Profile completeness">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs"><span className="font-semibold text-slate-700">{pct}% complete</span><span className="text-slate-500">{done}/{checks.length}</span></div>
          <ul className="mt-3 space-y-1.5">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                {c.ok ? <CheckCircle size={12} aria-hidden className="shrink-0 text-emerald-600" /> : <Clock3 size={12} aria-hidden className="shrink-0 text-slate-300" />}
                <span className={`text-xs ${c.ok ? 'text-slate-700' : 'text-slate-500'}`}>{c.label}{c.ok ? ' (done)' : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function DocumentsTab({
  docs, setDocs, verification, onSubmit, submitting,
}: {
  docs: TechDocs; setDocs: React.Dispatch<React.SetStateAction<TechDocs>>;
  verification: VerificationStatus; onSubmit: () => void; submitting: boolean;
}) {
  const set = (field: keyof TechDocs) => ({
    current: docs[field],
    onPick: (f: File) => setDocs((c) => ({ ...c, [field]: { name: f.name, size: f.size, status: 'uploaded' as const } })),
    onRemove: () => setDocs((c) => ({ ...c, [field]: undefined })),
  });
  const canSubmit = DOCUMENT_REVIEW_LIVE && requiredDocsUploaded(docs) && verification === 'unverified' && !submitting;

  return (
    <div className="space-y-5">
      <PageHeader title="Documents" description="Required: Aadhaar front, Aadhaar back and a profile photo. A skill certificate is optional." />
      {!DOCUMENT_REVIEW_LIVE && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0 text-amber-700" />
          <p className="text-sm text-amber-950"><strong className="font-semibold">Document review isn’t live yet.</strong> Files you choose here stay on this device and are not uploaded or reviewed. Please contact support to get verified.</p>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <UploadArea label="Aadhaar card (front)" required {...set('aadhaarFront')} />
        <UploadArea label="Aadhaar card (back)" required {...set('aadhaarBack')} />
        <UploadArea label="Profile photo" required {...set('profilePhoto')} />
        <UploadArea label="Skill certificate" required={false} {...set('skillCert')} />
      </div>
      <div className={`${card} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold text-slate-700">Verification status</p>
          <Badge tone={verification === 'verified' ? 'success' : verification === 'pending' ? 'info' : 'warning'}>
            {verification === 'verified' ? 'Verified' : verification === 'pending' ? 'Under review' : 'Not verified'}
          </Badge>
        </div>
        <button type="button" className={btnPrimary} disabled={!canSubmit} onClick={onSubmit}>
          {submitting && <Loader2 size={14} aria-hidden className="animate-spin" />}
          {DOCUMENT_REVIEW_LIVE ? 'Submit for verification' : 'Submission not available yet'}
        </button>
      </div>
      {verification === 'pending' && (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <Clock3 size={16} aria-hidden className="mt-0.5 shrink-0 text-sky-700" />
          <div>
            <p className="text-sm font-semibold text-sky-900">Under review</p>
            <p className="mt-0.5 text-xs text-sky-800">Reviews usually take 1 to 2 business days. You can update documents any time.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────── Jobs data hook ───────────────────────────── */

function useTechnicianJobs(enabled: boolean, userId?: string) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const mountedRef = useRef(false);
  const inflightRef = useRef(false);
  const queuedRef = useRef(false);
  const lastSyncRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (inflightRef.current) {
      queuedRef.current = true; // never drop an event that arrives mid-request
      return;
    }
    inflightRef.current = true;
    if (mountedRef.current) setRefreshing(true);
    try {
      const rows = await technicianJobsList();
      if (!mountedRef.current) return;
      const next = rows.map(orderToJob);
      setJobs(next);
      setError(null);
      lastSyncRef.current = Date.now();
      setLastSynced(lastSyncRef.current);
      writeJobsCache(userId, next);
    } catch (cause: unknown) {
      if (mountedRef.current) setError(getApiErrorMessage(cause));
      console.error('[TechnicianDashboard] jobs fetch failed:', cause);
    } finally {
      inflightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
      if (queuedRef.current) {
        queuedRef.current = false;
        void refresh();
      }
    }
  }, [userId]);

  // Instant paint from the session cache, then revalidate.
  useEffect(() => {
    if (!enabled) return;
    const cached = readJobsCache(userId);
    if (cached) {
      setJobs(cached);
      setLoading(false);
    }
    void refresh();
  }, [enabled, userId, refresh]);

  // Polling fallback, tab focus and reconnect.
  useEffect(() => {
    if (!enabled) return;
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastSyncRef.current > STALE_SYNC_MS) void refresh();
    };
    const onOnline = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, refresh]);

  // Realtime (debounced) with proper cleanup.
  useEffect(() => {
    if (!enabled || !userId) return;
    type SupaClient = ReturnType<typeof import('@/lib/db/supabase').supabaseBrowser>;
    let cancelled = false;
    let client: SupaClient | null = null;
    let channel: ReturnType<SupaClient['channel']> | null = null;
    let debounce: number | undefined;

    void import('@/lib/db/supabase').then(({ supabaseBrowser }) => {
      if (cancelled) return;
      client = supabaseBrowser();
      channel = client
        .channel(`technician-jobs-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `technician_id=eq.${userId}` }, () => {
          window.clearTimeout(debounce);
          debounce = window.setTimeout(() => void refresh(), 400);
        })
        .subscribe();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(debounce);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [enabled, userId, refresh]);

  return { jobs, setJobs, loading, refreshing, error, lastSynced, refresh };
}

/* ───────────────────────────── Page ───────────────────────────── */

export default function TechnicianDashboardPage() {
  const router = useRouter();
  const { role: authRole, hydrated: authHydrated, isLoggedIn, session } = useAuth();
  const roleKey = String(authRole ?? '').toLowerCase();
  const allowed = authHydrated && isLoggedIn && ALLOWED_ROLES.includes(roleKey);
  const roleLabel = roleKey === 'plumber' ? 'Plumber' : 'Technician';
  const userId = session?.userId;

  const [tab, setTab] = useState<TabKey>('overview');
  const [moreOpen, setMoreOpen] = useState(false);
  const [online, setOnline] = useState<TechnicianOnline>('offline');
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [verification, setVerification] = useState<VerificationStatus>('unverified');
  const [techName, setTechName] = useState('');
  const [greeting, setGreeting] = useState('Hello');
  const [clock, setClock] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | MyJobStage>('all');
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [completing, setCompleting] = useState<Job | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [cancelling, setCancelling] = useState<Job | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [docsSubmitting, setDocsSubmitting] = useState(false);

  const [profile, setProfile] = usePersisted<TechProfile>(KEYS.PROFILE, { skills: [], serviceCities: [], bio: '', upiId: '' }, normalizeProfile);
  const [availability, setAvailability] = usePersisted<Availability>(KEYS.AVAILABILITY, {}, normalizeAvailability);
  const [docs, setDocs] = usePersisted<TechDocs>(KEYS.DOCS, {}, normalizeDocs);

  const { jobs, setJobs, loading, refreshing, error, lastSynced, refresh } = useTechnicianJobs(allowed, userId);
  const busyRef = useRef<Record<string, string>>({});
  const seenOffersRef = useRef<Set<string> | null>(null);

  /* ── Mount: device-local state, hash tab, greeting, obsolete cleanup ── */
  useEffect(() => {
    const savedOnline = lsGet(KEYS.ONLINE);
    const savedVerif = lsGet(KEYS.VERIFICATION);
    setOnline(savedOnline === 'online' ? 'online' : 'offline');
    setVerification(savedVerif === 'verified' || savedVerif === 'pending' ? savedVerif : 'unverified');
    try {
      const profileRaw = lsGet(KEYS.USER_PROFILE);
      const parsed = typeof profileRaw === 'string' ? (JSON.parse(profileRaw) as { name?: string }) : null;
      setTechName(parsed?.name || '');
    } catch {
      setTechName('');
    }
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
    const hash = window.location.hash.slice(1) as TabKey;
    if (TAB_KEYS.includes(hash)) setTab(hash);
    KEYS.OBSOLETE.forEach((k) => lsRemove(k));
    setClock(Date.now());
    const id = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const changeTab = useCallback((next: TabKey) => {
    setTab(next);
    setMoreOpen(false);
    try {
      window.history.replaceState(null, '', `#${next}`);
    } catch {
      /* non-critical */
    }
    window.scrollTo({ top: 0 });
  }, []);

  /* ── Derived data ── */
  const offers = useMemo(
    () => jobs.filter((j) => j.stage === 'offer' && (clock === 0 || j.offerExpiresAt > clock)).sort((a, b) => a.offerExpiresAt - b.offerExpiresAt),
    [jobs, clock],
  );

  const myJobs = useMemo(() => {
    const priority: Record<MyJobStage, number> = { in_progress: 0, upcoming: 1, completed: 2, cancelled: 3 };
    return jobs.filter((j) => j.stage !== 'offer').sort((a, b) => priority[a.stage as MyJobStage] - priority[b.stage as MyJobStage] || b.updatedAt - a.updatedAt);
  }, [jobs]);

  const visibleMyJobs = useMemo(() => (filter === 'all' ? myJobs : myJobs.filter((j) => j.stage === filter)), [myJobs, filter]);
  const stageCounts = useMemo(() => {
    const c: Record<string, number> = { upcoming: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const j of myJobs) c[j.stage] += 1;
    return c;
  }, [myJobs]);

  const activeJob = useMemo(() => myJobs.find((j) => j.stage === 'in_progress') ?? null, [myJobs]);
  const nextJob = useMemo(() => myJobs.find((j) => j.stage === 'upcoming') ?? null, [myJobs]);
  const completedJobs = useMemo(() => myJobs.filter((j) => j.stage === 'completed').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)), [myJobs]);

  const { stats, week } = useMemo(() => {
    const nowTs = clock || Date.now();
    const today = dayKey(nowTs);
    const monthPrefix = `${new Date(nowTs).getFullYear()}-${new Date(nowTs).getMonth()}-`;
    let todayCount = 0;
    let month = 0;
    let total = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    let orderValueOnly = false;
    const byDay = new Map<string, number>();

    for (const j of completedJobs) {
      total += j.price;
      if (!j.priceIsPayout) orderValueOnly = true;
      if (j.rating !== undefined) { ratingSum += j.rating; ratingCount += 1; }
      if (!j.completedAt) continue;
      const k = dayKey(j.completedAt);
      byDay.set(k, (byDay.get(k) ?? 0) + j.price);
      if (k === today) todayCount += 1;
      if (k.startsWith(monthPrefix)) month += j.price;
    }

    const series: DayPoint[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(nowTs);
      d.setDate(d.getDate() - (6 - i));
      const key = dayKey(d.getTime());
      return { key, label: d.toLocaleDateString('en-IN', { weekday: 'short' }), value: byDay.get(key) ?? 0, isToday: i === 6 };
    });

    return {
      stats: { todayCount, totalCompleted: completedJobs.length, monthEarnings: month, totalEarnings: total, avgRating: ratingCount ? ratingSum / ratingCount : null, anyOrderValueOnly: orderValueOnly } as Stats,
      week: series,
    };
  }, [completedJobs, clock]);

  /* ── Page title with live offer count; new-offer alerts ── */
  useEffect(() => {
    document.title = `${offers.length ? `(${offers.length}) ` : ''}${TAB_META[tab].label} | ${roleLabel} | AuroWater`;
  }, [tab, offers.length, roleLabel]);

  useEffect(() => {
    if (loading) return;
    const ids = new Set(offers.map((o) => o.id));
    if (seenOffersRef.current === null) {
      seenOffersRef.current = ids;
      return;
    }
    const fresh = offers.filter((o) => !seenOffersRef.current!.has(o.id));
    seenOffersRef.current = ids;
    if (fresh.length) {
      toast.info(fresh.length === 1 ? `New job: ${fresh[0].service}` : `${fresh.length} new jobs in your queue`, { action: { label: 'View', onClick: () => changeTab('queue') } });
      try { navigator.vibrate?.(200); } catch { /* unsupported */ }
    }
  }, [offers, loading, changeTab]);

  /* ── Actions ── */
  const guard = useCallback(async (id: string, label: string, fn: () => Promise<void>, failure: string): Promise<boolean> => {
    if (busyRef.current[id]) return false;
    busyRef.current = { ...busyRef.current, [id]: label };
    setBusy(busyRef.current);
    try {
      await fn();
      return true;
    } catch (cause) {
      toast.error(getApiErrorMessage(cause) || failure);
      void refresh(); // restores the true server state after an optimistic change
      return false;
    } finally {
      const { [id]: _removed, ...rest } = busyRef.current;
      busyRef.current = rest;
      setBusy(rest);
    }
  }, [refresh]);

  const patchJob = useCallback((id: string, patch: Partial<Job>) => setJobs((cur) => cur.map((j) => (j.id === id ? { ...j, ...patch } : j))), [setJobs]);

  const handleOnline = useCallback(async (next: TechnicianOnline) => {
    if (onlineBusy) return;
    const previous = online;
    setOnline(next);
    setOnlineBusy(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      if (next === 'online' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 }),
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          toast.warning('Location is unavailable, so you may see fewer nearby jobs.');
        }
      }
      await technicianAvailabilityUpdate({ online: next === 'online', lat, lng });
      lsSet(KEYS.ONLINE, next);
      toast.success(next === 'online' ? 'You’re available for nearby jobs.' : 'You’re offline.');
    } catch (cause) {
      setOnline(previous);
      toast.error(getApiErrorMessage(cause) || 'Could not update availability.');
    } finally {
      setOnlineBusy(false);
    }
  }, [online, onlineBusy]);

  const handlers = useMemo<JobHandlers>(() => ({
    onAccept: async (job) => {
      const ok = await guard(job.id, 'accept', async () => {
        await technicianJobAccept(job.id);
        patchJob(job.id, { stage: 'upcoming', updatedAt: Date.now() });
      }, 'Couldn’t accept this job.');
      if (ok) {
        toast.success('Job accepted. You’re on the way.');
        void refresh();
      }
    },
    onDecline: async (job) => {
      let reassigned = false;
      const ok = await guard(job.id, 'decline', async () => {
        const result = await technicianJobReject(job.id);
        reassigned = Boolean(result.reassigned);
        setJobs((cur) => cur.filter((j) => j.id !== job.id));
      }, 'Couldn’t decline this job.');
      if (ok) {
        toast.success(reassigned ? 'Job declined. Finding the next technician.' : 'Job declined.');
        void refresh();
      }
    },
    onStart: async (job) => {
      const ok = await guard(job.id, 'start', async () => {
        await technicianJobUpdateStatus(job.id, 'IN_PROGRESS');
        patchJob(job.id, { stage: 'in_progress', updatedAt: Date.now() });
      }, 'Couldn’t start this job.');
      if (ok) {
        toast.success('Job started.');
        void refresh();
      }
    },
    onComplete: (job) => {
      setCompleteError(null);
      setCompleting(job);
    },
    onCancel: (job) => setCancelling(job),
  }), [guard, patchJob, refresh, setJobs]);

  const submitCompletion = useCallback(async (v: { otp: string; paymentConfirmed: boolean; reference: string }) => {
    if (!completing || completeBusy) return;
    setCompleteBusy(true);
    setCompleteError(null);
    try {
      type Extra = Parameters<typeof technicianJobUpdateStatus>[2];
      await technicianJobUpdateStatus(completing.id, 'COMPLETED', {
        payment_confirmed: v.paymentConfirmed,
        payment_reference: v.reference || undefined,
        completion_otp: v.otp,
      } as Extra);
      patchJob(completing.id, { stage: 'completed', completedAt: Date.now(), updatedAt: Date.now() });
      toast.success('Job completed. Great work!');
      setCompleting(null);
      void refresh();
    } catch (cause) {
      setCompleteError(getApiErrorMessage(cause) || 'Couldn’t complete this job. Check the code and try again.');
    } finally {
      setCompleteBusy(false);
    }
  }, [completing, completeBusy, patchJob, refresh]);

  const confirmCancel = useCallback(async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    const job = cancelling;
    const ok = await guard(job.id, 'cancel', async () => {
      await technicianJobUpdateStatus(job.id, 'CANCELLED');
      patchJob(job.id, { stage: 'cancelled', updatedAt: Date.now() });
    }, 'Couldn’t cancel this job.');
    setCancelBusy(false);
    if (ok) {
      setCancelling(null);
      toast.success('Job cancelled.');
      void refresh();
    }
  }, [cancelling, guard, patchJob, refresh]);

  const submitDocuments = useCallback(async () => {
    if (!requiredDocsUploaded(docs)) return toast.error('Add all required documents first.');
    setDocsSubmitting(true);
    try {
      await submitDocumentsToServer(docs);
      setVerification('pending');
      lsSet(KEYS.VERIFICATION, 'pending');
      toast.success('Documents submitted. Review takes 1 to 2 business days.');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Couldn’t submit documents.');
    } finally {
      setDocsSubmitting(false);
    }
  }, [docs]);

  const toggleExpanded = useCallback((id: string) => setExpandedId((cur) => (cur === id ? null : id)), []);

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const i = TAB_KEYS.indexOf(tab);
    let next = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % TAB_KEYS.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + TAB_KEYS.length) % TAB_KEYS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TAB_KEYS.length - 1;
    if (next >= 0) {
      e.preventDefault();
      changeTab(TAB_KEYS[next]);
      document.getElementById(`tech-tab-${TAB_KEYS[next]}`)?.focus();
    }
  };

  /* ── Auth gates (all hooks above) ── */
  if (!authHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100" role="status" aria-label="Loading">
        <Loader2 size={24} aria-hidden className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className={`${card} w-full max-w-sm p-8 text-center`}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50"><AlertCircle size={24} aria-hidden className="text-emerald-700" /></div>
          <h1 className="text-xl font-bold text-slate-900">Technician access</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in with a technician or plumber account to view this dashboard.</p>
          <button type="button" onClick={() => router.push('/auth/login')} className={`${btnPrimary} mt-6 w-full`}>Go to sign in</button>
        </div>
      </main>
    );
  }

  const displayName = techName || roleLabel;
  const canAccept = verification === 'verified' && online === 'online';
  const acceptReason = verification !== 'verified' ? 'Get verified to accept jobs.' : online !== 'online' ? 'Go online to accept jobs.' : null;
  const inProgressCount = stageCounts.in_progress;

  const badgeFor = (key: TabKey) => (key === 'queue' ? offers.length : key === 'my_jobs' ? inProgressCount : 0);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <a href="#tech-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg">Skip to content</a>

      <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className={`${card} sticky top-6 overflow-hidden`}>
              <div className="border-b border-slate-100 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <span className={`h-2 w-2 rounded-full ${online === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />
                      {roleLabel}, {online}
                    </p>
                  </div>
                </div>
              </div>
              <nav aria-label="Dashboard sections" className="space-y-0.5 p-2" role="tablist" aria-orientation="vertical" onKeyDown={onTabKeyDown}>
                {TAB_KEYS.map((key) => {
                  const { label, icon: Icon } = TAB_META[key];
                  const active = tab === key;
                  const badge = badgeFor(key);
                  return (
                    <button key={key} id={`tech-tab-${key}`} type="button" role="tab" aria-selected={active} aria-controls="tech-main" tabIndex={active ? 0 : -1} onClick={() => changeTab(key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${ringFocus} ${active ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                      <Icon size={16} aria-hidden className={active ? 'text-white' : 'text-slate-400'} />
                      <span className="flex-1 truncate">{label}</span>
                      {badge > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${active ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-800'}`}>{badge}</span>}
                    </button>
                  );
                })}
              </nav>
              <div className="border-t border-slate-100 p-2">
                <button type="button" onClick={() => router.push('/')} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 ${ringFocus}`}><ArrowLeft size={14} aria-hidden /> Back to site</button>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main id="tech-main" role="tabpanel" aria-labelledby={`tech-tab-${tab}`} tabIndex={-1} className="min-w-0 flex-1 pb-24 outline-none lg:pb-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span aria-live="polite">
                {lastSynced ? `Synced ${new Date(lastSynced).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Syncing…'}
              </span>
              <button type="button" onClick={() => void refresh()} disabled={refreshing} className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-slate-600 hover:bg-white disabled:opacity-60 ${ringFocus}`}>
                <RefreshCw size={12} aria-hidden className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing' : 'Refresh'}
              </button>
            </div>

            {error && (
              <div className="mb-5 space-y-2" role="alert">
                <DatabaseErrorBanner message={error} />
                <div className="flex justify-end"><button type="button" onClick={() => void refresh()} className={btnPrimary}>Retry</button></div>
              </div>
            )}

            {tab === 'overview' && (
              <OverviewTab techName={displayName} roleLabel={roleLabel} greeting={greeting} online={online} onlineBusy={onlineBusy} onOnline={handleOnline} verification={verification} stats={stats} activeJob={activeJob} nextJob={nextJob} offers={offers} onTab={changeTab} onComplete={handlers.onComplete} />
            )}

            {tab === 'queue' && (
              <div className="space-y-5">
                <PageHeader
                  title="Available jobs"
                  description="Accept before the timer ends. Expired offers are removed."
                  actions={
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={offers.length > 0 ? 'success' : 'default'}>{offers.length} in queue</Badge>
                      <StatusToggle online={online} busy={onlineBusy} onChange={handleOnline} />
                    </div>
                  }
                />
                {loading ? <JobsSkeleton /> : offers.length === 0 ? (
                  <EmptyState emoji="📭" title="No jobs right now" message={online === 'online' ? 'New requests appear here the moment they’re assigned to you.' : 'Go online to start receiving job requests.'} />
                ) : (
                  <div className="space-y-4">
                    {offers.map((j) => <QueueCard key={j.id} job={j} canAccept={canAccept} reason={acceptReason} busy={busy[j.id]} handlers={handlers} />)}
                  </div>
                )}
              </div>
            )}

            {tab === 'my_jobs' && (
              <div className="space-y-5">
                <PageHeader title="My jobs" description="Track, navigate to and complete your jobs." />
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter jobs">
                  {(['all', 'upcoming', 'in_progress', 'completed', 'cancelled'] as const).map((f) => (
                    <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${ringFocus} ${filter === f ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>
                      {f === 'all' ? 'All' : STAGE_META[f].label}
                      <span className="ml-1.5 tabular-nums opacity-70">{f === 'all' ? myJobs.length : stageCounts[f]}</span>
                    </button>
                  ))}
                </div>
                {loading ? <JobsSkeleton /> : visibleMyJobs.length === 0 ? (
                  <EmptyState emoji="📅" title="No jobs here yet" message="Accepted jobs show up here." action={<button type="button" className={btnPrimary} onClick={() => changeTab('queue')}>Open job queue</button>} />
                ) : (
                  <div className="space-y-3">
                    {visibleMyJobs.map((j) => <MyJobCard key={j.id} job={j} expanded={expandedId === j.id} busy={busy[j.id]} onToggle={toggleExpanded} handlers={handlers} />)}
                  </div>
                )}
              </div>
            )}

            {tab === 'earnings' && <EarningsTab stats={stats} week={week} completed={completedJobs} profile={profile} setProfile={setProfile} />}
            {tab === 'availability' && <AvailabilityTab availability={availability} setAvailability={setAvailability} />}
            {tab === 'profile' && <ProfileTab profile={profile} setProfile={setProfile} />}
            {tab === 'documents' && <DocumentsTab docs={docs} setDocs={setDocs} verification={verification} onSubmit={() => void submitDocuments()} submitting={docsSubmitting} />}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Dashboard sections" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {moreOpen && (
          <div className="absolute inset-x-3 bottom-[calc(100%+8px)] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            {(['availability', 'documents'] as TabKey[]).map((key) => {
              const { label, icon: Icon } = TAB_META[key];
              return (
                <button key={key} type="button" onClick={() => changeTab(key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 ${ringFocus}`}>
                  <Icon size={16} aria-hidden className="text-slate-400" /> {label}
                </button>
              );
            })}
            <button type="button" onClick={() => router.push('/')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-500 hover:bg-slate-50 ${ringFocus}`}>
              <ArrowLeft size={16} aria-hidden /> Back to site
            </button>
          </div>
        )}
        <div className="flex">
          {MOBILE_PRIMARY.map((key) => {
            const { label, icon: Icon } = TAB_META[key];
            const active = tab === key;
            const badge = badgeFor(key);
            return (
              <button key={key} type="button" aria-current={active ? 'page' : undefined} onClick={() => changeTab(key)} className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${ringFocus} ${active ? 'text-emerald-700' : 'text-slate-500'}`}>
                <Icon size={18} aria-hidden />
                {label.replace('Job queue', 'Queue')}
                {badge > 0 && <span className="absolute right-1/4 top-1.5 rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">{badge}</span>}
              </button>
            );
          })}
          <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${ringFocus} ${tab === 'availability' || tab === 'documents' ? 'text-emerald-700' : 'text-slate-500'}`}>
            <MoreHorizontal size={18} aria-hidden /> More
          </button>
        </div>
      </nav>

      {completing && <CompletionDialog job={completing} busy={completeBusy} error={completeError} onSubmit={(v) => void submitCompletion(v)} onCancel={() => !completeBusy && setCompleting(null)} />}

      {cancelling && (
        <Dialog
          title="Cancel this job?"
          description={`${cap(cancelling.service)} at ${cancelling.area}. The customer will be notified and the job may be reassigned. Frequent cancellations can affect your account.`}
          tone="danger"
          confirmLabel="Cancel job"
          busy={cancelBusy}
          onConfirm={() => void confirmCancel()}
          onCancel={() => !cancelBusy && setCancelling(null)}
        />
      )}
    </div>
  );
}











// 'use client';

// import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
// import { useRouter } from 'next/navigation';
// export const dynamic = 'force-dynamic';

// import {
//   LayoutDashboard,
//   Bell,
//   Briefcase,
//   IndianRupee,
//   Clock,
//   User,
//   FileText,
//   ArrowLeft,
//   CloudUpload,
//   Wifi,
//   WifiOff,
//   ChevronRight,
//   ChevronDown,
//   Star,
//   MapPin,
//   Calendar,
//   Zap,
//   TrendingUp,
//   Award,
//   Package,
//   CheckCircle,
//   XCircle,
//   Play,
//   Phone,
//   Edit3,
//   Save,
//   X,
//   AlertCircle,
//   Clock3,
//   Loader2,
// } from 'lucide-react';
// import { toast } from 'sonner';
// import { useAuth } from '@/hooks/useAuth';
// import type { ApiOrder } from '@/lib/api-client';
// import {
//   technicianJobsList,
//   technicianJobAccept,
//   technicianJobReject,
//   technicianJobUpdateStatus,
//   technicianAvailabilityUpdate,
//   getApiErrorMessage,
// } from '@/lib/api-client';
// import { DatabaseErrorBanner } from '@/components/ui/DatabaseErrorBanner';
// import { safeGet as lsGet, safeSet as lsSet } from '@/lib/storage';

// // ─── Types ──────────────────────────────────────────────────────────────────

// type TechnicianOnline = 'online' | 'offline';
// type VerificationStatus = 'unverified' | 'pending' | 'verified';
// type TechSkill = 'Plumbing' | 'RO Service' | 'Borewell' | 'Motor Repair' | 'Water Tanker' | 'Tank Cleaning Service';
// type TechAvailabilitySlot = 'morning' | 'afternoon' | 'evening';
// type TechDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
// type MyJobStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
// type TabKey = 'overview' | 'queue' | 'my_jobs' | 'earnings' | 'availability' | 'profile' | 'documents';

// const SKILLS: TechSkill[] = ['Plumbing', 'RO Service', 'Borewell', 'Motor Repair', 'Water Tanker', 'Tank Cleaning Service'];
// const DAYS: TechDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
// const SLOTS: TechAvailabilitySlot[] = ['morning', 'afternoon', 'evening'];
// const UP_CITIES = ['Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj', 'Agra', 'Meerut', 'Bareilly', 'Aligarh', 'Mathura', 'Delhi', 'Noida', 'Ghaziabad'] as const;

// type JobQueueItem = {
//   id: string;
//   service: string;
//   sub: string;
//   area: string;
//   date: string;
//   slot: string;
//   price: number;
//   distance: string;
//   expiresAt: number;
// };

// type MyJob = JobQueueItem & {
//   status: MyJobStatus;
//   acceptedAt: number;
//   startedAt?: number;
//   completedAt?: number;
//   rating?: number;
// };

// /** Map live API order → queue card (assigned / pending). */
// function orderToQueueItem(o: ApiOrder): JobQueueItem {
//   const snap = (o.address_snapshot ?? {}) as Record<string, unknown>;
//   return {
//     id: o.id,
//     service: String(o.service_type_key ?? 'service').replace(/_/g, ' '),
//     sub: String(o.sub_option_key ?? ''),
//     area: [snap.area, snap.city].filter(Boolean).join(', ') || '—',
//     date: String(o.scheduled_date ?? (typeof o.created_at === 'string' ? o.created_at.slice(0, 10) : '')),
//     slot: String(o.time_slot ?? '—'),
//     price: Number(o.total_amount ?? 0),
//     distance: '—',
//     expiresAt: Date.now() + 24 * 3600 * 1000,
//   };
// }

// /** Map API order → “my jobs” row with UI status. */
// function mapApiOrderToMyJob(o: ApiOrder): MyJob {
//   const base = orderToQueueItem(o);
//   const st = String(o.status ?? '').toUpperCase();
//   let status: MyJobStatus = 'upcoming';
//   if (st === 'IN_PROGRESS') status = 'in_progress';
//   else if (st === 'COMPLETED') status = 'completed';
//   else if (st === 'CANCELLED') status = 'cancelled';
//   else status = 'upcoming';

//   const acceptedAt = new Date(o.created_at).getTime();
//   const updatedAt = o.updated_at ? new Date(String(o.updated_at)).getTime() : acceptedAt;

//   return {
//     ...base,
//     status,
//     acceptedAt,
//     startedAt: st === 'IN_PROGRESS' ? updatedAt : undefined,
//     completedAt: st === 'COMPLETED' ? updatedAt : undefined,
//   };
// }

// type UploadMeta = {
//   name: string;
//   size: number;
//   status: 'uploaded' | 'submitted' | 'verified' | 'rejected';
// };

// type TechDocs = {
//   aadhaarFront?: UploadMeta;
//   aadhaarBack?: UploadMeta;
//   profilePhoto?: UploadMeta;
//   skillCert?: UploadMeta;
//   verificationStatus?: VerificationStatus;
//   submittedAt?: number;
// };

// type TechProfile = {
//   skills: TechSkill[];
//   serviceCities: string[];
//   bio: string;
//   upiId: string;
// };

// type PayoutRecord = {
//   id: string;
//   date: string;
//   jobs: number;
//   amount: number;
//   status: 'Paid' | 'Pending';
// };

// // ─── Storage Keys ────────────────────────────────────────────────────────────

// const KEYS = {
//   ONLINE: 'aurowater_tech_online',
//   VERIFICATION: 'aurowater_tech_verification_status',
//   JOB_QUEUE: 'aurowater_job_queue',
//   MY_JOBS: 'aurowater_tech_jobs',
//   AVAILABILITY: 'aurowater_tech_availability',
//   DOCS: 'aurowater_tech_documents',
//   PROFILE: 'aurowater_tech_profile',
//   PAYOUT: 'aurowater_tech_payout_history',
//   USER_PROFILE: 'aurowater_profile',
// } as const;

// function safeParse<T>(raw: string | null): T | null {
//   if (!raw) return null;
//   try { return JSON.parse(raw) as T; } catch { return null; }
// }

// // ─── Seed helpers ─────────────────────────────────────────────────────────────

// function seedAvailability(current: Record<string, boolean> | null): Record<string, boolean> {
//   if (current) return current;
//   const next: Record<string, boolean> = {};
//   for (const d of DAYS) for (const s of SLOTS) next[`${d}:${s}`] = ['mon', 'wed', 'fri'].includes(d) && s !== 'evening';
//   next['emergency'] = false;
//   return next;
// }

// function seedProfile(current: TechProfile | null): TechProfile {
//   return current ?? { skills: ['Plumbing', 'RO Service'], serviceCities: ['Kanpur', 'Lucknow'], bio: '', upiId: 'rahul.verma@upi' };
// }

// function seedPayouts(current: PayoutRecord[] | null): PayoutRecord[] {
//   if (current && current.length) return current;
//   const d = new Date().toLocaleDateString();
//   return [
//     { id: 'P-001', date: d, jobs: 6, amount: 4200, status: 'Paid' },
//     { id: 'P-002', date: d, jobs: 4, amount: 2900, status: 'Paid' },
//     { id: 'P-003', date: d, jobs: 2, amount: 650, status: 'Pending' },
//   ];
// }

// // ─── Util ─────────────────────────────────────────────────────────────────────

// function formatMoney(n: number) {
//   return `₹${Math.round(n).toLocaleString('en-IN')}`;
// }

// function fmtTimer(ms: number) {
//   const total = Math.max(0, Math.floor(ms / 1000));
//   const m = Math.floor(total / 60);
//   const s = total % 60;
//   return `${m}m ${s.toString().padStart(2, '0')}s`;
// }

// function requiredDocsUploaded(d: TechDocs) {
//   return Boolean(d.aadhaarFront && d.aadhaarBack && d.profilePhoto);
// }

// function uploadMetaFromFile(file: File): UploadMeta {
//   return { name: file.name, size: file.size, status: 'uploaded' };
// }

// const SERVICE_EMOJI: Record<string, string> = {
//   Plumbing: '🔧', 'RO Service': '💧', Borewell: '🕳️', 'Motor Repair': '⚙️', 'Water Tanker': '🚛', 'Tank Cleaning Service': '🪣',
// };

// // ─── Sub-components ──────────────────────────────────────────────────────────

// function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' }) {
//   const cls = {
//     default: 'bg-zinc-100 text-zinc-700 border-zinc-200',
//     success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
//     warning: 'bg-amber-50 text-amber-800 border-amber-200',
//     danger: 'bg-red-50 text-red-700 border-red-200',
//     info: 'bg-sky-50 text-sky-700 border-sky-200',
//     purple: 'bg-violet-50 text-violet-700 border-violet-200',
//   }[variant];
//   return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide ${cls}`}>{children}</span>;
// }

// function StatCard({ label, value, sub, icon: Icon, accent = false }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ size?: number; className?: string }>; accent?: boolean }) {
//   return (
//     <div className={`relative overflow-hidden rounded-2xl border p-5 ${accent ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-500 text-white' : 'bg-white border-zinc-100'}`}>
//       <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accent ? 'bg-white/20' : 'bg-emerald-50'}`}>
//         <Icon size={18} className={accent ? 'text-white' : 'text-emerald-600'} />
//       </div>
//       <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${accent ? 'text-emerald-100' : 'text-zinc-500'}`}>{label}</div>
//       <div className={`text-2xl font-black ${accent ? 'text-white' : 'text-zinc-900'}`}>{value}</div>
//       {sub && <div className={`text-xs mt-1 ${accent ? 'text-emerald-100' : 'text-zinc-400'}`}>{sub}</div>}
//       <div className={`absolute -right-3 -bottom-3 w-16 h-16 rounded-full opacity-10 ${accent ? 'bg-white' : 'bg-emerald-400'}`} />
//     </div>
//   );
// }

// function SidebarItem({ icon: Icon, label, active, badge, onClick }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; active?: boolean; badge?: number; onClick: () => void }) {
//   return (
//     <button type="button" onClick={onClick} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 text-left group ${active ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}>
//       <Icon size={16} className={active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-600'} />
//       <span className="flex-1 truncate">{label}</span>
//       {badge != null && badge > 0 && (
//         <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{badge}</span>
//       )}
//     </button>
//   );
// }

// function StatusToggle({ online, onChange }: { online: TechnicianOnline; onChange: (v: TechnicianOnline) => void }) {
//   return (
//     <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1">
//       <button onClick={() => onChange('online')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${online === 'online' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
//         <Wifi size={12} /> Online
//       </button>
//       <button onClick={() => onChange('offline')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${online === 'offline' ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
//         <WifiOff size={12} /> Offline
//       </button>
//     </div>
//   );
// }

// function UploadArea({ label, required, current, onPick, onRemove }: { label: string; required: boolean; current?: UploadMeta; onPick: (f: File) => void; onRemove: () => void }) {
//   const ref = useRef<HTMLInputElement | null>(null);
//   const badge = !current ? { text: 'Not uploaded', cls: 'default' as const } :
//     current.status === 'verified' ? { text: '✓ Verified', cls: 'success' as const } :
//     current.status === 'rejected' ? { text: '✗ Rejected', cls: 'danger' as const } :
//     current.status === 'submitted' ? { text: '↑ Under review', cls: 'info' as const } :
//     { text: '✓ Uploaded', cls: 'success' as const };

//   return (
//     <div className="rounded-2xl border border-zinc-100 bg-white p-4">
//       <div className="flex items-start justify-between gap-2 mb-3">
//         <div>
//           <p className="font-bold text-sm text-zinc-900">{label}</p>
//           <p className="text-[11px] text-zinc-400 mt-0.5">{required ? 'Required' : 'Optional'}</p>
//         </div>
//         <Badge variant={badge.cls}>{badge.text}</Badge>
//       </div>
//       <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onPick(f); if (ref.current) ref.current.value = ''; } }} />
//       <button type="button" onClick={() => ref.current?.click()} className="w-full rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 transition-colors p-4">
//         <div className="flex items-center gap-3">
//           <div className="w-9 h-9 rounded-lg bg-white border border-zinc-100 flex items-center justify-center shrink-0">
//             <CloudUpload size={16} className="text-emerald-600" />
//           </div>
//           <div className="text-left min-w-0">
//             <p className="text-sm font-semibold text-zinc-700">{current ? 'Replace file' : 'Upload file'}</p>
//             {current ? <p className="text-[11px] text-zinc-400 truncate mt-0.5">{current.name} · {(current.size / 1024).toFixed(1)} KB</p> : <p className="text-[11px] text-zinc-400 mt-0.5">JPG, PNG, PDF — max 5 MB</p>}
//           </div>
//         </div>
//       </button>
//       {current && (
//         <button type="button" onClick={onRemove} className="mt-2 w-full text-xs font-semibold text-red-500 hover:text-red-700 transition-colors py-1">
//           Remove
//         </button>
//       )}
//     </div>
//   );
// }

// // ─── Main Dashboard ───────────────────────────────────────────────────────────

// export default function TechnicianDashboardPage() {
//   const router = useRouter();
//   const { role: authRole, hydrated: authHydrated, isLoggedIn, session } = useAuth();

//   const [hydrated, setHydrated] = useState(false);
//   const [tab, setTab] = useState<TabKey>('overview');

//   const [online, setOnline] = useState<TechnicianOnline>('online');
//   const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('unverified');
//   const [jobQueue, setJobQueue] = useState<JobQueueItem[]>([]);
//   const [myJobs, setMyJobs] = useState<MyJob[]>([]);
//   const [docs, setDocs] = useState<TechDocs>({ verificationStatus: 'unverified' });
//   const [profile, setProfile] = useState<TechProfile>({ skills: ['Plumbing', 'RO Service'], serviceCities: ['Kanpur', 'Lucknow'], bio: '', upiId: '' });
//   const [availability, setAvailability] = useState<Record<string, boolean>>({});
//   const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
//   const [techName, setTechName] = useState('Technician');

//   const [tickerNow, setTickerNow] = useState(0);
//   const [upiEditing, setUpiEditing] = useState(false);
//   const [upiDraft, setUpiDraft] = useState('');
//   const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
//   const [myJobFilter, setMyJobFilter] = useState<'all' | MyJobStatus>('all');
//   const [jobsError, setJobsError] = useState<string | null>(null);
//   const [completionJobId, setCompletionJobId] = useState<string | null>(null);
//   const [completionOtp, setCompletionOtp] = useState('');
//   const [completionPaymentConfirmed, setCompletionPaymentConfirmed] = useState(false);
//   const [completionPaymentReference, setCompletionPaymentReference] = useState('');
//   const [completionBusy, setCompletionBusy] = useState(false);

//   const handleOnlineChange = useCallback(
//     async (next: TechnicianOnline) => {
//       const previous = online;
//       setOnline(next);

//       try {
//         let lat: number | null = null;
//         let lng: number | null = null;

//         if (next === 'online' && typeof navigator !== 'undefined' && navigator.geolocation) {
//           try {
//             const position = await new Promise<GeolocationPosition>((resolve, reject) =>
//               navigator.geolocation.getCurrentPosition(resolve, reject, {
//                 enableHighAccuracy: false,
//                 timeout: 8000,
//                 maximumAge: 300000,
//               }),
//             );
//             lat = position.coords.latitude;
//             lng = position.coords.longitude;
//           } catch (locationError) {
//             console.warn('[TechnicianDashboard] location unavailable:', locationError);
//           }
//         }

//         await technicianAvailabilityUpdate({
//           online: next === 'online',
//           lat,
//           lng,
//         });

//         toast.success(next === 'online' ? 'You are now available for nearby jobs.' : 'You are now offline.');
//       } catch (error) {
//         setOnline(previous);
//         toast.error(getApiErrorMessage(error) || 'Could not update availability.');
//       }
//     },
//     [online],
//   );

//   const fetchTechnicianJobs = useCallback(async () => {
//     setJobsError(null);
//     try {
//       const rows = await technicianJobsList();
//       const queueStatuses = ['ASSIGNED', 'PENDING'];
//       setJobQueue(rows.filter((o) => queueStatuses.includes(String(o.status ?? '').toUpperCase())).map(orderToQueueItem));
//       setMyJobs(
//         rows
//           .filter((o) => !queueStatuses.includes(String(o.status ?? '').toUpperCase()))
//           .map(mapApiOrderToMyJob)
//       );
//     } catch (e: unknown) {
//       setJobsError(getApiErrorMessage(e));
//       console.error('[TechnicianDashboard] jobs fetch failed:', e);
//     }
//   }, []);

//   // ── Hydrate from localStorage (client-only) — jobs come from API, not LS ──
//   useEffect(() => {
//     const savedOnline = lsGet(KEYS.ONLINE) as TechnicianOnline | null;
//     const savedVerif = lsGet(KEYS.VERIFICATION) as VerificationStatus | null;
//     const savedAvail = safeParse<Record<string, boolean>>(lsGet(KEYS.AVAILABILITY));
//     const savedDocs = safeParse<TechDocs>(lsGet(KEYS.DOCS));
//     const savedProfile = safeParse<TechProfile>(lsGet(KEYS.PROFILE));
//     const savedPayouts = safeParse<PayoutRecord[]>(lsGet(KEYS.PAYOUT));
//     const savedUserProfile = safeParse<{ name?: string }>(lsGet(KEYS.USER_PROFILE));

//     setOnline(savedOnline === 'offline' ? 'offline' : 'online');
//     setVerificationStatus(['verified', 'pending', 'unverified'].includes(savedVerif || '') ? (savedVerif as VerificationStatus) : 'unverified');
//     setJobQueue([]);
//     setMyJobs([]);
//     setAvailability(seedAvailability(savedAvail && typeof savedAvail === 'object' ? savedAvail : null));
//     setDocs(savedDocs ?? { verificationStatus: 'unverified' });
//     setProfile(seedProfile(savedProfile));
//     setPayouts(seedPayouts(Array.isArray(savedPayouts) ? savedPayouts : null));
//     setTechName(savedUserProfile?.name || 'Technician');
//     setTickerNow(Date.now());
//     setHydrated(true);
//   }, []);

//   useEffect(() => {
//     if (!hydrated || !authHydrated || !isLoggedIn || authRole !== 'technician') return;
//     void fetchTechnicianJobs();
//   }, [hydrated, authHydrated, isLoggedIn, authRole, fetchTechnicianJobs]);

//   useEffect(() => {
//     if (!session?.userId || typeof window === 'undefined') return;
//     let ch: ReturnType<ReturnType<typeof import('@/lib/db/supabase').supabaseBrowser>['channel']> | null = null;
//     void import('@/lib/db/supabase').then(({ supabaseBrowser }) => {
//       ch = supabaseBrowser()
//         .channel(`technician-jobs-${session.userId}`)
//         .on(
//           'postgres_changes',
//           {
//             event: '*',
//             schema: 'public',
//             table: 'orders',
//             filter: `technician_id=eq.${session.userId}`,
//           },
//           () => {
//             void fetchTechnicianJobs();
//           }
//         )
//         .subscribe();
//     });
//     return () => {
//       void ch?.unsubscribe();
//     };
//   }, [session?.userId, fetchTechnicianJobs]);

//   // ── Persist changes ──
//   useEffect(() => { if (hydrated) lsSet(KEYS.ONLINE, online); }, [online, hydrated]);
//   useEffect(() => { if (hydrated) lsSet(KEYS.VERIFICATION, verificationStatus); }, [verificationStatus, hydrated]);
//   useEffect(() => { if (hydrated) lsSet(KEYS.AVAILABILITY, JSON.stringify(availability)); }, [availability, hydrated]);
//   useEffect(() => { if (hydrated) lsSet(KEYS.DOCS, JSON.stringify(docs)); }, [docs, hydrated]);
//   useEffect(() => { if (hydrated) lsSet(KEYS.PROFILE, JSON.stringify(profile)); }, [profile, hydrated]);
//   useEffect(() => { if (hydrated) lsSet(KEYS.PAYOUT, JSON.stringify(payouts)); }, [payouts, hydrated]);

//   // ── Ticker ──
//   useEffect(() => {
//     const t = setInterval(() => setTickerNow(Date.now()), 1000);
//     return () => clearInterval(t);
//   }, []);

//   // ── Auto-expire queue ──
//   useEffect(() => {
//     if (!hydrated || !jobQueue.length || !tickerNow) return;
//     const expired = jobQueue.filter((j) => j.expiresAt <= tickerNow);
//     if (!expired.length) return;
//     setJobQueue((cur) => cur.filter((j) => j.expiresAt > tickerNow));
//     expired.forEach((j) => toast.error(`Job ${j.id} expired`));
//   }, [tickerNow, jobQueue, hydrated]);

//   // ── Greeting ──
//   const greeting = useMemo(() => {
//     if (typeof window === 'undefined') return 'Hello';
//     const h = new Date().getHours();
//     return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
//   }, []);

//   // ── Derived stats ──
//   const activeJob = useMemo(() => myJobs.find((j) => j.status === 'in_progress') || null, [myJobs]);

//   const stats = useMemo(() => {
//     const completed = myJobs.filter((j) => j.status === 'completed');
//     const rated = completed.filter((j) => typeof j.rating === 'number') as Array<MyJob & { rating: number }>;
//     const today = new Date();
//     const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
//     const monthKey = `${today.getFullYear()}-${today.getMonth()}`;

//     const todayCount = completed.filter((j) => {
//       if (!j.completedAt) return false;
//       const d = new Date(j.completedAt);
//       return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayKey;
//     }).length;

//     const monthEarnings = completed.reduce((sum, j) => {
//       if (!j.completedAt) return sum;
//       const d = new Date(j.completedAt);
//       return `${d.getFullYear()}-${d.getMonth()}` === monthKey ? sum + j.price : sum;
//     }, 0);

//     const totalEarnings = completed.reduce((s, j) => s + j.price, 0);
//     const avgRating = rated.length ? rated.reduce((s, j) => s + j.rating, 0) / rated.length : null;

//     return { todayCount, totalCompleted: completed.length, monthEarnings, totalEarnings, avgRating };
//   }, [myJobs]);

//   const earningsDaily = useMemo(() => {
//     const completed = myJobs.filter((j) => j.status === 'completed' && j.completedAt) as Array<MyJob & { completedAt: number }>;
//     const today = new Date();
//     return Array.from({ length: 7 }, (_, i) => {
//       const d = new Date(today);
//       d.setDate(today.getDate() - (6 - i));
//       const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
//       const sum = completed.filter((j) => { const dj = new Date(j.completedAt); return `${dj.getFullYear()}-${dj.getMonth()}-${dj.getDate()}` === key; }).reduce((s, j) => s + j.price, 0);
//       return sum;
//     });
//   }, [myJobs]);

//   const weeklyEarnings = useMemo(() => earningsDaily.reduce((s, v) => s + v, 0), [earningsDaily]);
//   const pendingBalance = useMemo(() => payouts.filter((p) => p.status === 'Pending').reduce((s, p) => s + p.amount, 0), [payouts]);

//   const visibleMyJobs = useMemo(() => {
//     const filtered = myJobFilter === 'all' ? myJobs : myJobs.filter((j) => j.status === myJobFilter);
//     return [...filtered].sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));
//   }, [myJobs, myJobFilter]);

//   // ── Actions ──
//   const acceptJob = useCallback(
//     async (job: JobQueueItem) => {
//       try {
//         await technicianJobAccept(job.id);
//         toast.success('Job accepted — you are on the way.');
//         await fetchTechnicianJobs();
//       } catch {
//         toast.error('Failed to accept job.');
//       }
//     },
//     [fetchTechnicianJobs]
//   );

//   const declineJob = useCallback(
//     async (job: JobQueueItem) => {
//       try {
//         const result = await technicianJobReject(job.id);
//         toast.success(result.reassigned ? 'Job declined. Finding the next technician.' : 'Job declined safely.');
//         await fetchTechnicianJobs();
//       } catch (error) {
//         toast.error(getApiErrorMessage(error) || 'Failed to decline job.');
//       }
//     },
//     [fetchTechnicianJobs],
//   );

//   const startJob = useCallback(
//     async (id: string) => {
//       try {
//         await technicianJobUpdateStatus(id, 'IN_PROGRESS');
//         toast.success('Status updated.');
//         await fetchTechnicianJobs();
//       } catch {
//         toast.error('Failed to update status.');
//       }
//     },
//     [fetchTechnicianJobs]
//   );

//   const openCompletion = useCallback((id: string) => {
//     setCompletionJobId(id);
//     setCompletionOtp('');
//     setCompletionPaymentConfirmed(false);
//     setCompletionPaymentReference('');
//   }, []);

//   const completeJob = useCallback(async () => {
//     if (!completionJobId || completionBusy) return;
//     if (!/^\d{6}$/.test(completionOtp.trim())) {
//       toast.error('Enter the 6-digit customer service code.');
//       return;
//     }

//     setCompletionBusy(true);
//     try {
//       await technicianJobUpdateStatus(completionJobId, 'COMPLETED', {
//         payment_confirmed: completionPaymentConfirmed,
//         payment_reference: completionPaymentReference.trim() || undefined,
//       });
//       toast.success('Job completed! Great work.');
//       setCompletionJobId(null);
//       await fetchTechnicianJobs();
//     } catch (error) {
//       toast.error(getApiErrorMessage(error) || 'Failed to complete job.');
//     } finally {
//       setCompletionBusy(false);
//     }
//   }, [
//     completionJobId,
//     completionBusy,
//     completionOtp,
//     completionPaymentConfirmed,
//     completionPaymentReference,
//     fetchTechnicianJobs,
//   ]);

//   const cancelJob = useCallback(
//     async (id: string) => {
//       try {
//         await technicianJobUpdateStatus(id, 'CANCELLED');
//         toast.error('Job cancelled');
//         await fetchTechnicianJobs();
//       } catch {
//         toast.error('Failed to cancel.');
//       }
//     },
//     [fetchTechnicianJobs]
//   );

//   const receiveRating = useCallback((_id: string) => {
//     toast.info('Ratings are recorded after the customer submits a review.');
//   }, []);

//   const requestPayout = useCallback(() => {
//     toast.error('Payout requests are not connected to a verified technician payout API yet. No request was submitted.');
//   }, []);

//   const submitForVerification = useCallback(() => {
//     if (!requiredDocsUploaded(docs)) { toast.error('Upload all required documents first'); return; }
//     setDocs((cur) => ({
//       ...cur,
//       aadhaarFront: cur.aadhaarFront ? { ...cur.aadhaarFront, status: 'submitted' } : cur.aadhaarFront,
//       aadhaarBack: cur.aadhaarBack ? { ...cur.aadhaarBack, status: 'submitted' } : cur.aadhaarBack,
//       profilePhoto: cur.profilePhoto ? { ...cur.profilePhoto, status: 'submitted' } : cur.profilePhoto,
//       skillCert: cur.skillCert?.status === 'uploaded' ? { ...cur.skillCert, status: 'submitted' } : cur.skillCert,
//       verificationStatus: 'pending',
//       submittedAt: Date.now(),
//     }));
//     setVerificationStatus('pending');
//     toast.success("Documents submitted! Review within 48 hours.");
//   }, [docs]);

//   // ── Auth gate ──
//   if (!authHydrated) return (
//     <div className="min-h-screen flex items-center justify-center bg-zinc-50">
//       <Loader2 size={24} className="text-emerald-600 animate-spin" />
//     </div>
//   );

//   if (!isLoggedIn || authRole !== 'technician') return (
//     <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
//       <div className="max-w-sm w-full bg-white rounded-2xl border border-zinc-100 shadow-sm p-8 text-center">
//         <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
//           <AlertCircle size={24} className="text-emerald-600" />
//         </div>
//         <h2 className="text-xl font-black text-zinc-900">Technician Access</h2>
//         <p className="text-sm text-zinc-500 mt-2">Sign in as a Technician to view this dashboard.</p>
//         <button onClick={() => router.push('/auth/login')} className="mt-6 w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors">
//           Go to Sign In
//         </button>
//       </div>
//     </div>
//   );

//   const verBanner = verificationStatus === 'verified'
//     ? { bg: 'bg-emerald-600', text: '✅ Verified AuroWater Technician — you can accept jobs', cta: null as null | string }
//     : verificationStatus === 'pending'
//     ? { bg: 'bg-sky-600', text: '🕐 ID under review — usually 1–2 business days', cta: null }
//     : { bg: 'bg-amber-500', text: '⚠️ Complete profile & upload ID to start accepting jobs', cta: 'Upload Documents' };

//   return (
//     <div className="min-h-screen bg-zinc-50 font-sans">
//       <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
//         {jobsError && (
//           <div className="mb-6 space-y-2">
//             <DatabaseErrorBanner message={jobsError} />
//             <div className="flex justify-end">
//               <button
//                 type="button"
//                 onClick={() => void fetchTechnicianJobs()}
//                 className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
//               >
//                 Retry
//               </button>
//             </div>
//           </div>
//         )}
//         <div className="flex gap-6">

//           {/* ── Sidebar ── */}
//           <aside className="hidden lg:flex flex-col w-56 shrink-0">
//             <div className="sticky top-6 rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden">
//               {/* Brand / User */}
//               <div className="p-4 border-b border-zinc-50">
//                 <div className="flex items-center gap-3">
//                   <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-black flex items-center justify-center shrink-0">
//                     {techName.charAt(0).toUpperCase()}
//                   </div>
//                   <div className="min-w-0">
//                     <p className="text-xs font-bold text-zinc-900 truncate">{techName}</p>
//                     <div className="flex items-center gap-1 mt-0.5">
//                       <div className={`w-1.5 h-1.5 rounded-full ${online === 'online' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
//                       <span className="text-[10px] text-zinc-400 capitalize">{online}</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {/* Nav */}
//               <nav className="p-2 space-y-0.5">
//                 <SidebarItem icon={LayoutDashboard} label="Overview" active={tab === 'overview'} onClick={() => setTab('overview')} />
//                 <SidebarItem icon={Bell} label="Job Queue" active={tab === 'queue'} badge={jobQueue.length} onClick={() => setTab('queue')} />
//                 <SidebarItem icon={Briefcase} label="My Jobs" active={tab === 'my_jobs'} badge={myJobs.filter(j => j.status === 'in_progress').length || undefined} onClick={() => setTab('my_jobs')} />
//                 <SidebarItem icon={IndianRupee} label="Earnings" active={tab === 'earnings'} onClick={() => setTab('earnings')} />
//                 <SidebarItem icon={Clock} label="Availability" active={tab === 'availability'} onClick={() => setTab('availability')} />
//                 <SidebarItem icon={User} label="Profile" active={tab === 'profile'} onClick={() => setTab('profile')} />
//                 <SidebarItem icon={FileText} label="Documents" active={tab === 'documents'} onClick={() => setTab('documents')} />
//               </nav>

//               <div className="p-2 border-t border-zinc-50 mt-1">
//                 <button onClick={() => router.push('/')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors">
//                   <ArrowLeft size={14} /> Back to Site
//                 </button>
//               </div>
//             </div>
//           </aside>

//           {/* ── Mobile Tab Bar ── */}
//           <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-100 flex">
//             {([
//               { key: 'overview', icon: LayoutDashboard },
//               { key: 'queue', icon: Bell },
//               { key: 'my_jobs', icon: Briefcase },
//               { key: 'earnings', icon: IndianRupee },
//               { key: 'profile', icon: User },
//             ] as { key: TabKey; icon: React.ComponentType<{ size?: number; className?: string }> }[]).map(({ key, icon: Icon }) => (
//               <button key={key} onClick={() => setTab(key)} className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors ${tab === key ? 'text-emerald-600' : 'text-zinc-400'}`}>
//                 <Icon size={18} />
//                 {key.replace('_', ' ')}
//               </button>
//             ))}
//           </div>

//           {/* ── Main Content ── */}
//           <main className="flex-1 min-w-0 pb-20 lg:pb-0">

//             {/* ────── OVERVIEW ────── */}
//             {tab === 'overview' && (
//               <div className="space-y-5">
//                 {/* Header */}
//                 <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
//                   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//                     <div>
//                       <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{greeting}</p>
//                       <h1 className="text-2xl font-black text-zinc-900 mt-0.5">{techName}</h1>
//                       <p className="text-sm text-zinc-500 mt-1">Here's your performance at a glance</p>
//                     </div>
//                     <StatusToggle online={online} onChange={handleOnlineChange} />
//                   </div>
//                 </div>

//                 {/* Verification Banner */}
//                 <div className={`${verBanner.bg} rounded-2xl p-4 text-white`}>
//                   <div className="flex items-center justify-between gap-4">
//                     <p className="text-sm font-semibold">{verBanner.text}</p>
//                     {verBanner.cta && (
//                       <button onClick={() => setTab('documents')} className="shrink-0 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
//                         {verBanner.cta}
//                       </button>
//                     )}
//                   </div>
//                 </div>

//                 {/* Stats Grid */}
//                 <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
//                   <StatCard label="Jobs Today" value={String(stats.todayCount)} icon={Briefcase} />
//                   <StatCard label="Total Completed" value={String(stats.totalCompleted)} icon={CheckCircle} />
//                   <StatCard label="Avg Rating" value={stats.avgRating ? `${stats.avgRating.toFixed(1)}★` : '—'} icon={Star} />
//                   <StatCard label="This Month" value={formatMoney(stats.monthEarnings)} icon={IndianRupee} accent />
//                 </div>

//                 {/* Active Job + Queue Preview */}
//                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
//                   <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
//                     <div className="flex items-center justify-between mb-4">
//                       <h2 className="text-sm font-bold text-zinc-700">Active Job</h2>
//                       {activeJob && <Badge variant="purple">In Progress</Badge>}
//                     </div>
//                     {activeJob ? (
//                       <div>
//                         <div className="flex items-center gap-3 mb-3">
//                           <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-xl">{SERVICE_EMOJI[activeJob.service] || '🔧'}</div>
//                           <div>
//                             <p className="font-bold text-zinc-900">{activeJob.service}</p>
//                             <p className="text-xs text-zinc-500">{activeJob.sub} · {activeJob.area}</p>
//                           </div>
//                         </div>
//                         <button onClick={() => openCompletion(activeJob.id)} className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm">
//                           Mark as Completed ✓
//                         </button>
//                       </div>
//                     ) : (
//                       <div className="text-center py-4">
//                         <p className="text-3xl mb-2">📭</p>
//                         <p className="text-sm font-semibold text-zinc-700">No active job</p>
//                         <p className="text-xs text-zinc-400 mt-1">Accept a job from the queue</p>
//                         <button onClick={() => setTab('queue')} className="mt-3 text-xs font-bold text-emerald-600 hover:underline">Open Job Queue →</button>
//                       </div>
//                     )}
//                   </div>

//                   <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
//                     <div className="flex items-center justify-between mb-4">
//                       <h2 className="text-sm font-bold text-zinc-700">Queue Preview</h2>
//                       <button onClick={() => setTab('queue')} className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">View all <ChevronRight size={12} /></button>
//                     </div>
//                     {jobQueue.length === 0 ? (
//                       <div className="text-center py-4">
//                         <p className="text-3xl mb-2">🌿</p>
//                         <p className="text-sm font-semibold text-zinc-700">Queue is clear</p>
//                         <p className="text-xs text-zinc-400 mt-1">New jobs will appear here</p>
//                       </div>
//                     ) : (
//                       <div className="space-y-2">
//                         {jobQueue.slice(0, 3).map((j) => {
//                           const rem = j.expiresAt - tickerNow;
//                           return (
//                             <div key={j.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
//                               <div className="text-lg shrink-0">{SERVICE_EMOJI[j.service] || '🔧'}</div>
//                               <div className="flex-1 min-w-0">
//                                 <p className="text-xs font-bold text-zinc-800 truncate">{j.service} · {j.sub}</p>
//                                 <p className="text-[10px] text-zinc-400 truncate">{j.area}</p>
//                               </div>
//                               <div className="shrink-0 text-right">
//                                 <p className="text-xs font-black text-emerald-600">{formatMoney(j.price)}</p>
//                                 <p className={`text-[10px] font-semibold ${rem < 5 * 60 * 1000 ? 'text-red-500' : 'text-zinc-400'}`}>{hydrated ? fmtTimer(rem) : '—'}</p>
//                               </div>
//                             </div>
//                           );
//                         })}
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* ────── JOB QUEUE ────── */}
//             {tab === 'queue' && (
//               <div className="space-y-5">
//                 <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
//                   <div className="flex items-start justify-between gap-4">
//                     <div>
//                       <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Job Queue</p>
//                       <h1 className="text-xl font-black text-zinc-900 mt-0.5">Available Jobs</h1>
//                       <p className="text-sm text-zinc-500 mt-1">Accept before the timer ends — expired jobs are removed.</p>
//                     </div>
//                     <div className="flex items-center gap-2 shrink-0">
//                       <Badge variant={jobQueue.length > 0 ? 'success' : 'default'}>{jobQueue.length} in queue</Badge>
//                       <StatusToggle online={online} onChange={setOnline} />
//                     </div>
//                   </div>
//                 </div>

//                 {jobQueue.length === 0 ? (
//                   <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-12 text-center">
//                     <p className="text-5xl mb-4">📭</p>
//                     <p className="font-bold text-zinc-900">No jobs right now</p>
//                     <p className="text-sm text-zinc-500 mt-1">Turn Online to start receiving job requests.</p>
//                   </div>
//                 ) : (
//                   <div className="space-y-4">
//                     {jobQueue.map((j) => {
//                       const rem = j.expiresAt - tickerNow;
//                       const isUrgent = rem < 5 * 60 * 1000;
//                       const canAccept = verificationStatus === 'verified' && online === 'online';
//                       return (
//                         <div key={j.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isUrgent ? 'border-red-200' : 'border-zinc-100'}`}>
//                           {isUrgent && <div className="h-1 bg-gradient-to-r from-red-500 to-orange-400" />}
//                           <div className="p-5">
//                             <div className="flex flex-col lg:flex-row lg:items-start gap-5">
//                               {/* Left: job details */}
//                               <div className="flex-1">
//                                 <div className="flex items-center gap-3 mb-4">
//                                   <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-2xl shrink-0">
//                                     {SERVICE_EMOJI[j.service] || '🔧'}
//                                   </div>
//                                   <div>
//                                     <div className="flex items-center gap-2">
//                                       <p className="font-black text-zinc-900">{j.service}</p>
//                                       <Badge variant="default">{j.id}</Badge>
//                                     </div>
//                                     <p className="text-sm text-zinc-500 mt-0.5">{j.sub}</p>
//                                   </div>
//                                 </div>
//                                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
//                                   <div className="bg-zinc-50 rounded-xl p-3">
//                                     <div className="flex items-center gap-1.5 mb-1"><MapPin size={11} className="text-zinc-400" /><p className="text-[10px] font-semibold text-zinc-400 uppercase">Area</p></div>
//                                     <p className="text-xs font-bold text-zinc-800 leading-tight">{j.area}</p>
//                                   </div>
//                                   <div className="bg-zinc-50 rounded-xl p-3">
//                                     <div className="flex items-center gap-1.5 mb-1"><Calendar size={11} className="text-zinc-400" /><p className="text-[10px] font-semibold text-zinc-400 uppercase">Schedule</p></div>
//                                     <p className="text-xs font-bold text-zinc-800">{j.date} · {j.slot}</p>
//                                   </div>
//                                   <div className="bg-zinc-50 rounded-xl p-3">
//                                     <div className="flex items-center gap-1.5 mb-1"><MapPin size={11} className="text-zinc-400" /><p className="text-[10px] font-semibold text-zinc-400 uppercase">Distance</p></div>
//                                     <p className="text-xs font-bold text-zinc-800">{j.distance}</p>
//                                   </div>
//                                   <div className="bg-emerald-50 rounded-xl p-3">
//                                     <div className="flex items-center gap-1.5 mb-1"><IndianRupee size={11} className="text-emerald-600" /><p className="text-[10px] font-semibold text-emerald-600 uppercase">Payout</p></div>
//                                     <p className="text-sm font-black text-emerald-700">{formatMoney(j.price)}</p>
//                                   </div>
//                                 </div>
//                               </div>

//                               {/* Right: timer + actions */}
//                               <div className="lg:w-52 shrink-0">
//                                 <div className={`rounded-xl p-3 mb-4 text-center ${isUrgent ? 'bg-red-50 border border-red-200' : 'bg-zinc-50 border border-zinc-100'}`}>
//                                   <p className={`text-[10px] font-semibold uppercase tracking-wider ${isUrgent ? 'text-red-500' : 'text-zinc-400'}`}>Expires in</p>
//                                   <p className={`text-2xl font-black tabular-nums mt-0.5 ${isUrgent ? 'text-red-600' : 'text-zinc-800'}`}>{hydrated ? fmtTimer(rem) : '—'}</p>
//                                 </div>
//                                 <div className="flex gap-2">
//                                   <button onClick={() => acceptJob(j)} disabled={!canAccept} title={!canAccept ? (verificationStatus !== 'verified' ? 'Get verified first' : 'Go online first') : ''} className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
//                                     Accept
//                                   </button>
//                                   <button onClick={() => declineJob(j)} className="flex-1 border border-red-200 text-red-600 font-bold py-2.5 rounded-xl hover:bg-red-50 transition-colors text-sm">
//                                     Decline
//                                   </button>
//                                 </div>
//                                 {!canAccept && (
//                                   <p className="text-[10px] text-zinc-400 text-center mt-2">
//                                     {verificationStatus !== 'verified' ? 'Verify your account to accept' : 'Set status to Online'}
//                                   </p>
//                                 )}
//                               </div>
//                             </div>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* ────── MY JOBS ────── */}
//             {tab === 'my_jobs' && (
//               <div className="space-y-5">
//                 <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
//                   <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">My Jobs</p>
//                   <h1 className="text-xl font-black text-zinc-900 mt-0.5">Track & manage your jobs</h1>
//                 </div>

//                 <div className="flex flex-wrap gap-2">
//                   {(['all', 'upcoming', 'in_progress', 'completed', 'cancelled'] as const).map((f) => (
//                     <button key={f} onClick={() => setMyJobFilter(f)} className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-all capitalize ${myJobFilter === f ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
//                       {f.replace('_', ' ')}
//                       {f !== 'all' && ` (${myJobs.filter(j => j.status === f).length})`}
//                     </button>
//                   ))}
//                 </div>

//                 {visibleMyJobs.length === 0 ? (
//                   <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-12 text-center">
//                     <p className="text-5xl mb-4">📅</p>
//                     <p className="font-bold text-zinc-900">No jobs here yet</p>
//                     <p className="text-sm text-zinc-500 mt-1">Accept jobs from the queue to see them here.</p>
//                     <button onClick={() => setTab('queue')} className="mt-4 bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm">
//                       Open Job Queue
//                     </button>
//                   </div>
//                 ) : (
//                   <div className="space-y-3">
//                     {visibleMyJobs.map((j) => {
//                       const expanded = expandedJobId === j.id;
//                       const statusColors: Record<MyJobStatus, string> = {
//                         upcoming: 'info',
//                         in_progress: 'purple',
//                         completed: 'success',
//                         cancelled: 'danger',
//                       };
//                       return (
//                         <div key={j.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
//                           <button type="button" onClick={() => setExpandedJobId(expanded ? null : j.id)} className="w-full p-4 flex items-start gap-4 text-left hover:bg-zinc-50/50 transition-colors">
//                             <div className="w-11 h-11 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-xl shrink-0">
//                               {SERVICE_EMOJI[j.service] || '🔧'}
//                             </div>
//                             <div className="flex-1 min-w-0">
//                               <div className="flex items-center gap-2 flex-wrap">
//                                 <p className="font-bold text-zinc-900">{j.service}</p>
//                                 <Badge variant={statusColors[j.status] as any}>{j.status.replace('_', ' ')}</Badge>
//                                 {j.status === 'completed' && typeof j.rating === 'number' && <Badge variant="warning">{'★'.repeat(j.rating)}</Badge>}
//                               </div>
//                               <p className="text-xs text-zinc-500 mt-0.5 truncate">{j.sub} · {j.area}</p>
//                               <p className="text-[10px] text-zinc-400 mt-1">{j.date} · {j.slot}</p>
//                             </div>
//                             <div className="shrink-0 text-right">
//                               <p className="font-black text-emerald-600">{formatMoney(j.price)}</p>
//                               <ChevronDown size={14} className={`ml-auto mt-1 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
//                             </div>
//                           </button>

//                           {expanded && (
//                             <div className="px-4 pb-4 border-t border-zinc-50">
//                               <div className="grid grid-cols-3 gap-3 mt-3 mb-4">
//                                 <div className="bg-zinc-50 rounded-xl p-3">
//                                   <p className="text-[10px] font-semibold text-zinc-400 uppercase">Job ID</p>
//                                   <p className="text-xs font-bold text-zinc-800 mt-1">{j.id}</p>
//                                 </div>
//                                 <div className="bg-zinc-50 rounded-xl p-3">
//                                   <p className="text-[10px] font-semibold text-zinc-400 uppercase">Accepted</p>
//                                   <p className="text-xs font-bold text-zinc-800 mt-1">{new Date(j.acceptedAt).toLocaleDateString()}</p>
//                                 </div>
//                                 <div className="bg-zinc-50 rounded-xl p-3">
//                                   <p className="text-[10px] font-semibold text-zinc-400 uppercase">City</p>
//                                   <p className="text-xs font-bold text-zinc-800 mt-1">{profile?.serviceCities?.[0] || '—'}</p>
//                                 </div>
//                               </div>
//                               <div className="flex flex-wrap gap-2">
//                                 {j.status === 'upcoming' && <button onClick={() => startJob(j.id)} className="flex items-center gap-1.5 bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors text-sm"><Play size={13} />Start Job</button>}
//                                 {j.status === 'in_progress' && <button onClick={() => openCompletion(j.id)} className="flex items-center gap-1.5 bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors text-sm"><CheckCircle size={13} />Complete</button>}
//                                 {j.status === 'completed' && !j.rating && <button onClick={() => receiveRating(j.id)} className="flex items-center gap-1.5 border border-zinc-200 text-zinc-700 font-bold px-4 py-2 rounded-xl hover:bg-zinc-50 transition-colors text-sm"><Star size={13} />Get Rating</button>}
//                                 {j.status !== 'completed' && j.status !== 'cancelled' && <button onClick={() => cancelJob(j.id)} className="flex items-center gap-1.5 border border-red-200 text-red-600 font-bold px-4 py-2 rounded-xl hover:bg-red-50 transition-colors text-sm"><XCircle size={13} />Cancel</button>}
//                                 <button onClick={() => toast.success('Support request sent')} className="flex items-center gap-1.5 border border-zinc-200 text-zinc-600 font-bold px-4 py-2 rounded-xl hover:bg-zinc-50 transition-colors text-sm"><Phone size={13} />Support</button>
//                               </div>
//                             </div>
//                           )}
//                         </div>
//                       );
//                     })}
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* ────── EARNINGS ────── */}
//             {tab === 'earnings' && (
//               <div className="space-y-5">
//                 <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
//                   <div>
//                     <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Earnings</p>
//                     <h1 className="text-xl font-black text-zinc-900 mt-0.5">Track revenue & payouts</h1>
//                     <p className="text-sm text-zinc-500 mt-1">UPI: <span className="font-bold text-zinc-700">{profile?.upiId || 'Not set'}</span></p>
//                   </div>
//                   <button onClick={requestPayout} disabled={pendingBalance < 500} className="flex items-center gap-2 bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm shrink-0">
//                     <IndianRupee size={14} /> Request Payout {pendingBalance >= 500 ? `(${formatMoney(pendingBalance)})` : ''}
//                   </button>
//                 </div>

//                 <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
//                   <StatCard label="Today" value={formatMoney(earningsDaily[6] || 0)} icon={TrendingUp} />
//                   <StatCard label="This Week" value={formatMoney(weeklyEarnings)} icon={Calendar} />
//                   <StatCard label="This Month" value={formatMoney(stats.monthEarnings)} icon={Package} />
//                   <StatCard label="All Time" value={formatMoney(stats.totalEarnings)} icon={Award} accent />
//                 </div>

//                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
//                   {/* Bar Chart */}
//                   <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
//                     <div className="flex items-center justify-between mb-5">
//                       <h2 className="font-bold text-zinc-900">Last 7 Days</h2>
//                       <p className="text-xs text-zinc-400">{formatMoney(weeklyEarnings)} total</p>
//                     </div>
//                     <div className="flex items-end gap-2 h-40">
//                       {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => {
//                         const val = earningsDaily[i] ?? 0;
//                         const max = Math.max(1, ...earningsDaily);
//                         const pct = Math.round((val / max) * 100);
//                         const isToday = i === 6;
//                         return (
//                           <div key={d} className="flex-1 flex flex-col items-center gap-1 group">
//                             <p className="text-[10px] font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">₹{val}</p>
//                             <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.max(4, pct)}%`, background: isToday ? 'linear-gradient(to top, #059669, #34d399)' : '#e4e4e7' }} />
//                             <p className={`text-[10px] font-bold ${isToday ? 'text-emerald-600' : 'text-zinc-400'}`}>{d}</p>
//                           </div>
//                         );
//                       })}
//                     </div>
//                   </div>

//                   {/* UPI + Pending */}
//                   <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
//                     <h2 className="font-bold text-zinc-900 mb-4">Payout Settings</h2>
//                     {!upiEditing ? (
//                       <div className="flex items-center gap-2">
//                         <div className="flex-1 bg-zinc-50 rounded-xl px-3 py-2.5 text-sm text-zinc-700 font-medium truncate">{profile?.upiId || 'No UPI set'}</div>
//                         <button onClick={() => { setUpiEditing(true); setUpiDraft(profile?.upiId || ''); }} className="p-2.5 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors">
//                           <Edit3 size={14} className="text-zinc-500" />
//                         </button>
//                       </div>
//                     ) : (
//                       <div className="space-y-2">
//                         <input value={upiDraft} onChange={(e) => setUpiDraft(e.target.value)} placeholder="name@upi" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
//                         <div className="flex gap-2">
//                           <button onClick={() => { setProfile((c) => c ? { ...c, upiId: upiDraft.trim() } : c); setUpiEditing(false); toast.success('UPI updated'); }} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs"><Save size={12} />Save</button>
//                           <button onClick={() => setUpiEditing(false)} className="p-2 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors"><X size={14} className="text-zinc-500" /></button>
//                         </div>
//                       </div>
//                     )}

//                     <div className="mt-5 p-4 bg-amber-50 rounded-xl border border-amber-100">
//                       <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pending Balance</p>
//                       <p className="text-2xl font-black text-amber-800 mt-1">{formatMoney(pendingBalance)}</p>
//                       <p className="text-[11px] text-amber-600 mt-1">{pendingBalance < 500 ? `₹${500 - pendingBalance} more to request` : 'Ready to withdraw'}</p>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Payout History */}
//                 <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
//                   <h2 className="font-bold text-zinc-900 mb-4">Payout History</h2>
//                   <div className="overflow-x-auto">
//                     <table className="w-full text-sm">
//                       <thead>
//                         <tr className="text-left border-b border-zinc-100">
//                           <th className="pb-3 text-[11px] font-bold text-zinc-400 uppercase">Date</th>
//                           <th className="pb-3 text-[11px] font-bold text-zinc-400 uppercase">Jobs</th>
//                           <th className="pb-3 text-[11px] font-bold text-zinc-400 uppercase">Amount</th>
//                           <th className="pb-3 text-[11px] font-bold text-zinc-400 uppercase">Status</th>
//                         </tr>
//                       </thead>
//                       <tbody>
//                         {payouts.length === 0 ? (
//                           <tr><td colSpan={4} className="py-6 text-center text-sm text-zinc-400">No payout records yet</td></tr>
//                         ) : payouts.slice(0, 10).map((p) => (
//                           <tr key={p.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
//                             <td className="py-3 text-zinc-600">{p.date}</td>
//                             <td className="py-3 font-semibold text-zinc-800">{p.jobs}</td>
//                             <td className="py-3 font-bold text-emerald-600">{formatMoney(p.amount)}</td>
//                             <td className="py-3"><Badge variant={p.status === 'Paid' ? 'success' : 'warning'}>{p.status}</Badge></td>
//                           </tr>
//                         ))}
//                       </tbody>
//                     </table>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* ────── AVAILABILITY ────── */}
//             {tab === 'availability' && (
//               <div className="space-y-5">
//                 <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
//                   <div>
//                     <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Availability</p>
//                     <h1 className="text-xl font-black text-zinc-900 mt-0.5">Set your schedule</h1>
//                     <p className="text-sm text-zinc-500 mt-1">Choose when you're available — affects which bookings you'll receive.</p>
//                   </div>
//                   <button onClick={() => toast.success('Availability saved!')} className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm shrink-0">
//                     Save Schedule
//                   </button>
//                 </div>

//                 <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 overflow-x-auto">
//                   <div className="min-w-[640px]">
//                     {/* Header */}
//                     <div className="grid grid-cols-8 gap-2 mb-3">
//                       <div />
//                       {DAYS.map((d) => (
//                         <div key={d} className="text-center text-[11px] font-bold text-zinc-500 uppercase">{d}</div>
//                       ))}
//                     </div>
//                     {/* Rows */}
//                     {SLOTS.map((s) => {
//                       const labels = { morning: 'Morning  8–12', afternoon: 'Afternoon  12–5', evening: 'Evening  5–8' };
//                       return (
//                         <div key={s} className="grid grid-cols-8 gap-2 mb-2">
//                           <div className="flex items-center">
//                             <span className="text-xs font-semibold text-zinc-500 whitespace-nowrap">{labels[s]}</span>
//                           </div>
//                           {DAYS.map((d) => {
//                             const key = `${d}:${s}`;
//                             const on = Boolean(availability[key]);
//                             return (
//                               <button key={key} type="button" onClick={() => setAvailability((c) => ({ ...c, [key]: !on }))} className={`h-10 rounded-xl text-xs font-bold transition-all ${on ? 'bg-emerald-600 text-white shadow-sm' : 'bg-zinc-50 border border-zinc-100 text-zinc-400 hover:border-zinc-200'}`}>
//                                 {on ? '✓' : '–'}
//                               </button>
//                             );
//                           })}
//                         </div>
//                       );
//                     })}
//                   </div>
//                 </div>

//                 {/* Emergency toggle */}
//                 <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 flex items-center justify-between gap-4">
//                   <div>
//                     <div className="flex items-center gap-2">
//                       <Zap size={16} className="text-amber-500" />
//                       <p className="font-bold text-zinc-900">Emergency Jobs</p>
//                     </div>
//                     <p className="text-xs text-zinc-500 mt-1">Accept urgent requests · extra ₹199 surcharge applies</p>
//                   </div>
//                   <button onClick={() => setAvailability((c) => ({ ...c, emergency: !c.emergency }))} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${availability.emergency ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
//                     {availability.emergency ? 'Enabled' : 'Disabled'}
//                   </button>
//                 </div>
//               </div>
//             )}

//             {/* ────── PROFILE ────── */}
//             {tab === 'profile' && (
//               <div className="space-y-5">
//                 <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
//                   <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Profile</p>
//                   <h1 className="text-xl font-black text-zinc-900 mt-0.5">Skills & service coverage</h1>
//                 </div>

//                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
//                   {/* Skills */}
//                   <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
//                     <h2 className="font-bold text-zinc-900 mb-3">Skills</h2>
//                     <div className="flex flex-wrap gap-2">
//                       {SKILLS.map((s) => {
//                         const active = profile?.skills?.includes(s);
//                         return (
//                           <button key={s} type="button" onClick={() => setProfile((c) => c ? { ...c, skills: c.skills.includes(s) ? c.skills.filter(x => x !== s) : [...c.skills, s] } : c)} className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${active ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
//                             {s}
//                           </button>
//                         );
//                       })}
//                     </div>

//                     <h2 className="font-bold text-zinc-900 mb-3 mt-6">Service Cities</h2>
//                     <div className="flex flex-wrap gap-2">
//                       {UP_CITIES.map((c) => {
//                         const active = profile?.serviceCities?.includes(c);
//                         return (
//                           <button key={c} type="button" onClick={() => setProfile((p) => p ? { ...p, serviceCities: p.serviceCities.includes(c) ? p.serviceCities.filter(x => x !== c) : [...p.serviceCities, c] } : p)} className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${active ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
//                             {c}
//                           </button>
//                         );
//                       })}
//                     </div>
//                   </div>

//                   {/* Bio + Completeness */}
//                   <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
//                     <h2 className="font-bold text-zinc-900 mb-3">Bio</h2>
//                     <textarea value={profile?.bio || ''} onChange={(e) => setProfile((c) => c ? { ...c, bio: e.target.value.slice(0, 200) } : c)} rows={5} placeholder="Tell customers what you specialize in and how you work…" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
//                     <p className="text-[11px] text-zinc-400 mt-1 text-right">{(profile?.bio || '').length}/200</p>

//                     {/* Completeness */}
//                     <div className="mt-5">
//                       <h2 className="font-bold text-zinc-900 mb-3">Profile Completeness</h2>
//                       {(() => {
//                         const checks = [
//                           { label: 'Skills selected', ok: (profile?.skills?.length || 0) > 0 },
//                           { label: 'Cities selected', ok: (profile?.serviceCities?.length || 0) > 0 },
//                           { label: 'Bio (30+ chars)', ok: Boolean(profile?.bio && profile.bio.trim().length >= 30) },
//                           { label: 'UPI ID set', ok: Boolean(profile?.upiId && profile.upiId.includes('@')) },
//                         ];
//                         const pct = Math.round((checks.filter(c => c.ok).length / checks.length) * 100);


//   return (
//                           <div>
//                             <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-2">
//                               <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
//                             </div>
//                             <div className="flex justify-between text-xs">
//                               <span className="font-bold text-zinc-700">{pct}% complete</span>
//                               <span className="text-zinc-400">{checks.filter(c => c.ok).length}/{checks.length}</span>
//                             </div>
//                             <div className="mt-3 space-y-1.5">
//                               {checks.map((c) => (
//                                 <div key={c.label} className="flex items-center gap-2">
//                                   {c.ok ? <CheckCircle size={12} className="text-emerald-500 shrink-0" /> : <Clock3 size={12} className="text-zinc-300 shrink-0" />}
//                                   <span className={`text-xs ${c.ok ? 'text-zinc-600' : 'text-zinc-400'}`}>{c.label}</span>
//                                 </div>
//                               ))}
//                             </div>
//                           </div>
//                         );
//                       })()}
//                     </div>

//                     <button onClick={() => toast.success('Profile saved!')} className="mt-5 w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm">
//                       Save Profile
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* ────── DOCUMENTS ────── */}
//             {tab === 'documents' && (
//               <div className="space-y-5">
//                 <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
//                   <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Documents</p>
//                   <h1 className="text-xl font-black text-zinc-900 mt-0.5">Upload ID for verification</h1>
//                   <p className="text-sm text-zinc-500 mt-1">Required: Aadhaar Front, Aadhaar Back, Profile Photo. Skill Certificate is optional.</p>
//                 </div>

//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <UploadArea label="Aadhaar Card (Front)" required current={docs.aadhaarFront} onPick={(f) => setDocs((c) => ({ ...c, aadhaarFront: uploadMetaFromFile(f) }))} onRemove={() => setDocs((c) => ({ ...c, aadhaarFront: undefined }))} />
//                   <UploadArea label="Aadhaar Card (Back)" required current={docs.aadhaarBack} onPick={(f) => setDocs((c) => ({ ...c, aadhaarBack: uploadMetaFromFile(f) }))} onRemove={() => setDocs((c) => ({ ...c, aadhaarBack: undefined }))} />
//                   <UploadArea label="Profile Photo" required current={docs.profilePhoto} onPick={(f) => setDocs((c) => ({ ...c, profilePhoto: uploadMetaFromFile(f) }))} onRemove={() => setDocs((c) => ({ ...c, profilePhoto: undefined }))} />
//                   <UploadArea label="Skill Certificate (Optional)" required={false} current={docs.skillCert} onPick={(f) => setDocs((c) => ({ ...c, skillCert: uploadMetaFromFile(f) }))} onRemove={() => setDocs((c) => ({ ...c, skillCert: undefined }))} />
//                 </div>

//                 <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
//                   <div className="flex items-center gap-3">
//                     <p className="text-sm font-bold text-zinc-700">Verification Status:</p>
//                     <Badge variant={verificationStatus === 'verified' ? 'success' : verificationStatus === 'pending' ? 'info' : 'warning'}>
//                       {verificationStatus === 'verified' ? '✓ Verified' : verificationStatus === 'pending' ? '⏳ Under Review' : '○ Unverified'}
//                     </Badge>
//                   </div>
//                   <button onClick={submitForVerification} disabled={!requiredDocsUploaded(docs) || verificationStatus !== 'unverified'} className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm shrink-0">
//                     Submit for Verification
//                   </button>
//                 </div>

//                 {verificationStatus === 'pending' && (
//                   <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-2xl p-4">
//                     <Clock3 size={16} className="text-sky-600 shrink-0 mt-0.5" />
//                     <div>
//                       <p className="text-sm font-bold text-sky-800">Under review</p>
//                       <p className="text-xs text-sky-600 mt-0.5">Your documents are being reviewed. This usually takes 1–2 business days. You can update documents anytime.</p>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             )}


// {completionJobId && (
//     <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="complete-job-title">
//       <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
//         <div className="border-b border-slate-100 bg-gradient-to-br from-[#003049] to-[#0D9B6C] px-5 py-5 text-white">
//           <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">Secure completion</p>
//           <h2 id="complete-job-title" className="mt-1 text-xl font-black">Verify service before closing</h2>
//           <p className="mt-1 text-xs text-white/70">Ask the customer for the 6-digit service code after the work is complete.</p>
//         </div>
//         <div className="space-y-4 p-5">
//           <label className="block">
//             <span className="text-xs font-extrabold text-slate-700">Customer service code</span>
//             <input
//               value={completionOtp}
//               onChange={(e) => setCompletionOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
//               inputMode="numeric"
//               autoComplete="one-time-code"
//               placeholder="6-digit code"
//               className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xl font-black tracking-[0.35em] text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
//             />
//           </label>

//           <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
//             <input
//               type="checkbox"
//               checked={completionPaymentConfirmed}
//               onChange={(e) => setCompletionPaymentConfirmed(e.target.checked)}
//               className="mt-0.5 h-4 w-4 accent-emerald-600"
//             />
//             <span className="text-xs font-semibold leading-5 text-slate-600">
//               I confirm payment has been received for this service.
//             </span>
//           </label>

//           <input
//             value={completionPaymentReference}
//             onChange={(e) => setCompletionPaymentReference(e.target.value.slice(0, 100))}
//             placeholder="UPI reference (if applicable)"
//             className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
//           />

//           <div className="flex gap-2 pt-1">
//             <button type="button" onClick={() => setCompletionJobId(null)} disabled={completionBusy} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-700">Cancel</button>
//             <button type="button" onClick={() => void completeJob()} disabled={completionBusy || completionOtp.length !== 6 || !completionPaymentConfirmed} className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-40">
//               {completionBusy ? 'Completing…' : 'Verify & Complete'}
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   )}
//           </main>
//         </div>
//       </div>
//     </div>
//   );
// }
