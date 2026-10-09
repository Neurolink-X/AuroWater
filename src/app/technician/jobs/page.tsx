'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import {
  getUser,
  getTechnicianJobs,
  updateJobStatus,
  logout,
} from '@/lib/api-client';

import type { User } from '@/types';

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

type JobStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'WORKING'
  | 'COMPLETED'
  | 'REJECTED';

const STATUS_META: Record<
  JobStatus,
  {
    label: string;
    className: string;
    dotClass: string;
  }
> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  ACCEPTED: {
    label: 'Accepted',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  WORKING: {
    label: 'Working',
    className: 'bg-violet-50 text-violet-700 border-violet-200',
    dotClass: 'bg-violet-500',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
  },
};

const FILTERS: Array<{
  value: JobStatus;
  label: string;
}> = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'WORKING', label: 'Working' },
  { value: 'COMPLETED', label: 'Completed' },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(value: string) {
  if (!value) return 'Not specified';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not specified';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatTimeSlot(value: string) {
  if (!value) return 'Time not specified';

  return value.replace(/_/g, ' ');
}

function getNextAction(status: string) {
  switch (status) {
    case 'PENDING':
      return {
        label: 'Review job',
        action: null,
      };

    case 'ACCEPTED':
      return {
        label: 'Start journey',
        action: 'on_the_way',
      };

    case 'WORKING':
      return {
        label: 'Complete job',
        action: 'complete',
      };

    default:
      return {
        label: 'View details',
        action: null,
      };
  }
}

