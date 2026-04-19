import type { ProfileRow } from '@/lib/db/types';

/**
 * Login is allowed unless the profile is explicitly deactivated.
 * `is_active` null/undefined (legacy rows, partial JSON) → treat as active (same as DB default true).
 */
export function isProfileLoginAllowed(
  row: Pick<ProfileRow, 'is_active'> & { status?: string | null }
): boolean {
  if (row.is_active === false) return false;
  const st = typeof row.status === 'string' ? row.status.toLowerCase().trim() : '';
  if (st === 'suspended' || st === 'banned') return false;
  return true;
}
