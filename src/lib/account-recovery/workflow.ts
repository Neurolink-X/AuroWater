import type { RecoveryCategory } from './shared';

/** Client-safe labels. Server routes separately enforce every requirement. */
export const RECOVERY_WORKFLOWS: Record<RecoveryCategory, {
  title: string;
  steps: readonly string[];
  actionHelp: string;
}> = {
  forgot_password: {
    title: 'Password reset & sign-in',
    steps: ['Verify the account owner independently', 'Send reset instructions to the registered inbox', 'Customer resets password and signs in', 'Verify recovery and customer confirmation', 'Record final outcome and notify'],
    actionHelp: 'A sent email is not a completed reset. Require actual customer sign-in confirmation.',
  },
  lost_email_access: {
    title: 'Lost registered email access',
    steps: ['Identify the original account without trusting supplied contact email', 'Verify ownership using independent evidence', 'Escalate email recovery to the authorized secure channel', 'Verify the changed email against Auth AND profile', 'Customer confirms restored access'],
    actionHelp: 'Never send access links to a new contact email or overwrite Auth on the basis of this form.',
  },
  change_email: {
    title: 'Registered email change',
    steps: ['Independently verify ownership', 'Use an authenticated, provider-confirmed email-change process', 'Check Auth and profile show the newly verified address', 'Customer confirms the new login works', 'Notify and close'],
    actionHelp: 'An administrative override bypasses Supabase email confirmation; it is not available in this workflow.',
  },
  account_blocked: {
    title: 'Account suspension review',
    steps: ['Verify ownership and original status', 'Investigate suspension policy and reason', 'Use the existing authorized Users reactivation action when allowed', 'Verify account is active in the database', 'Customer confirms successful access'],
    actionHelp: 'Do not automatically clear bans, rejection decisions or policy/safety restrictions.',
  },
  account_access: {
    title: 'Login/access investigation',
    steps: ['Verify ownership', 'Inspect error and login/provider status', 'Perform a secure supported correction', 'Verify a real account recovery action', 'Customer confirms sign-in works'],
    actionHelp: 'Reset instructions are only one possible remedy. Confirm the actual reported error is gone.',
  },
  other: {
    title: 'Other account assistance',
    steps: ['Classify the actual issue', 'Verify the requester and account link', 'Perform a documented authorized correction', 'Obtain independent reviewer approval', 'Customer confirms the issue is fixed'],
    actionHelp: 'An unspecified ticket requires a second authorized admin review before it can be closed.',
  },
};

export const OWNERSHIP_METHODS = [
  { value: 'verified_existing_session', label: 'Verified existing authenticated session' },
  { value: 'independent_support_check', label: 'Independent support verification with evidence' },
  { value: 'verified_prior_records', label: 'Verified prior account records and trusted callback' },
] as const;

export type RecoveryAction =
  | 'verify_identity'
  | 'verify_remedy'
  | 'confirm_offline';
export type WorkflowAuditEvent = {
  action: string;
  actor_user_id: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
};

export function workflowState(events: readonly WorkflowAuditEvent[]) {
  const identity = events.find(e => e.action === 'ownership_evidence_verified');
  const remedy = events.find(e => e.action === 'recovery_remedy_verified');
  const confirmation = events.find(e => e.action === 'customer_recovery_confirmed' || e.action === 'customer_recovery_confirmed_offline');
  return {
    identity: Boolean(identity),
    remedy: Boolean(remedy),
    confirmation: Boolean(confirmation),
    remedyActor: remedy?.actor_user_id ?? null,
    identityActor: identity?.actor_user_id ?? null,
    confirmationActor: confirmation?.actor_user_id ?? null,
    ready: Boolean(identity && remedy && confirmation),
  };
}
