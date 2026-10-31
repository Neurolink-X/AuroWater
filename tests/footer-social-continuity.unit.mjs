import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeFooterSocialUrl } from '../src/lib/footer-social-links.ts';

const footer = readFileSync('src/components/layout/Footer.tsx', 'utf8');
const social = readFileSync('src/lib/footer-social-links.ts', 'utf8');
const chrome = readFileSync('src/components/layout/RootChrome.tsx', 'utf8');

test('branded footer has AuroTap wordmark, not the obsolete AuroWater brand', () => {
  assert.match(footer, /AuroTap/);
  assert.doesNotMatch(footer, /AuroWater/);
  assert.match(footer, /\/aurotap-mark\.svg/);
});

test('footer preserves real customer and business paths', () => {
  for (const url of [
    '/book?service=water_can', '/book?service=plumbing', '/services',
    '/service-areas', '/pricing', '/how-it-works', '/blog', '/contact',
    '/about', '/careers', '/technicians', '/become-a-supplier',
    '/register/pro?type=technician',
  ]) assert.ok(footer.includes(url), `footer is missing ${url}`);
});

test('footer has full service navigation', () => {
  for (const service of [
    'water_can', 'plumbing', 'tank_cleaning', 'ro_service',
    'water_tanker', 'motor_pump', 'borewell',
  ]) assert.match(footer, new RegExp('service=' + service));
});

test('footer keeps contact methods and verified operational CTA', () => {
  assert.match(footer, /tel:\+919889305803/);
  assert.match(footer, /mailto:support\.aurotap@gmail\.com/);
  assert.match(footer, /https:\/\/wa\.me\/919889305803/);
  assert.match(footer, /noopener noreferrer/);
});

test('social accounts must be explicitly configured rather than fake profiles', () => {
  assert.match(footer, /getFooterSocialProfiles\(\)/);
  assert.match(social, /NEXT_PUBLIC_AUROTAP_INSTAGRAM_URL/);
  assert.match(social, /NEXT_PUBLIC_AUROTAP_FACEBOOK_URL/);
  assert.match(social, /NEXT_PUBLIC_AUROTAP_LINKEDIN_URL/);
  assert.match(social, /NEXT_PUBLIC_AUROTAP_YOUTUBE_URL/);
  assert.match(social, /NON_PROFILE_PATHS/);
  assert.match(social, /https:/);
  assert.match(social, /url\.search \|\| url\.hash/);
});

test('social URLs require a platform-matched hostname', () => {
  assert.match(social, /HOSTS\[platform\]\.includes\(url\.hostname\.toLowerCase\(\)\)/);
});

test('social icons are accessible and only rendered for valid profile links', () => {
  assert.match(footer, /SOCIALS\.map\(\(profile\)/);
  assert.match(footer, /aria-label=\{\x60AuroTap on/);
  // Brand logos are inline SVG, because lucide-react does not export them.
  // Verify platform branches and accessible SVG markup, not obsolete imports.
  for (const platform of ['instagram', 'facebook', 'linkedin']) {
    assert.ok(footer.includes(`platform === '${platform}'`), `missing ${platform} icon`);
  }
  assert.match(footer, /<SocialIcon platform=\{profile\.platform\} \/>/);
  assert.match(footer, /aria-hidden="true" focusable="false"/);
  assert.doesNotMatch(footer, /ArrowRight, Facebook, Instagram, Linkedin/);
});

test('footer creates visual continuity without a tall wave section', () => {
  assert.match(footer, /--footer-prev-bg/);
  assert.match(footer, /pointer-events-none h-3 w-full/);
  assert.match(footer, /linear-gradient\(180deg/);
  assert.doesNotMatch(footer, /ft-wave-top|ft-cta-band/);
});

test('RootChrome controls page-to-footer transition without additional API requests', () => {
  assert.match(chrome, /previousBackground/);
  assert.match(chrome, /--footer-prev-bg/);
  assert.match(chrome, /<Footer \/>/);
});

test('footer is accessible and preserves dynamic city expansion', () => {
  assert.match(footer, /fetch\('\/api\/cities'/);
  assert.match(footer, /selectFooterCities\(cities, 6, 2\)/);
  assert.match(footer, /groups\.active\.map/);
  assert.match(footer, /groups\.upcoming\.map/);
  assert.match(footer, /controller\.abort\(\)/);
});

test('footer uses native link navigation with keyboard focus', () => {
  assert.match(footer, /focus-visible:outline/);
  assert.match(footer, /<nav aria-label="Footer navigation"/);
  assert.match(footer, /<nav aria-label="Our services"/);
  assert.match(footer, /<nav aria-label="Policies"/);
});

test('footer avoids janky animation on low-end mobile devices', () => {
  assert.doesNotMatch(footer, /requestAnimationFrame|setInterval|backdrop-filter/);
  assert.match(footer, /lg:grid-cols-\[1\.2fr_0\.82fr_0\.82fr_1\.08fr\]/);
});

test('social link normalizer accepts real HTTPS profile paths', () => {
  assert.equal(normalizeFooterSocialUrl('instagram', 'https://www.instagram.com/aurotap.in/'),
    'https://www.instagram.com/aurotap.in/');
  assert.equal(normalizeFooterSocialUrl('facebook', 'https://www.facebook.com/aurotapofficial'),
    'https://www.facebook.com/aurotapofficial/');
  assert.equal(normalizeFooterSocialUrl('linkedin', 'https://www.linkedin.com/company/aurotap'),
    'https://www.linkedin.com/company/aurotap/');
  assert.equal(normalizeFooterSocialUrl('youtube', 'https://www.youtube.com/@aurotap'),
    'https://www.youtube.com/@aurotap/');
});

test('social links reject generic homepages and malicious mismatched links', () => {
  for (const link of [
    'https://instagram.com', 'http://instagram.com/aurotap',
    'https://instagram.com.evil.test/aurotap',
    'https://instagram.com/aurotap?redirect=https://bad.test',
    'https://user:password@instagram.com/aurotap',
    'https://instagram.com/%2funsafe',
  ]) assert.equal(normalizeFooterSocialUrl('instagram', link), null, link);
  assert.equal(normalizeFooterSocialUrl('facebook', 'https://instagram.com/aurotap'), null);
  assert.equal(normalizeFooterSocialUrl('linkedin', 'https://linkedin.com/feed'), null);
  assert.equal(normalizeFooterSocialUrl('youtube', 'https://youtube.com/watch'), null);
});
