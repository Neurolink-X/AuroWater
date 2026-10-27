import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const home = readFileSync(new URL('../src/app/(public)/page.tsx', import.meta.url), 'utf8');
const howItWorks = readFileSync(new URL('../src/app/(public)/how-it-works/page.tsx', import.meta.url), 'utf8');

test('homepage does not advertise NCR as an active service area', () => {
  assert.doesNotMatch(home, /Now serving eligible areas[^\n]*NCR/i);
  assert.doesNotMatch(home, /Kanpur\s*·\s*Lucknow\s*·\s*Gorakhpur and NCR/i);
  assert.match(home, /Operational cities: Kanpur, Lucknow &amp; Gorakhpur/);\n  assert.match(home, /NCR: approved PIN codes only/);
});

test('public marketing avoids unverified real-time and guaranteed service claims', () => {
  assert.doesNotMatch(home, /title:\s*'Live Tracking'/);
  assert.doesNotMatch(home, /Real-time updates from booking/i);
  assert.doesNotMatch(home, /Book by 2 PM, get service today in most areas/i);\n  assert.match(home, /Same-day Service Where Available/);\n  assert.match(home, /Same-day slots depend on your PIN code/);\n  assert.doesNotMatch(home, /Trusted and recognized operations worldwide/i);\n  assert.doesNotMatch(home, /Lifetime 10% discount on water and services/i);\n  assert.doesNotMatch(home, /First order free \(up to ₹200\)/i);
  assert.doesNotMatch(home, /100% Sealed & Hygienic/i);
  assert.match(home, /Order Updates/);
  assert.match(howItWorks, /Timing and fulfilment depend on local availability/);
  assert.doesNotMatch(howItWorks, /live tracking, zero surprises/i);
});

test('homepage preserves public pricing and the three currently active cities', () => {
  assert.match(home, /NORMAL_RO_PRICE|₹20/);
  assert.match(home, /CHILLED_RO_PRICE|₹25/);
  assert.match(home, /Kanpur/);
  assert.match(home, /Lucknow/);
  assert.match(home, /Gorakhpur/);
});
