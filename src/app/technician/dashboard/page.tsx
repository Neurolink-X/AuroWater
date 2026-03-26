'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

type TechnicianOnline = 'online' | 'offline';
type VerificationStatus = 'unverified' | 'pending' | 'verified';

type TechSkill = 'Plumbing' | 'RO Service' | 'Borewell' | 'Motor Repair' | 'Water Tanker' | 'Tank Cleaning Service';
const SKILLS: TechSkill[] = ['Plumbing', 'RO Service', 'Borewell', 'Motor Repair', 'Water Tanker', 'Tank Cleaning Service'];

type TechAvailabilitySlot = 'morning' | 'afternoon' | 'evening';
type TechDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
const DAYS: TechDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SLOTS: TechAvailabilitySlot[] = ['morning', 'afternoon', 'evening'];

type JobQueueItem = {
  id: string; // JR-001
  service: string;
  sub: string;
  area: string;
  date: string; // Today / Tomorrow
  slot: string; // Morning / Afternoon
  price: number;
  distance: string; // 2.3 km
  expiresAt: number; // epoch ms
};

type MyJobStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';

type MyJob = JobQueueItem & {
  status: MyJobStatus;
  acceptedAt: number;
  startedAt?: number;
  completedAt?: number;
  rating?: number; // 1..5
};

type UploadMeta = {
  name: string;
  size: number;
  status: 'uploaded' | 'submitted' | 'verified' | 'rejected';
};

type TechDocs = {
  aadhaarFront?: UploadMeta;
  aadhaarBack?: UploadMeta;
  profilePhoto?: UploadMeta;
  skillCert?: UploadMeta;
  verificationStatus?: VerificationStatus;
  submittedAt?: number;
};

type TechProfile = {
  skills: TechSkill[];
  serviceCities: string[];
  bio: string;
  upiId: string;
};

