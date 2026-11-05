import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');
const proxy = read('src/proxy.ts');
const supplierPage = read('src/app/customer/referral/page.tsx');
const customerPage = read('src/app/customer/referrals/page.tsx');
const login = read('src/app/auth/login/page.tsx');
const signup = read('src/app/auth/register/page.tsx');
const callback = read('src/app/auth/callback/route.ts');
const supplierApi = read('src/app/api/customer/referral/route.ts');
const rewardApi = read('src/app/api/customer/referrals/route.ts');
const helperSource = read('src/lib/referrals/invite-paths.ts');

test('both existing invite paths are publicly accessible without exposing protected customer routes', () => {
  assert.match(proxy, /'\/customer\/referral',/);
  assert.match(proxy, /'\/customer\/referrals',/);
  assert.doesNotMatch(proxy, /'\/customer\/',\s*\/\* Public/);
});

test('supplier and customer invitations have separate actions and APIs', () => {
  assert.match(supplierPage, /api\/customer\/referral/);
  assert.match(customerPage, /api\/customer\/referrals/);
  assert.match(supplierApi, /confirm_customer_supplier_referral/);
  assert.match(rewardApi, /apply_referral_code/);
  assert.match(supplierPage, /Confirm supplier referral/);
  assert.match(customerPage, /Apply code/);
});

test('invite survives login and registration while non-referral logins retain existing defaults', () => {
  assert.match(login, /sanitized\.startsWith\('\/customer\/'\)/);
  assert.match(login, /referralReturnPath\(searchParams\.get\('returnTo'\)\)/);
  assert.match(signup, /referralReturnPath\(params\.get\('returnTo'\)\)/);
  assert.match(signup, /const customerReturn = role === 'customer' \? returnTo : null/);
  assert.match(signup, /router\.replace\(result\.profile\.role === 'customer' && returnTo \? returnTo : cfg\.dest\)/);
  assert.match(callback, /referralReturnPath\(nextPath\)/);
});

test('invites require explicit confirmation and are not implicitly attributed on authentication', () => {
  assert.match(supplierPage, /onClick=\{\(\) => void confirm\(\)\}/);
  assert.match(customerPage, /onClick=\{\(\) => void applyCode\(\)\}/);
  assert.match(helperSource, /url\.pathname === '\/customer\/referral'/);
  assert.match(helperSource, /url\.pathname === '\/customer\/referrals'/);
  assert.match(helperSource, /url\.origin !==/);
  assert.match(helperSource, /url\.hash/);
});
