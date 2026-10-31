import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');

test('blog is discoverable in active mobile drawer and footer navigation', () => {
  const header = read('src/components/layout/Header.tsx');
  const footer = read('src/components/layout/Footer.tsx');
  assert.match(header, /\{ label: 'Blog & Guides', href: '\/blog'/);
  assert.match(header, /const drawerLinks =/);
  assert.match(footer, /\{ label: 'Blog & Guides', href: '\/blog'/);
  assert.match(footer, /NAV_LINKS\.map/);
});

test('blog index renders editorial cards, safe article links and reviewed updates', () => {
  const page = read('src/app/blog/page.tsx');
  assert.match(page, /await allPublishedGuides\(\)/);
  assert.match(page, /publishedNews\(\)/);
  assert.match(page, /featured\.coverImage/);
  assert.match(page, /href=\{\`\/blog\/\$\{featured\.slug\}\`\}/);
  assert.match(page, /news\.length > 0/);
  assert.match(page, /alt=\{featured\.title/);
});

test('article has metadata, readable navigation, image and schema', () => {
  const page = read('src/app/blog/[slug]/page.tsx');
  for (const token of ['generateMetadata', 'findPublishedGuide(slug)', 'notFound()', 'application/ld+json', 'In this guide', 'Keep reading', 'datePublished', 'dateModified']) {
    assert.ok(page.includes(token), token);
  }
  assert.match(page, /post\.coverImage &&/);
  assert.match(page, /href=\{\`#section-/);
});

test('editorial cover image exists and future posts remain unpublished', () => {
  const source = read('src/lib/blog/posts.ts');
  const images = [...source.matchAll(/coverImage:\s*'([^']+)'/g)].map(m => m[1]);
  for (const image of images) {
    assert.ok(image.startsWith('/images/'), 'cover images must be local reviewed assets');
    assert.ok(existsSync(join(root, 'public', image.slice(1))), `missing cover image: ${image}`);
  }
  assert.match(source, /Date\.parse\(post\.publishAt\) <= timestamp/);
  assert.match(source, /publishedGuides\(now\)\.find/);
});
