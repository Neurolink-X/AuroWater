'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUser, getTechnicianJobs, updateJobStatus, logout } from '@/lib/api-client';
import type { User } from '@/types';
import GlassCard from '@/components/ui/GlassCard';

interface Job {
  id: string | number;
  order_id?: string | number;
  status: string;
  service_name: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  time_slot: string;
  house_no: string;
  area: string;
  city: string;
  assigned_at: string;
}

const JOB_STATUS_CLASS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  ON_THE_WAY: 'bg-orange-100 text-orange-800',
  WORKING: 'bg-violet-100 text-violet-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-800',
};

export default function TechnicianJobs() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [allCompleted, setAllCompleted] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role !== 'TECHNICIAN') {
      setUser(null);
      setLoading(false);
      return;
    }
    setUser(currentUser);
    loadJobs();
  }, [router, statusFilter]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const data = await getTechnicianJobs(statusFilter);
      setJobs(data as Job[]);
      const completed = await getTechnicianJobs('COMPLETED');
      setAllCompleted(completed as Job[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleJobAction = async (jobId: string | number, action: string) => {
    setActionLoading(typeof jobId === 'number' ? jobId : Number(jobId));
    try {
      await updateJobStatus(jobId, action);
      await loadJobs();
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update job');
    } finally {
      setActionLoading(null);
    }
  };

  const earningsFromCompleted = allCompleted.reduce((sum, j) => sum + (j.total_amount ?? 0), 0);

  if (!user) {
    return (
      <div className="min-h-screen gradient-section flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Technician workspace (coming soon)</h1>
          <p className="text-slate-600 mb-4">
            This page will show live jobs, status updates, and earnings once technician accounts are
            turned on. For now, the public site focuses on customer booking and marketing only.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            Back to AuroWater home
          </Link>
        </div>
      </div>
    );
  }

  const filters = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'ACCEPTED', label: 'Accepted' },
    { value: 'ON_THE_WAY', label: 'On the way' },
    { value: 'WORKING', label: 'Working' },
    { value: 'COMPLETED', label: 'Completed' },
  ];

  return (
    <div className="min-h-screen gradient-section">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Jobs</h1>
            <p className="text-slate-600">Welcome, {user.full_name}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/technician/profile" className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors">
              My profile
            </Link>
            <button type="button" onClick={() => { logout(); router.push('/'); }} className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors">
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">{error}</div>
        )}

        <GlassCard className="p-6 mb-8 rounded-2xl shadow-card">
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Earnings summary</h2>
          <p className="text-2xl font-bold text-emerald-700">₹{earningsFromCompleted.toFixed(2)}</p>
          <p className="text-sm text-slate-500 mt-1">From {allCompleted.length} completed job(s)</p>
        </GlassCard>

        <div className="flex flex-wrap gap-2 mb-6">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                statusFilter === f.value ? 'bg-emerald-600 text-white' : 'bg-white/80 border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-slate-500">Loading jobs...</p>
        ) : jobs.length === 0 ? (
          <GlassCard className="p-12 text-center rounded-2xl">
            <p className="text-slate-600">No jobs with this status</p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <GlassCard key={job.id} className="p-6 rounded-2xl shadow-soft hover-lift">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-slate-800">Job #{job.id}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${JOB_STATUS_CLASS[job.status] ?? 'bg-slate-100'}`}>
                        {job.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-slate-600">{job.service_name?.replace(/_/g, ' ')}</p>
                    <p className="font-semibold text-emerald-700 mt-1">₹{job.total_amount}</p>
                  </div>
                  <Link href={`/technician/job/${job.id}`} className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
                    View & update
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50/80">
                  <div>
                    <p className="text-xs text-slate-500">Customer</p>
                    <p className="font-medium text-slate-800">{job.customer_name}</p>
                    <p className="text-sm text-slate-600">{job.customer_phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Location</p>
                    <p className="font-medium text-slate-800">{job.house_no}, {job.area}</p>
                    <p className="text-sm text-slate-600">{job.city}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Time slot</p>
                    <p className="font-medium text-slate-800">{job.time_slot || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Assigned</p>
                    <p className="text-sm text-slate-800">{new Date(job.assigned_at).toLocaleDateString()}</p>
                  </div>
                </div>
                {job.status === 'PENDING' && (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleJobAction(job.id, 'accept')}
                      disabled={actionLoading === job.id}
                      className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === job.id ? 'Updating…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleJobAction(job.id, 'reject')}
                      disabled={actionLoading === job.id}
                      className="flex-1 py-2.5 rounded-lg border border-rose-300 text-rose-700 font-medium hover:bg-rose-50 transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
