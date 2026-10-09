'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getUser, getTechnicianJobDetail, updateJobStatus, logout } from '@/lib/api-client';
import { Button } from '@/components/Button';
import { Alert } from '@/components/Alert';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { User } from '@/types';

const jobStatusSteps = ['PENDING', 'ACCEPTED', 'WORKING', 'COMPLETED'];

const stepActions: any = {
  PENDING: { action: 'accept', label: 'Accept Job', next: 'ACCEPTED' },
  ACCEPTED: { action: 'on_the_way', label: 'Start Visit', next: 'WORKING' },
  WORKING: { action: 'complete', label: 'Mark Complete', next: 'COMPLETED' },
};

export default function JobDetail() {
  const router = useRouter();
  const params = useParams();
  const jobId = params?.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [serviceOtp, setServiceOtp] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role !== 'TECHNICIAN') {
      setUser(null);
      setLoading(false);
      return;
    }

    setUser(currentUser);
    loadJobData();
  }, [router, jobId]);

  const loadJobData = async () => {
    if (!jobId) return;
    try {
      setLoading(true);
      setError('');
      const data = await getTechnicianJobDetail(jobId);
      setJob(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
      setJob(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!job) return;

    const action = stepActions[job.status]?.action;
    if (!action) {
      setError('No action available for current status');
      return;
    }

    setError('');
    setSuccess('');

    if (action === 'complete' && !/^\d{6}$/.test(serviceOtp.trim())) {
      setError('Enter the 6-digit service code shared by the customer.');
      return;
    }
    if (action === 'complete' && !paymentConfirmed) {
      setError('Confirm that payment has been collected or correctly recorded before completing the job.');
      return;
    }
    if (action === 'complete' && String(job.payment_method ?? '').toLowerCase() === 'upi' && !paymentReference.trim()) {
      setError('Enter the UPI payment reference before completing this job.');
      return;
    }

    setUpdating(true);
    try {
      await updateJobStatus(jobId, action, notes, action === 'complete' ? {
        otp: serviceOtp.trim(),
        payment_confirmed: paymentConfirmed,
        payment_reference: paymentReference.trim() || undefined,
      } : undefined);
      setSuccess('Job status updated successfully!');
      setNotes('');
      if (action === 'complete') setServiceOtp('');
      
      // Update local state
      setJob({
        ...job,
        status: stepActions[job.status].next,
      });

      setTimeout(() => {
        router.push('/technician/jobs');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update job');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Technician job detail (accounts off)</h1>
          <p className="text-gray-600 mb-4">
            Detailed job flows for plumbers and technicians will appear here when we enable
            logins again. Right now the focus is a frictionless public experience.
          </p>
          <Link href="/">
            <Button variant="secondary">Go to homepage</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link href="/technician/jobs">
              <Button variant="secondary">← Back to Jobs</Button>
            </Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Alert type="error">{error || 'Job not found'}</Alert>
        </main>
      </div>
    );
  }

  const actionInfo = stepActions[job.status];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-600">🌊 AuroWater</h1>
            <p className="text-sm text-gray-600">Job #{job.id}</p>
          </div>
          <div className="space-x-4">
            <Link href="/technician/jobs">
              <Button variant="secondary">Back to Jobs</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Info */}
            <Card>
              <h2 className="text-xl font-bold mb-4">Customer Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="text-lg font-semibold">{job.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="text-lg font-semibold">
                    <a href={`tel:${job.customer_phone}`} className="text-blue-600 hover:underline">
                      {job.customer_phone}
                    </a>
                  </p>
                </div>
              </div>
            </Card>

            {/* Location Info */}
            <Card>
              <h2 className="text-xl font-bold mb-4">Service Location</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-semibold">
                    {job.house_no}, {job.area}
                  </p>
                  {job.landmark && <p className="text-sm text-gray-600">📍 {job.landmark}</p>}
                  <p className="text-sm text-gray-600">
                    {job.city}
                  </p>
                </div>
                {job.lat && job.lng && (
                  <div>
                    <p className="text-sm text-gray-600">Coordinates</p>
                    <p className="font-mono text-sm">
                      {job.lat}, {job.lng}
                    </p>
                    <a
                      href={`https://maps.google.com/?q=${job.lat},${job.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      📍 Open in Google Maps
                    </a>
                  </div>
                )}
              </div>
            </Card>

            {/* Service Info */}
            <Card>
              <h2 className="text-xl font-bold mb-4">Service Details</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Service Type</p>
                  <p className="text-lg font-semibold">
                    {job.service_name?.replace(/_/g, ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="text-2xl font-bold text-blue-600">₹{job.total_amount}</p>
                </div>
                {job.time_slot && (
                  <div>
                    <p className="text-sm text-gray-600">Preferred Time Slot</p>
                    <p className="font-semibold">{job.time_slot}</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Status Timeline */}
            <Card>
              <h2 className="text-xl font-bold mb-4">Status Journey</h2>
              <div className="flex gap-2 flex-wrap">
                {jobStatusSteps.map((step, index) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`px-4 py-2 rounded-lg font-semibold text-sm ${
                        jobStatusSteps.indexOf(job.status) >= index
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {step}
                    </div>
                    {index < jobStatusSteps.length - 1 && (
                      <div className="w-4 h-0.5 bg-gray-300 mx-1"></div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Actions Sidebar */}
          <div>
            <Card>
              <h3 className="text-xl font-bold mb-4">Next Action</h3>

              {actionInfo ? (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Current Status</p>
                    <p className="text-lg font-bold text-blue-600">{job.status}</p>
                  </div>

                  {actionInfo.action === 'complete' ? (
                    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <label className="block text-sm font-semibold text-gray-800" htmlFor="service-otp">6-digit customer service code</label>
                      <input id="service-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={serviceOtp} onChange={(event) => setServiceOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base tracking-[0.3em]" placeholder="••••••" />
                      <label className="flex items-start gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={paymentConfirmed} onChange={(event) => setPaymentConfirmed(event.target.checked)} className="mt-1" />
                        <span>I confirm the payment has been collected or accurately recorded.</span>
                      </label>
                      {String(job.payment_method ?? '').toLowerCase() === 'upi' ? (
                        <Input label="UPI payment reference" type="text" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
                      ) : null}
                    </div>
                  ) : null}

                  <Input
                    label="Add Notes (Optional)"
                    type="textarea"
                    placeholder="e.g., Work completed, parts replaced..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />

                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleStatusUpdate}
                    isLoading={updating}
                  >
                    {actionInfo.label}
                  </Button>

                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">
                      Next Status: <span className="font-bold">{actionInfo.next}</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-green-700 font-semibold">✓ Job Completed!</p>
                </div>
              )}

              <Button
                variant="secondary"
                className="w-full mt-4"
                onClick={() => router.push('/technician/jobs')}
              >
                View All Jobs
              </Button>
            </Card>

            <div className="mt-6">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  logout();
                  router.push('/');
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
