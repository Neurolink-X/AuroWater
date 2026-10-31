import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/app/globals.css', 'utf8');
const home = readFileSync('src/app/(public)/HomeClient.tsx', 'utf8');
const observer = readFileSync('src/components/observability/ScrollStallReporter.tsx', 'utf8');
const sitemap = readFileSync('src/app/sitemap.ts', 'utf8');

test('mobile vertical pan is not disabled', () => {
  assert.match(css, /touch-action: pan-y pinch-zoom/);
});
test('mobile click targets avoid delayed taps', () => {
  assert.match(css, /touch-action: manipulation/);
});
test('mobile content is width constrained', () => {
  assert.match(css, /main\s*\{\s*min-width: 0/);
});
test('mobile media has max width guard', () => {
  assert.match(css, /main :is\(img, video, svg\)/);
});
test('mobile table overflow is locally contained', () => {
  assert.match(css, /overscroll-behavior-x: contain/);
});
test('home page has no wheel event handler', () => {
  assert.doesNotMatch(home, /onWheel=/);
});
test('home page has no touchmove preventDefault handler', () => {
  assert.doesNotMatch(home, /touchmove[^\n]*preventDefault/);
});
test('scroll observer samples only coarse pointer devices', () => {
  assert.match(observer, /pointer: coarse/);
});
test('scroll observer uses passive event listener', () => {
  assert.match(observer, /passive: true/);
});
test('scroll observer avoids logging user paths', () => {
  assert.match(observer, /route_group:/);
});
test('scroll observer does not send telemetry on every scroll event', () => {
  assert.match(observer, /window\.setInterval\(report/);
});
test('scroll observer removes event listener', () => {
  assert.match(observer, /removeEventListener\('scroll'/);
});
test('sitemap respects indexing policy', () => {
  assert.match(sitemap, /canIndexDeployment/);
});
test('sitemap uses configured site URL', () => {
  assert.match(sitemap, /getSiteUrl/);
});
test('sitemap includes service detail pages', () => {
  assert.match(sitemap, /serviceDetailPages/);
});
test('sitemap includes reviewed content only', () => {
  assert.match(sitemap, /publishedNews/);
});
