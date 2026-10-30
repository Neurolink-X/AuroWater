import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reporter = readFileSync(new URL('../src/components/observability/WebVitalsReporter.tsx', import.meta.url), 'utf8');
const endpoint = readFileSync(new URL('../src/app/api/internal/telemetry/web-vitals/route.ts', import.meta.url), 'utf8');
const apiClient = readFileSync(new URL('../src/lib/api-client.ts', import.meta.url), 'utf8');
const budgets = readFileSync(new URL('../src/lib/observability/performance-budgets.ts', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');

assert.match(reporter, /useReportWebVitals/);
assert.match(reporter, /SAMPLE_RATE = 0\.2/);
assert.match(reporter, /route_group: routeGroup/);
assert.doesNotMatch(reporter, /customer_id|order_id|accessToken|email|phone/);
assert.match(endpoint, /ALLOWED_METRICS/);
assert.match(endpoint, /origin !== new URL\(request.url\)\.origin/);
assert.match(endpoint, /rawBody.length > 2048/);
assert.match(endpoint, /budget_exceeded: value > budget/);
assert.doesNotMatch(endpoint, /x-forwarded-for|authorization|cookie/);
assert.match(budgets, /LCP: \{ target: 2500/);
assert.match(budgets, /INP: \{ target: 200/);
assert.match(budgets, /CLS: \{ target: 0\.1/);
assert.match(layout, /<WebVitalsReporter \/>/);
const proxy = readFileSync(new URL('../src/proxy.ts', import.meta.url), 'utf8');
assert.ok(proxy.includes("'/api/internal/telemetry/web-vitals'"));
assert.match(apiClient, /reportApiTiming\(path, startedAt, result\.res\.status, true\)/);
assert.match(apiClient, /customer_order_detail/);
assert.match(apiClient, /supplier_orders/);
assert.match(apiClient, /technician_jobs/);
assert.match(apiClient, /admin_dashboard/);
assert.match(budgets, /API_CUSTOMER_ORDER: \{ target: 600/);
const bundleReport = readFileSync(new URL('../scripts/report-client-bundle-budget.mjs', import.meta.url), 'utf8');
assert.match(bundleReport, /gzipSync/);
assert.match(bundleReport, /AUROWATER_ENFORCE_BUNDLE_BUDGET/);

console.log('Web Vitals telemetry privacy and budget regression checks passed.');
