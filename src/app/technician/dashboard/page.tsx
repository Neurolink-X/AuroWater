'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUser, getTechnicianJobs, logout } from '@/lib/api-client';
import type { User } from '@/types';
import GlassCard from '@/components/ui/GlassCard';

interface Job {
  id: number;
  status: string;
  total_amount: number;
  time_slot: string;
  assigned_at: string;
  service_name: string;
}

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  ON_THE_WAY: 'bg-orange-100 text-orange-800',
  WORKING: 'bg-violet-100 text-violet-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
};

export default function TechnicianDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [todayJobs, setTodayJobs] = useState<Job[]>([]);
  const [completedJobs, setCompletedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role !== 'TECHNICIAN') {
      setUser(null);
      setLoading(false);
      return;
    }
    setUser(currentUser);
    (async () => {
      try {
        setLoading(true);
        const pending = await getTechnicianJobs('PENDING');
        const accepted = await getTechnicianJobs('ACCEPTED');
        const onTheWay = await getTechnicianJobs('ON_THE_WAY');
        const working = await getTechnicianJobs('WORKING');
        const completed = await getTechnicianJobs('COMPLETED');

        const active = [...pending, ...accepted, ...onTheWay, ...working] as Job[];
        setTodayJobs(active);
        setCompletedJobs(completed as Job[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (!user) {
    return (
      <div className="min-h-screen gradient-section flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-emerald-900 mb-2">Technician dashboard (coming soon)</h1>
          <p className="text-sm text-emerald-900/80 mb-4">
            This dashboard will power real-time jobs, routes, and earnings for plumbers and suppliers
            when account logins are switched on. Today the site is fully open, focused on customers.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-md hover:bg-emerald-700 transition-colors"
          >
            Back to AuroWater home
          </Link>
        </div>
      </div>
    );
  }

  const totalEarnings = completedJobs.reduce(
    (sum, j) => sum + (j.total_amount ?? 0),
    0
  );

  return (
    <div className="min-h-screen gradient-section">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-emerald-900">
              Technician dashboard
            </h1>
            <p className="text-sm text-emerald-900/70">
              Welcome, {user.full_name}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/technician/jobs"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-md hover:bg-emerald-700 transition-colors"
            >
              View jobs
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace('/');
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-emerald-200 text-emerald-900 text-sm font-medium bg-white/60 hover:bg-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <GlassCard className="p-5 rounded-2xl shadow-card bg-emerald-900 text-emerald-50 border-emerald-700/40">
            <p className="text-xs uppercase tracking-wide text-emerald-200">
              Today
            </p>
            <p className="mt-2 text-3xl font-bold">
              {todayJobs.length}
            </p>
            <p className="mt-1 text-sm text-emerald-100">
              active job{todayJobs.length === 1 ? '' : 's'}
            </p>
          </GlassCard>

          <GlassCard className="p-5 rounded-2xl shadow-card">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Completed
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {completedJobs.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              total jobs completed
            </p>
          </GlassCard>

          <GlassCard className="p-5 rounded-2xl shadow-card">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Earnings
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              ₹{totalEarnings.toFixed(2)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              from completed jobs
            </p>
          </GlassCard>
        </div>

        <GlassCard className="p-6 rounded-2xl shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Active jobs
            </h2>
            <Link
              href="/technician/jobs"
              className="text-sm font-medium text-emerald-700 hover:underline"
            >
              View all jobs →
            </Link>
          </div>
          {loading ? (
            <p className="text-slate-500">Loading jobs…</p>
          ) : todayJobs.length === 0 ? (
            <p className="text-slate-500 py-4">
              No active jobs right now. You&apos;ll see new assignments here.
            </p>
          ) : (
            <div className="space-y-3">
              {todayJobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white/80 border border-emerald-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900">
                        Job #{job.id}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_CLASS[job.status] ??
                          'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">
                      {job.service_name?.replace(/_/g, ' ')}
                    </p>
                    {job.time_slot && (
                      <p className="text-xs text-slate-500 mt-1">
                        Slot: {job.time_slot}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/technician/job/${job.id}`}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                  >
                    View &amp; update
                  </Link>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

