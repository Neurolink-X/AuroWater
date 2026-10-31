/**
 * Static regression guard for responsive and user-facing recovery behavior.
 * Run with: node --test tests/responsive-content.unit.mjs
 *
 * These checks are deliberately dependency-free and work in CI.
 * They catch accidental removal of protections but cannot replace browser tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const booking = read('src/components/booking/BookingWizard.tsx');
const settings = read('src/app/admin/settings/page.tsx');
const globalStyles = read('src/app/globals.css');
const seo = read('src/lib/seo.ts');
const serviceData = read('src/app/(public)/services/services-data.ts');

test('booking has clear service selection heading', () => {
  assert.match(booking, /What do you need\?/);
});

test('booking service picker exposes selection state', () => {
  assert.match(booking, /aria-pressed=\{draft\.serviceKey === s\.key\}/);
});

test('booking service imagery has descriptive alt text', () => {
  assert.match(booking, /ILLUSTRATION_ALT\[/);
});

test('booking images use responsive sizes', () => {
  assert.match(booking, /sizes="\(max-width: 640px\)/);
});

test('booking images use lazy loading', () => {
  assert.match(booking, /loading="lazy"/);
});

test('booking service card avoids width overflow', () => {
  assert.match(booking, /relative min-w-0 overflow-hidden rounded-2xl/);
});

test('booking displays settings-driven starting price', () => {
  assert.match(booking, /fromPrice\(s\.key\)/);
});

test('booking retains normal water price source', () => {
  assert.match(booking, /settings\.default_can_price/);
});

test('booking retains chilled water price source', () => {
  assert.match(booking, /settings\.chilled_can_price/);
});

test('booking retains quantity upper bound', () => {
  assert.match(booking, /maxCansFor\(d\)/);
});

test('booking has location permission recovery', () => {
  assert.match(booking, /Location permission is off/);
});

test('booking explains device location settings', () => {
  assert.match(booking, /Settings → Location/);
});

test('booking explains browser site permission', () => {
  assert.match(booking, /Allow location/);
});

test('booking allows manual address fallback', () => {
  assert.match(booking, /enter the address manually/);
});

test('booking distinguishes timeout from denial', () => {
  assert.match(booking, /Location request timed out/);
});

test('booking does not require GPS to enter address', () => {
  assert.match(booking, /6-digit PIN code below/);
});

test('booking has bilingual guidance', () => {
  assert.match(booking, /lang="hi"/);
});

test('booking location error is accessible', () => {
  assert.match(booking, /role="alert" aria-live="polite"/);
});

test('booking preserves address review step', () => {
  assert.match(booking, /Review order/);
});

test('settings navigation has semantic label', () => {
  assert.match(settings, /aria-label="Settings sections"/);
});

test('settings navigation is locally horizontally scrollable', () => {
  assert.match(settings, /overflow-x-auto/);
});

test('settings nav tabs cannot shrink into overlap', () => {
  assert.match(settings, /flex shrink-0 items-center/);
});

test('settings grid has safe minimum width', () => {
  assert.match(settings, /grid min-w-0 grid-cols-1/);
});

test('settings keeps accessible active section', () => {
  assert.match(settings, /aria-current=\{active/);
});

test('responsive card utility wraps long text', () => {
  assert.match(globalStyles, /\.responsive-card\s*\{/);
  assert.match(globalStyles, /overflow-wrap: anywhere/);
});

test('responsive tabs support local scrolling', () => {
  assert.match(globalStyles, /\.responsive-tabs\s*\{/);
  assert.match(globalStyles, /overscroll-behavior-inline: contain/);
});

test('responsive grids avoid minimum card overflow', () => {
  assert.match(globalStyles, /minmax\(min\(100%, 16rem\), 1fr\)/);
});

test('responsive fields use bounded widths', () => {
  assert.match(globalStyles, /\.responsive-field\s*\{/);
});

test('responsive table overflow is contained', () => {
  assert.match(globalStyles, /\.responsive-table-scroll\s*\{/);
});

test('reduced motion is respected', () => {
  assert.match(globalStyles, /prefers-reduced-motion: reduce/);
});

test('brand name is AuroTap', () => {
  assert.match(seo, /export const BRAND = 'AuroTap'/);
});

test('canonical fallback uses production www host', () => {
  assert.match(seo, /https:\/\/www\.aurotap\.in/);
});

test('metadata has canonical links', () => {
  assert.match(seo, /alternates: \{ canonical: url \}/);
});

test('metadata has open graph', () => {
  assert.match(seo, /openGraph:/);
});

test('metadata has organization structured data', () => {
  assert.match(seo, /'@type': 'Organization'/);
});

test('metadata has website structured data', () => {
  assert.match(seo, /'@type': 'WebSite'/);
});

test('SEO contains service-oriented description', () => {
  assert.match(seo, /20L drinking water can delivery/);
});

test('service data uses the AuroTap brand', () => {
  assert.match(serviceData, /'AuroTap'/);
});

test('shared feedback component exists', () => {
  assert.ok(existsSync(resolve(root, 'src/components/ui/UserFeedback.tsx')));
});

test('shared feedback component has four semantic tones', () => {
  const feedback = read('src/components/ui/UserFeedback.tsx');
  for (const tone of ['info', 'success', 'warning', 'error']) {
    assert.match(feedback, new RegExp(tone));
  }
});

test('shared feedback component has action button support', () => {
  const feedback = read('src/components/ui/UserFeedback.tsx');
  assert.match(feedback, /secondaryAction/);
  assert.match(feedback, /onClick=\{action\.onClick\}/);
});

test('shared feedback component respects disabled state', () => {
  const feedback = read('src/components/ui/UserFeedback.tsx');
  assert.match(feedback, /disabled=\{action\.disabled\}/);
});

test('shared feedback component wraps long descriptions', () => {
  const feedback = read('src/components/ui/UserFeedback.tsx');
  assert.match(feedback, /break-words/);
});

test('shared feedback component has accessible live regions', () => {
  const feedback = read('src/components/ui/UserFeedback.tsx');
  assert.match(feedback, /aria-live=/);
});
