import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOMAIN_CONTRACTS,
  EXPLICIT_RUNTIME_OWNERS,
  domainsForChangedPath,
  requiredTestEvidence,
  enforceChangeImpact,
} from '../scripts/platform-quality-contract.mjs';

test('all shared modules have explicit, valid, duplicate-free safety-domain ownership', () => {
  const known = new Set(Object.keys(DOMAIN_CONTRACTS));
  assert.equal(Object.keys(EXPLICIT_RUNTIME_OWNERS).length, 17);
  for (const [path, domains] of Object.entries(EXPLICIT_RUNTIME_OWNERS)) {
    assert.match(path, /^src\//);
    assert.ok(domains.length, `No domain for ${path}`);
    assert.equal(new Set(domains).size, domains.length, `Duplicate domain for ${path}`);
    for (const domain of domains) {
      assert.ok(known.has(domain), `Unknown domain ${domain}: ${path}`);
      assert.ok(domainsForChangedPath(path).includes(domain));
    }
  }
});

test('critical booking and administrative flows propagate their cross-role impact', () => {
  const booking = domainsForChangedPath('src/components/booking/BookingWizard.tsx');
  for (const domain of ['booking','pricing','subscriptions','dispatch','finance','notifications']) {
    assert.ok(booking.includes(domain), `Booking missing ${domain}`);
  }
  const recovery = domainsForChangedPath('src/app/account-help/page.tsx');
  assert.ok(recovery.includes('auth'));
  assert.ok(recovery.includes('admin'));
  const documents = domainsForChangedPath('src/components/private-files/DocumentUploader.tsx');
  assert.ok(documents.includes('technician'));
  assert.ok(documents.includes('admin'));
});

test('unmapped high-risk runtime modules are still blocked (no generic bypass)', () => {
  const { problems } = enforceChangeImpact(['src/components/unreviewed/UnexpectedRuntimeWidget.tsx']);
  assert.ok(problems.some(p => p.includes('Unmapped runtime change')));
});

test('changing owned runtime code with no corresponding regression test remains blocked', () => {
  const { problems } = enforceChangeImpact(['src/app/customer/subscriptions/page.tsx']);
  assert.ok(problems.some(p => p.includes('subscriptions')));
});

test('explicit evidence covers each affected domain, without allowing unrelated tests', () => {
  const allChanged = [
    'src/components/booking/BookingWizard.tsx',
    'src/app/account-help/page.tsx',
    'src/app/notifications/page.tsx',
    'src/app/technician/dashboard/page.tsx',
    'tests/admin-booking-subscriptions-notifications-technician-integrity.unit.mjs',
    'tests/platform-domain-ownership.unit.mjs',
    'tests/address-maintenance-commission-integrity.unit.mjs',
    'tests/dispatch-coverage.unit.mjs',
    'tests/dispatch-radius.unit.mjs',
  ];
  const res = requiredTestEvidence(allChanged);
  assert.deepEqual(res.unmapped, []);
  assert.deepEqual(res.missing, []);
  const irrelevant = enforceChangeImpact([
    'src/app/customer/subscriptions/page.tsx',
    'tests/unrelated-render-colors.unit.mjs',
  ]);
  assert.ok(irrelevant.problems.some(s => s.includes('subscriptions')));
});
