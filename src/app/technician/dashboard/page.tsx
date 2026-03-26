// 'use client';

// import React, { useEffect, useMemo, useRef, useState } from 'react';
// import { useRouter } from 'next/navigation';
// export const dynamic = "force-dynamic";
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
//   CheckCircle2,
//   XCircle,
// } from 'lucide-react';
// import { toast } from 'sonner';
// import { useAuth } from '@/hooks/useAuth';

// type TechnicianOnline = 'online' | 'offline';
// type VerificationStatus = 'unverified' | 'pending' | 'verified';

// type TechSkill = 'Plumbing' | 'RO Service' | 'Borewell' | 'Motor Repair' | 'Water Tanker' | 'Tank Cleaning Service';
// const SKILLS: TechSkill[] = ['Plumbing', 'RO Service', 'Borewell', 'Motor Repair', 'Water Tanker', 'Tank Cleaning Service'];

// type TechAvailabilitySlot = 'morning' | 'afternoon' | 'evening';
// type TechDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
// const DAYS: TechDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
// const SLOTS: TechAvailabilitySlot[] = ['morning', 'afternoon', 'evening'];

// type JobQueueItem = {
//   id: string; // JR-001
//   service: string;
//   sub: string;
//   area: string;
//   date: string; // Today / Tomorrow
//   slot: string; // Morning / Afternoon
//   price: number;
//   distance: string; // 2.3 km
//   expiresAt: number; // epoch ms
// };

// type MyJobStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';

// type MyJob = JobQueueItem & {
//   status: MyJobStatus;
//   acceptedAt: number;
//   startedAt?: number;
//   completedAt?: number;
//   rating?: number; // 1..5
// };

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

// const UP_CITIES = [
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

// const STORAGE_ONLINE = 'aurowater_tech_online';
// const STORAGE_VERIFICATION = 'aurowater_tech_verification_status';
// const STORAGE_JOB_QUEUE = 'aurowater_job_queue';
// const STORAGE_MY_JOBS = 'aurowater_tech_jobs';
// const STORAGE_AVAILABILITY = 'aurowater_tech_availability';
// const STORAGE_DOCS = 'aurowater_tech_documents';
// const STORAGE_PROFILE = 'aurowater_tech_profile';

// function safeParse<T>(raw: string | null): T | null {
//   if (!raw) return null;
//   try {
//     return JSON.parse(raw) as T;
//   } catch {
//     return null;
//   }
// }

// function formatMoney(n: number) {
//   return `₹${Math.round(n).toLocaleString('en-IN')}`;
// }

// function minutesSeconds(ms: number) {
//   const total = Math.max(0, Math.floor(ms / 1000));
//   const m = Math.floor(total / 60);
//   const s = total % 60;
//   return `${m}m ${s}s`;
// }

// function nowIsoLocal() {
//   const d = new Date();
//   return d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
// }

// function seedJobQueueIfEmpty(current: JobQueueItem[] | null) {
//   if (current && current.length) return current;
//   const base = Date.now();
//   const jobs: JobQueueItem[] = [
//     {
//       id: 'JR-001',
//       service: 'Plumbing',
//       sub: 'Pipe Repair',
//       area: 'Civil Lines, Kanpur',
//       date: 'Today',
//       slot: 'Morning',
//       price: 199,
//       distance: '2.3 km',
//       expiresAt: base + 12 * 60 * 1000,
//     },
//     {
//       id: 'JR-002',
//       service: 'RO Service',
//       sub: 'Filter Change',
//       area: 'Kidwai Nagar, Kanpur',
//       date: 'Today',
//       slot: 'Afternoon',
//       price: 279,
//       distance: '4.1 km',
//       expiresAt: base + 8 * 60 * 1000,
//     },
//     {
//       id: 'JR-003',
//       service: 'Motor Repair',
//       sub: 'Submersible',
//       area: 'Govind Nagar, Kanpur',
//       date: 'Tomorrow',
//       slot: 'Morning',
//       price: 349,
//       distance: '6.2 km',
//       expiresAt: base + 45 * 60 * 1000,
//     },
//   ];
//   return jobs;
// }

// function seedMyJobsIfEmpty(current: MyJob[] | null): MyJob[] {
//   if (current && current.length) return current;
//   return [];
// }

// function seedAvailabilityIfEmpty(current: Record<string, boolean> | null) {
//   if (current) return current;
//   const next: Record<string, boolean> = {};
//   for (const d of DAYS) {
//     for (const s of SLOTS) {
//       next[`${d}:${s}`] = d === 'mon' || d === 'wed' || d === 'fri' ? s !== 'evening' : false;
//     }
//   }
//   next['emergency'] = false;
//   return next;
// }

// function seedDocsIfEmpty(current: TechDocs | null): TechDocs {
//   if (current) return current;
//   return { verificationStatus: 'unverified' };
// }

// function seedProfileIfEmpty(current: TechProfile | null): TechProfile {
//   if (current) return current;
//   return {
//     skills: ['Plumbing', 'RO Service'],
//     serviceCities: ['Kanpur', 'Lucknow'],
//     bio: '',
//     upiId: 'rahul.verma@upi',
//   };
// }

// function requiredDocsUploaded(d: TechDocs) {
//   return Boolean(d.aadhaarFront && d.aadhaarBack && d.profilePhoto);
// }

// function uploadMetaFromFile(file: File): UploadMeta {
//   return { name: file.name, size: file.size, status: 'uploaded' };
// }

// function SidebarItem({
//   icon: Icon,
//   label,
//   active,
//   onClick,
// }: {
//   icon: React.ComponentType<{ size?: number }>;
//   label: string;
//   active?: boolean;
//   onClick: () => void;
// }) {
//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       className={[
//         'w-full flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all text-left',
//         active ? 'bg-[#E8F8F2] border-[#0D9B6C] text-[#0D9B6C] border-l-4' : 'bg-white border-slate-100 hover:bg-slate-50',
//       ].join(' ')}
//     >
//       <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
//         <Icon size={18} />
//       </span>
//       <span className="font-extrabold text-sm">{label}</span>
//     </button>
//   );
// }

// type TabKey = 'overview' | 'queue' | 'my_jobs' | 'earnings' | 'availability' | 'profile' | 'documents';

// export default function TechnicianDashboardPage() {
//   const router = useRouter();
//   const { role: authRole, checked, isLoggedIn } = useAuth();
//   const [tab, setTab] = useState<TabKey>('overview');

//   const [online, setOnline] = useState<TechnicianOnline>('online');
//   const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('unverified');

//   const [jobQueue, setJobQueue] = useState<JobQueueItem[]>([]);
//   const [myJobs, setMyJobs] = useState<MyJob[]>([]);
//   const [docs, setDocs] = useState<TechDocs>({});
//   const [profile, setProfile] = useState<TechProfile | null>(null);
//   const [availability, setAvailability] = useState<Record<string, boolean>>({});

//   const [tickerNow, setTickerNow] = useState<number>(Date.now());

//   const [upiEditing, setUpiEditing] = useState(false);
//   const [upiDraft, setUpiDraft] = useState('');

//   const mountedRef = useRef(false);

//   useEffect(() => {
//     if (mountedRef.current) return;
//     mountedRef.current = true;

//     // const savedOnline = localStorage.getItem(STORAGE_ONLINE) as TechnicianOnline | null;
//     // const savedVerification = localStorage.getItem(STORAGE_VERIFICATION) as VerificationStatus | null;
//     // const savedQueue = safeParse<JobQueueItem[]>(localStorage.getItem(STORAGE_JOB_QUEUE));

//     const savedOnline =
//   typeof window !== "undefined"
//     ? localStorage.getItem(STORAGE_ONLINE)
//     : null;

// const savedVerification =
//   typeof window !== "undefined"
//     ? localStorage.getItem(STORAGE_VERIFICATION)
//     : null;

// const savedQueue =
//   typeof window !== "undefined"
//     ? safeParse(localStorage.getItem(STORAGE_JOB_QUEUE))
//     : null;

//     const savedMyJobs = safeParse<MyJob[]>(localStorage.getItem(STORAGE_MY_JOBS));
//     const savedAvail = safeParse<Record<string, boolean>>(localStorage.getItem(STORAGE_AVAILABILITY));
//     const savedDocs = safeParse<TechDocs>(localStorage.getItem(STORAGE_DOCS));
//     const savedProfile = safeParse<TechProfile>(localStorage.getItem(STORAGE_PROFILE));

//     setOnline(savedOnline === 'offline' ? 'offline' : 'online');
//     //setVerificationStatus(savedVerification || 'unverified');
//     setVerificationStatus(
//       savedVerification === 'verified' ||
//       savedVerification === 'pending' ||
//       savedVerification === 'unverified'
//         ? savedVerification
//         : 'unverified'
//     );
//    // setJobQueue(seedJobQueueIfEmpty(savedQueue || null));
//    setJobQueue(
//     seedJobQueueIfEmpty(Array.isArray(savedQueue) ? savedQueue : null)
//   );
//     // setMyJobs(seedMyJobsIfEmpty(savedMyJobs || null));
//     // setAvailability(seedAvailabilityIfEmpty(savedAvail || null));
//     setMyJobs(
//       seedMyJobsIfEmpty(Array.isArray(savedMyJobs) ? savedMyJobs : null)
//     );
    
//     setAvailability(
//       seedAvailabilityIfEmpty(
//         savedAvail && typeof savedAvail === "object" ? savedAvail : null
//       )
//     );
//     setDocs(seedDocsIfEmpty(savedDocs || null));
//     setProfile(seedProfileIfEmpty(savedProfile || null));
//   }, []);

//   useEffect(() => {
//     if (!mountedRef.current) return;
//     localStorage.setItem(STORAGE_ONLINE, online);
//   }, [online]);

//   useEffect(() => {
//     if (!mountedRef.current) return;
//     localStorage.setItem(STORAGE_VERIFICATION, verificationStatus);
//   }, [verificationStatus]);

//   useEffect(() => {
//     if (!mountedRef.current) return;
//     localStorage.setItem(STORAGE_JOB_QUEUE, JSON.stringify(jobQueue));
//   }, [jobQueue]);

//   useEffect(() => {
//     if (!mountedRef.current) return;
//     localStorage.setItem(STORAGE_MY_JOBS, JSON.stringify(myJobs));
//   }, [myJobs]);

//   useEffect(() => {
//     if (!mountedRef.current) return;
//     localStorage.setItem(STORAGE_AVAILABILITY, JSON.stringify(availability));
//   }, [availability]);

//   useEffect(() => {
//     if (!mountedRef.current) return;
//     localStorage.setItem(STORAGE_DOCS, JSON.stringify(docs));
//   }, [docs]);

//   useEffect(() => {
//     if (!mountedRef.current) return;
//     localStorage.setItem(STORAGE_PROFILE, JSON.stringify(profile));
//   }, [profile]);

//   useEffect(() => {
//     const t = window.setInterval(() => setTickerNow(Date.now()), 1000);
//     return () => window.clearInterval(t);
//   }, []);

//   useEffect(() => {
//     // Auto-expire job queue items
//     if (!jobQueue.length) return;
//     const expired = jobQueue.filter((j) => j.expiresAt <= tickerNow);
//     if (!expired.length) return;
//     setJobQueue((cur) => cur.filter((j) => j.expiresAt > tickerNow));
//     for (const j of expired) toast.error(`Job ${j.id} expired.`);
//   }, [tickerNow, jobQueue]);

//   const greeting = useMemo(() => {
//     const h = new Date().getHours();
//     if (h < 12) return 'Good morning';
//     if (h < 17) return 'Good afternoon';
//     return 'Good evening';
//   }, []);

//   const name = useMemo(() => {
//     // Use profile.name from local session for greeting; localStorage profile can be different.
//     const stored = safeParse<{ name?: string }>(localStorage.getItem('aurowater_profile'));
//     return stored?.name || 'Technician';
//   }, []);

//   const completionBanner = useMemo(() => {
//     if (verificationStatus === 'verified') {
//       return { tone: 'bg-emerald-50 border-emerald-200 text-emerald-900', title: "✅ You're a Verified AuroWater Technician!", cta: null as null | string };
//     }
//     if (verificationStatus === 'pending') {
//       return {
//         tone: 'bg-sky-50 border-sky-200 text-sky-900',
//         title: '🕐 Your ID is under review. Usually takes 1–2 business days.',
//         cta: 'Upload Documents',
//       };
//     }
//     return {
//       tone: 'bg-amber-50 border-amber-200 text-amber-900',
//       title: '⚠️ Complete your profile and upload ID to start accepting jobs',
//       cta: 'Upload Documents',
//     };
//   }, [verificationStatus]);

//   const activeJob = useMemo(() => myJobs.find((j) => j.status === 'in_progress') || null, [myJobs]);

