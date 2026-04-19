#!/usr/bin/env node
/**
 * Lightweight smoke checks against a running instance (no auth).
 * Usage: BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs
 */
const base = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function check(path, label) {
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { redirect: 'manual' });
  const ok = res.status >= 200 && res.status < 400;
  console.log(`${ok ? 'OK' : 'FAIL'} ${res.status} ${label} ${url}`);
  return ok;
}

async function main() {
  console.log(`Smoke base: ${base}\n`);
  const results = await Promise.all([
    check('/api/settings', 'public settings'),
    check('/sitemap.xml', 'sitemap'),
    check('/robots.txt', 'robots'),
    check('/og-image.png', 'og image'),
    check('/', 'home'),
    check('/dashboard', 'legacy dashboard redirect'),
  ]);
  const failed = results.filter((r) => !r).length;
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
