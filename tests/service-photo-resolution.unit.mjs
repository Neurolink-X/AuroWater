import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('service photographs retain measured source pixel dimensions', () => {
  const data = read('src/app/(public)/services/services-data.ts');
  for (const [service, width, height] of [
    ['water_can',400,442], ['water_tanker',399,442],
    ['ro_service',402,442], ['plumbing',419,442],
    ['borewell',549,456], ['motor_pump',518,456],
    ['tank_cleaning',557,456],
  ]) {
    assert.match(data, new RegExp(service + ': \\{ width: ' + width + ', height: ' + height + ' \\}'));
  }
});

test('service listing and detail images use responsive full-bleed frames', () => {
  const css = read('src/app/(public)/services/services.css');
  const detail = read('src/app/(public)/services/[slug]/page.tsx');
  const booking = read('src/components/ui/AnimatedServiceCard.tsx');
  const about = read('src/app/(public)/about/page.tsx');
  assert.match(css, /\.sv-card-illustration img \{[\s\S]*?object-fit: cover/);
  assert.match(css, /\.sv-card-illustration \{[\s\S]*?aspect-ratio: 4 \/ 3/);
  const media = read('src/components/services/ServiceMedia.tsx');
  assert.match(detail, /<ServiceMedia serviceKey=\{service.key\} variant="detail" priority/);
  assert.match(media, /aspect-\[4\/3\]/);
  assert.match(media, /className="block h-full w-full object-cover"/);
  assert.match(media, /\(max-width: 640px\) calc\(100vw - 40px\)/);
  assert.match(booking, /object-contain/);
  assert.match(about, /\.ab-svc-photo img\{object-fit:contain/);
});


test('service navigation prefetches details and mobile images use real viewport widths', () => {
  const listing = read('src/app/(public)/services/ServicesClient.tsx');
  const css = read('src/app/(public)/services/services.css');
  assert.match(listing, /href=\{\x60\/services\/\$\{s.key\}\x60\}/);
  assert.doesNotMatch(listing, /href=\{\x60\/services\/\$\{s.key\}\x60\} prefetch=\{false\}/);
  const media = read('src/components/services/ServiceMedia.tsx');
  assert.match(listing, /<ServiceMedia serviceKey=\{s.key\} variant="card"/);
  assert.match(media, /\(max-width: 640px\) calc\(100vw - 52px\)/);
  assert.match(css, /@media \(hover:none\) and \(pointer:coarse\)/);
});


test('image components have one high-priority LCP photo and lazy-load supporting cards', () => {
  const media = read('src/components/services/ServiceMedia.tsx');
  const listing = read('src/app/(public)/services/ServicesClient.tsx');
  const detail = read('src/app/(public)/services/[slug]/page.tsx');
  assert.match(media, /loading=\{priority \? 'eager' : 'lazy'\}/);
  assert.match(media, /fetchPriority=\{priority \? 'high' : 'auto'\}/);
  assert.match(listing, /priority=\{index === 0\}/);
  assert.match(detail, /variant="detail" priority/);
  assert.match(media, /draggable=\{false\}/);
  assert.match(media, /FOCAL_POINTS: Record<ServiceKey, string>/);
});

test('service pages keep functional booking and pricing routes', () => {
  const listing = read('src/app/(public)/services/ServicesClient.tsx');
  const detail = read('src/app/(public)/services/[slug]/page.tsx');
  assert.match(detail, /const bookingHref = `\/book\?service=/);
  assert.match(detail, /<ServicePrice serviceKey=\{service.key\}/);
  assert.match(listing, /href=\{`\/book\?service=/);
  assert.match(detail, /generateStaticParams/);
  assert.match(detail, /dynamicParams = false/);
});