//   const jobsTodayCount = useMemo(() => {
//     const d = new Date();
//     const isSameDay = (t?: number) => {
//       if (!t) return false;
//       const dt = new Date(t);
//       return dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth() && dt.getDate() === d.getDate();
//     };
//     return myJobs.filter((j) => (j.completedAt ? isSameDay(j.completedAt) : false)).length;
//   }, [myJobs]);

//   const totalCompletedCount = useMemo(() => myJobs.filter((j) => j.status === 'completed').length, [myJobs]);

//   const avgRating = useMemo(() => {
//     const rated = myJobs.filter((j) => typeof j.rating === 'number') as Array<MyJob & { rating: number }>;
//     if (!rated.length) return null;
//     return rated.reduce((s, j) => s + j.rating, 0) / rated.length;
//   }, [myJobs]);

//   const thisMonthEarnings = useMemo(() => {
//     const d = new Date();
//     const ym = `${d.getFullYear()}-${d.getMonth()}`;
//     return myJobs
//       .filter((j) => j.status === 'completed' && j.completedAt)
//       .reduce((sum, j) => {
//         const dj = j.completedAt ? new Date(j.completedAt) : null;
//         if (!dj) return sum;
//         const key = `${dj.getFullYear()}-${dj.getMonth()}`;
//         return key === ym ? sum + j.price : sum;
//       }, 0);
//   }, [myJobs]);

//   const acceptJobFromQueue = (job: JobQueueItem) => {
//     const nextMy: MyJob = { ...job, status: 'upcoming', acceptedAt: Date.now() };
//     setMyJobs((cur) => [nextMy, ...cur]);
//     setJobQueue((cur) => cur.filter((j) => j.id !== job.id));
//     toast.success(`Job ${job.id} accepted! Customer will be notified.`);
//   };

//   const declineJobFromQueue = (job: JobQueueItem) => {
//     setJobQueue((cur) => cur.filter((j) => j.id !== job.id));
//     toast.error('Job declined');
//   };

//   const startJob = (jobId: string) => {
//     setMyJobs((cur) =>
//       cur.map((j) => (j.id === jobId ? { ...j, status: 'in_progress', startedAt: Date.now() } : j))
//     );
//     toast.success('Job started. Good luck!');
//   };

//   const completeJob = (jobId: string) => {
//     setMyJobs((cur) =>
//       cur.map((j) => (j.id === jobId ? { ...j, status: 'completed', completedAt: Date.now() } : j))
//     );
//     toast.success('Job marked completed.');
//   };

//   const [queueFilterCount, setQueueFilterCount] = useState(0);
//   useEffect(() => setQueueFilterCount(jobQueue.length), [jobQueue.length]);

//   const [myJobFilter, setMyJobFilter] = useState<'all' | MyJobStatus>('all');
//   const visibleMyJobs = useMemo(() => {
//     if (myJobFilter === 'all') return myJobs;
//     if (myJobFilter === 'upcoming') return myJobs.filter((j) => j.status === 'upcoming');
//     return myJobs.filter((j) => j.status === myJobFilter);
//   }, [myJobs, myJobFilter]);

//   const [expandedMyJobId, setExpandedMyJobId] = useState<string | null>(null);

//   const earningsDaily = useMemo(() => {
//     const completed = myJobs.filter((j) => j.status === 'completed' && j.completedAt) as Array<MyJob & { completedAt: number }>;
//     // Build last 7 days buckets (Mon..Sun styling; best-effort)
//     const today = new Date();
//     const days: number[] = [];
//     for (let i = 6; i >= 0; i -= 1) {
//       const dt = new Date(today);
//       dt.setDate(today.getDate() - i);
//       const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
//       const sum = completed
//         .filter((j) => {
//           const dj = new Date(j.completedAt);
//           const k = `${dj.getFullYear()}-${dj.getMonth()}-${dj.getDate()}`;
//           return k === key;
//         })
//         .reduce((s, j) => s + j.price, 0);
//       days.push(sum);
//     }
//     return days.length ? days : [850, 0, 1200, 400, 0, 980, 650];
//   }, [myJobs]);

//   const earningsTotal = useMemo(() => myJobs.filter((j) => j.status === 'completed').reduce((s, j) => s + j.price, 0), [myJobs]);
//   const earningsToday = useMemo(() => earningsDaily[6] || 0, [earningsDaily]);
//   const earningsThisWeek = useMemo(() => earningsDaily.reduce((s, v) => s + v, 0), [earningsDaily]);

//   const payoutHistoryKey = 'aurowater_tech_payout_history';
//   const payoutHistory = useMemo(() => {
//     const saved = safeParse<Array<{ id: string; date: string; jobs: number; amount: number; status: 'Paid' | 'Pending' }>>(
//       localStorage.getItem(payoutHistoryKey)
//     );
//     return saved || [];
//   }, [/* compute at render only */]); // intentionally only used in initial seed below

//   useEffect(() => {
//     const saved = safeParse<Array<{ id: string; date: string; jobs: number; amount: number; status: 'Paid' | 'Pending' }>>(
//       localStorage.getItem(payoutHistoryKey)
//     );
//     if (saved && saved.length) return;
//     const base = new Date();
//     const seed = [
//       { id: 'P-001', date: base.toLocaleDateString(), jobs: 6, amount: 4200, status: 'Paid' as const },
//       { id: 'P-002', date: base.toLocaleDateString(undefined, { day: '2-digit' }), jobs: 4, amount: 2900, status: 'Paid' as const },
//       { id: 'P-003', date: base.toLocaleDateString(undefined, { day: '2-digit' }), jobs: 2, amount: 650, status: 'Pending' as const },
//     ];
//     try {
//       localStorage.setItem(payoutHistoryKey, JSON.stringify(seed));
//     } catch {
//       // ignore
//     }
//   }, []);

//   const payoutHistoryLive = useMemo(() => {
//     const saved = safeParse<Array<{ id: string; date: string; jobs: number; amount: number; status: 'Paid' | 'Pending' }>>(
//       localStorage.getItem(payoutHistoryKey)
//     );
//     return saved || [];
//   }, [myJobs]);

//   const pendingBalance = useMemo(() => {
//     return payoutHistoryLive.filter((p) => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);
//   }, [payoutHistoryLive]);

//   const requestPayout = () => {
//     if (pendingBalance < 500) {
//       toast.error('Pending balance should be at least ₹500.');
//       return;
//     }
//     const next = [
//       { id: `P-${Math.floor(Math.random() * 900 + 100)}`, date: new Date().toLocaleDateString(), jobs: 0, amount: pendingBalance, status: 'Pending' as const },
//       ...payoutHistoryLive.filter((p) => p.status !== 'Pending'),
//     ];
//     try {
//       localStorage.setItem(payoutHistoryKey, JSON.stringify(next));
//     } catch {
//       // ignore
//     }
//     toast.success('Payout request submitted.');
//   };

//   const updateVerificationStatusToPending = () => {
//     setVerificationStatus('pending');
//     setDocs((cur) => ({ ...cur, verificationStatus: 'pending', submittedAt: Date.now() }));
//   };

//   if (!checked) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading…</div>;
//   if (!isLoggedIn || authRole !== 'technician') {
//     return (
//       <div className="min-h-screen bg-slate-50">
//         <div className="max-w-2xl mx-auto px-4 py-14">
//           <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-7">
//             <div className="text-2xl font-extrabold text-[#0F1C18]">Technician access</div>
//             <p className="text-slate-600 mt-2 text-sm">
//               Please sign in as a Technician to view this dashboard.
//             </p>
//             <button type="button" onClick={() => router.push('/auth/login')} className="mt-5 w-full rounded-xl bg-[#0D9B6C] text-white font-extrabold py-3 hover:bg-[#086D4C] transition-all">
//               Go to Sign In
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-slate-50">
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
//         <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
//           {/* Sidebar */}
//           <aside className="lg:col-span-3 xl:col-span-2">
//             <div className="lg:sticky lg:top-6 rounded-3xl border border-slate-100 bg-white shadow-card p-4">
//               <div className="flex items-center gap-3 px-2 py-2">
//                 <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0D9B6C] to-[#38BDF8] text-white font-extrabold flex items-center justify-center">
//                   {profile?.skills?.[0] ? 'T' : '🔧'}
//                 </div>
//                 <div className="min-w-0">
//                   <div className="font-extrabold text-[#0F1C18] truncate">Technician</div>
//                   <div className="text-xs text-slate-500 truncate">{name}</div>
//                 </div>
//               </div>

//               <div className="mt-4 space-y-2">
//                 <SidebarItem icon={LayoutDashboard} label="Overview" active={tab === 'overview'} onClick={() => setTab('overview')} />
//                 <SidebarItem icon={Bell} label={`Job Queue (${queueFilterCount})`} active={tab === 'queue'} onClick={() => setTab('queue')} />
//                 <SidebarItem icon={Briefcase} label="My Jobs" active={tab === 'my_jobs'} onClick={() => setTab('my_jobs')} />
//                 <SidebarItem icon={IndianRupee} label="Earnings" active={tab === 'earnings'} onClick={() => setTab('earnings')} />
//                 <SidebarItem icon={Clock} label="Availability" active={tab === 'availability'} onClick={() => setTab('availability')} />
//                 <SidebarItem icon={User} label="Profile" active={tab === 'profile'} onClick={() => setTab('profile')} />
//                 <SidebarItem icon={FileText} label="Documents" active={tab === 'documents'} onClick={() => setTab('documents')} />
//               </div>

//               <div className="mt-4 pt-4 border-t border-slate-100">
//                 <button
//                   type="button"
//                   onClick={() => router.push('/')}
//                   className="w-full flex items-center gap-2 rounded-2xl px-4 py-3 hover:bg-slate-50 border border-slate-100 text-slate-700 font-extrabold text-sm transition-all"
//                 >
//                   <ArrowLeft size={18} /> Back to Site
//                 </button>
//               </div>
//             </div>
//           </aside>

//           {/* Main */}
//           <main className="lg:col-span-9 xl:col-span-10">
//             {tab === 'overview' && (
//               <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
//                 {/* Top bar */}
//                 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
//                   <div>
//                     <div className="text-sm font-semibold text-slate-600">{greeting}, {name}</div>
//                     <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Dashboard</div>
//                   </div>

//                   <div className="flex items-center gap-4">
//                     <div className="flex items-center gap-3">
//                       <div className="text-sm font-extrabold text-slate-700">Status</div>
//                       <button
//                         type="button"
//                         onClick={() => setOnline('online')}
//                         className={[
//                           'h-12 px-4 rounded-2xl font-extrabold text-sm border transition-all',
//                           online === 'online' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
//                         ].join(' ')}
//                       >
//                         ● Online
//                       </button>
//                       <button
//                         type="button"
//                         onClick={() => setOnline('offline')}
//                         className={[
//                           'h-12 px-4 rounded-2xl font-extrabold text-sm border transition-all',
//                           online === 'offline' ? 'bg-slate-200 text-slate-900 border-slate-200' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
//                         ].join(' ')}
//                       >
//                         ○ Offline
//                       </button>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Verification banner */}
//                 <div className={['mt-5 rounded-3xl border p-4', completionBanner.tone].join(' ')}>
//                   <div className="flex items-start justify-between gap-4">
//                     <div className="font-extrabold">{completionBanner.title}</div>
//                     {completionBanner.cta ? (
//                       <button
//                         type="button"
//                         onClick={() => setTab('documents')}
//                         className="rounded-2xl bg-white text-[#0D9B6C] font-extrabold px-4 py-2 border border-white/60 hover:bg-slate-50 transition-all active:scale-95"
//                       >
//                         {completionBanner.cta}
//                       </button>
//                     ) : null}
//                   </div>
//                 </div>

//                 {/* Stat cards */}
//                 <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
//                   <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
//                     <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Jobs Today</div>
//                     <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{jobsTodayCount}</div>
//                   </div>
//                   <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
//                     <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Total Completed</div>
//                     <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{totalCompletedCount}</div>
//                   </div>
//                   <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
//                     <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Avg Rating</div>
//                     <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">
//                       {avgRating ? avgRating.toFixed(1) : '—'}/5
//                     </div>
//                   </div>
//                   <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
//                     <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">This Month ₹</div>
//                     <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{formatMoney(thisMonthEarnings)}</div>
//                   </div>
//                 </div>

