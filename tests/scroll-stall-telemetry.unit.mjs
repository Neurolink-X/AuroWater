import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reporter = readFileSync(new URL('../src/components/observability/ScrollStallReporter.tsx', import.meta.url), 'utf8');
const endpoint = readFileSync(new URL('../src/app/api/internal/telemetry/web-vitals/route.ts', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');

// Long-task sampling must be optional, lightweight and privacy preserving.
assert.match(reporter, /Math\.random\(\) > 0\.1/);
assert.match(reporter, /supportedEntryTypes\?\.includes\('longtask'\)/);
assert.match(reporter, /addEventListener\('scroll', onScroll, \{ passive: true \}\)/);
assert.match(reporter, /window\.setInterval\(report, 30_000\)/);
assert.doesNotMatch(reporter, /customer_id|order_id|localStorage|sessionStorage|touches\[/);
assert.match(endpoint, /name === 'SCROLL_LONG_TASK'/);
assert.match(endpoint, /kind === 'scroll' \? 50/);
assert.match(endpoint, /aurotap\.scroll_stall/);
assert.match(layout, /<ScrollStallReporter \/>/);

console.log('Mobile scroll-stall telemetry privacy regression checks passed.');
