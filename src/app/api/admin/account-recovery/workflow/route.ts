import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonErr, jsonOk } from '@/lib/api/json-response';
import { requireSupabaseAuth } from '@/lib/api/supabase-request';
import { createServiceClient } from '@/utils/supabase/server';
import { UUID_PATTERN, RECOVERY_CATEGORIES } from '@/lib/account-recovery/shared';
import { OWNERSHIP_METHODS, workflowState } from '@/lib/account-recovery/workflow';

export const dynamic = 'force-dynamic';
const UUID = z.string().regex(UUID_PATTERN);
const schema = z.object({
  request_id: UUID,
  action: z.enum(['propose_account_link', 'approve_account_link', 'verify_identity', 'verify_remedy', 'confirm_offline']),
  target_user_id: UUID.optional(),
  method: z.enum(OWNERSHIP_METHODS.map(x => x.value) as [typeof OWNERSHIP_METHODS[number]['value'], ...typeof OWNERSHIP_METHODS[number]['value'][]]).optional(),
  note: z.string().trim().min(40).max(900),
}).strict();

export async function POST(req: NextRequest) {
  const auth = await requireSupabaseAuth(req);
  if (!auth.ok) return auth.response;
  if (auth.ctx.profile.role !== 'admin') return jsonErr('Forbidden', 403);
  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonErr('Invalid request.', 400); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonErr(parsed.error.issues[0]?.message ?? 'Invalid workflow action.', 422);
  const { request_id, action, target_user_id, note, method } = parsed.data;
  const adminId = auth.ctx.user.id;
  const db = createServiceClient();

  const { data: ticket, error: ticketError } = await db.from('account_recovery_requests')
    .select('id,user_id,contact_email,category,status,ownership_verified_at').eq('id', request_id).maybeSingle();
  if (ticketError) return jsonErr('Could not load recovery request.', 503);
  if (!ticket) return jsonErr('Recovery request not found.', 404);
  if (['resolved', 'rejected'].includes(String(ticket.status))) return jsonErr('This recovery request is closed.', 409);

  const { data: audit, error: auditError } = await db.from('account_recovery_audit')
    .select('action,actor_user_id,details,created_at').eq('request_id', request_id)
    .order('created_at', { ascending: false }).limit(100);
  if (auditError) return jsonErr('Recovery audit log unavailable; no action taken.', 503);
  const events = audit ?? [];
  const state = workflowState(events);

  async function log(event: string, details: Record<string, unknown>) {
    const { error } = await db.from('account_recovery_audit').insert({
      request_id, actor_user_id: adminId, action: event, details: { ...details, note },
    });
    return error;
  }

  // An anonymous form can name a victim. Link it only after independent evidence,
  // and have a SECOND distinct admin authorize the exact target before any actions.
  if (action === 'propose_account_link') {
    if (ticket.user_id) return jsonErr('This ticket is already account-linked.', 409);
    if (!target_user_id || !method) return jsonErr('Choose target account, evidence method and a detailed verification note.', 422);
    const { data: target, error } = await db.from('profiles')
      .select('id,role').eq('id', target_user_id).maybeSingle();
    if (error || !target || target.role !== 'customer') return jsonErr('Eligible customer account not found.', 422);
    const writeError = await log('recovery_account_link_proposed', { target_user_id, method });
    return writeError ? jsonErr('Could not record account-link proposal.', 503) : jsonOk({ recorded: true, message: 'Proposal recorded. A different admin must independently verify and approve the link.' });
  }

  if (action === 'approve_account_link') {
    if (ticket.user_id) return jsonErr('This ticket is already linked.', 409);
    if (!target_user_id || !method) return jsonErr('Target account and independent verification method are required.', 422);
    const proposal = events.find(e => e.action === 'recovery_account_link_proposed' &&
      e.details?.target_user_id === target_user_id && e.actor_user_id !== adminId);
    if (!proposal) return jsonErr('Require a matching proposal from another administrator.', 409);
    const { data: target, error: targetError } = await db.from('profiles').select('id,role').eq('id', target_user_id).maybeSingle();
    if (targetError || target?.role !== 'customer') return jsonErr('Linked account eligibility cannot be verified.', 409);
    const { data: linked, error: linkError } = await db.from('account_recovery_requests')
      .update({ user_id: target_user_id }).eq('id', request_id).is('user_id', null)
      .in('status', ['open', 'in_review', 'waiting_customer']).select('id').maybeSingle();
    if (linkError || !linked) return jsonErr('Ticket changed during account linking; refresh and review.', 409);
    const writeError = await log('recovery_account_link_approved', { target_user_id, method, proposal_actor: proposal.actor_user_id });
    if (writeError) {
      console.error('[recovery/workflow] linked account audit failure', writeError.code);
      return jsonErr('Account linked but audit write failed. STOP and reconcile before taking further action.', 503);
    }
    return jsonOk({ recorded: true, message: 'Account linked with two-admin verification. Ownership evidence must still be recorded.' });
  }

  if (!ticket.user_id) return jsonErr('First link the correct account through the two-admin verification process.', 409);

  const { data: profile, error: profileError } = await db.from('profiles')
    .select('id,role,email,status,is_active').eq('id', ticket.user_id).maybeSingle();
  if (profileError || !profile || profile.role !== 'customer') return jsonErr('Target customer record could not be verified.', 409);
  const originalIdentity = events.find(e => e.action === 'ownership_evidence_verified');

  if (action === 'verify_identity') {
    if (!method) return jsonErr('Independent verification method is required.', 422);
    if (state.identity) return jsonErr('Ownership evidence is already recorded.', 409);
    // Record the independent evidence before mutating the verified flag. Neither
    // contact email nor matching profile email is accepted as standalone proof.
    const written = await log('ownership_evidence_verified', {
      method, registered_email_at_verification: String(profile.email ?? '').toLowerCase(),
      original_status: profile.status, originally_active: profile.is_active === true,
    });
    if (written) return jsonErr('Ownership evidence could not be securely recorded.', 503);
    const { error: verifyError } = await db.rpc('update_account_recovery_review', {
      p_request_id: request_id, p_admin_id: adminId, p_status: 'in_review',
      p_admin_note: note, p_verify_ownership: true,
    });
    if (verifyError) return jsonErr('Evidence saved but ownership flag update failed. Do not proceed until reconciled.', 503);
    return jsonOk({ recorded: true, message: 'Ownership evidence recorded and request moved to In Review.' });
  }

  if (!state.identity || !ticket.ownership_verified_at) {
    return jsonErr('Complete the independent ownership verification workflow first.', 409);
  }

  if (action === 'verify_remedy') {
    if (state.remedy) return jsonErr('A remedy was already verified. Refresh the audit.', 409);
    let verifiedState: Record<string, unknown>;
    const category = String(ticket.category);
    if (category === 'forgot_password' || category === 'account_access') {
      const resetRequested = events.some(e => e.action === 'registered_email_reset_requested');
      const customerConfirmed = events.some(e => e.action === 'customer_recovery_confirmed');
      if (!customerConfirmed) return jsonErr('The customer must sign in and confirm account access. A reset email alone is not proof.', 409);
      verifiedState = { customer_confirmed: true, reset_requested: resetRequested };
    } else if (category === 'lost_email_access' || category === 'change_email') {
      const baseline = String(originalIdentity?.details?.registered_email_at_verification ?? '').toLowerCase();
      const { data: actual, error } = await db.auth.admin.getUserById(ticket.user_id);
      const authEmail = String(actual?.user?.email ?? '').trim().toLowerCase();
      const profileEmail = String(profile.email ?? '').trim().toLowerCase();
      if (error || !baseline || !authEmail || authEmail === baseline || authEmail !== profileEmail) {
        return jsonErr('Auth email change not verified. Require a securely completed change and synchronized profile email.', 409);
      }
      verifiedState = { auth_email_changed: true, registered_profile_synced: true };
    } else if (category === 'account_blocked') {
      const previous = String(originalIdentity?.details?.original_status ?? '');
      const wasInactive = originalIdentity?.details?.originally_active === false;
      if (previous !== 'suspended' && !wasInactive) return jsonErr('No previous account suspension/inactivation was evidenced.', 409);
      if (profile.status !== 'active' || profile.is_active !== true) return jsonErr('Account is not active. Review policy and use authorized Users controls first.', 409);
      verifiedState = { profile_active: true, original_status: previous };
    } else if (category === 'other') {
      if (adminId === state.identityActor) return jsonErr('A second independent admin must verify the correction for Other issues.', 409);
      verifiedState = { independent_admin_review: true };
    } else return jsonErr('Unsupported recovery category.', 422);

    const writeError = await log('recovery_remedy_verified', { category, verified_state: verifiedState });
    return writeError ? jsonErr('Remedy verification audit failed.', 503)
      : jsonOk({ recorded: true, message: 'Backend validated the corrective-action evidence. Customer confirmation is still required unless already recorded.' });
  }

  if (action === 'confirm_offline') {
    if (!method) return jsonErr('Choose an independently verified contact method.', 422);
    if (!state.remedy) return jsonErr('Verify the actual remedy before offline customer confirmation.', 409);
    if (state.identityActor === adminId || state.remedyActor === adminId) {
      return jsonErr('Offline confirmation requires a separate administrator from the identity verifier and remedy reviewer.', 409);
    }
    if (state.confirmation) return jsonErr('Customer confirmation already recorded.', 409);
    const writeError = await log('customer_recovery_confirmed_offline', { method, confirmation_method: 'independent_verified_contact' });
    return writeError ? jsonErr('Offline confirmation could not be recorded.', 503)
      : jsonOk({ recorded: true, message: 'Separate admin documented independent customer confirmation. Review the case before closure.' });
  }

  return jsonErr('Unsupported action.', 422);
}