//                 {/* Active job card */}
//                 <div className="mt-6 rounded-3xl bg-white border border-slate-100 p-5">
//                   <div className="flex items-start justify-between gap-4">
//                     <div>
//                       <div className="text-sm font-extrabold text-slate-700">Active Job</div>
//                       <div className="text-lg font-extrabold text-[#0F1C18] mt-1">
//                         {activeJob ? activeJob.service : 'No active job'}
//                       </div>
//                       <div className="text-sm text-slate-600 mt-1">
//                         {activeJob ? `${activeJob.sub} · ${activeJob.area}` : 'Accept a job from Queue to get started.'}
//                       </div>
//                       {activeJob ? (
//                         <div className="text-xs font-semibold text-slate-500 mt-2">
//                           ▶ Started: {activeJob.startedAt ? new Date(activeJob.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : nowIsoLocal()}
//                         </div>
//                       ) : null}
//                     </div>
//                     <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
//                       {activeJob ? (
//                         <button
//                           type="button"
//                           onClick={() => completeJob(activeJob.id)}
//                           className="rounded-2xl bg-emerald-600 text-white font-extrabold px-5 py-3 hover:bg-emerald-700 active:scale-95 transition-all"
//                         >
//                           ▶ Mark as Completed
//                         </button>
//                       ) : (
//                         <button
//                           type="button"
//                           onClick={() => setTab('queue')}
//                           className="rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
//                         >
//                           Open Job Queue
//                         </button>
//                       )}
//                       <button
//                         type="button"
//                         onClick={() => toast.success('Support request sent (simulated).')}
//                         className="rounded-2xl border border-slate-200 bg-white text-slate-800 font-extrabold px-5 py-3 hover:bg-slate-50 active:scale-95 transition-all"
//                       >
//                         📞 Contact Support
//                       </button>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {tab === 'queue' && (
//               <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
//                 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//                   <div>
//                     <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Job Queue</div>
//                     <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Receive jobs you can complete</div>
//                     <div className="text-sm text-slate-600 mt-1">Accept before the timer ends. Expired jobs are removed automatically.</div>
//                   </div>
//                   <div className="flex items-center gap-2">
//                     <div className="rounded-2xl bg-[#E8F8F2] border border-[#0D9B6C]/30 px-4 py-2 font-extrabold text-[#0D9B6C]">
//                       {jobQueue.length} in queue
//                     </div>
//                   </div>
//                 </div>

//                 <div className="mt-6 space-y-3">
//                   {jobQueue.length === 0 ? (
//                     <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center">
//                       <div className="text-4xl">📭</div>
//                       <div className="font-extrabold text-slate-900 mt-2">No jobs right now</div>
//                       <div className="text-sm text-slate-600 mt-1">Turn Online to start receiving requests.</div>
//                     </div>
//                   ) : (
//                     jobQueue.map((j) => {
//                       const remaining = j.expiresAt - tickerNow;
//                       const timerText = remaining <= 0 ? 'Expired' : minutesSeconds(remaining);
//                       return (
//                         <div key={j.id} className="rounded-3xl border border-slate-100 bg-white p-4">
//                           <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
//                             <div className="flex-1">
//                               <div className="flex items-center gap-3">
//                                 <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl">
//                                   {j.service === 'Plumbing' ? '🧰' : j.service === 'RO Service' ? '🚿' : '⚙️'}
//                                 </div>
//                                 <div className="min-w-0">
//                                   <div className="font-extrabold text-slate-900 truncate">{j.service}</div>
//                                   <div className="text-sm text-slate-600 mt-1">{j.sub}</div>
//                                 </div>
//                               </div>

//                               <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
//                                 <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
//                                   <div className="text-xs font-extrabold text-slate-500">📍 Area</div>
//                                   <div className="text-sm font-extrabold text-slate-800 mt-1">{j.area}</div>
//                                 </div>
//                                 <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
//                                   <div className="text-xs font-extrabold text-slate-500">📅 Date/Slot</div>
//                                   <div className="text-sm font-extrabold text-slate-800 mt-1">{j.date} · {j.slot}</div>
//                                 </div>
//                                 <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
//                                   <div className="text-xs font-extrabold text-slate-500">💰 Price</div>
//                                   <div className="text-sm font-extrabold text-[#0D9B6C] mt-1">{formatMoney(j.price)}</div>
//                                 </div>
//                               </div>
//                             </div>

//                             <div className="w-full lg:w-72">
//                               <div className="flex items-center justify-between gap-3">
//                                 <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-700">
//                                   📍 {j.distance}
//                                 </div>
//                                 <div className={['text-xs font-extrabold rounded-full px-3 py-1 border', remaining < 5 * 60 * 1000 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-slate-600'].join(' ')}>
//                                   ⏱ {timerText}
//                                 </div>
//                               </div>

//                               <div className="mt-4 flex gap-2">
//                                 <button
//                                   type="button"
//                                   onClick={() => acceptJobFromQueue(j)}
//                                   className="flex-1 rounded-2xl bg-emerald-600 text-white font-extrabold py-3 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-60"
//                                   disabled={verificationStatus !== 'verified' || online !== 'online'}
//                                   title={verificationStatus !== 'verified' ? 'Upload documents and get verified' : online !== 'online' ? 'Set Online to accept jobs' : ''}
//                                 >
//                                   Accept ✓
//                                 </button>
//                                 <button
//                                   type="button"
//                                   onClick={() => declineJobFromQueue(j)}
//                                   className="flex-1 rounded-2xl border border-rose-200 text-rose-700 font-extrabold py-3 hover:bg-rose-50 active:scale-95 transition-all"
//                                 >
//                                   Decline ✗
//                                 </button>
//                               </div>
//                               <div className="mt-3 text-xs text-slate-500 font-semibold">
//                                 {verificationStatus !== 'verified' ? 'Complete verification to accept jobs.' : online !== 'online' ? 'Set Online to receive and accept jobs.' : ' '}
//                               </div>
//                             </div>
//                           </div>
//                         </div>
//                       );
//                     })
//                   )}
//                 </div>
//               </div>
//             )}

//             {tab === 'my_jobs' && (
//               <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
//                 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//                   <div>
//                     <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">My Jobs</div>
//                     <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Start, complete, and track your earnings</div>
//                   </div>
//                 </div>

//                 <div className="mt-6 flex flex-wrap gap-2">
//                   {([
//                     { key: 'all', label: 'All' },
//                     { key: 'upcoming', label: 'Upcoming' },
//                     { key: 'in_progress', label: 'In Progress' },
//                     { key: 'completed', label: 'Completed' },
//                     { key: 'cancelled', label: 'Cancelled' },
//                   ] as Array<{ key: typeof myJobFilter; label: string }>).map((f) => {
//                     const active = myJobFilter === f.key;
//                     return (
//                       <button
//                         key={f.key}
//                         type="button"
//                         onClick={() => setMyJobFilter(f.key)}
//                         className={[
//                           'px-4 py-2 rounded-full border text-sm font-extrabold transition-all',
//                           active ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
//                         ].join(' ')}
//                       >
//                         {f.label}
//                       </button>
//                     );
//                   })}
//                 </div>

//                 <div className="mt-6 space-y-3">
//                   {visibleMyJobs.length === 0 ? (
//                     <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 text-center">
//                       <div className="text-4xl">📅</div>
//                       <div className="font-extrabold text-slate-900 mt-2">No jobs here yet</div>
//                       <div className="text-sm text-slate-600 mt-1">Accept a job from your queue to populate this tab.</div>
//                       <button type="button" onClick={() => setTab('queue')} className="mt-5 rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] transition-all active:scale-95">
//                         Go to Job Queue
//                       </button>
//                     </div>
//                   ) : (
//                     visibleMyJobs
//                       .sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0))
//                       .map((j) => {
//                         const expanded = expandedMyJobId === j.id;
//                         return (
//                           <div key={j.id} className="rounded-3xl border border-slate-100 bg-white overflow-hidden">
//                             <button
//                               type="button"
//                               onClick={() => setExpandedMyJobId(expanded ? null : j.id)}
//                               className="w-full p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 text-left"
//                             >
//                               <div className="flex items-start gap-3">
//                                 <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl">
//                                   {j.service === 'Plumbing' ? '🧰' : j.service === 'RO Service' ? '🚿' : '⚙️'}
//                                 </div>
//                                 <div>
//                                   <div className="font-extrabold text-slate-900">{j.service} · {j.sub}</div>
//                                   <div className="text-sm text-slate-600 mt-1">{j.area}</div>
//                                   <div className="text-xs font-semibold text-slate-500 mt-2">
//                                     {j.date} · {j.slot} · Accepted {new Date(j.acceptedAt).toLocaleDateString()}
//                                   </div>
//                                 </div>
//                               </div>
//                               <div className="sm:text-right">
//                                 <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 border border-slate-200 bg-slate-50">
//                                   <span className="text-xs font-extrabold text-slate-700">Status</span>
//                                   <span className={['text-xs font-extrabold', j.status === 'completed' ? 'text-emerald-700' : j.status === 'in_progress' ? 'text-violet-700' : j.status === 'upcoming' ? 'text-[#0D9B6C]' : 'text-rose-700'].join(' ')}>
//                                     {j.status.replace('_', ' ')}
//                                   </span>
//                                 </div>
//                                 <div className="font-extrabold text-[#0D9B6C] mt-2">{formatMoney(j.price)}</div>
//                                 {j.status === 'completed' && typeof j.rating === 'number' ? (
//                                   <div className="text-xs font-extrabold text-slate-600 mt-2">
//                                     ⭐ {j.rating}/5
//                                   </div>
//                                 ) : null}
//                               </div>
//                             </button>

//                             {expanded ? (
//                               <div className="p-4 pt-0">
//                                 <div className="mt-2 rounded-2xl bg-slate-50 border border-slate-100 p-4">
//                                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
//                                     <div>
//                                       <div className="text-xs font-extrabold text-slate-500">Job ID</div>
//                                       <div className="font-extrabold text-slate-800 mt-1">{j.id}</div>
//                                     </div>
//                                     <div>
//                                       <div className="text-xs font-extrabold text-slate-500">Scheduled</div>
//                                       <div className="font-extrabold text-slate-800 mt-1">{j.date} · {j.slot}</div>
//                                     </div>
//                                     <div>
//                                       <div className="text-xs font-extrabold text-slate-500">Service City</div>
//                                       <div className="font-extrabold text-slate-800 mt-1">{profile?.serviceCities?.[0] || '—'}</div>
//                                     </div>
//                                   </div>
//                                 </div>

//                                 <div className="mt-4 flex flex-col sm:flex-row gap-3">
//                                   {j.status === 'upcoming' ? (
//                                     <button type="button" onClick={() => startJob(j.id)} className="flex-1 rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all">
//                                       Start Job
//                                     </button>
//                                   ) : null}
//                                   {j.status === 'in_progress' ? (
//                                     <button type="button" onClick={() => completeJob(j.id)} className="flex-1 rounded-2xl bg-emerald-600 text-white font-extrabold px-5 py-3 hover:bg-emerald-700 active:scale-95 transition-all">
//                                       Complete Job
//                                     </button>
//                                   ) : null}
//                                   {j.status === 'completed' ? (
//                                     <button
//                                       type="button"
//                                       onClick={() => {
//                                         const r = 4 + Math.floor(Math.random() * 2);
//                                         setMyJobs((cur) => cur.map((x) => (x.id === j.id ? { ...x, rating: r } : x)));
//                                         toast.success(`Rating received: ${r}★`);
//                                       }}
//                                       className="flex-1 rounded-2xl border border-slate-200 bg-white text-slate-800 font-extrabold px-5 py-3 hover:bg-slate-50 active:scale-95 transition-all"
//                                     >
//                                       Receive Rating
//                                     </button>
//                                   ) : null}
//                                   {j.status !== 'completed' ? (
//                                     <button
//                                       type="button"
//                                       onClick={() => {
//                                         setMyJobs((cur) => cur.map((x) => (x.id === j.id ? { ...x, status: 'cancelled' } : x)));
//                                         toast.error('Job cancelled.');
//                                       }}
//                                       className="flex-1 rounded-2xl border border-rose-200 bg-white text-rose-700 font-extrabold px-5 py-3 hover:bg-rose-50 active:scale-95 transition-all"
//                                     >
//                                       Cancel Job
//                                     </button>
//                                   ) : null}
//                                 </div>
//                               </div>
//                             ) : null}
//                           </div>
//                         );
//                       })
//                   )}
//                 </div>
//               </div>
//             )}

//             {tab === 'earnings' && (
//               <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
//                 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
//                   <div>
//                     <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Earnings</div>
//                     <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Track payouts and job revenue</div>
//                     <div className="text-sm text-slate-600 mt-1">Updated instantly from your completed jobs.</div>
//                   </div>
//                   <button type="button" onClick={requestPayout} className="rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60" disabled={pendingBalance < 500}>
//                     Request Payout
//                   </button>
//                 </div>

//                 <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
//                   <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
//                     <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Today ₹</div>
//                     <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{formatMoney(earningsToday)}</div>
//                   </div>
//                   <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
//                     <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">This Week ₹</div>
//                     <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{formatMoney(earningsThisWeek)}</div>
//                   </div>
//                   <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
//                     <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">This Month ₹</div>
//                     <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{formatMoney(thisMonthEarnings)}</div>
//                   </div>
//                   <div className="rounded-3xl bg-slate-50 border border-slate-100 p-5">
//                     <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Total ₹</div>
//                     <div className="mt-2 text-3xl font-extrabold text-[#0D9B6C]">{formatMoney(earningsTotal)}</div>
//                   </div>
//                 </div>

