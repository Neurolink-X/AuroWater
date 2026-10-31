import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(name) { return readFileSync(name, 'utf8'); }
const scroll = source('src/hooks/useScrollAnimation.ts');
const home = source('src/app/(public)/HomeClient.tsx');
const cityApi = source('src/app/api/cities/route.ts');
const cityAdmin = source('src/app/api/admin/cities/route.ts');
const supplier = source('src/app/become-a-supplier/page.tsx');
const sitemap = source('src/app/sitemap.ts');
const robots = source('src/app/robots.ts');
const seo = source('src/lib/seo-policy.ts');

test('scroll reveal executes the mobile/reduced motion guard rather than commenting it out', () => {
  assert.match(scroll, /if \(reducedMotion \|\| coarsePointer \|\|/);
  assert.doesNotMatch(scroll, /observers\.\\n\s*\/\/);
});
test('reveals use passive browser intersections instead of scroll listeners', () => {
  assert.match(scroll, /new IntersectionObserver/);
  assert.doesNotMatch(scroll, /addEventListener\(['"]scroll/);
});
test('mobile devices never create the mutation observer', () => {
  const coarseGuard = scroll.indexOf('if (reducedMotion || coarsePointer');
  const mutation = scroll.indexOf('new MutationObserver');
  assert.ok(coarseGuard >= 0 && mutation > coarseGuard);
  assert.match(scroll.slice(coarseGuard, mutation), /return;/);
});
test('mutation observer batches new DOM elements in one animation frame', () => {
  assert.match(scroll, /pending = new Set<Element>/);
  assert.match(scroll, /requestAnimationFrame\(flush\)/);
});
test('mutation observer is disconnected on cleanup', () => {
  assert.match(scroll, /mutationObserver\.disconnect\(\)/);
});
test('intersection observer is disconnected on cleanup', () => {
  assert.match(scroll, /observer\.disconnect\(\)/);
});
test('revealed markup remains backward compatible', () => {
  assert.match(scroll, /classList\.add\('visible'\)/);
  assert.match(scroll, /data-reveal\], \.fade-up/);
});
test('home does not create nested vertical scrolling with overflow-x-hidden', () => {
  assert.match(home, /min-h-screen overflow-x-clip/);
  assert.match(home, /aw-hero-bg relative min-h-screen flex flex-col overflow-x-clip/);
  assert.doesNotMatch(home, /min-h-screen overflow-x-hidden/);
});
test('home preserves native carousel horizontal scrolling', () => {
  assert.match(home, /\.aw-campaign-rail\{[^}]+overflow-x:auto/);
});
test('home disables continuous decoration for coarse pointers', () => {
  assert.match(home, /@media \(hover:none\) and \(pointer:coarse\)/);
  assert.match(home, /\.aw-hero-accent \{ animation:none!important \}/);
});
test('canonical city API reads actual cities table', () => {
  assert.match(cityApi, /\.from\('cities'\)/);
});
test('activation requires supplier and stock readiness', () => {
  assert.match(cityAdmin, /Cannot activate city: no assigned, approved, online supplier/);
});
test('supplier imagery uses responsive Next.js image component', () => {
  assert.match(supplier, /import Image from 'next\/image'/);
  assert.match(supplier, /<Image src=\{service\.src\}/);
  assert.match(supplier, /sizes="\(max-width: 639px\)/);
  assert.match(supplier, /loading="lazy"/);
});
test('supplier imagery uses local assets already published in service catalog', () => {
  const services = source('src/app/(public)/services/services-data.ts');
  for (const name of ['water_can', 'water_tanker', 'ro_service']) {
    assert.match(supplier, new RegExp('/images/' + name + '\\.webp'));
    assert.match(services, new RegExp('/images/' + name + '\\.webp'));
  }
});
test('supplier imagery does not pretend it is verified supplier photography', () => {
  assert.match(supplier, /Service images are illustrative/);
});
test('sitemap includes the supplier recruitment page', () => {
  assert.match(sitemap, /'\/become-a-supplier'/);
});
test('sitemap excludes non-indexable deployments', () => {
  assert.match(sitemap, /canIndexDeployment/);
});
test('robots policy handles preview deployments', () => {
  assert.match(robots, /canIndexDeployment/);
  assert.match(seo, /environment\.vercelEnv === 'production'/);
});
test('private dashboards are not advertised in sitemap', () => {
  assert.doesNotMatch(sitemap, /page\('\/(?:admin|supplier|customer|technician)/);
});
