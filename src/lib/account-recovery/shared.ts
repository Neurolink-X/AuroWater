// PATH: src/lib/account-recovery/shared.ts
import { z } from 'zod';

/**
 * Single source of truth for the account-recovery feature.
 * Imported by the public page, the admin page, and both API routes, so
 * validation rules, labels and limits can never drift apart.
 * Must stay isomorphic: no Node-only or browser-only imports here.
 */

export const RECOVERY_CATEGORIES = [
  { value: 'forgot_password', label: 'Forgot password', adminLabel: 'Forgot password' },
  { value: 'lost_email_access', label: 'I lost access to my registered email', adminLabel: 'Lost email access' },
  { value: 'change_email', label: 'Request registered email change', adminLabel: 'Change registered email' },
  { value: 'account_blocked', label: 'Account blocked or suspended', adminLabel: 'Account blocked' },
  { value: 'account_access', label: 'Other login/access problem', adminLabel: 'Cannot access account' },
  { value: 'other', label: 'Other', adminLabel: 'Other issue' },
] as const;

export type RecoveryCategory = (typeof RECOVERY_CATEGORIES)[number]['value'];
const CATEGORY_VALUES = RECOVERY_CATEGORIES.map((c) => c.value) as [RecoveryCategory, ...RecoveryCategory[]];

export const categoryAdminLabel = (value: string) =>
  RECOVERY_CATEGORIES.find((c) => c.value === value)?.adminLabel ?? value;

export const RECOVERY_STATUSES = ['open', 'in_review', 'waiting_customer', 'resolved', 'rejected'] as const;
export type RecoveryStatus = (typeof RECOVERY_STATUSES)[number];
export const CLOSED_STATUSES: readonly string[] = ['resolved', 'rejected'];
export const isClosedStatus = (s: string) => CLOSED_STATUSES.includes(s);
export const statusLabel = (s: string) => s.replace(/_/g, ' ');

export const LIMITS = {
  nameMin: 2, nameMax: 100,
  emailMax: 254,
  phoneMax: 20,
  messageMin: 10, messageMax: 2000,
  noteMin: 10, noteMax: 1000,
} as const;

const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(LIMITS.emailMax, 'Email address is too long.')
  .email('Enter a valid email address.')
  .transform((v) => v.toLowerCase());

/** Public "I need help" form. `website` is a honeypot that real users never fill. */
export const recoveryRequestSchema = z.object({
  name: z.string().trim()
    .min(LIMITS.nameMin, `Enter your full name (at least ${LIMITS.nameMin} characters).`)
    .max(LIMITS.nameMax, 'Name is too long.'),
  email: emailField,
  phone: z.string().trim().max(LIMITS.phoneMax, 'Phone number is too long.')
    .refine((v) => v === '' || PHONE_PATTERN.test(v), 'Enter a valid contact number.')
    .optional().default(''),
  category: z.enum(CATEGORY_VALUES, { message: 'Choose what you need help with.' }),
  message: z.string().trim()
    .min(LIMITS.messageMin, `Please describe the problem (at least ${LIMITS.messageMin} characters).`)
    .max(LIMITS.messageMax, `Keep the message under ${LIMITS.messageMax} characters.`),
  website: z.string().max(200).optional().default(''),
});
export type RecoveryRequestInput = z.input<typeof recoveryRequestSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });

/** Admin review payload. Mirrors the rules enforced inside the SQL function. */
export const reviewSchema = z
  .object({
    request_id: z.string().regex(UUID_PATTERN, 'Invalid request ID.'),
    status: z.enum(RECOVERY_STATUSES),
    admin_note: z.string().trim().max(LIMITS.noteMax).optional().default(''),
    verify_ownership: z.boolean().optional().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.verify_ownership && v.admin_note.length < LIMITS.noteMin) {
      ctx.addIssue({ code: 'custom', path: ['admin_note'], message: `Add a verification note (at least ${LIMITS.noteMin} characters) before confirming ownership.` });
    }
    if (v.verify_ownership && v.status === 'rejected') {
      ctx.addIssue({ code: 'custom', path: ['status'], message: 'Ownership cannot be verified on a rejected request.' });
    }
  });

export type RecoveryRequest = {
  id: string; request_number: number; user_id: string | null; contact_name: string;
  contact_email: string; contact_phone: string | null; category: string; message: string;
  status: string; admin_note: string | null; ownership_verified_at: string | null;
  resolved_at?: string | null; created_at: string; updated_at?: string | null;
};
export type RecoveryAudit = {
  id: number; request_id?: string; actor_user_id: string | null; action: string;
  details: Record<string, unknown>; created_at: string;
};
export type StatusCounts = Partial<Record<RecoveryStatus, number | null>>;

export const firstIssue = (e: z.ZodError, fallback = 'Check the details and try again.') =>
  e.issues[0]?.message || fallback;

export const maskEmail = (email: string) => {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(user.length - 2, 6)))}@${domain}`;
};
