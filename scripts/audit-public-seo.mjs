#!/usr/bin/env node
/** Zero-dependency SEO smoke audit of public production metadata.
 * Observes, never changes Search Console indexing or publishes any pages.
 */
const origin = (process.env.SEO_BASE_URL || 'https://www.aurotap.in').replace(/\/$/, '');
const urls = ['/robots.txt', '/sitemap.xml', '/blog', '/'];
const failures = [];
const results = [];
for (const path of urls) {
  try {
    const endpoint = new URL(path, origin);
    if (endpoint.protocol !== 'https:' && endpoint.hostname !== 'localhost') throw new Error('Only HTTPS sources are supported');
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(9000), redirect: 'follow' });
    const body = (await response.text()).slice(0, 2_000_000);
    const checks = [];
    if (!response.ok) checks.push('HTTP '+response.status);
    if (path === '/robots.txt' && (!body.includes('sitemap.xml') || /Disallow: \/\s*(?:\n|$)/i.test(body))) {
      checks.push('Sitemap missing or robots may block all crawling');
    }
    if (path === '/sitemap.xml') {
      if (!body.includes('<urlset') && !body.includes('<sitemapindex')) checks.push('Missing valid sitemap root');
      if (!body.includes('/blog')) checks.push('Blog URLs missing from sitemap');
      if (/\/customer\/|\/admin\/|\/supplier\/|\/technician\//.test(body)) checks.push('Private role URL found in sitemap');
    }
    if (path === '/blog' && !/<h1\b/i.test(body)) checks.push('Blog has no server-rendered heading');
    if (path === '/' && !/<title\b/i.test(body)) checks.push('Homepage title missing');
    results.push({ path, status: response.status, checks });
    for (const issue of checks) failures.push({ path, issue });
  } catch (error) {
    failures.push({ path, issue: error instanceof Error ? error.message : 'Unknown network failure' });
  }
}
console.log(JSON.stringify({ origin, status: failures.length ? 'degraded' : 'pass', results, failures }, null, 2));
if (failures.length) process.exitCode = 1;