//                 <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
//                   <div className="rounded-3xl border border-slate-100 bg-white p-5">
//                     <div className="flex items-center justify-between gap-3">
//                       <div className="font-extrabold text-[#0F1C18]">Last 7 days</div>
//                       <div className="text-xs font-extrabold text-slate-500">CSS bar chart</div>
//                     </div>
//                     <div className="mt-4 flex items-end gap-3">
//                       {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => {
//                         const max = Math.max(1, ...earningsDaily);
//                         const val = earningsDaily[i] ?? 0;
//                         const height = Math.round((val / max) * 160);
//                         return (
//                           <div key={d} className="flex flex-col items-center flex-1">
//                             <div
//                               className="w-full rounded-md bg-gradient-to-t from-[#0D9B6C] to-[#38BDF8]"
//                               style={{ height: 20 + height }}
//                               aria-label={`${d}: ₹${val}`}
//                             />
//                             <div className="mt-2 text-xs font-extrabold text-slate-600">{d}</div>
//                             <div className="text-[10px] font-extrabold text-slate-500 mt-1">₹{val}</div>
//                           </div>
//                         );
//                       })}
//                     </div>
//                   </div>

//                   <div className="rounded-3xl border border-slate-100 bg-white p-5">
//                     <div className="font-extrabold text-[#0F1C18]">Payouts</div>
//                     <div className="text-sm text-slate-600 mt-1">UPI ID: {profile?.upiId || '—'}</div>
//                     <div className="mt-3 flex items-center gap-2">
//                       {!upiEditing ? (
//                         <button
//                           type="button"
//                           onClick={() => {
//                             setUpiEditing(true);
//                             setUpiDraft(profile?.upiId || '');
//                           }}
//                           className="rounded-2xl border border-slate-200 bg-white text-slate-700 font-extrabold px-4 py-2 hover:bg-slate-50 transition-all"
//                         >
//                           Edit UPI
//                         </button>
//                       ) : (
//                         <>
//                           <input
//                             value={upiDraft}
//                             onChange={(e) => setUpiDraft(e.target.value)}
//                             className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 focus:ring-2 focus:ring-[#0D9B6C]"
//                             placeholder="name@upi"
//                           />
//                           <button
//                             type="button"
//                             onClick={() => {
//                               setProfile((cur) => (cur ? { ...cur, upiId: upiDraft.trim() } : cur));
//                               setUpiEditing(false);
//                               toast.success('UPI ID updated.');
//                             }}
//                             className="rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-4 py-2 hover:bg-[#086D4C] active:scale-95 transition-all"
//                           >
//                             Save
//                           </button>
//                           <button
//                             type="button"
//                             onClick={() => setUpiEditing(false)}
//                             className="rounded-2xl border border-slate-200 bg-white text-slate-700 font-extrabold px-4 py-2 hover:bg-slate-50 transition-all"
//                           >
//                             Cancel
//                           </button>
//                         </>
//                       )}
//                     </div>

//                     <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
//                       <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Payout history</div>
//                       <div className="mt-3 overflow-x-auto">
//                         <table className="w-full text-sm">
//                           <thead>
//                             <tr className="text-left text-xs text-slate-500">
//                               <th className="py-2">Date</th>
//                               <th className="py-2">Jobs</th>
//                               <th className="py-2">Amount</th>
//                               <th className="py-2">Status</th>
//                             </tr>
//                           </thead>
//                           <tbody>
//                             {(() => {
//                               const key = 'aurowater_tech_payout_history';
//                               const saved = safeParse<Array<{ id: string; date: string; jobs: number; amount: number; status: 'Paid' | 'Pending' }>>(
//                                 localStorage.getItem(key)
//                               );
//                               const rows = saved && saved.length ? saved : [];
//                               if (!rows.length) {
//                                 return (
//                                   <tr>
//                                     <td colSpan={4} className="py-4 text-center text-slate-500">
//                                       No payout records yet.
//                                     </td>
//                                   </tr>
//                                 );
//                               }
//                               return rows.slice(0, 5).map((p) => (
//                                 <tr key={p.id} className="border-t border-slate-100">
//                                   <td className="py-2">{p.date}</td>
//                                   <td className="py-2 font-extrabold text-slate-800">{p.jobs}</td>
//                                   <td className="py-2 font-extrabold text-[#0D9B6C]">{formatMoney(p.amount)}</td>
//                                   <td className="py-2">
//                                     <span className={['inline-flex px-2 py-1 rounded-full text-[11px] font-extrabold border', p.status === 'Paid' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'].join(' ')}>
//                                       {p.status}
//                                     </span>
//                                   </td>
//                                 </tr>
//                               ));
//                             })()}
//                           </tbody>
//                         </table>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {tab === 'availability' && (
//               <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
//                 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
//                   <div>
//                     <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Availability</div>
//                     <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Choose when you can take jobs</div>
//                     <div className="text-sm text-slate-600 mt-1">Availability affects which bookings you’ll be shown.</div>
//                   </div>
//                   <button
//                     type="button"
//                     onClick={() => {
//                       toast.success('Availability saved.');
//                     }}
//                     className="rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
//                   >
//                     Save Availability
//                   </button>
//                 </div>

//                 <div className="mt-6 overflow-x-auto">
//                   <div className="min-w-[680px] rounded-3xl border border-slate-100 bg-white p-4">
//                     <div className="grid grid-cols-1 md:grid-cols-8 gap-2 items-center font-extrabold text-xs text-slate-500 uppercase tracking-wide">
//                       <div className="px-2 py-1">Slot</div>
//                       {DAYS.map((d) => (
//                         <div key={d} className="text-center">
//                           {d.toUpperCase()}
//                         </div>
//                       ))}
//                     </div>
//                     <div className="mt-3 space-y-2">
//                       {SLOTS.map((s) => {
//                         const label = s === 'morning' ? 'Morning (8-12)' : s === 'afternoon' ? 'Afternoon (12-5)' : 'Evening (5-8)';
//                         return (
//                           <div key={s} className="grid grid-cols-1 md:grid-cols-8 gap-2 items-center">
//                             <div className="px-2 py-2 text-sm font-extrabold text-slate-700">{label}</div>
//                             {DAYS.map((d) => {
//                               const key = `${d}:${s}`;
//                               const enabled = Boolean(availability[key]);
//                               return (
//                                 <button
//                                   key={key}
//                                   type="button"
//                                   onClick={() => setAvailability((cur) => ({ ...cur, [key]: !enabled }))}
//                                   className={[
//                                     'h-11 rounded-2xl border text-sm font-extrabold transition-all',
//                                     enabled ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
//                                   ].join(' ')}
//                                 >
//                                   {enabled ? 'Available' : '—'}
//                                 </button>
//                               );
//                             })}
//                           </div>
//                         );
//                       })}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="mt-5 flex items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4">
//                   <div>
//                     <div className="text-sm font-extrabold text-slate-900">Emergency Toggle</div>
//                     <div className="text-xs text-slate-600 mt-1">Accept emergency jobs (additional ₹199 surcharge)</div>
//                   </div>
//                   <button
//                     type="button"
//                     onClick={() => setAvailability((cur) => ({ ...cur, emergency: !cur.emergency }))}
//                     className={[
//                       'h-12 px-5 rounded-2xl font-extrabold border transition-all',
//                       availability.emergency ? 'bg-[#0D9B6C] text-white border-[#0D9B6C]' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
//                     ].join(' ')}
//                   >
//                     {availability.emergency ? 'Enabled' : 'Disabled'}
//                   </button>
//                 </div>
//               </div>
//             )}

//             {tab === 'profile' && (
//               <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
//                 <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Profile</div>
//                 <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Update your skills and service coverage</div>

//                 <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
//                   <div className="rounded-3xl border border-slate-100 bg-white p-5">
//                     <div className="font-extrabold text-[#0F1C18]">Skills</div>
//                     <div className="mt-3 flex flex-wrap gap-2">
//                       {SKILLS.map((s) => {
//                         const active = profile?.skills?.includes(s);
//                         return (
//                           <button
//                             key={s}
//                             type="button"
//                             onClick={() => {
//                               setProfile((cur) => {
//                                 if (!cur) return cur;
//                                 const has = cur.skills.includes(s);
//                                 const next = has ? cur.skills.filter((x) => x !== s) : [...cur.skills, s];
//                                 return { ...cur, skills: next };
//                               });
//                             }}
//                             className={[
//                               'px-4 py-2 rounded-full border text-sm font-extrabold transition-all active:scale-95',
//                               active ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
//                             ].join(' ')}
//                           >
//                             {s}
//                           </button>
//                         );
//                       })}
//                     </div>

//                     <div className="mt-6">
//                       <div className="font-extrabold text-[#0F1C18]">Service Cities</div>
//                       <div className="mt-3 flex flex-wrap gap-2">
//                         {UP_CITIES.map((c) => {
//                           const active = profile?.serviceCities?.includes(c);
//                           return (
//                             <button
//                               key={c}
//                               type="button"
//                               onClick={() => {
//                                 setProfile((cur) => {
//                                   if (!cur) return cur;
//                                   const has = cur.serviceCities.includes(c);
//                                   const next = has ? cur.serviceCities.filter((x) => x !== c) : [...cur.serviceCities, c];
//                                   return { ...cur, serviceCities: next };
//                                 });
//                               }}
//                               className={[
//                                 'px-4 py-2 rounded-full border text-sm font-extrabold transition-all active:scale-95',
//                                 active ? 'border-[#0D9B6C] bg-[#E8F8F2] text-[#0D9B6C]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
//                               ].join(' ')}
//                             >
//                               {c}
//                             </button>
//                           );
//                         })}
//                       </div>
//                     </div>
//                   </div>

//                   <div className="rounded-3xl border border-slate-100 bg-white p-5">
//                     <div className="font-extrabold text-[#0F1C18]">Bio</div>
//                     <textarea
//                       value={profile?.bio || ''}
//                       onChange={(e) => setProfile((cur) => (cur ? { ...cur, bio: e.target.value.slice(0, 200) } : cur))}
//                       className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:ring-2 focus:ring-[#0D9B6C]"
//                       placeholder="Tell customers what you specialize in and how you work."
//                       rows={6}
//                     />
//                     <div className="mt-1 text-xs font-semibold text-slate-500">{(profile?.bio || '').length}/200</div>

//                     <div className="mt-6">
//                       <div className="font-extrabold text-[#0F1C18]">Profile Completeness</div>
//                       {(() => {
//                         const fields = [
//                           (profile?.skills?.length || 0) > 0,
//                           (profile?.serviceCities?.length || 0) > 0,
//                           Boolean(profile?.bio && profile.bio.trim().length >= 30),
//                           Boolean(profile?.upiId && profile.upiId.includes('@')),
//                         ];
//                         const pct = Math.round((fields.filter(Boolean).length / fields.length) * 100);
//                         return (
//                           <div className="mt-3">
//                             <div className="h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-100">
//                               <div className="h-full rounded-full bg-[#0D9B6C]" style={{ width: `${pct}%` }} />
//                             </div>
//                             <div className="mt-2 text-sm font-extrabold text-[#0F1C18]">{`Profile ${pct}% complete`}</div>
//                           </div>
//                         );
//                       })()}
//                     </div>

//                     <button
//                       type="button"
//                       onClick={() => toast.success('Profile saved.')}
//                       className="mt-6 w-full rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all"
//                     >
//                       Save Profile
//                     </button>
//                   </div>
//                 </div>
//               </div>
//             )}

//             {tab === 'documents' && (
//               <div className="rounded-3xl border border-slate-100 bg-white shadow-card p-5 sm:p-7">
//                 <div className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Documents</div>
//                 <div className="text-2xl font-extrabold text-[#0F1C18] mt-1">Upload required ID for verification</div>
//                 <div className="text-sm text-slate-600 mt-1">Required: Aadhaar Front, Aadhaar Back, Profile Photo. Optional: Skill Certificate.</div>

//                 <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <UploadArea
//                     label="Aadhaar Card (Front)"
//                     required
//                     current={docs.aadhaarFront}
//                     onPick={(file) => setDocs((cur) => ({ ...cur, aadhaarFront: uploadMetaFromFile(file) }))}
//                     onRemove={() => setDocs((cur) => ({ ...cur, aadhaarFront: undefined }))}
//                   />
//                   <UploadArea
//                     label="Aadhaar Card (Back)"
//                     required
//                     current={docs.aadhaarBack}
//                     onPick={(file) => setDocs((cur) => ({ ...cur, aadhaarBack: uploadMetaFromFile(file) }))}
//                     onRemove={() => setDocs((cur) => ({ ...cur, aadhaarBack: undefined }))}
//                   />
//                   <UploadArea
//                     label="Profile Photo"
//                     required
//                     current={docs.profilePhoto}
//                     onPick={(file) => setDocs((cur) => ({ ...cur, profilePhoto: uploadMetaFromFile(file) }))}
//                     onRemove={() => setDocs((cur) => ({ ...cur, profilePhoto: undefined }))}
//                   />
//                   <UploadArea
//                     label="Skill Certificate (Optional)"
//                     required={false}
//                     current={docs.skillCert}
//                     onPick={(file) => setDocs((cur) => ({ ...cur, skillCert: uploadMetaFromFile(file) }))}
//                     onRemove={() => setDocs((cur) => ({ ...cur, skillCert: undefined }))}
//                   />
//                 </div>