const UP_CITIES = [
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

const STORAGE_ONLINE = 'aurowater_tech_online';
const STORAGE_VERIFICATION = 'aurowater_tech_verification_status';
const STORAGE_JOB_QUEUE = 'aurowater_job_queue';
const STORAGE_MY_JOBS = 'aurowater_tech_jobs';
const STORAGE_AVAILABILITY = 'aurowater_tech_availability';
const STORAGE_DOCS = 'aurowater_tech_documents';
const STORAGE_PROFILE = 'aurowater_tech_profile';

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function formatMoney(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function minutesSeconds(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s}s`;
}

function nowIsoLocal() {
  const d = new Date();
  return d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function seedJobQueueIfEmpty(current: JobQueueItem[] | null) {
  if (current && current.length) return current;
  const base = Date.now();
  const jobs: JobQueueItem[] = [
    {
      id: 'JR-001',
      service: 'Plumbing',
      sub: 'Pipe Repair',
      area: 'Civil Lines, Kanpur',
      date: 'Today',
      slot: 'Morning',
      price: 199,
      distance: '2.3 km',
      expiresAt: base + 12 * 60 * 1000,
    },
    {
      id: 'JR-002',
      service: 'RO Service',
      sub: 'Filter Change',
      area: 'Kidwai Nagar, Kanpur',
      date: 'Today',
      slot: 'Afternoon',
      price: 279,
      distance: '4.1 km',
      expiresAt: base + 8 * 60 * 1000,
    },
    {
      id: 'JR-003',
      service: 'Motor Repair',
      sub: 'Submersible',
      area: 'Govind Nagar, Kanpur',
      date: 'Tomorrow',
      slot: 'Morning',
      price: 349,
      distance: '6.2 km',
      expiresAt: base + 45 * 60 * 1000,
    },
  ];
  return jobs;
}

function seedMyJobsIfEmpty(current: MyJob[] | null): MyJob[] {
  if (current && current.length) return current;
  return [];
}

function seedAvailabilityIfEmpty(current: Record<string, boolean> | null) {
  if (current) return current;
  const next: Record<string, boolean> = {};
  for (const d of DAYS) {
    for (const s of SLOTS) {
      next[`${d}:${s}`] = d === 'mon' || d === 'wed' || d === 'fri' ? s !== 'evening' : false;
    }
  }
  next['emergency'] = false;
  return next;
}

function seedDocsIfEmpty(current: TechDocs | null): TechDocs {
  if (current) return current;
  return { verificationStatus: 'unverified' };
}

function seedProfileIfEmpty(current: TechProfile | null): TechProfile {
  if (current) return current;
  return {
    skills: ['Plumbing', 'RO Service'],
    serviceCities: ['Kanpur', 'Lucknow'],
    bio: '',
    upiId: 'rahul.verma@upi',
  };
}

function requiredDocsUploaded(d: TechDocs) {
  return Boolean(d.aadhaarFront && d.aadhaarBack && d.profilePhoto);
}

function uploadMetaFromFile(file: File): UploadMeta {
  return { name: file.name, size: file.size, status: 'uploaded' };
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all text-left',
        active ? 'bg-[#E8F8F2] border-[#0D9B6C] text-[#0D9B6C] border-l-4' : 'bg-white border-slate-100 hover:bg-slate-50',
      ].join(' ')}
    >
      <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
        <Icon size={18} />
      </span>
      <span className="font-extrabold text-sm">{label}</span>
    </button>
  );
}

type TabKey = 'overview' | 'queue' | 'my_jobs' | 'earnings' | 'availability' | 'profile' | 'documents';

export default function TechnicianDashboardPage() {
  const router = useRouter();
  const { role: authRole, checked, isLoggedIn } = useAuth();
  const [tab, setTab] = useState<TabKey>('overview');

  const [online, setOnline] = useState<TechnicianOnline>('online');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('unverified');

  const [jobQueue, setJobQueue] = useState<JobQueueItem[]>([]);
  const [myJobs, setMyJobs] = useState<MyJob[]>([]);
  const [docs, setDocs] = useState<TechDocs>({});
  const [profile, setProfile] = useState<TechProfile | null>(null);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});

  const [tickerNow, setTickerNow] = useState<number>(Date.now());

  const [upiEditing, setUpiEditing] = useState(false);
  const [upiDraft, setUpiDraft] = useState('');

  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const savedOnline = localStorage.getItem(STORAGE_ONLINE) as TechnicianOnline | null;
    const savedVerification = localStorage.getItem(STORAGE_VERIFICATION) as VerificationStatus | null;
    const savedQueue = safeParse<JobQueueItem[]>(localStorage.getItem(STORAGE_JOB_QUEUE));
    const savedMyJobs = safeParse<MyJob[]>(localStorage.getItem(STORAGE_MY_JOBS));
    const savedAvail = safeParse<Record<string, boolean>>(localStorage.getItem(STORAGE_AVAILABILITY));
    const savedDocs = safeParse<TechDocs>(localStorage.getItem(STORAGE_DOCS));
    const savedProfile = safeParse<TechProfile>(localStorage.getItem(STORAGE_PROFILE));

    setOnline(savedOnline === 'offline' ? 'offline' : 'online');
    setVerificationStatus(savedVerification || 'unverified');
    setJobQueue(seedJobQueueIfEmpty(savedQueue || null));
    setMyJobs(seedMyJobsIfEmpty(savedMyJobs || null));
    setAvailability(seedAvailabilityIfEmpty(savedAvail || null));
    setDocs(seedDocsIfEmpty(savedDocs || null));
    setProfile(seedProfileIfEmpty(savedProfile || null));
  }, []);

  useEffect(() => {
    if (!mountedRef.current) return;
    localStorage.setItem(STORAGE_ONLINE, online);
  }, [online]);

  useEffect(() => {
    if (!mountedRef.current) return;
    localStorage.setItem(STORAGE_VERIFICATION, verificationStatus);
  }, [verificationStatus]);

  useEffect(() => {
    if (!mountedRef.current) return;
    localStorage.setItem(STORAGE_JOB_QUEUE, JSON.stringify(jobQueue));
  }, [jobQueue]);

  useEffect(() => {
    if (!mountedRef.current) return;
    localStorage.setItem(STORAGE_MY_JOBS, JSON.stringify(myJobs));
  }, [myJobs]);

  useEffect(() => {
    if (!mountedRef.current) return;
    localStorage.setItem(STORAGE_AVAILABILITY, JSON.stringify(availability));
  }, [availability]);

  useEffect(() => {
    if (!mountedRef.current) return;
    localStorage.setItem(STORAGE_DOCS, JSON.stringify(docs));
  }, [docs]);

  useEffect(() => {
    if (!mountedRef.current) return;
    localStorage.setItem(STORAGE_PROFILE, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    const t = window.setInterval(() => setTickerNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    // Auto-expire job queue items
    if (!jobQueue.length) return;
    const expired = jobQueue.filter((j) => j.expiresAt <= tickerNow);
    if (!expired.length) return;
    setJobQueue((cur) => cur.filter((j) => j.expiresAt > tickerNow));
    for (const j of expired) toast.error(`Job ${j.id} expired.`);
  }, [tickerNow, jobQueue]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const name = useMemo(() => {
    // Use profile.name from local session for greeting; localStorage profile can be different.
    const stored = safeParse<{ name?: string }>(localStorage.getItem('aurowater_profile'));
    return stored?.name || 'Technician';
  }, []);

  const completionBanner = useMemo(() => {
    if (verificationStatus === 'verified') {
      return { tone: 'bg-emerald-50 border-emerald-200 text-emerald-900', title: "✅ You're a Verified AuroWater Technician!", cta: null as null | string };
    }
    if (verificationStatus === 'pending') {
      return {
        tone: 'bg-sky-50 border-sky-200 text-sky-900',
        title: '🕐 Your ID is under review. Usually takes 1–2 business days.',
        cta: 'Upload Documents',
      };
    }
    return {
      tone: 'bg-amber-50 border-amber-200 text-amber-900',
      title: '⚠️ Complete your profile and upload ID to start accepting jobs',
      cta: 'Upload Documents',
    };
  }, [verificationStatus]);

  const activeJob = useMemo(() => myJobs.find((j) => j.status === 'in_progress') || null, [myJobs]);

  const jobsTodayCount = useMemo(() => {
    const d = new Date();
    const isSameDay = (t?: number) => {
      if (!t) return false;
      const dt = new Date(t);
      return dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth() && dt.getDate() === d.getDate();
    };
    return myJobs.filter((j) => (j.completedAt ? isSameDay(j.completedAt) : false)).length;
  }, [myJobs]);

  const totalCompletedCount = useMemo(() => myJobs.filter((j) => j.status === 'completed').length, [myJobs]);

  const avgRating = useMemo(() => {
    const rated = myJobs.filter((j) => typeof j.rating === 'number') as Array<MyJob & { rating: number }>;
    if (!rated.length) return null;
    return rated.reduce((s, j) => s + j.rating, 0) / rated.length;
  }, [myJobs]);

  const thisMonthEarnings = useMemo(() => {
    const d = new Date();
    const ym = `${d.getFullYear()}-${d.getMonth()}`;
    return myJobs
      .filter((j) => j.status === 'completed' && j.completedAt)
      .reduce((sum, j) => {
        const dj = j.completedAt ? new Date(j.completedAt) : null;
        if (!dj) return sum;
        const key = `${dj.getFullYear()}-${dj.getMonth()}`;
        return key === ym ? sum + j.price : sum;
      }, 0);
  }, [myJobs]);

  const acceptJobFromQueue = (job: JobQueueItem) => {
    const nextMy: MyJob = { ...job, status: 'upcoming', acceptedAt: Date.now() };
    setMyJobs((cur) => [nextMy, ...cur]);
    setJobQueue((cur) => cur.filter((j) => j.id !== job.id));
    toast.success(`Job ${job.id} accepted! Customer will be notified.`);
  };

  const declineJobFromQueue = (job: JobQueueItem) => {
    setJobQueue((cur) => cur.filter((j) => j.id !== job.id));
    toast.error('Job declined');
  };

  const startJob = (jobId: string) => {
    setMyJobs((cur) =>
      cur.map((j) => (j.id === jobId ? { ...j, status: 'in_progress', startedAt: Date.now() } : j))
    );
    toast.success('Job started. Good luck!');
  };

  const completeJob = (jobId: string) => {
    setMyJobs((cur) =>
      cur.map((j) => (j.id === jobId ? { ...j, status: 'completed', completedAt: Date.now() } : j))
    );
    toast.success('Job marked completed.');
  };

  const [queueFilterCount, setQueueFilterCount] = useState(0);
  useEffect(() => setQueueFilterCount(jobQueue.length), [jobQueue.length]);

  const [myJobFilter, setMyJobFilter] = useState<'all' | MyJobStatus>('all');
  const visibleMyJobs = useMemo(() => {
    if (myJobFilter === 'all') return myJobs;
    if (myJobFilter === 'upcoming') return myJobs.filter((j) => j.status === 'upcoming');
    return myJobs.filter((j) => j.status === myJobFilter);
  }, [myJobs, myJobFilter]);

  const [expandedMyJobId, setExpandedMyJobId] = useState<string | null>(null);

  const earningsDaily = useMemo(() => {
    const completed = myJobs.filter((j) => j.status === 'completed' && j.completedAt) as Array<MyJob & { completedAt: number }>;
    // Build last 7 days buckets (Mon..Sun styling; best-effort)
    const today = new Date();
    const days: number[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const dt = new Date(today);
      dt.setDate(today.getDate() - i);
      const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
      const sum = completed
        .filter((j) => {
          const dj = new Date(j.completedAt);
          const k = `${dj.getFullYear()}-${dj.getMonth()}-${dj.getDate()}`;
          return k === key;
        })
        .reduce((s, j) => s + j.price, 0);
      days.push(sum);
    }
    return days.length ? days : [850, 0, 1200, 400, 0, 980, 650];
  }, [myJobs]);

  const earningsTotal = useMemo(() => myJobs.filter((j) => j.status === 'completed').reduce((s, j) => s + j.price, 0), [myJobs]);
  const earningsToday = useMemo(() => earningsDaily[6] || 0, [earningsDaily]);
  const earningsThisWeek = useMemo(() => earningsDaily.reduce((s, v) => s + v, 0), [earningsDaily]);

  const payoutHistoryKey = 'aurowater_tech_payout_history';
  const payoutHistory = useMemo(() => {
    const saved = safeParse<Array<{ id: string; date: string; jobs: number; amount: number; status: 'Paid' | 'Pending' }>>(
      localStorage.getItem(payoutHistoryKey)
    );
    return saved || [];
  }, [/* compute at render only */]); // intentionally only used in initial seed below

  useEffect(() => {
    const saved = safeParse<Array<{ id: string; date: string; jobs: number; amount: number; status: 'Paid' | 'Pending' }>>(
      localStorage.getItem(payoutHistoryKey)
    );
    if (saved && saved.length) return;
    const base = new Date();
    const seed = [
      { id: 'P-001', date: base.toLocaleDateString(), jobs: 6, amount: 4200, status: 'Paid' as const },
      { id: 'P-002', date: base.toLocaleDateString(undefined, { day: '2-digit' }), jobs: 4, amount: 2900, status: 'Paid' as const },
      { id: 'P-003', date: base.toLocaleDateString(undefined, { day: '2-digit' }), jobs: 2, amount: 650, status: 'Pending' as const },
    ];
    try {
      localStorage.setItem(payoutHistoryKey, JSON.stringify(seed));
    } catch {
      // ignore
    }
  }, []);

  const payoutHistoryLive = useMemo(() => {
    const saved = safeParse<Array<{ id: string; date: string; jobs: number; amount: number; status: 'Paid' | 'Pending' }>>(
      localStorage.getItem(payoutHistoryKey)
    );
    return saved || [];
  }, [myJobs]);

  const pendingBalance = useMemo(() => {
    return payoutHistoryLive.filter((p) => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);
  }, [payoutHistoryLive]);

  const requestPayout = () => {
    if (pendingBalance < 500) {
      toast.error('Pending balance should be at least ₹500.');
      return;
    }
    const next = [
      { id: `P-${Math.floor(Math.random() * 900 + 100)}`, date: new Date().toLocaleDateString(), jobs: 0, amount: pendingBalance, status: 'Pending' as const },
      ...payoutHistoryLive.filter((p) => p.status !== 'Pending'),
    ];
    try {
      localStorage.setItem(payoutHistoryKey, JSON.stringify(next));
    } catch {
      // ignore
    }
    toast.success('Payout request submitted.');
  };

  const updateVerificationStatusToPending = () => {
    setVerificationStatus('pending');
    setDocs((cur) => ({ ...cur, verificationStatus: 'pending', submittedAt: Date.now() }));
  };

  if (!checked) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading…</div>;
  if (!isLoggedIn || authRole !== 'technician') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-2xl mx-auto px-4 py-14">
          <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-7">
            <div className="text-2xl font-extrabold text-[#0F1C18]">Technician access</div>
            <p className="text-slate-600 mt-2 text-sm">
              Please sign in as a Technician to view this dashboard.
            </p>
            <button type="button" onClick={() => router.push('/auth/login')} className="mt-5 w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] transition-all">
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar */}
          <aside className="lg:col-span-3 xl:col-span-2">
            <div className="lg:sticky lg:top-6 rounded-3xl border border-slate-100 bg-white shadow-card p-4">
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0D9B6C] to-[#38BDF8] text-white font-extrabold flex items-center justify-center">
                  {profile?.skills?.[0] ? 'T' : '🔧'}
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-[#0F1C18] truncate">Technician</div>
                  <div className="text-xs text-slate-500 truncate">{name}</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <SidebarItem icon={LayoutDashboard} label="Overview" active={tab === 'overview'} onClick={() => setTab('overview')} />
                <SidebarItem icon={Bell} label={`Job Queue (${queueFilterCount})`} active={tab === 'queue'} onClick={() => setTab('queue')} />
                <SidebarItem icon={Briefcase} label="My Jobs" active={tab === 'my_jobs'} onClick={() => setTab('my_jobs')} />
                <SidebarItem icon={IndianRupee} label="Earnings" active={tab === 'earnings'} onClick={() => setTab('earnings')} />
                <SidebarItem icon={Clock} label="Availability" active={tab === 'availability'} onClick={() => setTab('availability')} />
                <SidebarItem icon={User} label="Profile" active={tab === 'profile'} onClick={() => setTab('profile')} />
                <SidebarItem icon={FileText} label="Documents" active={tab === 'documents'} onClick={() => setTab('documents')} />
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="w-full flex items-center gap-2 rounded-2xl px-4 py-3 hover:bg-slate-50 border border-slate-100 text-slate-700 font-extrabold text-sm transition-all"
                >
                  <ArrowLeft size={18} /> Back to Site
                </button>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="lg:col-span-9 xl:col-span-10">
            {tab === 'overview' && (
              <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
                {/* Top bar */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-600">{greeting}, {name}</div>
                    <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Dashboard</div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-extrabold text-slate-700">Status</div>
                      <button
                        type="button"
                        onClick={() => setOnline('online')}
                        className={[
                          'h-12 px-4 rounded-2xl font-extrabold text-sm border transition-all',
                          online === 'online' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        ● Online
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnline('offline')}
                        className={[
                          'h-12 px-4 rounded-2xl font-extrabold text-sm border transition-all',
                          online === 'offline' ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        ○ Offline
                      </button>
                    </div>
                  </div>
                </div>

                {/* Verification banner */}
                <div className={['mt-5 rounded-3xl border p-4', completionBanner.tone].join(' ')}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="font-extrabold">{completionBanner.title}</div>
                    {completionBanner.cta ? (
                      <button
                        type="button"
                        onClick={() => setTab('documents')}
                        className="rounded-2xl bg-white text-[#0D9B6C] font-extrabold px-4 py-2 border border-white/60 hover:bg-slate-50 transition-all active:scale-95"
                      >
                        {completionBanner.cta}
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Stat cards */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
                    <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Jobs Today</div>
                    <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{jobsTodayCount}</div>
                  </div>
                  <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
                    <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Total Completed</div>
                    <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{totalCompletedCount}</div>
                  </div>
                  <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
                    <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Avg Rating</div>
                    <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">
                      {avgRating ? avgRating.toFixed(1) : '—'}/5
                    </div>
                  </div>
                  <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
                    <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">This Month ₹</div>
                    <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{formatMoney(thisMonthEarnings)}</div>
                  </div>
                </div>

                {/* Active job card */}
                <div className="mt-6 rounded-3xl bg-white border border-slate-100 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-extrabold text-slate-700">Active Job</div>
                      <div className="text-lg font-extrabold text-[#0F1C18] mt-1">
                        {activeJob ? activeJob.service : 'No active job'}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        {activeJob ? `${activeJob.sub} · ${activeJob.area}` : 'Accept a job from Queue to get started.'}
                      </div>
                      {activeJob ? (
                        <div className="text-xs font-semibold text-slate-500 mt-2">
                          ▶ Started: {activeJob.startedAt ? new Date(activeJob.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : nowIsoLocal()}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                      {activeJob ? (
                        <button
                          type="button"
                          onClick={() => completeJob(activeJob.id)}
                          className="rounded-2xl bg-emerald-600 text-white font-extrabold px-5 py-3 hover:bg-emerald-700 active:scale-95 transition-all"
                        >
                          ▶ Mark as Completed
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setTab('queue')}
                          className="rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
                        >
                          Open Job Queue
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toast.success('Support request sent (simulated).')}
                        className="rounded-2xl border border-slate-200 bg-white text-slate-800 font-extrabold px-5 py-3 hover:bg-slate-50 active:scale-95 transition-all"
                      >
                        📞 Contact Support
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'queue' && (
              <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Job Queue</div>
                    <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Receive jobs you can complete</div>
                    <div className="text-sm text-slate-600 mt-1">Accept before the timer ends. Expired jobs are removed automatically.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl bg-[#E8F8F2] border border-[#0D9B6C]/30 px-4 py-2 font-extrabold text-[#0D9B6C]">
                      {jobQueue.length} in queue
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {jobQueue.length === 0 ? (
                    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center">
                      <div className="text-4xl">📭</div>
                      <div className="font-extrabold text-slate-900 mt-2">No jobs right now</div>
                      <div className="text-sm text-slate-600 mt-1">Turn Online to start receiving requests.</div>
                    </div>
                  ) : (
                    jobQueue.map((j) => {
                      const remaining = j.expiresAt - tickerNow;
                      const timerText = remaining <= 0 ? 'Expired' : minutesSeconds(remaining);
                      return (
                        <div key={j.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl">
                                  {j.service === 'Plumbing' ? '🧰' : j.service === 'RO Service' ? '🚿' : '⚙️'}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-extrabold text-slate-900 truncate">{j.service}</div>
                                  <div className="text-sm text-slate-600 mt-1">{j.sub}</div>
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                                  <div className="text-xs font-extrabold text-slate-500">📍 Area</div>
                                  <div className="text-sm font-extrabold text-slate-800 mt-1">{j.area}</div>
                                </div>
                                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                                  <div className="text-xs font-extrabold text-slate-500">📅 Date/Slot</div>
                                  <div className="text-sm font-extrabold text-slate-800 mt-1">{j.date} · {j.slot}</div>
                                </div>
                                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                                  <div className="text-xs font-extrabold text-slate-500">💰 Price</div>
                                  <div className="text-sm font-extrabold text-[#0D9B6C] mt-1">{formatMoney(j.price)}</div>
                                </div>
                              </div>
                            </div>

                            <div className="w-full lg:w-72">
                              <div className="flex items-center justify-between gap-3">
                                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-700">
                                  📍 {j.distance}
                                </div>
                                <div className={['text-xs font-extrabold rounded-full px-3 py-1 border', remaining < 5 * 60 * 1000 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-600'].join(' ')}>
                                  ⏱ {timerText}
                                </div>
                              </div>

                              <div className="mt-4 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => acceptJobFromQueue(j)}
                                  className="flex-1 rounded-2xl bg-emerald-600 text-white font-extrabold py-3 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-60"
                                  disabled={verificationStatus !== 'verified' || online !== 'online'}
                                  title={verificationStatus !== 'verified' ? 'Upload documents and get verified' : online !== 'online' ? 'Set Online to accept jobs' : ''}
                                >
                                  Accept ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => declineJobFromQueue(j)}
                                  className="flex-1 rounded-2xl border border-rose-200 text-rose-700 font-extrabold py-3 hover:bg-rose-50 active:scale-95 transition-all"
                                >
                                  Decline ✗
                                </button>
                              </div>
                              <div className="mt-3 text-xs text-slate-500 font-semibold">
                                {verificationStatus !== 'verified' ? 'Complete verification to accept jobs.' : online !== 'online' ? 'Set Online to receive and accept jobs.' : ' '}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {tab === 'my_jobs' && (
              <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">My Jobs</div>
                    <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Start, complete, and track your earnings</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {([
                    { key: 'all', label: 'All' },
                    { key: 'upcoming', label: 'Upcoming' },
                    { key: 'in_progress', label: 'In Progress' },
                    { key: 'completed', label: 'Completed' },
                    { key: 'cancelled', label: 'Cancelled' },
                  ] as Array<{ key: typeof myJobFilter; label: string }>).map((f) => {
                    const active = myJobFilter === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setMyJobFilter(f.key)}
                        className={[
                          'px-4 py-2 rounded-full border text-sm font-extrabold transition-all',
                          active ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        ].join(' ')}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 space-y-3">
                  {visibleMyJobs.length === 0 ? (
                    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center">
                      <div className="text-4xl">📅</div>
                      <div className="font-extrabold text-slate-900 mt-2">No jobs here yet</div>
                      <div className="text-sm text-slate-600 mt-1">Accept a job from your queue to populate this tab.</div>
                      <button type="button" onClick={() => setTab('queue')} className="mt-5 rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] transition-all active:scale-95">
                        Go to Job Queue
                      </button>
                    </div>
                  ) : (
                    visibleMyJobs
                      .sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0))
                      .map((j) => {
                        const expanded = expandedMyJobId === j.id;
                        return (
                          <div key={j.id} className="rounded-3xl border border-slate-100 bg-white overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedMyJobId(expanded ? null : j.id)}
                              className="w-full p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 text-left"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl">
                                  {j.service === 'Plumbing' ? '🧰' : j.service === 'RO Service' ? '🚿' : '⚙️'}
                                </div>
                                <div>
                                  <div className="font-extrabold text-slate-900">{j.service} · {j.sub}</div>
                                  <div className="text-sm text-slate-600 mt-1">{j.area}</div>
                                  <div className="text-xs font-semibold text-slate-500 mt-2">
                                    {j.date} · {j.slot} · Accepted {new Date(j.acceptedAt).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              <div className="sm:text-right">
                                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 border border-slate-200 bg-slate-50">
                                  <span className="text-xs font-extrabold text-slate-700">Status</span>
                                  <span className={['text-xs font-extrabold', j.status === 'completed' ? 'text-emerald-700' : j.status === 'in_progress' ? 'text-violet-700' : j.status === 'upcoming' ? 'text-[#0D9B6C]' : 'text-rose-700'].join(' ')}>
                                    {j.status.replace('_', ' ')}
                                  </span>
                                </div>
                                <div className="font-extrabold text-[#0D9B6C] mt-2">{formatMoney(j.price)}</div>
                                {j.status === 'completed' && typeof j.rating === 'number' ? (
                                  <div className="text-xs font-extrabold text-slate-600 mt-2">
                                    ⭐ {j.rating}/5
                                  </div>
                                ) : null}
                              </div>
                            </button>

                            {expanded ? (
                              <div className="p-4 pt-0">
                                <div className="mt-2 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                      <div className="text-xs font-extrabold text-slate-500">Job ID</div>
                                      <div className="font-extrabold text-slate-800 mt-1">{j.id}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-extrabold text-slate-500">Scheduled</div>
                                      <div className="font-extrabold text-slate-800 mt-1">{j.date} · {j.slot}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs font-extrabold text-slate-500">Service City</div>
                                      <div className="font-extrabold text-slate-800 mt-1">{profile?.serviceCities?.[0] || '—'}</div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                                  {j.status === 'upcoming' ? (
                                    <button type="button" onClick={() => startJob(j.id)} className="flex-1 rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all">
                                      Start Job
                                    </button>
                                  ) : null}
                                  {j.status === 'in_progress' ? (
                                    <button type="button" onClick={() => completeJob(j.id)} className="flex-1 rounded-2xl bg-emerald-600 text-white font-extrabold px-5 py-3 hover:bg-emerald-700 active:scale-95 transition-all">
                                      Complete Job
                                    </button>
                                  ) : null}
                                  {j.status === 'completed' ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const r = 4 + Math.floor(Math.random() * 2);
                                        setMyJobs((cur) => cur.map((x) => (x.id === j.id ? { ...x, rating: r } : x)));
                                        toast.success(`Rating received: ${r}★`);
                                      }}
                                      className="flex-1 rounded-2xl border border-slate-200 bg-white text-slate-800 font-extrabold px-5 py-3 hover:bg-slate-50 active:scale-95 transition-all"
                                    >
                                      Receive Rating
                                    </button>
                                  ) : null}
                                  {j.status !== 'completed' ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMyJobs((cur) => cur.map((x) => (x.id === j.id ? { ...x, status: 'cancelled' } : x)));
                                        toast.error('Job cancelled.');
                                      }}
                                      className="flex-1 rounded-2xl border border-rose-200 bg-white text-rose-700 font-extrabold px-5 py-3 hover:bg-rose-50 active:scale-95 transition-all"
                                    >
                                      Cancel Job
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}

            {tab === 'earnings' && (
              <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Earnings</div>
                    <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Track payouts and job revenue</div>
                    <div className="text-sm text-slate-600 mt-1">Updated instantly from your completed jobs.</div>
                  </div>
                  <button type="button" onClick={requestPayout} className="rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60" disabled={pendingBalance < 500}>
                    Request Payout
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
                    <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Today ₹</div>
                    <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{formatMoney(earningsToday)}</div>
                  </div>
                  <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
                    <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">This Week ₹</div>
                    <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{formatMoney(earningsThisWeek)}</div>
                  </div>
                  <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
                    <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">This Month ₹</div>
                    <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{formatMoney(thisMonthEarnings)}</div>
                  </div>
                  <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
                    <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Total ₹</div>
                    <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{formatMoney(earningsTotal)}</div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-3xl border border-slate-100 bg-white p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-extrabold text-[#0F1C18]">Last 7 days</div>
                      <div className="text-xs font-extrabold text-slate-500">CSS bar chart</div>
                    </div>
                    <div className="mt-4 flex items-end gap-3">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => {
                        const max = Math.max(1, ...earningsDaily);
                        const val = earningsDaily[i] ?? 0;
                        const height = Math.round((val / max) * 160);
                        return (
                          <div key={d} className="flex flex-col items-center flex-1">
                            <div
                              className="w-full rounded-md bg-gradient-to-t from-[#0D9B6C] to-[#38BDF8]"
                              style={{ height: 20 + height }}
                              aria-label={`${d}: ₹${val}`}
                            />
                            <div className="mt-2 text-xs font-extrabold text-slate-600">{d}</div>
                            <div className="text-[10px] font-extrabold text-slate-500 mt-1">₹{val}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-white p-5">
                    <div className="font-extrabold text-[#0F1C18]">Payouts</div>
                    <div className="text-sm text-slate-600 mt-1">UPI ID: {profile?.upiId || '—'}</div>
                    <div className="mt-3 flex items-center gap-2">
                      {!upiEditing ? (
                        <button
                          type="button"
                          onClick={() => {
                            setUpiEditing(true);
                            setUpiDraft(profile?.upiId || '');
                          }}
                          className="rounded-2xl border border-slate-200 bg-white text-slate-700 font-extrabold px-4 py-2 hover:bg-slate-50 transition-all"
                        >
                          Edit UPI
                        </button>
                      ) : (
                        <>
                          <input
                            value={upiDraft}
                            onChange={(e) => setUpiDraft(e.target.value)}
                            className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 focus:ring-2 focus:ring-[#0D9B6C]"
                            placeholder="name@upi"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setProfile((cur) => (cur ? { ...cur, upiId: upiDraft.trim() } : cur));
                              setUpiEditing(false);
                              toast.success('UPI ID updated.');
                            }}
                            className="rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-4 py-2 hover:bg-[#086D4C] active:scale-95 transition-all"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setUpiEditing(false)}
                            className="rounded-2xl border border-slate-200 bg-white text-slate-700 font-extrabold px-4 py-2 hover:bg-slate-50 transition-all"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                      <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Payout history</div>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-500">
                              <th className="py-2">Date</th>
                              <th className="py-2">Jobs</th>
                              <th className="py-2">Amount</th>
                              <th className="py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const key = 'aurowater_tech_payout_history';
                              const saved = safeParse<Array<{ id: string; date: string; jobs: number; amount: number; status: 'Paid' | 'Pending' }>>(
                                localStorage.getItem(key)
                              );
                              const rows = saved && saved.length ? saved : [];
                              if (!rows.length) {
                                return (
                                  <tr>
                                    <td colSpan={4} className="py-4 text-center text-slate-500">
                                      No payout records yet.
                                    </td>
                                  </tr>
                                );
                              }
                              return rows.slice(0, 5).map((p) => (
                                <tr key={p.id} className="border-t border-slate-100">
                                  <td className="py-2">{p.date}</td>
                                  <td className="py-2 font-extrabold text-slate-800">{p.jobs}</td>
                                  <td className="py-2 font-extrabold text-[#0D9B6C]">{formatMoney(p.amount)}</td>
                                  <td className="py-2">
                                    <span className={['inline-flex px-2 py-1 rounded-full text-[11px] font-extrabold border', p.status === 'Paid' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'].join(' ')}>
                                      {p.status}
                                    </span>
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'availability' && (
              <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Availability</div>
                    <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Choose when you can take jobs</div>
                    <div className="text-sm text-slate-600 mt-1">Availability affects which bookings you’ll be shown.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      toast.success('Availability saved.');
                    }}
                    className="rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
                  >
                    Save Availability
                  </button>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <div className="min-w-[680px] rounded-3xl border border-slate-100 bg-white p-4">
                    <div className="grid grid-cols-1 md:grid-cols-8 gap-2 items-center font-extrabold text-xs text-slate-500 uppercase tracking-wide">
                      <div className="px-2 py-1">Slot</div>
                      {DAYS.map((d) => (
                        <div key={d} className="text-center">
                          {d.toUpperCase()}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      {SLOTS.map((s) => {
                        const label = s === 'morning' ? 'Morning (8-12)' : s === 'afternoon' ? 'Afternoon (12-5)' : 'Evening (5-8)';
                        return (
                          <div key={s} className="grid grid-cols-1 md:grid-cols-8 gap-2 items-center">
                            <div className="px-2 py-2 text-sm font-extrabold text-slate-700">{label}</div>
                            {DAYS.map((d) => {
                              const key = `${d}:${s}`;
                              const enabled = Boolean(availability[key]);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setAvailability((cur) => ({ ...cur, [key]: !enabled }))}
                                  className={[
                                    'h-11 rounded-2xl border text-sm font-extrabold transition-all',
                                    enabled ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
                                  ].join(' ')}
                                >
                                  {enabled ? 'Available' : '—'}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Emergency Toggle</div>
                    <div className="text-xs text-slate-600 mt-1">Accept emergency jobs (additional ₹199 surcharge)</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAvailability((cur) => ({ ...cur, emergency: !cur.emergency }))}
                    className={[
                      'h-12 px-5 rounded-2xl font-extrabold border transition-all',
                      availability.emergency ? 'bg-[#0D9B6C] text-white border-[#0D9B6C]' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {availability.emergency ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'profile' && (
              <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
                <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Profile</div>
                <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Update your skills and service coverage</div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-3xl border border-slate-100 bg-white p-5">
                    <div className="font-extrabold text-[#0F1C18]">Skills</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {SKILLS.map((s) => {
                        const active = profile?.skills?.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setProfile((cur) => {
                                if (!cur) return cur;
                                const has = cur.skills.includes(s);
                                const next = has ? cur.skills.filter((x) => x !== s) : [...cur.skills, s];
                                return { ...cur, skills: next };
                              });
                            }}
                            className={[
                              'px-4 py-2 rounded-full border text-sm font-extrabold transition-all active:scale-95',
                              active ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                            ].join(' ')}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-6">
                      <div className="font-extrabold text-[#0F1C18]">Service Cities</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {UP_CITIES.map((c) => {
                          const active = profile?.serviceCities?.includes(c);
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setProfile((cur) => {
                                  if (!cur) return cur;
                                  const has = cur.serviceCities.includes(c);
                                  const next = has ? cur.serviceCities.filter((x) => x !== c) : [...cur.serviceCities, c];
                                  return { ...cur, serviceCities: next };
                                });
                              }}
                              className={[
                                'px-4 py-2 rounded-full border text-sm font-extrabold transition-all active:scale-95',
                                active ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                              ].join(' ')}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-white p-5">
                    <div className="font-extrabold text-[#0F1C18]">Bio</div>
                    <textarea
                      value={profile?.bio || ''}
                      onChange={(e) => setProfile((cur) => (cur ? { ...cur, bio: e.target.value.slice(0, 200) } : cur))}
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
                      placeholder="Tell customers what you specialize in and how you work."
                      rows={6}
                    />
                    <div className="mt-1 text-xs font-semibold text-slate-500">{(profile?.bio || '').length}/200</div>

                    <div className="mt-6">
                      <div className="font-extrabold text-[#0F1C18]">Profile Completeness</div>
                      {(() => {
                        const fields = [
                          (profile?.skills?.length || 0) > 0,
                          (profile?.serviceCities?.length || 0) > 0,
                          Boolean(profile?.bio && profile.bio.trim().length >= 30),
                          Boolean(profile?.upiId && profile.upiId.includes('@')),
                        ];
                        const pct = Math.round((fields.filter(Boolean).length / fields.length) * 100);
                        return (
                          <div className="mt-3">
                            <div className="h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-100">
                              <div className="h-full rounded-full bg-[#0D9B6C]" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="mt-2 text-sm font-extrabold text-[#0F1C18]">{`Profile ${pct}% complete`}</div>
                          </div>
                        );
                      })()}
                    </div>

                    <button
                      type="button"
                      onClick={() => toast.success('Profile saved.')}
                      className="mt-6 w-full rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
                    >
                      Save Profile
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'documents' && (
              <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
                <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Documents</div>
                <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Upload required ID for verification</div>
                <div className="text-sm text-slate-600 mt-1">Required: Aadhaar Front, Aadhaar Back, Profile Photo. Optional: Skill Certificate.</div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UploadArea
                    label="Aadhaar Card (Front)"
                    required
                    current={docs.aadhaarFront}
                    onPick={(file) => setDocs((cur) => ({ ...cur, aadhaarFront: uploadMetaFromFile(file) }))}
                    onRemove={() => setDocs((cur) => ({ ...cur, aadhaarFront: undefined }))}
                  />
                  <UploadArea
                    label="Aadhaar Card (Back)"
                    required
                    current={docs.aadhaarBack}
                    onPick={(file) => setDocs((cur) => ({ ...cur, aadhaarBack: uploadMetaFromFile(file) }))}
                    onRemove={() => setDocs((cur) => ({ ...cur, aadhaarBack: undefined }))}
                  />
                  <UploadArea
                    label="Profile Photo"
                    required
                    current={docs.profilePhoto}
                    onPick={(file) => setDocs((cur) => ({ ...cur, profilePhoto: uploadMetaFromFile(file) }))}
                    onRemove={() => setDocs((cur) => ({ ...cur, profilePhoto: undefined }))}
                  />
                  <UploadArea
                    label="Skill Certificate (Optional)"
                    required={false}
                    current={docs.skillCert}
                    onPick={(file) => setDocs((cur) => ({ ...cur, skillCert: uploadMetaFromFile(file) }))}
                    onRemove={() => setDocs((cur) => ({ ...cur, skillCert: undefined }))}
                  />
                </div>

                <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-sm font-extrabold text-slate-700">
                    Verification Status:{' '}
                    <span className={['ml-2 inline-flex px-3 py-1 rounded-full text-xs font-extrabold border', verificationStatus === 'verified' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : verificationStatus === 'pending' ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-amber-50 border-amber-200 text-amber-800'].join(' ')}>
                      {verificationStatus}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!requiredDocsUploaded(docs) || verificationStatus === 'verified' || verificationStatus === 'pending'}
                    onClick={() => {
                      if (!requiredDocsUploaded(docs)) {
                        toast.error('Upload all required documents first.');
                        return;
                      }
                      // Mark required docs as submitted
                      setDocs((cur) => ({
                        ...cur,
                        aadhaarFront: cur.aadhaarFront ? { ...cur.aadhaarFront, status: 'submitted' } : cur.aadhaarFront,
                        aadhaarBack: cur.aadhaarBack ? { ...cur.aadhaarBack, status: 'submitted' } : cur.aadhaarBack,
                        profilePhoto: cur.profilePhoto ? { ...cur.profilePhoto, status: 'submitted' } : cur.profilePhoto,
                        skillCert: cur.skillCert ? { ...cur.skillCert, status: cur.skillCert.status === 'uploaded' ? 'submitted' : cur.skillCert.status } : cur.skillCert,
                        verificationStatus: 'pending',
                      }));
                      updateVerificationStatusToPending();
                      toast.success("Documents submitted! We'll review within 48 hours.");
                    }}
                    className="rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60"
                  >
                    Submit for Verification
                  </button>
                </div>

                {verificationStatus === 'pending' ? (
                  <div className="mt-4 rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 font-semibold">
                    🕐 Under review. You can still update documents anytime.
                  </div>
                ) : null}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function UploadArea({
  label,
  required,
  current,
  onPick,
  onRemove,
}: {
  label: string;
  required: boolean;
  current?: UploadMeta;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const statusBadge = (() => {
    if (!current) return { cls: 'bg-slate-100 border-slate-200 text-slate-700', text: '○ Not uploaded' };
    if (current.status === 'verified') return { cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', text: '✓ Verified' };
    if (current.status === 'rejected') return { cls: 'bg-rose-50 border-rose-200 text-rose-700', text: '✗ Rejected — Re-upload required' };
    if (current.status === 'submitted') return { cls: 'bg-sky-50 border-sky-200 text-sky-700', text: '↑ Submitted' };
    return { cls: 'bg-slate-50 border-slate-200 text-slate-700', text: 'Uploaded ✓' };
  })();

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-extrabold text-slate-900">{label}</div>
          <div className="text-xs font-extrabold text-slate-500 mt-1">{required ? 'Required' : 'Optional'}</div>
        </div>
        <span className={['inline-flex px-3 py-1 rounded-full text-xs font-extrabold border', statusBadge.cls].join(' ')}>
          {statusBadge.text}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onPick(file);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-4 w-full rounded-2xl border-2 border-[#0D9B6C]/20 border-dashed bg-slate-50 hover:bg-slate-50/80 transition-all p-5 text-left"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 flex items-center justify-center">
            <CloudUpload size={18} className="text-[#0D9B6C]" />
          </div>
          <div className="flex-1">
            <div className="font-extrabold text-[#0F1C18]">{current ? 'Update file' : 'Click to upload or drag & drop'}</div>
            <div className="text-xs text-slate-600 mt-1">Supported: JPG, PNG, PDF (max 5MB)</div>
            {current ? (
              <div className="text-xs font-semibold text-slate-500 mt-2">
                {current.name} · {(current.size / 1024).toFixed(1)} KB
              </div>
            ) : null}
          </div>
        </div>
      </button>

      {current ? (
        <div className="mt-3 flex items-center justify-end">
          <button type="button" onClick={onRemove} className="rounded-2xl border border-rose-200 bg-white text-rose-700 font-extrabold px-4 py-2 hover:bg-rose-50 transition-all">
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}

