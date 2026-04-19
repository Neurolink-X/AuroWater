import type { User, UserRole } from '@/types';

export function getRoleHomePath(role: UserRole): string {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'TECHNICIAN') return '/technician/dashboard';
  if (role === 'SUPPLIER') return '/supplier/dashboard';
  return '/dashboard';
}

export function getUserRoleHomePath(user: User | null | undefined): string {
  if (!user) return '/dashboard';
  return getRoleHomePath(user.role);
}

