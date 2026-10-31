#!/usr/bin/env node
/** Observe production without mutations, data access, or credentials.
 * Designed for GitHub Actions. Returns nonzero on a repeated failure.
 */
const base = (process.env.BASE_URL || 'https://www.aurotap.in').replace(/\/$/, '');
const paths = ['/api/health', '/', '/blog', '/api/settings', '/api/cities'];
const attempts = 3;
const timeoutMs = 7000;
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
export async function checkSite(fetchImpl = fetch) {
  const failures = [];
  for (const path of paths) {
    const url = new URL(path, base);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid health-check protocol');
    let succeeded = false;
    let last = '';
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await fetchImpl(url, { redirect: 'manual',
          signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'AuroTap-Health-Watchdog/1.0' } });
        if (response.status >= 200 && response.status < 300) {
          if (path === '/api/health') {
            const body = await response.json();
            succeeded = body?.status === 'ok' && body?.db === 'ok';
            if (!succeeded) last = 'health payload degraded';
          } else if (path === '/api/settings') {
            const body = await response.json();
            const settings = body?.data ?? body;
            succeeded = Number.isSafeInteger(settings?.pricing_version) && settings.pricing_version > 0
              && Number(settings?.default_can_price) >= 20
              && Number(settings?.chilled_can_price) >= 25;
            if (!succeeded) last = 'pricing payload missing or invalid';
          } else if (path === '/api/cities') {
            const body = await response.json();
            const cities = Array.isArray(body) ? body : body?.data;
            succeeded = Array.isArray(cities) && cities.every(city => typeof city.slug === 'string' && ['active', 'coming_soon', 'waitlist'].includes(city.status));
            if (!succeeded) last = 'city directory payload invalid';
          } else succeeded = true;
          if (succeeded) break;
        } else last = `HTTP ${response.status}`;
      } catch (err) { last = err instanceof Error ? err.name : 'request error'; }
      if (attempt < attempts - 1) await wait(750);
    }
    if (!succeeded) failures.push({ path, error: last });
  }
  return { status: failures.length ? 'degraded' : 'healthy', checks: paths.length, failures };
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  checkSite().then(result => {
    console.log(JSON.stringify(result));
    if (result.failures.length) process.exitCode = 1;
  }).catch(error => { console.error(error instanceof Error ? error.message : 'Unknown failure'); process.exitCode = 1; });
}
