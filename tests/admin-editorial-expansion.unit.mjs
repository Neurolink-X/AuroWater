import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync,readFileSync } from 'node:fs';
const read=(path)=>readFileSync(path,'utf8');

test('admin editorial and expansion routes exist in App Router',()=>{
  for(const p of [
    'src/app/admin/blog/page.tsx','src/app/admin/expansion/page.tsx',
    'src/app/api/admin/blog/route.ts','src/app/api/admin/blog/[id]/route.ts',
    'src/app/api/admin/cities/route.ts','src/lib/blog/managed-posts.ts'
  ]) assert.ok(existsSync(p),p);
});

test('draft articles never appear in public blog',()=>{
  const source=read('src/lib/blog/managed-posts.ts');
  assert.match(source,/\.eq\('status','published'\)/);
  assert.match(source,/\.lte\('publish_at'/);
  const migration=read('supabase/migrations/20261031120000_admin_blog_editorial.sql');
  assert.match(migration,/enable row level security/);
  assert.match(migration,/revoke all on public.blog_posts from anon, authenticated/);
  const list=read('src/app/blog/page.tsx');
  const detail=read('src/app/blog/[slug]/page.tsx');
  assert.match(list,/await allPublishedGuides\(\)/);
  assert.match(detail,/await findPublishedGuide\(slug\)/);
});

test('admin writes require server-side admin authorization',()=>{
  for(const path of ['src/app/api/admin/blog/route.ts','src/app/api/admin/blog/[id]/route.ts','src/app/api/admin/cities/route.ts']){
    const code=read(path);
    assert.match(code,/requireSupabaseAuth\(req\)/);
    assert.match(code,/requireAdmin\(auth.ctx\)/);
  }
  const cities=read('src/app/api/admin/cities/route.ts');
  assert.match(cities,/Cannot activate city: no available zones with verified PIN codes/);
  assert.match(cities,/online supplier with available stock/);
  assert.match(cities,/city.status_change/);
});

test('admin navigation exposes manual publishing and expansion',()=>{
  const source=read('src/components/admin/AdminShell.tsx');
  assert.match(source,/href: '\/admin\/blog'/);
  assert.match(source,/href: '\/admin\/expansion'/);
});
