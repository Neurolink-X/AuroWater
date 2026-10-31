import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
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
  // Never scan whole source text for method names: "output" contains PUT,
  // and comments can contain method names without making any HTTP writes.
  // Inspect executable syntax instead, so prose/diagnostics do not cause CI
  // failures and future non-GET fetches are caught at review time.
  const ast = ts.createSourceFile('audit-public-seo.mjs', audit, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(ast.parseDiagnostics.length, 0, 'SEO auditor must parse successfully');
  const fetchCalls = [];
  const forbiddenNetworkCalls = [];
  const visit = node => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'fetch') {
        fetchCalls.push(node);
      }
      if (ts.isPropertyAccessExpression(node.expression) &&
          /^(post|put|patch|delete|request)$/i.test(node.expression.name.text)) {
        forbiddenNetworkCalls.push(node.expression.getText(ast));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(fetchCalls.length > 0, 'SEO auditor must perform HTTP reads');
  assert.deepEqual(forbiddenNetworkCalls, [], 'SEO auditor cannot call write-oriented HTTP helpers');
  for (const call of fetchCalls) {
    // A Request object could carry a POST method even without fetch options.
    assert.ok(ts.isIdentifier(call.arguments[0]) && call.arguments[0].text === 'url',
      'SEO reads must use the URL constructed by readPage');
    const options = call.arguments[1];
    if (options === undefined) continue; // fetch defaults to GET
    assert.ok(ts.isObjectLiteralExpression(options), 'fetch options must be reviewable');
    for (const property of options.properties) {
      if (!ts.isPropertyAssignment(property)) {
        assert.fail('No spread or dynamic HTTP options allowed in the SEO auditor');
      }
      const key = property.name.getText(ast).replace(/^['"]|['"]$/g, '');
      if (key.toLowerCase() === 'method') {
        assert.ok(ts.isStringLiteral(property.initializer) &&
          property.initializer.text.toUpperCase() === 'GET',
          'SEO auditor may only fetch using GET');
      }
    }
  }
  assert.match(audit, /const url = new URL\(path, origin\)/);
});