//                 <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//                   <div className="text-sm font-extrabold text-slate-700">
//                     Verification Status:{' '}
//                     <span className={['ml-2 inline-flex px-3 py-1 rounded-full text-xs font-extrabold border', verificationStatus === 'verified' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : verificationStatus === 'pending' ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-amber-50 border-amber-200 text-amber-800'].join(' ')}>
//                       {verificationStatus}
//                     </span>
//                   </div>

//                   <button
//                     type="button"
//                     disabled={!requiredDocsUploaded(docs) || verificationStatus === 'verified' || verificationStatus === 'pending'}
//                     onClick={() => {
//                       if (!requiredDocsUploaded(docs)) {
//                         toast.error('Upload all required documents first.');
//                         return;
//                       }
//                       // Mark required docs as submitted
//                       setDocs((cur) => ({
//                         ...cur,
//                         aadhaarFront: cur.aadhaarFront ? { ...cur.aadhaarFront, status: 'submitted' } : cur.aadhaarFront,
//                         aadhaarBack: cur.aadhaarBack ? { ...cur.aadhaarBack, status: 'submitted' } : cur.aadhaarBack,
//                         profilePhoto: cur.profilePhoto ? { ...cur.profilePhoto, status: 'submitted' } : cur.profilePhoto,
//                         skillCert: cur.skillCert ? { ...cur.skillCert, status: cur.skillCert.status === 'uploaded' ? 'submitted' : cur.skillCert.status } : cur.skillCert,
//                         verificationStatus: 'pending',
//                       }));
//                       updateVerificationStatusToPending();
//                       toast.success("Documents submitted! We'll review within 48 hours.");
//                     }}
//                     className="rounded-2xl bg-[#0D9B6C] text-white font-extrabold px-5 py-3 hover:bg-[#086D4C] active:scale-95 transition-all disabled:opacity-60"
//                   >
//                     Submit for Verification
//                   </button>
//                 </div>

//                 {verificationStatus === 'pending' ? (
//                   <div className="mt-4 rounded-3xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 font-semibold">
//                     🕐 Under review. You can still update documents anytime.
//                   </div>
//                 ) : null}
//               </div>
//             )}
//           </main>
//         </div>
//       </div>
//     </div>
//   );
// }

// function UploadArea({
//   label,
//   required,
//   current,
//   onPick,
//   onRemove,
// }: {
//   label: string;
//   required: boolean;
//   current?: UploadMeta;
//   onPick: (file: File) => void;
//   onRemove: () => void;
// }) {
//   const inputRef = useRef<HTMLInputElement | null>(null);

//   const statusBadge = (() => {
//     if (!current) return { cls: 'bg-slate-100 border-slate-200 text-slate-700', text: '○ Not uploaded' };
//     if (current.status === 'verified') return { cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', text: '✓ Verified' };
//     if (current.status === 'rejected') return { cls: 'bg-rose-50 border-rose-200 text-rose-700', text: '✗ Rejected — Re-upload required' };
//     if (current.status === 'submitted') return { cls: 'bg-sky-50 border-sky-200 text-sky-700', text: '↑ Submitted' };
//     return { cls: 'bg-slate-50 border-slate-200 text-slate-700', text: 'Uploaded ✓' };
//   })();

//   return (
//     <div className="rounded-3xl border border-slate-100 bg-white p-4">
//       <div className="flex items-start justify-between gap-3">
//         <div>
//           <div className="font-extrabold text-slate-900">{label}</div>
//           <div className="text-xs font-extrabold text-slate-500 mt-1">{required ? 'Required' : 'Optional'}</div>
//         </div>
//         <span className={['inline-flex px-3 py-1 rounded-full text-xs font-extrabold border', statusBadge.cls].join(' ')}>
//           {statusBadge.text}
//         </span>
//       </div>

//       <input
//         ref={inputRef}
//         type="file"
//         className="hidden"
//         onChange={(e) => {
//           const file = e.target.files?.[0];
//           if (!file) return;
//           onPick(file);
//           if (inputRef.current) inputRef.current.value = '';
//         }}
//       />

//       <button
//         type="button"
//         onClick={() => inputRef.current?.click()}
//         className="mt-4 w-full rounded-2xl border-2 border-[#0D9B6C]/20 border-dashed bg-slate-50 hover:bg-slate-50/80 transition-all p-5 text-left"
//       >
//         <div className="flex items-start gap-3">
//           <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 flex items-center justify-center">
//             <CloudUpload size={18} className="text-[#0D9B6C]" />
//           </div>
//           <div className="flex-1">
//             <div className="font-extrabold text-[#0F1C18]">{current ? 'Update file' : 'Click to upload or drag & drop'}</div>
//             <div className="text-xs text-slate-600 mt-1">Supported: JPG, PNG, PDF (max 5MB)</div>
//             {current ? (
//               <div className="text-xs font-semibold text-slate-500 mt-2">
//                 {current.name} · {(current.size / 1024).toFixed(1)} KB
//               </div>
//             ) : null}
//           </div>
//         </div>
//       </button>

//       {current ? (
//         <div className="mt-3 flex items-center justify-end">
//           <button type="button" onClick={onRemove} className="rounded-2xl border border-rose-200 bg-white text-rose-700 font-extrabold px-4 py-2 hover:bg-rose-50 transition-all">
//             Remove
//           </button>
//         </div>
//       ) : null}
//     </div>
//   );
// }





'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
export const dynamic = 'force-dynamic';

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
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

// ─── Types ──────────────────────────────────────────────────────────────────

type TechnicianOnline = 'online' | 'offline';
type VerificationStatus = 'unverified' | 'pending' | 'verified';
type TechSkill = 'Plumbing' | 'RO Service' | 'Borewell' | 'Motor Repair' | 'Water Tanker' | 'Tank Cleaning Service';
type TechAvailabilitySlot = 'morning' | 'afternoon' | 'evening';
type TechDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type MyJobStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
type TabKey = 'overview' | 'queue' | 'my_jobs' | 'earnings' | 'availability' | 'profile' | 'documents';

const SKILLS: TechSkill[] = ['Plumbing', 'RO Service', 'Borewell', 'Motor Repair', 'Water Tanker', 'Tank Cleaning Service'];
const DAYS: TechDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SLOTS: TechAvailabilitySlot[] = ['morning', 'afternoon', 'evening'];
const UP_CITIES = ['Kanpur', 'Gorakhpur', 'Lucknow', 'Varanasi', 'Prayagraj', 'Agra', 'Meerut', 'Bareilly', 'Aligarh', 'Mathura', 'Delhi', 'Noida', 'Ghaziabad'] as const;

type JobQueueItem = {
  id: string;
  service: string;
  sub: string;
  area: string;
  date: string;
  slot: string;
  price: number;
  distance: string;
  expiresAt: number;
};

type MyJob = JobQueueItem & {
  status: MyJobStatus;
  acceptedAt: number;
  startedAt?: number;
  completedAt?: number;
  rating?: number;
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

type PayoutRecord = {
  id: string;
  date: string;
  jobs: number;
  amount: number;
  status: 'Paid' | 'Pending';
};

// ─── Storage Keys ────────────────────────────────────────────────────────────

const KEYS = {
  ONLINE: 'aurowater_tech_online',
  VERIFICATION: 'aurowater_tech_verification_status',
  JOB_QUEUE: 'aurowater_job_queue',
  MY_JOBS: 'aurowater_tech_jobs',
  AVAILABILITY: 'aurowater_tech_availability',
  DOCS: 'aurowater_tech_documents',
  PROFILE: 'aurowater_tech_profile',
  PAYOUT: 'aurowater_tech_payout_history',
  USER_PROFILE: 'aurowater_profile',
} as const;

// ─── SSR-safe localStorage helpers ───────────────────────────────────────────

function lsGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function lsSet(key: string, val: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, val); } catch { /* ignore */ }
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────

function seedJobQueue(current: JobQueueItem[] | null): JobQueueItem[] {
  if (current && current.length) return current;
  const base = Date.now();
  return [
    { id: 'JR-001', service: 'Plumbing', sub: 'Pipe Repair', area: 'Civil Lines, Kanpur', date: 'Today', slot: 'Morning', price: 199, distance: '2.3 km', expiresAt: base + 12 * 60 * 1000 },
    { id: 'JR-002', service: 'RO Service', sub: 'Filter Change', area: 'Kidwai Nagar, Kanpur', date: 'Today', slot: 'Afternoon', price: 279, distance: '4.1 km', expiresAt: base + 8 * 60 * 1000 },
    { id: 'JR-003', service: 'Motor Repair', sub: 'Submersible', area: 'Govind Nagar, Kanpur', date: 'Tomorrow', slot: 'Morning', price: 349, distance: '6.2 km', expiresAt: base + 45 * 60 * 1000 },
  ];
}

function seedAvailability(current: Record<string, boolean> | null): Record<string, boolean> {
  if (current) return current;
  const next: Record<string, boolean> = {};
  for (const d of DAYS) for (const s of SLOTS) next[`${d}:${s}`] = ['mon', 'wed', 'fri'].includes(d) && s !== 'evening';
  next['emergency'] = false;
  return next;
}

function seedProfile(current: TechProfile | null): TechProfile {
  return current ?? { skills: ['Plumbing', 'RO Service'], serviceCities: ['Kanpur', 'Lucknow'], bio: '', upiId: 'rahul.verma@upi' };
}

function seedPayouts(current: PayoutRecord[] | null): PayoutRecord[] {
  if (current && current.length) return current;
  const d = new Date().toLocaleDateString();
  return [
    { id: 'P-001', date: d, jobs: 6, amount: 4200, status: 'Paid' },
    { id: 'P-002', date: d, jobs: 4, amount: 2900, status: 'Paid' },
    { id: 'P-003', date: d, jobs: 2, amount: 650, status: 'Pending' },
  ];
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function fmtTimer(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function requiredDocsUploaded(d: TechDocs) {
  return Boolean(d.aadhaarFront && d.aadhaarBack && d.profilePhoto);
}

function uploadMetaFromFile(file: File): UploadMeta {
  return { name: file.name, size: file.size, status: 'uploaded' };
}

const SERVICE_EMOJI: Record<string, string> = {
  Plumbing: '🔧', 'RO Service': '💧', Borewell: '🕳️', 'Motor Repair': '⚙️', 'Water Tanker': '🚛', 'Tank Cleaning Service': '🪣',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' }) {
  const cls = {
    default: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    purple: 'bg-violet-50 text-violet-700 border-violet-200',
  }[variant];
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-wide ${cls}`}>{children}</span>;
}

function StatCard({ label, value, sub, icon: Icon, accent = false }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ size?: number; className?: string }>; accent?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 ${accent ? 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-500 text-white' : 'bg-white border-zinc-100'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accent ? 'bg-white/20' : 'bg-emerald-50'}`}>
        <Icon size={18} className={accent ? 'text-white' : 'text-emerald-600'} />
      </div>
      <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${accent ? 'text-emerald-100' : 'text-zinc-500'}`}>{label}</div>
      <div className={`text-2xl font-black ${accent ? 'text-white' : 'text-zinc-900'}`}>{value}</div>
      {sub && <div className={`text-xs mt-1 ${accent ? 'text-emerald-100' : 'text-zinc-400'}`}>{sub}</div>}
      <div className={`absolute -right-3 -bottom-3 w-16 h-16 rounded-full opacity-10 ${accent ? 'bg-white' : 'bg-emerald-400'}`} />
    </div>
  );
}

function SidebarItem({ icon: Icon, label, active, badge, onClick }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; active?: boolean; badge?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 text-left group ${active ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`}>
      <Icon size={16} className={active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-600'} />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>{badge}</span>
      )}
    </button>
  );
}

