import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(path, 'utf8');
const link = source('src/components/navigation/BookingIntentLink.tsx');
const home = source('src/app/(public)/HomeClient.tsx');
const customer = source('src/app/customer/home/page.tsx');
const bottomNav = source('src/components/customer/BottomNav.tsx');
const services = source('src/app/(public)/services/ServicesClient.tsx');
const admin = source('src/app/admin/dashboard/page.tsx');
const booking = source('src/app/(public)/book/page.tsx');
const loading = source('src/app/(public)/book/loading.tsx');

test('booking CTA retains real Next Link navigation and immediate visual feedback', () => {
  assert.ok(link.includes("import Link from 'next/link'"));
  assert.ok(link.includes("href={href}"));
  assert.ok(link.includes('setOpeningFrom(pathname)'));
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

test('mobile bottom navigation acknowledges taps before route content arrives', () => {
  assert.ok(bottomNav.includes('aria-busy={opening}'));
  assert.ok(bottomNav.includes("opening ? 'Opening…' : it.label"));
  assert.ok(bottomNav.includes('setPending({ key, origin: pathname })'));
  assert.ok(bottomNav.includes('event.defaultPrevented'));
  assert.ok(bottomNav.includes('event.ctrlKey'));
  assert.ok(bottomNav.includes('<Link'));
  assert.ok(!bottomNav.slice(0, bottomNav.indexOf("// 'use client';")).includes('router.push('));
});

test('service tab selection stays immediate and does not hydrate an animation runtime', () => {
  assert.ok(home.includes('role="tablist"'));
  assert.ok(home.includes('role="tab" aria-selected={svc === i} onClick={() => setSvc(i)}'));
  assert.ok(home.includes('key={svc} className="aw-glass aw-service-panel'));
  assert.ok(home.includes('role="tabpanel"'));
  assert.ok(home.includes('aw-service-panel,.aw-status-message{animation:aw-panel-in .12s ease-out both}'));
  assert.ok(!home.includes('AnimatePresence'));
  assert.ok(!home.includes("from 'framer-motion'"));
  assert.ok(home.includes('<BookingIntentLink href={s.href}'));
  assert.ok(admin.includes('activeTabRef.current = key;'));
  assert.ok(admin.includes('setTab(key);'));
  assert.ok(!admin.includes('startTransition(() => setTab(key))'));
});
