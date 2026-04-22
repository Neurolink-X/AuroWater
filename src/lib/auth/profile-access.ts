import type { ProfileRow } from '@/lib/db/types';

/* ══════════════════════════════════════════════════════════════════════
   Profile access guards
   All functions accept a minimal Pick so callers don't need a full row.
   ══════════════════════════════════════════════════════════════════════

   THE FIX:
   `is_active` does not exist on ProfileRow — the AuroWater schema uses a
   `status` text column ('active' | 'suspended' | 'pending' | 'banned').
   Removed `Pick<ProfileRow, 'is_active'>` and replaced with the actual
   fields present on ProfileRow. TypeScript can now validate the keys.
══════════════════════════════════════════════════════════════════════ */

/** Subset of ProfileRow needed for login checks — all keys are real columns. */
type LoginCheckRow = Pick<ProfileRow, 'status' | 'role'>;

/** Subset needed for role checks. */
type RoleCheckRow = Pick<ProfileRow, 'role'>;

/** Subset needed for approval checks (supplier / technician applications). */
type ApprovalCheckRow = Pick<ProfileRow, 'status' | 'role'>;

/* ── Status constants ─────────────────────────────────────────────────── */

const BLOCKED_STATUSES = new Set<string>(['suspended', 'banned']);
const PENDING_STATUSES = new Set<string>(['pending']);

const ROLES_REQUIRING_APPROVAL = new Set<string>(['supplier', 'technician']);

/* ══════════════════════════════════════════════════════════════════════
   Core guards
══════════════════════════════════════════════════════════════════════ */

/**
 * Returns true when the profile is allowed to log in.
 *
 * Rules (in order):
 *  1. status = 'suspended' | 'banned'  → blocked
 *  2. role requires approval AND status = 'pending' → blocked (application not yet approved)
 *  3. Everything else → allowed
 *
 * Null / undefined status (legacy rows) defaults to 'active' — same as the
 * DB column default — so old rows are never accidentally locked out.
 *
 * @example
 * const allowed = isProfileLoginAllowed(profile);
 * if (!allowed.ok) return jsonErr(allowed.reason, 403);
 */
export function isProfileLoginAllowed(row: LoginCheckRow): {
  ok: boolean;
  reason: string;
} {
  const status = normaliseStatus(row.status);
  const role   = normaliseRole(row.role);

  if (BLOCKED_STATUSES.has(status)) {
    return {
      ok:     false,
      reason: status === 'banned'
        ? 'This account has been permanently banned.'
        : 'This account is suspended. Contact support.',
    };
  }

  if (ROLES_REQUIRING_APPROVAL.has(role) && PENDING_STATUSES.has(status)) {
    return {
      ok:     false,
      reason: 'Your application is pending admin approval. You will be notified once approved.',
    };
  }

  return { ok: true, reason: '' };
}

/**
 * Returns true when the profile holds admin-level access.
 */
export function isAdmin(row: RoleCheckRow): boolean {
  return normaliseRole(row.role) === 'admin';
}

/**
 * Returns true when the profile holds the specified role.
 *
 * @example
 * if (!hasRole(profile, 'supplier')) return jsonErr('Forbidden', 403);
 */
export function hasRole(row: RoleCheckRow, role: ProfileRow['role']): boolean {
  return normaliseRole(row.role) === role;
}

/**
 * Admins pass every role check — they can act on behalf of any role.
 */
export function hasRoleOrAdmin(row: RoleCheckRow, role: ProfileRow['role']): boolean {
  const r = normaliseRole(row.role);
  return r === role || r === 'admin';
}

/**
 * Returns true when a supplier or technician application has been approved.
 * For customers and admins this always returns true (no approval required).
 */
export function isApproved(row: ApprovalCheckRow): boolean {
  const role   = normaliseRole(row.role);
  const status = normaliseStatus(row.status);

  if (!ROLES_REQUIRING_APPROVAL.has(role)) return true;
  return status === 'active';
}

/**
 * Convenience: returns a human-readable label for a profile's status.
 */
export function statusLabel(row: Pick<ProfileRow, 'status'>): string {
  const STATUS_LABELS: Record<string, string> = {
    active:    'Active',
    suspended: 'Suspended',
    pending:   'Pending Approval',
    banned:    'Banned',
  };
  return STATUS_LABELS[normaliseStatus(row.status)] ?? 'Unknown';
}

/* ── Private helpers ──────────────────────────────────────────────────── */

function normaliseStatus(status: string | null | undefined): string {
  return typeof status === 'string' ? status.toLowerCase().trim() : 'active';
}

function normaliseRole(role: string | null | undefined): string {
  return typeof role === 'string' ? role.toLowerCase().trim() : 'customer';
}