#!/usr/bin/env node
/**
 * Read-only production SEO audit.
 *
 * It verifies HTTP crawlability, robots, sitemap, title, descriptions,
 * canonical host, and noindex on public routes. It does NOT claim to know
 * whether Google has actually indexed a page: Google Search Console owns
 * those signals (URL Inspection / Pages indexing report).
 *
 * Run:
 *   SEO_BASE_URL=https://www.aurotap.in npm run seo:audit-public
 *
 * Set SEO_STRICT=1 to treat SEO warnings as failures in release gates.
 */
const rawOrigin = process.env.SEO_BASE_URL || 'https://www.aurotap.in';
const origin = new URL(rawOrigin);
if (!['https:', 'http:'].includes(origin.protocol) ||
    (origin.protocol === 'http:' && origin.hostname !== 'localhost')) {
  throw new Error('SEO_BASE_URL must use HTTPS (HTTP allowed only for localhost)');
}
if (origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
  throw new Error('SEO_BASE_URL must be the bare origin without credentials or paths');
}

const routes = [
  '/',
  '/services',
  '/pricing',
  '/service-areas',
  '/water-delivery',
  '/blog',
  '/become-a-supplier',
  '/contact',
];
const auditPaths = ['/robots.txt', '/sitemap.xml', ...routes];
const maxBytes = 1_500_000;
const failures = [];
const warnings = [];
const results = [];

async function readPage(path) {
  const url = new URL(path, origin);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'AuroTap-SEO-Audit/1.0' },
    });
    const type = response.headers.get('content-type') || '';
    const bytes = await response.text();
    if (bytes.length > maxBytes) {
      warnings.push({ path, issue: 'Large HTML response; check bundle and server rendering.' });
    }
    return { response, finalUrl: response.url, type, body: bytes.slice(0, maxBytes) };
  } finally {
    clearTimeout(timer);
  }
}

function cleanText(value) {
  // SEO diagnostics are never injected into HTML. Do not attempt to sanitize
  // arbitrary markup by removing tags: incomplete multi-character removal can
  // expose a script-like sequence from previously separated characters.
  // Titles from fetched pages are treated only as inert text in JSON output.
  return value.replace(/&(?:amp|quot|#39|lt|gt);/g, ' ').trim();
}
function tagAttr(tag, attribute) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('\\b' + escaped + '\\s*=\\s*(["\\x27])([^"\\x27]*)\\1', 'i');
  return tag.match(pattern)?.[2] || '';
}
function metaContent(html, attr, value) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (tagAttr(tag, attr).toLowerCase() === value.toLowerCase()) {
      return tagAttr(tag, 'content');
    }
  }
  return '';
}
function canonicalUrl(html) {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (tagAttr(tag, 'rel').split(/\s+/).includes('canonical')) {
      return tagAttr(tag, 'href');
    }
  }
  return '';
}
function issue(path, reason, kind = 'error') {
  (kind === 'warning' ? warnings : failures).push({ path, issue: reason });
}

for (const path of auditPaths) {
  const checks = [];
  try {
    const { response, finalUrl, type, body } = await readPage(path);
    if (!response.ok) checks.push('HTTP ' + response.status);
    if (new URL(finalUrl).origin !== origin.origin) {
      checks.push('Unexpected cross-origin redirect: ' + finalUrl);
    }
    if (path === '/robots.txt') {
      if (!/sitemap\s*:/i.test(body) || !body.includes('/sitemap.xml')) {
        checks.push('Robots file has no sitemap reference');
      }
      // The public production property must not accidentally disallow all bots.
      if (/disallow:\s*\/\s*$/im.test(body)) {
        checks.push('Robots file disallows the entire site');
      }
    } else if (path === '/sitemap.xml') {
      if (!/<(?:urlset|sitemapindex)\b/i.test(body)) checks.push('XML sitemap root missing');
      if (!body.includes('/blog')) checks.push('Published blog URLs missing');
      if (!body.includes('/become-a-supplier')) checks.push('Supplier recruitment URL missing');
      if (/\/(?:admin|auth|customer|supplier|technician)\//i.test(body)) {
        checks.push('Private account URLs found in public sitemap');
      }
    } else {
      if (!type.includes('text/html')) checks.push('Expected HTML content type');
      const title = cleanText(body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
      if (!title || !/AuroTap/i.test(title)) checks.push('Missing or incorrect AuroTap title');
      const description = metaContent(body, 'name', 'description');
      if (description.length < 60 || description.length > 230) {
        issue(path, 'Description missing, unusually short or too long', 'warning');
      }
      const robots = metaContent(body, 'name', 'robots');
      if (/\bnoindex\b/i.test(robots) || /\bnoindex\b/i.test(response.headers.get('x-robots-tag') || '')) {
        checks.push('Unexpected noindex on public page');
      }
      const canonical = canonicalUrl(body);
      if (!canonical) {
        checks.push('Missing canonical link');
      } else {
        let canonicalParsed;
        try { canonicalParsed = new URL(canonical, origin); } catch { /* handled below */ }
        if (!canonicalParsed || canonicalParsed.origin !== origin.origin ||
            canonicalParsed.pathname.replace(/\/$/, '') !== path.replace(/\/$/, '')) {
          checks.push('Canonical does not match public path / host: ' + canonical);
        }
      }
      if (!/<h1\b/i.test(body)) issue(path, 'No server-rendered H1', 'warning');
    }
    for (const check of checks) issue(path, check);
    results.push({ path, status: response.status, ok: checks.length === 0, checks });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    issue(path, message);
    results.push({ path, status: null, ok: false, checks: [message] });
  }
}

const strict = process.env.SEO_STRICT === '1';
const report = {
  origin: origin.origin,
  checked_at: new Date().toISOString(),
  status: failures.length ? 'fail' : warnings.length ? 'warning' : 'pass',
  pages_checked: results.length,
  results,
  failures,
  warnings,
  google_indexing_verified: false,
  note: 'HTML crawlability checks only. Confirm Google indexing independently in Search Console.',
};
console.log(JSON.stringify(report, null, 2));
if (failures.length || (strict && warnings.length)) process.exitCode = 1;
