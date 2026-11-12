import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transpileModule, ModuleKind, ScriptTarget, JsxEmit } from 'typescript';

const home = readFileSync('src/app/(public)/HomeClient.tsx', 'utf8');
const shell = readFileSync('src/components/layout/RootChrome.tsx', 'utf8');
const page = readFileSync('src/app/(public)/page.tsx', 'utf8');

test('homepage hero stays visible before hydration and CSS entry motion does not hide text', () => {
  assert.match(home, /<div className="aw-hero-copy">/);
  assert.match(home, /<div className="aw-hero-visual flex flex-col gap-4">/);
  assert.doesNotMatch(home, /from ['"]framer-motion['"]/);
  assert.doesNotMatch(home, /<motion\.|<AnimatePresence/);
  for (const name of ['aw-copy-in', 'aw-visual-in', 'aw-panel-in']) {
    const keyframes = home.slice(home.indexOf('@keyframes ' + name)).split('\n')[0];
    assert.ok(keyframes.includes('transform:'));
    assert.ok(!keyframes.includes('opacity'), 'Entry animation must not hide content');
  }
  assert.ok(home.includes('(min-width:640px) and (prefers-reduced-motion:no-preference)'));
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

test('server rendering exposes hero, booking links and verified prices without animation JS', () => {
  const require = createRequire(import.meta.url);
  const exports = {};
  let ready = false;
  const Link = ({ children, href, ...props }) => React.createElement('a', { ...props, href }, children);
  const dependencies = {
    react: { ...React, default: React },
    'next/link': { default: Link },
    '@/components/navigation/BookingIntentLink': { default: Link },
    'next/image': { default: () => null },
    '@/lib/trust-reviews': { TRUST_REVIEWS: [] },
    '@/lib/pricing/presentation': { pricingFaqs: () => [] },
    '@/hooks/useSettings': { useSettings: () => ({ settings: {
      default_can_price: 27, chilled_can_price: 32,
      service_base_prices: { plumbing: 149, tank_cleaning: 599 },
    }, pricingReady: ready, error: null, refresh() {} }) },
    '@/lib/marketing-pricing': {
      PRICING: { water: { normal: 25, chilled: 30 }, plumber: { visitFee: 149 }, tank: [{ from: 599 }], plans: [] },
      ORDER_FEES: { assumedDeliveriesPerMonth: 4 }, FAQS: [], MAX_LOCK_MONTHS: 12,
      planForQty: () => ({ lockMonths: 12 }),
    },
  };
  const code = transpileModule(home, { compilerOptions: {
    module: ModuleKind.CommonJS, target: ScriptTarget.ES2022, jsx: JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(code, { exports, require: id => {
    assert.notEqual(id, 'framer-motion', 'Hero must render without the animation runtime');
    return Object.hasOwn(dependencies, id) ? dependencies[id] : require(id);
  } });
  const render = () => renderToStaticMarkup(React.createElement(exports.default, {
    initialCities: [{ id: 'kanpur', name: 'Kanpur', slug: 'kanpur', status: 'active' }],
  }));
  const pending = render();
  assert.match(pending, /Order 20L RO cans, book a plumber/);
  assert.match(pending, /Loading live price/);
  assert.match(pending, /<div class="aw-hero-copy">/);
  assert.doesNotMatch(pending, /style="[^"]*opacity:0(?:;|")/);
  for (const service of ['water_can', 'plumbing', 'tank_cleaning']) {
    assert.ok(pending.includes('/book?service=' + service));
  }
  ready = true;
  const verified = render();
  assert.match(verified, /₹27,/);
  assert.match(verified, /Chilled RO/);
  assert.match(verified, /<form/);
  assert.match(verified, /role="tabpanel"/);
  assert.match(verified, /Join the first 100/);
});