function StatusToggle({ online, onChange }: { online: TechnicianOnline; onChange: (v: TechnicianOnline) => void }) {
  return (
    <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1">
      <button onClick={() => onChange('online')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${online === 'online' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
        <Wifi size={12} /> Online
      </button>
      <button onClick={() => onChange('offline')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${online === 'offline' ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
        <WifiOff size={12} /> Offline
      </button>
    </div>
  );
}

function UploadArea({ label, required, current, onPick, onRemove }: { label: string; required: boolean; current?: UploadMeta; onPick: (f: File) => void; onRemove: () => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  const badge = !current ? { text: 'Not uploaded', cls: 'default' as const } :
    current.status === 'verified' ? { text: '✓ Verified', cls: 'success' as const } :
    current.status === 'rejected' ? { text: '✗ Rejected', cls: 'danger' as const } :
    current.status === 'submitted' ? { text: '↑ Under review', cls: 'info' as const } :
    { text: '✓ Uploaded', cls: 'success' as const };

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-bold text-sm text-zinc-900">{label}</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">{required ? 'Required' : 'Optional'}</p>
        </div>
        <Badge variant={badge.cls}>{badge.text}</Badge>
      </div>
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { onPick(f); if (ref.current) ref.current.value = ''; } }} />
      <button type="button" onClick={() => ref.current?.click()} className="w-full rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 transition-colors p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white border border-zinc-100 flex items-center justify-center shrink-0">
            <CloudUpload size={16} className="text-emerald-600" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-zinc-700">{current ? 'Replace file' : 'Upload file'}</p>
            {current ? <p className="text-[11px] text-zinc-400 truncate mt-0.5">{current.name} · {(current.size / 1024).toFixed(1)} KB</p> : <p className="text-[11px] text-zinc-400 mt-0.5">JPG, PNG, PDF — max 5 MB</p>}
          </div>
        </div>
      </button>
      {current && (
        <button type="button" onClick={onRemove} className="mt-2 w-full text-xs font-semibold text-red-500 hover:text-red-700 transition-colors py-1">
          Remove
        </button>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function TechnicianDashboardPage() {
  const router = useRouter();
  const { role: authRole, checked, isLoggedIn } = useAuth();

  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<TabKey>('overview');

  const [online, setOnline] = useState<TechnicianOnline>('online');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('unverified');
  const [jobQueue, setJobQueue] = useState<JobQueueItem[]>([]);
  const [myJobs, setMyJobs] = useState<MyJob[]>([]);
  const [docs, setDocs] = useState<TechDocs>({ verificationStatus: 'unverified' });
  const [profile, setProfile] = useState<TechProfile>({ skills: ['Plumbing', 'RO Service'], serviceCities: ['Kanpur', 'Lucknow'], bio: '', upiId: '' });
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [techName, setTechName] = useState('Technician');

  const [tickerNow, setTickerNow] = useState(0);
  const [upiEditing, setUpiEditing] = useState(false);
  const [upiDraft, setUpiDraft] = useState('');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [myJobFilter, setMyJobFilter] = useState<'all' | MyJobStatus>('all');

  // ── Hydrate from localStorage (client-only) ──
  useEffect(() => {
    const savedOnline = lsGet(KEYS.ONLINE) as TechnicianOnline | null;
    const savedVerif = lsGet(KEYS.VERIFICATION) as VerificationStatus | null;
    const savedQueue = safeParse<JobQueueItem[]>(lsGet(KEYS.JOB_QUEUE));
    const savedJobs = safeParse<MyJob[]>(lsGet(KEYS.MY_JOBS));
    const savedAvail = safeParse<Record<string, boolean>>(lsGet(KEYS.AVAILABILITY));
    const savedDocs = safeParse<TechDocs>(lsGet(KEYS.DOCS));
    const savedProfile = safeParse<TechProfile>(lsGet(KEYS.PROFILE));
    const savedPayouts = safeParse<PayoutRecord[]>(lsGet(KEYS.PAYOUT));
    const savedUserProfile = safeParse<{ name?: string }>(lsGet(KEYS.USER_PROFILE));

    setOnline(savedOnline === 'offline' ? 'offline' : 'online');
    setVerificationStatus(['verified', 'pending', 'unverified'].includes(savedVerif || '') ? (savedVerif as VerificationStatus) : 'unverified');
    setJobQueue(seedJobQueue(Array.isArray(savedQueue) ? savedQueue : null));
    setMyJobs(Array.isArray(savedJobs) ? savedJobs : []);
    setAvailability(seedAvailability(savedAvail && typeof savedAvail === 'object' ? savedAvail : null));
    setDocs(savedDocs ?? { verificationStatus: 'unverified' });
    setProfile(seedProfile(savedProfile));
    setPayouts(seedPayouts(Array.isArray(savedPayouts) ? savedPayouts : null));
    setTechName(savedUserProfile?.name || 'Technician');
    setTickerNow(Date.now());
    setHydrated(true);
  }, []);

  // ── Persist changes ──
  useEffect(() => { if (hydrated) lsSet(KEYS.ONLINE, online); }, [online, hydrated]);
  useEffect(() => { if (hydrated) lsSet(KEYS.VERIFICATION, verificationStatus); }, [verificationStatus, hydrated]);
  useEffect(() => { if (hydrated) lsSet(KEYS.JOB_QUEUE, JSON.stringify(jobQueue)); }, [jobQueue, hydrated]);
  useEffect(() => { if (hydrated) lsSet(KEYS.MY_JOBS, JSON.stringify(myJobs)); }, [myJobs, hydrated]);
  useEffect(() => { if (hydrated) lsSet(KEYS.AVAILABILITY, JSON.stringify(availability)); }, [availability, hydrated]);
  useEffect(() => { if (hydrated) lsSet(KEYS.DOCS, JSON.stringify(docs)); }, [docs, hydrated]);
  useEffect(() => { if (hydrated) lsSet(KEYS.PROFILE, JSON.stringify(profile)); }, [profile, hydrated]);
  useEffect(() => { if (hydrated) lsSet(KEYS.PAYOUT, JSON.stringify(payouts)); }, [payouts, hydrated]);

  // ── Ticker ──
  useEffect(() => {
    const t = setInterval(() => setTickerNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Auto-expire queue ──
  useEffect(() => {
    if (!hydrated || !jobQueue.length || !tickerNow) return;
    const expired = jobQueue.filter((j) => j.expiresAt <= tickerNow);
    if (!expired.length) return;
    setJobQueue((cur) => cur.filter((j) => j.expiresAt > tickerNow));
    expired.forEach((j) => toast.error(`Job ${j.id} expired`));
  }, [tickerNow, jobQueue, hydrated]);

  // ── Greeting ──
  const greeting = useMemo(() => {
    if (typeof window === 'undefined') return 'Hello';
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  // ── Derived stats ──
  const activeJob = useMemo(() => myJobs.find((j) => j.status === 'in_progress') || null, [myJobs]);

  const stats = useMemo(() => {
    const completed = myJobs.filter((j) => j.status === 'completed');
    const rated = completed.filter((j) => typeof j.rating === 'number') as Array<MyJob & { rating: number }>;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const monthKey = `${today.getFullYear()}-${today.getMonth()}`;

    const todayCount = completed.filter((j) => {
      if (!j.completedAt) return false;
      const d = new Date(j.completedAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayKey;
    }).length;

    const monthEarnings = completed.reduce((sum, j) => {
      if (!j.completedAt) return sum;
      const d = new Date(j.completedAt);
      return `${d.getFullYear()}-${d.getMonth()}` === monthKey ? sum + j.price : sum;
    }, 0);

    const totalEarnings = completed.reduce((s, j) => s + j.price, 0);
    const avgRating = rated.length ? rated.reduce((s, j) => s + j.rating, 0) / rated.length : null;

    return { todayCount, totalCompleted: completed.length, monthEarnings, totalEarnings, avgRating };
  }, [myJobs]);

  const earningsDaily = useMemo(() => {
    const completed = myJobs.filter((j) => j.status === 'completed' && j.completedAt) as Array<MyJob & { completedAt: number }>;
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const sum = completed.filter((j) => { const dj = new Date(j.completedAt); return `${dj.getFullYear()}-${dj.getMonth()}-${dj.getDate()}` === key; }).reduce((s, j) => s + j.price, 0);
      return sum;
    });
  }, [myJobs]);

  const weeklyEarnings = useMemo(() => earningsDaily.reduce((s, v) => s + v, 0), [earningsDaily]);
  const pendingBalance = useMemo(() => payouts.filter((p) => p.status === 'Pending').reduce((s, p) => s + p.amount, 0), [payouts]);

  const visibleMyJobs = useMemo(() => {
    const filtered = myJobFilter === 'all' ? myJobs : myJobs.filter((j) => j.status === myJobFilter);
    return [...filtered].sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));
  }, [myJobs, myJobFilter]);

  // ── Actions ──
  const acceptJob = useCallback((job: JobQueueItem) => {
    setMyJobs((cur) => [{ ...job, status: 'upcoming', acceptedAt: Date.now() }, ...cur]);
    setJobQueue((cur) => cur.filter((j) => j.id !== job.id));
    toast.success(`Job ${job.id} accepted!`);
  }, []);

  const declineJob = useCallback((job: JobQueueItem) => {
    setJobQueue((cur) => cur.filter((j) => j.id !== job.id));
    toast('Job declined');
  }, []);

  const startJob = useCallback((id: string) => {
    setMyJobs((cur) => cur.map((j) => j.id === id ? { ...j, status: 'in_progress', startedAt: Date.now() } : j));
    toast.success('Job started!');
  }, []);

  const completeJob = useCallback((id: string) => {
    setMyJobs((cur) => cur.map((j) => j.id === id ? { ...j, status: 'completed', completedAt: Date.now() } : j));
    toast.success('Job completed! Great work.');
  }, []);

  const cancelJob = useCallback((id: string) => {
    setMyJobs((cur) => cur.map((j) => j.id === id ? { ...j, status: 'cancelled' } : j));
    toast.error('Job cancelled');
  }, []);

  const receiveRating = useCallback((id: string) => {
    const r = 4 + Math.floor(Math.random() * 2);
    setMyJobs((cur) => cur.map((j) => j.id === id ? { ...j, rating: r } : j));
    toast.success(`Rating: ${r}★`);
  }, []);

  const requestPayout = useCallback(() => {
    if (pendingBalance < 500) { toast.error('Min. ₹500 pending required'); return; }
    setPayouts((cur) => [
      { id: `P-${Math.floor(Math.random() * 900 + 100)}`, date: new Date().toLocaleDateString(), jobs: 0, amount: pendingBalance, status: 'Pending' },
      ...cur.filter((p) => p.status !== 'Pending'),
    ]);
    toast.success('Payout request submitted!');
  }, [pendingBalance]);

  const submitForVerification = useCallback(() => {
    if (!requiredDocsUploaded(docs)) { toast.error('Upload all required documents first'); return; }
    setDocs((cur) => ({
      ...cur,
      aadhaarFront: cur.aadhaarFront ? { ...cur.aadhaarFront, status: 'submitted' } : cur.aadhaarFront,
      aadhaarBack: cur.aadhaarBack ? { ...cur.aadhaarBack, status: 'submitted' } : cur.aadhaarBack,
      profilePhoto: cur.profilePhoto ? { ...cur.profilePhoto, status: 'submitted' } : cur.profilePhoto,
      skillCert: cur.skillCert?.status === 'uploaded' ? { ...cur.skillCert, status: 'submitted' } : cur.skillCert,
      verificationStatus: 'pending',
      submittedAt: Date.now(),
    }));
    setVerificationStatus('pending');
    toast.success("Documents submitted! Review within 48 hours.");
  }, [docs]);

  // ── Auth gate ──
  if (!checked) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <Loader2 size={24} className="text-emerald-600 animate-spin" />
    </div>
  );

  if (!isLoggedIn || authRole !== 'technician') return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white rounded-2xl border border-zinc-100 shadow-sm p-8 text-center">
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={24} className="text-emerald-600" />
        </div>
        <h2 className="text-xl font-black text-zinc-900">Technician Access</h2>
        <p className="text-sm text-zinc-500 mt-2">Sign in as a Technician to view this dashboard.</p>
        <button onClick={() => router.push('/auth/login')} className="mt-6 w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors">
          Go to Sign In
        </button>
      </div>
    </div>
  );

  const verBanner = verificationStatus === 'verified'
    ? { bg: 'bg-emerald-600', text: '✅ Verified AuroWater Technician — you can accept jobs', cta: null as null | string }
    : verificationStatus === 'pending'
    ? { bg: 'bg-sky-600', text: '🕐 ID under review — usually 1–2 business days', cta: null }
    : { bg: 'bg-amber-500', text: '⚠️ Complete profile & upload ID to start accepting jobs', cta: 'Upload Documents' };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">

          {/* ── Sidebar ── */}
          <aside className="hidden lg:flex flex-col w-56 shrink-0">
            <div className="sticky top-6 rounded-2xl border border-zinc-100 bg-white shadow-sm overflow-hidden">
              {/* Brand / User */}
              <div className="p-4 border-b border-zinc-50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm font-black flex items-center justify-center shrink-0">
                    {techName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 truncate">{techName}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${online === 'online' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                      <span className="text-[10px] text-zinc-400 capitalize">{online}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nav */}
              <nav className="p-2 space-y-0.5">
                <SidebarItem icon={LayoutDashboard} label="Overview" active={tab === 'overview'} onClick={() => setTab('overview')} />
                <SidebarItem icon={Bell} label="Job Queue" active={tab === 'queue'} badge={jobQueue.length} onClick={() => setTab('queue')} />
                <SidebarItem icon={Briefcase} label="My Jobs" active={tab === 'my_jobs'} badge={myJobs.filter(j => j.status === 'in_progress').length || undefined} onClick={() => setTab('my_jobs')} />
                <SidebarItem icon={IndianRupee} label="Earnings" active={tab === 'earnings'} onClick={() => setTab('earnings')} />
                <SidebarItem icon={Clock} label="Availability" active={tab === 'availability'} onClick={() => setTab('availability')} />
                <SidebarItem icon={User} label="Profile" active={tab === 'profile'} onClick={() => setTab('profile')} />
                <SidebarItem icon={FileText} label="Documents" active={tab === 'documents'} onClick={() => setTab('documents')} />
              </nav>

              <div className="p-2 border-t border-zinc-50 mt-1">
                <button onClick={() => router.push('/')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors">
                  <ArrowLeft size={14} /> Back to Site
                </button>
              </div>
            </div>
          </aside>

          {/* ── Mobile Tab Bar ── */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-100 flex">
            {([
              { key: 'overview', icon: LayoutDashboard },
              { key: 'queue', icon: Bell },
              { key: 'my_jobs', icon: Briefcase },
              { key: 'earnings', icon: IndianRupee },
              { key: 'profile', icon: User },
            ] as { key: TabKey; icon: React.ComponentType<{ size?: number; className?: string }> }[]).map(({ key, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)} className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide transition-colors ${tab === key ? 'text-emerald-600' : 'text-zinc-400'}`}>
                <Icon size={18} />
                {key.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* ── Main Content ── */}
          <main className="flex-1 min-w-0 pb-20 lg:pb-0">

            {/* ────── OVERVIEW ────── */}
            {tab === 'overview' && (
              <div className="space-y-5">
                {/* Header */}
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">{greeting}</p>
                      <h1 className="text-2xl font-black text-zinc-900 mt-0.5">{techName}</h1>
                      <p className="text-sm text-zinc-500 mt-1">Here's your performance at a glance</p>
                    </div>
                    <StatusToggle online={online} onChange={setOnline} />
                  </div>
                </div>

                {/* Verification Banner */}
                <div className={`${verBanner.bg} rounded-2xl p-4 text-white`}>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold">{verBanner.text}</p>
                    {verBanner.cta && (
                      <button onClick={() => setTab('documents')} className="shrink-0 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
                        {verBanner.cta}
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard label="Jobs Today" value={String(stats.todayCount)} icon={Briefcase} />
                  <StatCard label="Total Completed" value={String(stats.totalCompleted)} icon={CheckCircle} />
                  <StatCard label="Avg Rating" value={stats.avgRating ? `${stats.avgRating.toFixed(1)}★` : '—'} icon={Star} />
                  <StatCard label="This Month" value={formatMoney(stats.monthEarnings)} icon={IndianRupee} accent />
                </div>

                {/* Active Job + Queue Preview */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-zinc-700">Active Job</h2>
                      {activeJob && <Badge variant="purple">In Progress</Badge>}
                    </div>
                    {activeJob ? (
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-xl">{SERVICE_EMOJI[activeJob.service] || '🔧'}</div>
                          <div>
                            <p className="font-bold text-zinc-900">{activeJob.service}</p>
                            <p className="text-xs text-zinc-500">{activeJob.sub} · {activeJob.area}</p>
                          </div>
                        </div>
                        <button onClick={() => completeJob(activeJob.id)} className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm">
                          Mark as Completed ✓
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-3xl mb-2">📭</p>
                        <p className="text-sm font-semibold text-zinc-700">No active job</p>
                        <p className="text-xs text-zinc-400 mt-1">Accept a job from the queue</p>
                        <button onClick={() => setTab('queue')} className="mt-3 text-xs font-bold text-emerald-600 hover:underline">Open Job Queue →</button>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-bold text-zinc-700">Queue Preview</h2>
                      <button onClick={() => setTab('queue')} className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">View all <ChevronRight size={12} /></button>
                    </div>
                    {jobQueue.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-3xl mb-2">🌿</p>
                        <p className="text-sm font-semibold text-zinc-700">Queue is clear</p>
                        <p className="text-xs text-zinc-400 mt-1">New jobs will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {jobQueue.slice(0, 3).map((j) => {
                          const rem = j.expiresAt - tickerNow;
                          return (
                            <div key={j.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-50 border border-zinc-100">
                              <div className="text-lg shrink-0">{SERVICE_EMOJI[j.service] || '🔧'}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-zinc-800 truncate">{j.service} · {j.sub}</p>
                                <p className="text-[10px] text-zinc-400 truncate">{j.area}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-xs font-black text-emerald-600">{formatMoney(j.price)}</p>
                                <p className={`text-[10px] font-semibold ${rem < 5 * 60 * 1000 ? 'text-red-500' : 'text-zinc-400'}`}>{hydrated ? fmtTimer(rem) : '—'}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ────── JOB QUEUE ────── */}
            {tab === 'queue' && (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Job Queue</p>
                      <h1 className="text-xl font-black text-zinc-900 mt-0.5">Available Jobs</h1>
                      <p className="text-sm text-zinc-500 mt-1">Accept before the timer ends — expired jobs are removed.</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={jobQueue.length > 0 ? 'success' : 'default'}>{jobQueue.length} in queue</Badge>
                      <StatusToggle online={online} onChange={setOnline} />
                    </div>
                  </div>
                </div>

                {jobQueue.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-12 text-center">
                    <p className="text-5xl mb-4">📭</p>
                    <p className="font-bold text-zinc-900">No jobs right now</p>
                    <p className="text-sm text-zinc-500 mt-1">Turn Online to start receiving job requests.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {jobQueue.map((j) => {
                      const rem = j.expiresAt - tickerNow;
                      const isUrgent = rem < 5 * 60 * 1000;
                      const canAccept = verificationStatus === 'verified' && online === 'online';
                      return (
                        <div key={j.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isUrgent ? 'border-red-200' : 'border-zinc-100'}`}>
                          {isUrgent && <div className="h-1 bg-gradient-to-r from-red-500 to-orange-400" />}
                          <div className="p-5">
                            <div className="flex flex-col lg:flex-row lg:items-start gap-5">
                              {/* Left: job details */}
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-2xl shrink-0">
                                    {SERVICE_EMOJI[j.service] || '🔧'}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-black text-zinc-900">{j.service}</p>
                                      <Badge variant="default">{j.id}</Badge>
                                    </div>
                                    <p className="text-sm text-zinc-500 mt-0.5">{j.sub}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <div className="bg-zinc-50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1"><MapPin size={11} className="text-zinc-400" /><p className="text-[10px] font-semibold text-zinc-400 uppercase">Area</p></div>
                                    <p className="text-xs font-bold text-zinc-800 leading-tight">{j.area}</p>
                                  </div>
                                  <div className="bg-zinc-50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1"><Calendar size={11} className="text-zinc-400" /><p className="text-[10px] font-semibold text-zinc-400 uppercase">Schedule</p></div>
                                    <p className="text-xs font-bold text-zinc-800">{j.date} · {j.slot}</p>
                                  </div>
                                  <div className="bg-zinc-50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1"><MapPin size={11} className="text-zinc-400" /><p className="text-[10px] font-semibold text-zinc-400 uppercase">Distance</p></div>
                                    <p className="text-xs font-bold text-zinc-800">{j.distance}</p>
                                  </div>
                                  <div className="bg-emerald-50 rounded-xl p-3">
                                    <div className="flex items-center gap-1.5 mb-1"><IndianRupee size={11} className="text-emerald-600" /><p className="text-[10px] font-semibold text-emerald-600 uppercase">Payout</p></div>
                                    <p className="text-sm font-black text-emerald-700">{formatMoney(j.price)}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Right: timer + actions */}
                              <div className="lg:w-52 shrink-0">
                                <div className={`rounded-xl p-3 mb-4 text-center ${isUrgent ? 'bg-red-50 border border-red-200' : 'bg-zinc-50 border border-zinc-100'}`}>
                                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${isUrgent ? 'text-red-500' : 'text-zinc-400'}`}>Expires in</p>
                                  <p className={`text-2xl font-black tabular-nums mt-0.5 ${isUrgent ? 'text-red-600' : 'text-zinc-800'}`}>{hydrated ? fmtTimer(rem) : '—'}</p>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => acceptJob(j)} disabled={!canAccept} title={!canAccept ? (verificationStatus !== 'verified' ? 'Get verified first' : 'Go online first') : ''} className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
                                    Accept
                                  </button>
                                  <button onClick={() => declineJob(j)} className="flex-1 border border-red-200 text-red-600 font-bold py-2.5 rounded-xl hover:bg-red-50 transition-colors text-sm">
                                    Decline
                                  </button>
                                </div>
                                {!canAccept && (
                                  <p className="text-[10px] text-zinc-400 text-center mt-2">
                                    {verificationStatus !== 'verified' ? 'Verify your account to accept' : 'Set status to Online'}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ────── MY JOBS ────── */}
            {tab === 'my_jobs' && (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">My Jobs</p>
                  <h1 className="text-xl font-black text-zinc-900 mt-0.5">Track & manage your jobs</h1>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(['all', 'upcoming', 'in_progress', 'completed', 'cancelled'] as const).map((f) => (
                    <button key={f} onClick={() => setMyJobFilter(f)} className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-all capitalize ${myJobFilter === f ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                      {f.replace('_', ' ')}
                      {f !== 'all' && ` (${myJobs.filter(j => j.status === f).length})`}
                    </button>
                  ))}
                </div>

                {visibleMyJobs.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-12 text-center">
                    <p className="text-5xl mb-4">📅</p>
                    <p className="font-bold text-zinc-900">No jobs here yet</p>
                    <p className="text-sm text-zinc-500 mt-1">Accept jobs from the queue to see them here.</p>
                    <button onClick={() => setTab('queue')} className="mt-4 bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm">
                      Open Job Queue
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleMyJobs.map((j) => {
                      const expanded = expandedJobId === j.id;
                      const statusColors: Record<MyJobStatus, string> = {
                        upcoming: 'info',
                        in_progress: 'purple',
                        completed: 'success',
                        cancelled: 'danger',
                      };
                      return (
                        <div key={j.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
                          <button type="button" onClick={() => setExpandedJobId(expanded ? null : j.id)} className="w-full p-4 flex items-start gap-4 text-left hover:bg-zinc-50/50 transition-colors">
                            <div className="w-11 h-11 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-xl shrink-0">
                              {SERVICE_EMOJI[j.service] || '🔧'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-zinc-900">{j.service}</p>
                                <Badge variant={statusColors[j.status] as any}>{j.status.replace('_', ' ')}</Badge>
                                {j.status === 'completed' && typeof j.rating === 'number' && <Badge variant="warning">{'★'.repeat(j.rating)}</Badge>}
                              </div>
                              <p className="text-xs text-zinc-500 mt-0.5 truncate">{j.sub} · {j.area}</p>
                              <p className="text-[10px] text-zinc-400 mt-1">{j.date} · {j.slot}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-black text-emerald-600">{formatMoney(j.price)}</p>
                              <ChevronDown size={14} className={`ml-auto mt-1 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            </div>
                          </button>

                          {expanded && (
                            <div className="px-4 pb-4 border-t border-zinc-50">
                              <div className="grid grid-cols-3 gap-3 mt-3 mb-4">
                                <div className="bg-zinc-50 rounded-xl p-3">
                                  <p className="text-[10px] font-semibold text-zinc-400 uppercase">Job ID</p>
                                  <p className="text-xs font-bold text-zinc-800 mt-1">{j.id}</p>
                                </div>
                                <div className="bg-zinc-50 rounded-xl p-3">
                                  <p className="text-[10px] font-semibold text-zinc-400 uppercase">Accepted</p>
                                  <p className="text-xs font-bold text-zinc-800 mt-1">{new Date(j.acceptedAt).toLocaleDateString()}</p>
                                </div>
                                <div className="bg-zinc-50 rounded-xl p-3">
                                  <p className="text-[10px] font-semibold text-zinc-400 uppercase">City</p>
                                  <p className="text-xs font-bold text-zinc-800 mt-1">{profile?.serviceCities?.[0] || '—'}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {j.status === 'upcoming' && <button onClick={() => startJob(j.id)} className="flex items-center gap-1.5 bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors text-sm"><Play size={13} />Start Job</button>}
                                {j.status === 'in_progress' && <button onClick={() => completeJob(j.id)} className="flex items-center gap-1.5 bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors text-sm"><CheckCircle size={13} />Complete</button>}
                                {j.status === 'completed' && !j.rating && <button onClick={() => receiveRating(j.id)} className="flex items-center gap-1.5 border border-zinc-200 text-zinc-700 font-bold px-4 py-2 rounded-xl hover:bg-zinc-50 transition-colors text-sm"><Star size={13} />Get Rating</button>}
                                {j.status !== 'completed' && j.status !== 'cancelled' && <button onClick={() => cancelJob(j.id)} className="flex items-center gap-1.5 border border-red-200 text-red-600 font-bold px-4 py-2 rounded-xl hover:bg-red-50 transition-colors text-sm"><XCircle size={13} />Cancel</button>}
                                <button onClick={() => toast.success('Support request sent')} className="flex items-center gap-1.5 border border-zinc-200 text-zinc-600 font-bold px-4 py-2 rounded-xl hover:bg-zinc-50 transition-colors text-sm"><Phone size={13} />Support</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ────── EARNINGS ────── */}
            {tab === 'earnings' && (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Earnings</p>
                    <h1 className="text-xl font-black text-zinc-900 mt-0.5">Track revenue & payouts</h1>
                    <p className="text-sm text-zinc-500 mt-1">UPI: <span className="font-bold text-zinc-700">{profile?.upiId || 'Not set'}</span></p>
                  </div>
                  <button onClick={requestPayout} disabled={pendingBalance < 500} className="flex items-center gap-2 bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm shrink-0">
                    <IndianRupee size={14} /> Request Payout {pendingBalance >= 500 ? `(${formatMoney(pendingBalance)})` : ''}
                  </button>
                </div>

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                  <StatCard label="Today" value={formatMoney(earningsDaily[6] || 0)} icon={TrendingUp} />
                  <StatCard label="This Week" value={formatMoney(weeklyEarnings)} icon={Calendar} />
                  <StatCard label="This Month" value={formatMoney(stats.monthEarnings)} icon={Package} />
                  <StatCard label="All Time" value={formatMoney(stats.totalEarnings)} icon={Award} accent />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Bar Chart */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="font-bold text-zinc-900">Last 7 Days</h2>
                      <p className="text-xs text-zinc-400">{formatMoney(weeklyEarnings)} total</p>
                    </div>
                    <div className="flex items-end gap-2 h-40">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => {
                        const val = earningsDaily[i] ?? 0;
                        const max = Math.max(1, ...earningsDaily);
                        const pct = Math.round((val / max) * 100);
                        const isToday = i === 6;
                        return (
                          <div key={d} className="flex-1 flex flex-col items-center gap-1 group">
                            <p className="text-[10px] font-bold text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">₹{val}</p>
                            <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.max(4, pct)}%`, background: isToday ? 'linear-gradient(to top, #059669, #34d399)' : '#e4e4e7' }} />
                            <p className={`text-[10px] font-bold ${isToday ? 'text-emerald-600' : 'text-zinc-400'}`}>{d}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* UPI + Pending */}
                  <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
                    <h2 className="font-bold text-zinc-900 mb-4">Payout Settings</h2>
                    {!upiEditing ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-zinc-50 rounded-xl px-3 py-2.5 text-sm text-zinc-700 font-medium truncate">{profile?.upiId || 'No UPI set'}</div>
                        <button onClick={() => { setUpiEditing(true); setUpiDraft(profile?.upiId || ''); }} className="p-2.5 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors">
                          <Edit3 size={14} className="text-zinc-500" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input value={upiDraft} onChange={(e) => setUpiDraft(e.target.value)} placeholder="name@upi" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        <div className="flex gap-2">
                          <button onClick={() => { setProfile((c) => c ? { ...c, upiId: upiDraft.trim() } : c); setUpiEditing(false); toast.success('UPI updated'); }} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs"><Save size={12} />Save</button>
                          <button onClick={() => setUpiEditing(false)} className="p-2 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors"><X size={14} className="text-zinc-500" /></button>
                        </div>
                      </div>
                    )}

                    <div className="mt-5 p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pending Balance</p>
                      <p className="text-2xl font-black text-amber-800 mt-1">{formatMoney(pendingBalance)}</p>
                      <p className="text-[11px] text-amber-600 mt-1">{pendingBalance < 500 ? `₹${500 - pendingBalance} more to request` : 'Ready to withdraw'}</p>
                    </div>
                  </div>
                </div>

                {/* Payout History */}
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
                  <h2 className="font-bold text-zinc-900 mb-4">Payout History</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-zinc-100">
                          <th className="pb-3 text-[11px] font-bold text-zinc-400 uppercase">Date</th>
                          <th className="pb-3 text-[11px] font-bold text-zinc-400 uppercase">Jobs</th>
                          <th className="pb-3 text-[11px] font-bold text-zinc-400 uppercase">Amount</th>
                          <th className="pb-3 text-[11px] font-bold text-zinc-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payouts.length === 0 ? (
                          <tr><td colSpan={4} className="py-6 text-center text-sm text-zinc-400">No payout records yet</td></tr>
                        ) : payouts.slice(0, 10).map((p) => (
                          <tr key={p.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                            <td className="py-3 text-zinc-600">{p.date}</td>
                            <td className="py-3 font-semibold text-zinc-800">{p.jobs}</td>
                            <td className="py-3 font-bold text-emerald-600">{formatMoney(p.amount)}</td>
                            <td className="py-3"><Badge variant={p.status === 'Paid' ? 'success' : 'warning'}>{p.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ────── AVAILABILITY ────── */}
            {tab === 'availability' && (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Availability</p>
                    <h1 className="text-xl font-black text-zinc-900 mt-0.5">Set your schedule</h1>
                    <p className="text-sm text-zinc-500 mt-1">Choose when you're available — affects which bookings you'll receive.</p>
                  </div>
                  <button onClick={() => toast.success('Availability saved!')} className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm shrink-0">
                    Save Schedule
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 overflow-x-auto">
                  <div className="min-w-[640px]">
                    {/* Header */}
                    <div className="grid grid-cols-8 gap-2 mb-3">
                      <div />
                      {DAYS.map((d) => (
                        <div key={d} className="text-center text-[11px] font-bold text-zinc-500 uppercase">{d}</div>
                      ))}
                    </div>
                    {/* Rows */}
                    {SLOTS.map((s) => {
                      const labels = { morning: 'Morning  8–12', afternoon: 'Afternoon  12–5', evening: 'Evening  5–8' };
                      return (
                        <div key={s} className="grid grid-cols-8 gap-2 mb-2">
                          <div className="flex items-center">
                            <span className="text-xs font-semibold text-zinc-500 whitespace-nowrap">{labels[s]}</span>
                          </div>
                          {DAYS.map((d) => {
                            const key = `${d}:${s}`;
                            const on = Boolean(availability[key]);
                            return (
                              <button key={key} type="button" onClick={() => setAvailability((c) => ({ ...c, [key]: !on }))} className={`h-10 rounded-xl text-xs font-bold transition-all ${on ? 'bg-emerald-600 text-white shadow-sm' : 'bg-zinc-50 border border-zinc-100 text-zinc-400 hover:border-zinc-200'}`}>
                                {on ? '✓' : '–'}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Emergency toggle */}
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-amber-500" />
                      <p className="font-bold text-zinc-900">Emergency Jobs</p>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">Accept urgent requests · extra ₹199 surcharge applies</p>
                  </div>
                  <button onClick={() => setAvailability((c) => ({ ...c, emergency: !c.emergency }))} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${availability.emergency ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
                    {availability.emergency ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            )}

            {/* ────── PROFILE ────── */}
            {tab === 'profile' && (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Profile</p>
                  <h1 className="text-xl font-black text-zinc-900 mt-0.5">Skills & service coverage</h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Skills */}
                  <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
                    <h2 className="font-bold text-zinc-900 mb-3">Skills</h2>
                    <div className="flex flex-wrap gap-2">
                      {SKILLS.map((s) => {
                        const active = profile?.skills?.includes(s);
                        return (
                          <button key={s} type="button" onClick={() => setProfile((c) => c ? { ...c, skills: c.skills.includes(s) ? c.skills.filter(x => x !== s) : [...c.skills, s] } : c)} className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${active ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                            {s}
                          </button>
                        );
                      })}
                    </div>

                    <h2 className="font-bold text-zinc-900 mb-3 mt-6">Service Cities</h2>
                    <div className="flex flex-wrap gap-2">
                      {UP_CITIES.map((c) => {
                        const active = profile?.serviceCities?.includes(c);
                        return (
                          <button key={c} type="button" onClick={() => setProfile((p) => p ? { ...p, serviceCities: p.serviceCities.includes(c) ? p.serviceCities.filter(x => x !== c) : [...p.serviceCities, c] } : p)} className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${active ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}>
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bio + Completeness */}
                  <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
                    <h2 className="font-bold text-zinc-900 mb-3">Bio</h2>
                    <textarea value={profile?.bio || ''} onChange={(e) => setProfile((c) => c ? { ...c, bio: e.target.value.slice(0, 200) } : c)} rows={5} placeholder="Tell customers what you specialize in and how you work…" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                    <p className="text-[11px] text-zinc-400 mt-1 text-right">{(profile?.bio || '').length}/200</p>

                    {/* Completeness */}
                    <div className="mt-5">
                      <h2 className="font-bold text-zinc-900 mb-3">Profile Completeness</h2>
                      {(() => {
                        const checks = [
                          { label: 'Skills selected', ok: (profile?.skills?.length || 0) > 0 },
                          { label: 'Cities selected', ok: (profile?.serviceCities?.length || 0) > 0 },
                          { label: 'Bio (30+ chars)', ok: Boolean(profile?.bio && profile.bio.trim().length >= 30) },
                          { label: 'UPI ID set', ok: Boolean(profile?.upiId && profile.upiId.includes('@')) },
                        ];
                        const pct = Math.round((checks.filter(c => c.ok).length / checks.length) * 100);
                        return (
                          <div>
                            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden mb-2">
                              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="font-bold text-zinc-700">{pct}% complete</span>
                              <span className="text-zinc-400">{checks.filter(c => c.ok).length}/{checks.length}</span>
                            </div>
                            <div className="mt-3 space-y-1.5">
                              {checks.map((c) => (
                                <div key={c.label} className="flex items-center gap-2">
                                  {c.ok ? <CheckCircle size={12} className="text-emerald-500 shrink-0" /> : <Clock3 size={12} className="text-zinc-300 shrink-0" />}
                                  <span className={`text-xs ${c.ok ? 'text-zinc-600' : 'text-zinc-400'}`}>{c.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <button onClick={() => toast.success('Profile saved!')} className="mt-5 w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm">
                      Save Profile
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ────── DOCUMENTS ────── */}
            {tab === 'documents' && (
              <div className="space-y-5">
                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Documents</p>
                  <h1 className="text-xl font-black text-zinc-900 mt-0.5">Upload ID for verification</h1>
                  <p className="text-sm text-zinc-500 mt-1">Required: Aadhaar Front, Aadhaar Back, Profile Photo. Skill Certificate is optional.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <UploadArea label="Aadhaar Card (Front)" required current={docs.aadhaarFront} onPick={(f) => setDocs((c) => ({ ...c, aadhaarFront: uploadMetaFromFile(f) }))} onRemove={() => setDocs((c) => ({ ...c, aadhaarFront: undefined }))} />
                  <UploadArea label="Aadhaar Card (Back)" required current={docs.aadhaarBack} onPick={(f) => setDocs((c) => ({ ...c, aadhaarBack: uploadMetaFromFile(f) }))} onRemove={() => setDocs((c) => ({ ...c, aadhaarBack: undefined }))} />
                  <UploadArea label="Profile Photo" required current={docs.profilePhoto} onPick={(f) => setDocs((c) => ({ ...c, profilePhoto: uploadMetaFromFile(f) }))} onRemove={() => setDocs((c) => ({ ...c, profilePhoto: undefined }))} />
                  <UploadArea label="Skill Certificate (Optional)" required={false} current={docs.skillCert} onPick={(f) => setDocs((c) => ({ ...c, skillCert: uploadMetaFromFile(f) }))} onRemove={() => setDocs((c) => ({ ...c, skillCert: undefined }))} />
                </div>

                <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-zinc-700">Verification Status:</p>
                    <Badge variant={verificationStatus === 'verified' ? 'success' : verificationStatus === 'pending' ? 'info' : 'warning'}>
                      {verificationStatus === 'verified' ? '✓ Verified' : verificationStatus === 'pending' ? '⏳ Under Review' : '○ Unverified'}
                    </Badge>
                  </div>
                  <button onClick={submitForVerification} disabled={!requiredDocsUploaded(docs) || verificationStatus !== 'unverified'} className="bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm shrink-0">
                    Submit for Verification
                  </button>
                </div>

                {verificationStatus === 'pending' && (
                  <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-2xl p-4">
                    <Clock3 size={16} className="text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-sky-800">Under review</p>
                      <p className="text-xs text-sky-600 mt-0.5">Your documents are being reviewed. This usually takes 1–2 business days. You can update documents anytime.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}