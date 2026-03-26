'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type AuthRole } from '@/hooks/useAuth';

export default function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: AuthRole;
}) {
  const router = useRouter();
  const { isLoggedIn, role, checked } = useAuth();

  React.useEffect(() => {
    if (!checked) return;
    if (!isLoggedIn) {
      router.replace('/auth/login');
      return;
    }
    if (requiredRole && role && role !== requiredRole && (role as string) !== 'admin') {
      if (role === 'customer') router.replace('/dashboard');
      if (role === 'technician') router.replace('/technician/dashboard');
      if (role === 'supplier') router.replace('/supplier/dashboard');
    }
  }, [checked, isLoggedIn, role, requiredRole, router]);

  if (!checked) return null;
  if (!isLoggedIn) return null;
  if (requiredRole && role && role !== requiredRole && (role as string) !== 'admin') return null;

  return <>{children}</>;
}

