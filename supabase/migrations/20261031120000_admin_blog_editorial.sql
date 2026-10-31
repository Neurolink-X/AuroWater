-- Manual editorial CMS. Private drafts must never be queryable from browser roles.
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 5 and 120),
  title text not null check (length(title) between 12 and 180),
  description text not null check (length(description) between 30 and 400),
  category text not null default 'Water and home services' check (length(category) between 2 and 80),
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  status text not null default 'draft' check (status in ('draft','published')),
  publish_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_id uuid references auth.users(id) on delete set null
);
create index if not exists blog_posts_public_listing_idx on public.blog_posts (publish_at desc) where status='published';
alter table public.blog_posts enable row level security;
revoke all on public.blog_posts from anon, authenticated;
grant select,insert,update,delete on public.blog_posts to service_role;
-- Every read/write of blog_posts is performed server-side after authorization.
-- The public blog loader reads ONLY published articles whose publish_at <= now().