export default function TechnicianJobs() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [completedJobs, setCompletedJobs] = useState<Job[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] =
    useState<JobStatus>('PENDING');

  const [actionLoading, setActionLoading] =
    useState<string | number | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      setError('');

      const data = await getTechnicianJobs(statusFilter);
      setJobs(data as Job[]);

      /*
       * Completed jobs are only required for the earnings summary.
       * Keep this request isolated from the visible queue.
       */
      if (statusFilter !== 'COMPLETED') {
        const completed = await getTechnicianJobs('COMPLETED');
        setCompletedJobs(completed as Job[]);
      } else {
        setCompletedJobs(data as Job[]);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load technician jobs.'
      );
    }
  }, [statusFilter]);

  useEffect(() => {
    const currentUser = getUser();

    if (!currentUser || currentUser.role !== 'TECHNICIAN') {
      setUser(null);
      setLoading(false);
      return;
    }

    setUser(currentUser);

    let mounted = true;

    const run = async () => {
      setLoading(true);

      try {
        await loadJobs();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [loadJobs]);

  const refreshJobs = async () => {
    setRefreshing(true);

    try {
      await loadJobs();
    } finally {
      setRefreshing(false);
    }
  };

  const handleJobAction = async (
    jobId: string | number,
    action: string
  ) => {
    if (actionLoading !== null) return;

    setActionLoading(jobId);
    setError('');

    try {
      await updateJobStatus(jobId, action);
      await loadJobs();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update job status.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const completedEarnings = useMemo(
    () =>
      completedJobs.reduce(
        (sum, job) => sum + Number(job.total_amount || 0),
        0
      ),
    [completedJobs]
  );

  const activeJobs = useMemo(
    () => jobs.filter((job) => ['ACCEPTED', 'WORKING'].includes(job.status)).length,
    [jobs]
  );

  const pendingJobs = useMemo(
    () => jobs.filter((job) => job.status === 'PENDING').length,
    [jobs]
  );

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#003049] text-white">
            <span className="text-xl font-bold">A</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Technician workspace
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your technician account is not currently available.
            Please sign in with an authorized technician account.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#003049] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#00263b]"
          >
            Back to AuroWater
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">

        {/* ============================================================
            HEADER
        ============================================================ */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

              <span className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                Technician workspace
              </span>
            </div>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Good to see you, {user.full_name}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage your assigned jobs and keep every service moving.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshJobs}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>

            <Link
              href="/technician/profile"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Profile
            </Link>

            <button
              type="button"
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="inline-flex items-center justify-center rounded-xl bg-[#003049] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00263b]"
            >
              Logout
            </button>
          </div>
        </header>

        {/* ============================================================
            ERROR
        ============================================================ */}
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError('')}
              className="font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ============================================================
            COMMAND CENTER
        ============================================================ */}
        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">

          <MetricCard
            label="Pending"
            value={pendingJobs}
            description="Needs attention"
            accent="amber"
          />

          <MetricCard
            label="Active jobs"
            value={activeJobs}
            description="Currently assigned"
            accent="blue"
          />

          <MetricCard
            label="Completed"
            value={completedJobs.length}
            description="Recorded jobs"
            accent="emerald"
          />

          <MetricCard
            label="Completed value"
            value={formatCurrency(completedEarnings)}
            description="Order value"
            accent="violet"
          />

        </section>

        {/* ============================================================
            JOB QUEUE
        ============================================================ */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* Queue header */}
          <div className="border-b border-slate-100 p-5 sm:p-6">

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Job queue
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your assigned service requests and next actions.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => {
                  const active =
                    statusFilter === filter.value;

                  return (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() =>
                        setStatusFilter(filter.value)
                      }
                      className={[
                        'rounded-xl px-3.5 py-2 text-sm font-semibold transition',
                        active
                          ? 'bg-[#003049] text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Queue */}
          <div className="p-4 sm:p-6">
            {loading ? (
              <JobsSkeleton />
            ) : jobs.length === 0 ? (
              <EmptyJobsState status={statusFilter} />
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => {
                  const status =
                    STATUS_META[
                      job.status as JobStatus
                    ] ?? {
                      label: job.status,
                      className:
                        'bg-slate-50 text-slate-700 border-slate-200',
                      dotClass: 'bg-slate-400',
                    };

                  const nextAction = getNextAction(
                    job.status
                  );

                  const busy =
                    actionLoading === job.id;

                  return (
                    <article
                      key={job.id}
                      className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-md sm:p-5"
                    >

                      {/* Top */}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">

                            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                              Job #{job.id}
                            </span>

                            <span
                              className={[
                                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                                status.className,
                              ].join(' ')}
                            >
                              <span
                                className={[
                                  'h-1.5 w-1.5 rounded-full',
                                  status.dotClass,
                                ].join(' ')}
                              />

                              {status.label}
                            </span>
                          </div>

                          <h3 className="mt-2 text-lg font-bold capitalize text-slate-900">
                            {job.service_name?.replace(
                              /_/g,
                              ' '
                            )}
                          </h3>

                          <p className="mt-1 text-sm text-slate-500">
                            Assigned {formatDate(job.assigned_at)}
                          </p>
                        </div>

                        <div className="shrink-0 text-left sm:text-right">
                          <p className="text-xs font-medium text-slate-400">
                            Order value
                          </p>

                          <p className="mt-1 text-xl font-bold text-[#003049]">
                            {formatCurrency(
                              job.total_amount
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                        <InfoBlock
                          label="Customer"
                          value={job.customer_name}
                          secondary={job.customer_phone}
                        />

                        <InfoBlock
                          label="Location"
                          value={`${job.house_no}, ${job.area}`}
                          secondary={job.city}
                        />

                        <InfoBlock
                          label="Time slot"
                          value={formatTimeSlot(
                            job.time_slot
                          )}
                        />

                        <InfoBlock
                          label="Job ID"
                          value={String(
                            job.order_id ?? job.id
                          )}
                        />

                      </div>

                      {/* Actions */}
                      <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">

                        <Link
                          href={`/technician/job/${job.id}`}
                          className="text-sm font-semibold text-[#003049] hover:underline"
                        >
                          View complete job →
                        </Link>

                        <div className="flex w-full gap-2 sm:w-auto">

                          {job.status === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleJobAction(
                                    job.id,
                                    'accept'
                                  )
                                }
                                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                              >
                                {busy
                                  ? 'Updating…'
                                  : 'Accept job'}
                              </button>

                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  handleJobAction(
                                    job.id,
                                    'reject'
                                  )
                                }
                                className="flex-1 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {nextAction.action && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleJobAction(
                                  job.id,
                                  nextAction.action!
                                )
                              }
                              className="w-full rounded-xl bg-[#003049] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#00263b] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                            >
                              {busy
                                ? 'Updating…'
                                : nextAction.label}
                            </button>
                          )}

                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ============================================================
            OPERATING PRINCIPLE
        ============================================================ */}
        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#003049] text-white">
              <span className="text-lg font-bold">A</span>
            </div>

            <div>
              <h2 className="font-bold text-slate-900">
                Keep every job moving
              </h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                Accept only jobs you can complete within the assigned
                service window. Update your status as you travel,
                start work, and finish the service so customers and
                operations always have an accurate view.
              </p>
            </div>

          </div>
        </section>

      </div>
    </main>
  );
}

/* =================================================================
   METRIC CARD
================================================================= */

function MetricCard({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: string | number;
  description: string;
  accent: 'amber' | 'blue' | 'emerald' | 'violet';
}) {
  const accentMap = {
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </span>

        <span
          className={[
            'h-2 w-2 rounded-full',
            accent === 'amber' && 'bg-amber-500',
            accent === 'blue' && 'bg-blue-500',
            accent === 'emerald' && 'bg-emerald-500',
            accent === 'violet' && 'bg-violet-500',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      </div>

      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>

      <span
        className={[
          'mt-2 inline-flex rounded-lg px-2 py-1 text-xs font-semibold',
          accentMap[accent],
        ].join(' ')}
      >
        {description}
      </span>
    </div>
  );
}

/* =================================================================
   INFO BLOCK
================================================================= */

function InfoBlock({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-semibold text-slate-800">
        {value}
      </p>

      {secondary && (
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {secondary}
        </p>
      )}
    </div>
  );
}

/* =================================================================
   EMPTY STATE
================================================================= */

function EmptyJobsState({
  status,
}: {
  status: JobStatus;
}) {
  const meta = STATUS_META[status];

  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-14 text-center">

      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
        <span className="text-xl text-slate-300">✓</span>
      </div>

      <h3 className="mt-4 text-lg font-bold text-slate-800">
        No {meta.label.toLowerCase()} jobs
      </h3>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        There are currently no jobs in this queue. New assignments
        will appear here automatically.
      </p>
    </div>
  );
}

/* =================================================================
   LOADING SKELETON
================================================================= */

function JobsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-slate-200 p-5"
        >
          <div className="flex justify-between gap-4">
            <div className="space-y-3">
              <div className="h-3 w-20 rounded bg-slate-100" />
              <div className="h-5 w-48 rounded bg-slate-100" />
              <div className="h-3 w-32 rounded bg-slate-50" />
            </div>

            <div className="h-6 w-20 rounded bg-slate-100" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, item) => (
              <div
                key={item}
                className="h-16 rounded-xl bg-slate-50"
              />
            ))}
          </div>

          <div className="mt-5 flex justify-between border-t border-slate-100 pt-4">
            <div className="h-4 w-28 rounded bg-slate-100" />
            <div className="h-10 w-32 rounded-xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
