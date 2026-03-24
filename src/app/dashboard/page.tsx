'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser } from '@/lib/api-client';
import type { User } from '@/types';
import CustomerHome from '@/app/customer/home/page';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const u = getUser();
    setUser(u ?? null);
    setChecked(true);
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-section">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  // If not logged in, just show a public-friendly dashboard entry
  // instead of forcing login.
  if (!user) {
    return <CustomerHome />;
  }

  if (user.role === 'CUSTOMER') {
    return <CustomerHome />;
  }

  if (user.role === 'TECHNICIAN') {
    router.replace('/technician/dashboard');
    return null;
  }

  if (user.role === 'ADMIN') {
    router.replace('/admin/dashboard');
    return null;
  }

  router.replace('/');
  return null;
}
