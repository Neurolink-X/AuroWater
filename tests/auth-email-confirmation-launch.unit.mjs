import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const register = readFileSync('src/app/api/auth/register/route.ts', 'utf8');
const client = readFileSync('src/lib/api-client.ts', 'utf8');
const signupPage = readFileSync('src/app/auth/register/page.tsx', 'utf8');

test('launch signup defaults to server-confirmed without SMTP and flag stays server-owned', () => {
  assert.match(register, /process\.env\.AUROTAP_REQUIRE_EMAIL_VERIFICATION === 'true'/);
  assert.match(register, /if \(admin && !requireEmailVerification\)/);
  assert.match(register, /email_confirm: true/);
  assert.doesNotMatch(register, /body\.AUROTAP_REQUIRE_EMAIL_VERIFICATION/);
});

test('unconfirmed Supabase signup response is treated as pending rather than failed', () => {
  assert.match(register, /signupPendingConfirmation = Boolean\(data\.user && !data\.session\)/);
  assert.match(register, /if \(signupPendingConfirmation && !authErrorMessage\)/);
  assert.match(register, /needsEmailConfirmation: true/);
  assert.match(client, /needsEmailConfirmation: true; email: string/);
  assert.match(signupPage, /'needsEmailConfirmation' in reg/);
});

test('referral handoff remains preserved in future verification mode', () => {
  assert.match(signupPage, /referralDestination/);
  assert.match(signupPage, /returnTo=\$\{encodeURIComponent\(referralDestination\)\}/);
});
