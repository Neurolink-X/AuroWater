import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/lib/location-guidance.ts', 'utf8');
const booking = readFileSync('src/components/booking/BookingWizard.tsx', 'utf8');
const footer = readFileSync('src/components/layout/Footer.tsx', 'utf8');
const home = readFileSync('src/app/(public)/HomeClient.tsx', 'utf8');

const cases = [
  'permission-denied',
  'device-location-off',
  'timeout',
  'position-unavailable',
  'unsupported',
  'insecure-context',
  'network',
  'unknown',
];

for (const type of cases) {
  test('location guidance includes ' + type, () => {
    assert.ok(source.includes(type + ':') || source.includes("'" + type + "':"));
  });
}

test('location guidance does not force GPS permission', () => {
  assert.match(source, /You can continue without GPS/);
});

test('location guidance covers device location setting', () => {
  assert.match(source, /phone settings/);
});

test('location guidance covers browser permission', () => {
  assert.match(source, /browser settings/);
});

test('location guidance explains weak GPS signal', () => {
  assert.match(source, /signal is weak/);
});

test('location guidance explains HTTPS requirement', () => {
  assert.match(source, /secure HTTPS/);
});

test('location guidance explains network failure', () => {
  assert.match(source, /internet connection/);
});

test('location guidance has a manual PIN fallback', () => {
  assert.match(source, /6-digit PIN code/);
});

test('location guidance classifies denied permission', () => {
  assert.match(source, /code === 1/);
});

test('location guidance classifies unavailable position', () => {
  assert.match(source, /code === 2/);
});

test('location guidance classifies GPS timeout', () => {
  assert.match(source, /code === 3/);
});

test('booking imports centralized guidance', () => {
  assert.match(booking, /from '@\/lib\/location-guidance'/);
});

test('booking renders recovery steps', () => {
  assert.match(booking, /locationHelp\.steps\.map/);
});

test('booking renders fallback text', () => {
  assert.match(booking, /locationHelp\.fallback/);
});

test('footer uses public-facing brand', () => {
  const active = footer.slice(footer.lastIndexOf('export default function Footer()'));
  assert.match(active, /AuroTap/);
  assert.doesNotMatch(active, /AuroWater/);
});

test('home displays price-lock terms once', () => {
  assert.equal(
    home.split('Plan availability and any price-lock terms are shown before you confirm your booking.').length - 1,
    1,
  );
});

test('home no longer repeats eligibility warning on every card', () => {
  assert.doesNotMatch(home, /Actual plan eligibility and price lock are confirmed when booking\./);
});
