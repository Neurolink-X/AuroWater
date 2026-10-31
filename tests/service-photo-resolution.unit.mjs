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

test('service images use responsive cover frames while detail images preserve original proportions', () => {
  const css = read('src/app/(public)/services/services.css');
  const detail = read('src/app/(public)/services/[slug]/page.tsx');
  const booking = read('src/components/ui/AnimatedServiceCard.tsx');
  const about = read('src/app/(public)/about/page.tsx');
  assert.match(css, /\.sv-card-illustration img \{[\s\S]*?object-fit: cover/);
  assert.match(css, /\.sv-card-illustration \{[\s\S]*?aspect-ratio: 4 \/ 3/);
  assert.match(detail, /SERVICE_IMAGE_DIMENSIONS\[service.key\]/);
  assert.match(booking, /object-contain/);
  assert.match(about, /\.ab-svc-photo img\{object-fit:contain/);
});
