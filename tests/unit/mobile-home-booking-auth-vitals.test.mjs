import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync('src/app/(public)/HomeClient.tsx', 'utf8');
const shell = readFileSync('src/components/layout/RootChrome.tsx', 'utf8');
const page = readFileSync('src/app/(public)/page.tsx', 'utf8');

test('mobile homepage paints the existing hero before animation hydration', () => {
  assert.match(home, /@media\s*\(max-width:639px\)/);
  assert.match(home, /\.aw-hero-copy,\.aw-hero-visual\{opacity:1!important;transform:none!important\}/);
  assert.match(home, /className="aw-hero-copy"\s+initial=/);
  assert.match(home, /className="aw-hero-visual flex flex-col gap-4"\s+initial=/);
  assert.match(home, /transition=\{\{ duration: 0\.7 \}\}/);
});

test('mobile hero keeps a stable single-line height while live price is verified', () => {
  assert.ok(home.includes('.hero-price-line{font-size:clamp(1.25rem,6.85vw,2.6rem)'));
  assert.ok(home.includes('className="hero-h hero-price-line block mt-2"'));
  assert.ok(home.includes("RO Water from{' '}"));
  assert.ok(home.includes('aria-live="polite"'));
  assert.ok(home.includes('Loading live price'));
  assert.ok(home.includes("pricingReady ? `${displayPrice(currentNormal)},` :"));
  assert.ok(!home.includes("pricingReady ? 'hero-price-line' : ''"));
  assert.ok(!home.includes('className="block whitespace-nowrap sm:inline">{displayPrice(currentNormal)}'));
  assert.match(home, /flex min-h-7 items-center whitespace-nowrap/);
  assert.match(home, /pricingReady/);
  assert.match(home, /See live price/);
});

test('homepage does not duplicate automatic booking-link prefetch during first paint', () => {
  const link = readFileSync('src/components/navigation/BookingIntentLink.tsx', 'utf8');
  assert.doesNotMatch(home, /router\.prefetch\('\/book\?service=water_can'\)/);
  assert.doesNotMatch(home, /requestIdleCallback\?\.\(prefetch/);
  assert.match(home, /<BookingIntentLink href="\/book\?service=water_can"/);
  assert.match(link, /prefetch=\{prefetch\}/);
  assert.match(link, /onPointerEnter=\{event =>/);
  assert.match(link, /onTouchStart=\{event =>/);
});

test('SEO, images, public chrome and booking intents remain intact', () => {
  for (const intent of ['/book?service=water_can', '/book?service=plumbing', '/book?service=tank_cleaning']) {
    assert.ok(home.includes(intent), 'Missing booking intent: ' + intent);
  }
  for (const asset of [
    'https://images.unsplash.com/photo-1739528660620-89a665b3a4db',
    '/Friendly Kitchen Water Service Team.png',
    '/mentinence image.png',
  ]) assert.ok(home.includes(asset), 'Missing hero image: ' + asset);
  assert.match(home, /<h1 className="mb-6">/);
  assert.match(page, /<HomeClient initialCities=\{cities\}\s*\/>/);
  assert.match(page, /application\/ld\+json/);
  assert.match(shell, /<Header \/>/);
  assert.match(shell, /<Footer \/>/);
});
