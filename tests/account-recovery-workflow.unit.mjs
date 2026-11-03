import assert from 'node:assert/strict';
import test from 'node:test';
import { RECOVERY_WORKFLOWS, workflowState } from '../src/lib/account-recovery/workflow.ts';

const event = (action, actor = 'actor') => ({ action, actor_user_id: actor, details: {}, created_at: '2026-11-03T00:00:00Z' });

test('six recovery categories have distinct workflows and explicitly explain safe action', () => {
  assert.deepEqual(Object.keys(RECOVERY_WORKFLOWS).sort(), [
    'account_access', 'account_blocked', 'change_email',
    'forgot_password', 'lost_email_access', 'other',
  ]);
  for (const flow of Object.values(RECOVERY_WORKFLOWS)) {
    assert.ok(flow.steps.length >= 4);
    assert.ok(flow.actionHelp.length >= 30);
  }
});

test('all independent recovery stages are required before a case is ready to resolve', () => {
  assert.equal(workflowState([]).ready, false);
  assert.equal(workflowState([event('ownership_evidence_verified')]).ready, false);
  assert.equal(workflowState([event('ownership_evidence_verified'), event('customer_recovery_confirmed', 'customer')]).ready, false);
  assert.equal(workflowState([event('ownership_evidence_verified'), event('recovery_remedy_verified')]).ready, false);
  const state = workflowState([
    event('ownership_evidence_verified', 'admin-a'),
    event('recovery_remedy_verified', 'admin-b'),
    event('customer_recovery_confirmed', 'customer'),
  ]);
  assert.equal(state.ready, true);
  assert.equal(state.identityActor, 'admin-a');
  assert.equal(state.remedyActor, 'admin-b');
  assert.equal(state.confirmationActor, 'customer');
});

test('an email sent, audit review update or reset requested cannot stand in for a remedy', () => {
  const state = workflowState([
    event('ownership_evidence_verified'),
    event('registered_email_reset_requested'),
    event('review_updated'),
    event('customer_recovery_confirmed'),
  ]);
  assert.equal(state.ready, false);
});

test('independent offline confirmation is only an evidence event, not an automatic resolution', () => {
  assert.equal(workflowState([event('customer_recovery_confirmed_offline')]).ready, false);
});
