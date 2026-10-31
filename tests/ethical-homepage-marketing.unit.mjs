import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('homepage does not render empty testimonials as a fake reviews carousel', () => {
  const home = read('src/app/(public)/HomeClient.tsx');
  const trust = read('src/lib/trust-reviews.ts');
  assert.match(trust, /TRUST_REVIEWS: TrustReview\[\] = \[\]/);
  assert.match(home, /TRUST_REVIEWS\.length > 0 \?/);
  assert.match(home, /Know what happens before you order/);
  assert.match(home, /customer-confidence-heading/);
  assert.match(home, /Reviews supplied by customers after service/);
});

test('illustrative imagery is not represented as real AuroTap delivery proof', () => {
  const home = read('src/app/(public)/HomeClient.tsx');
  assert.match(home, /Illustrative scene of a water can/);
  assert.match(home, /Illustrative plumbing and tank-care scene/);
  assert.doesNotMatch(home, /Why customers switch/);
});

test('pricing and plan copy uses conditional, accurately scoped statements', () => {
  const home = read('src/app/(public)/HomeClient.tsx');
  assert.match(home, /Review the checkout total, including applicable charges/);
  assert.match(home, /Plan availability and any price-lock terms are shown before you confirm your booking/);
  assert.match(home, /No business verification for customer registration/);
  assert.doesNotMatch(home, /No surprise add-ons|30-second signup|Price locked \$\{p\.lockMonths\} months/);
});
