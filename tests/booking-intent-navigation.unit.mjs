import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(path, 'utf8');
const link = source('src/components/navigation/BookingIntentLink.tsx');
const home = source('src/app/(public)/HomeClient.tsx');
const customer = source('src/app/customer/home/page.tsx');
const services = source('src/app/(public)/services/ServicesClient.tsx');
const admin = source('src/app/admin/dashboard/page.tsx');
const booking = source('src/app/(public)/book/page.tsx');
const loading = source('src/app/(public)/book/loading.tsx');

test('booking CTA retains real Next Link navigation and immediate visual feedback', () => {
  assert.ok(link.includes("import Link from 'next/link'"));
  assert.ok(link.includes("href={href}"));
  assert.ok(link.includes('setOpening(true)'));
  assert.ok(link.includes('role="status"'));
  assert.ok(link.includes('aria-busy={opening}'));
  assert.ok(link.includes('event.defaultPrevented'));
  assert.ok(link.includes("event.button !== 0"));
  assert.ok(link.includes('event.metaKey'));
  assert.ok(link.includes('event.shiftKey'));
  assert.ok(link.includes("event.currentTarget.target === '_blank'"));
  assert.ok(link.includes('router.prefetch(href)'));
  assert.ok(link.includes('MAX_WARMED_BOOKING_ROUTES = 8'));
  assert.ok(!link.includes('router.push('));
  assert.ok(!link.includes('api/customer/orders'));
});

test('booking entry points on key screens have instant feedback', () => {
  assert.ok(home.includes('<BookingIntentLink href="/book?service=water_can"'));
  assert.ok(home.includes('<BookingIntentLink href={s.href}'));
  assert.ok(customer.includes('<BookingIntentLink'));
  assert.ok(services.includes('<BookingIntentLink href={`/book?service='));
  assert.ok(booking.includes('dynamic(() => import('));
  assert.ok(loading.includes('aria-busy="true"'));
});

test('service and admin tab selection does not wait for exit or low priority state', () => {
  assert.ok(home.includes('<AnimatePresence mode="sync">'));
  assert.ok(home.includes('transition={{ duration: 0.12 }}'));
  assert.ok(admin.includes('activeTabRef.current = key;'));
  assert.ok(admin.includes('setTab(key);'));
  assert.ok(!admin.includes('startTransition(() => setTab(key))'));
});
