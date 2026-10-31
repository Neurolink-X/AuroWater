import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
test('supplier and technician journeys link real existing pages only', () => {
  const journey = read('src/components/operations/PartnerJourney.tsx');
  assert.match(journey, /role: Role/);
  for(const route of ['/supplier/settings','/supplier/inventory','/supplier/orders','/supplier/earnings','/technician/jobs','/technician/dashboard']) {
    assert.ok(journey.includes(route), 'Missing role workflow route '+route);
  }
  assert.match(read('src/app/supplier/[section]/page.tsx'), /<PartnerJourney role="supplier"/);
  assert.match(read('src/app/technician/jobs/page.tsx'), /<PartnerJourney role="technician"/);
  assert.match(journey, /not a live status indicator/);
});
test('subscription metrics count only actual plans and route to verified rewards', () => {
  const source = read('src/app/customer/subscriptions/page.tsx');
  assert.match(source, /items\.filter\(/);
  assert.match(source, /activeCount/);
  assert.match(source, /pausedCount/);
  assert.match(source, /href="\/customer\/loyalty"/);
});
test('SEO checks never advertise private routes or alter indexing remotely', () => {
  const audit = read('scripts/audit-public-seo.mjs');
  assert.match(audit, /robots\.txt/);
  assert.match(audit, /sitemap\.xml/);
  assert.match(audit, /\/blog/);
  // Match the diagnostic emitted by the actual read-only sitemap audit.
  // Private account routes must be rejected rather than published as SEO URLs.
  assert.match(audit, /checks\.push\('Private account URLs found in public sitemap'\)/);
  assert.match(audit, /admin\|auth\|customer\|supplier\|technician/);
  assert.doesNotMatch(audit, /POST|PUT|PATCH|DELETE|submit.*index/i);
});
