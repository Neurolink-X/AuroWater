'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getUser, getOrderDetail, logout } from '@/lib/api-client';
import { Button } from '@/components/Button';
import { Alert } from '@/components/Alert';
import { Card } from '@/components/Card';
import { User } from '@/types';

interface OrderDetail {
  order: any;
  history: any[];
  job: any;
}

const statusColors: any = {
  PENDING: 'bg-gray-100 text-gray-800',
  ASSIGNED: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const jobStatusColors: any = {
  PENDING: 'bg-gray-100 text-gray-800',
  ACCEPTED: 'bg-blue-100 text-blue-800',
  ON_THE_WAY: 'bg-orange-100 text-orange-800',
  WORKING: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function TrackOrder() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser || currentUser.role !== 'CUSTOMER') {
      setUser(null);
      setLoading(false);
      return;
    }

    setUser(currentUser);
    loadOrderDetail();
  }, [router, orderId]);

  const loadOrderDetail = async () => {
    try {
      setLoading(true);
      const data = await getOrderDetail(orderId);
      setOrderDetail(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Live tracking</h1>
          <p className="text-gray-600 mb-4">
            Tracking activates automatically after you place a booking. Start a booking to get a live
            status timeline and updates.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/book">
              <Button variant="primary">Explore booking</Button>
            </Link>
            <Link href="/pricing">
              <Button variant="secondary">View pricing</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!orderDetail) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link href="/customer/home">
              <Button variant="secondary">← Back to Home</Button>
            </Link>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Alert type="error">{error || 'Order not found'}</Alert>
        </main>
      </div>
    );
  }

  const { order, history, job } = orderDetail;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-600">🌊 AuroWater</h1>
            <p className="text-sm text-gray-600">Order #{order.id}</p>
          </div>
          <div className="space-x-4">
            <Link href="/customer/history">
              <Button variant="secondary">Order History</Button>
            </Link>
            <Link href="/customer/home">
              <Button variant="secondary">New Order</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <Alert type="error">{error}</Alert>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Status */}
            <Card>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Order Status</h2>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-bold ${
                    statusColors[order.status] || 'bg-gray-100'
                  }`}
                >
                  {order.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Service</p>
                  <p className="font-semibold">{order.service_name?.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-gray-600">Date & Time</p>
                  <p className="font-semibold">
                    {new Date(order.created_at).toLocaleDateString()} {order.time_slot}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Location</p>
                  <p className="font-semibold">
                    {order.house_no}, {order.area}, {order.city}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Amount</p>
                  <p className="font-semibold text-blue-600">₹{order.total_amount}</p>
                </div>
              </div>
            </Card>

            {/* Job Status (if assigned) */}
            {job && (
              <Card>
                <h3 className="text-xl font-bold mb-4 flex justify-between items-center">
                  <span>Technician Assignment</span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-bold ${
                      jobStatusColors[job.status] || 'bg-gray-100'
                    }`}
                  >
                    {job.status}
                  </span>
                </h3>

                <div className="space-y-3">
                  <div>
                    <p className="text-gray-600 text-sm">Technician</p>
                    <p className="font-semibold">{job.technician_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Contact</p>
                    <p className="font-semibold">📞 {job.technician_phone}</p>
                  </div>
                  {job.accepted_at && (
                    <div>
                      <p className="text-gray-600 text-sm">Accepted At</p>
                      <p className="font-semibold">
                        {new Date(job.accepted_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {job.completed_at && (
                    <div>
                      <p className="text-gray-600 text-sm">Completed At</p>
                      <p className="font-semibold">
                        {new Date(job.completed_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Status Timeline */}
            <Card>
              <h3 className="text-xl font-bold mb-4">Status Timeline</h3>
              <div className="space-y-4">
                {history.map((item, index) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
                      {index < history.length - 1 && (
                        <div className="w-1 h-12 bg-gray-300"></div>
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="font-semibold">{item.status}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                      {item.notes && <p className="text-sm text-gray-700 mt-1">{item.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Pricing Summary */}
          <div>
            <Card>
              <h3 className="text-xl font-bold mb-4">Payment Details</h3>

              <div className="space-y-3 text-sm mb-6 pb-6 border-b">
                <div className="flex justify-between">
                  <span className="text-gray-600">Base Price:</span>
                  <span>₹{order.base_price?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Distance Factor:</span>
                  <span>{order.distance_factor?.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>₹{order.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax:</span>
                  <span>₹{order.tax_amount?.toFixed(2)}</span>
                </div>
                {order.emergency_charge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Emergency:</span>
                    <span className="text-red-600">₹{order.emergency_charge?.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-blue-600">₹{order.total_amount?.toFixed(2)}</span>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                <p>
                  {order.status === 'COMPLETED'
                    ? '✓ Order completed successfully'
                    : order.status === 'CANCELLED'
                      ? '✗ Order cancelled'
                      : '⏳ Order in progress. You will be notified of any changes.'}
                </p>
              </div>
            </Card>

            <div className="mt-6">
              <Link href="/customer/home">
                <Button variant="primary" className="w-full">
                  + New Order
                </Button>
              </Link>
              <Link href="/customer/history">
                <Button variant="secondary" className="w-full mt-2">
                  View All Orders
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
