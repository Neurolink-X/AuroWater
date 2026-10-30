-- Secure private file storage foundation for AuroTap.
-- Additive and idempotent. Apply through Supabase migrations before enabling uploads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-user-files',
  'private-user-files',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

create table if not exists public.user_files (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null default 'private-user-files'
    check (bucket_id = 'private-user-files'),
  object_path text not null unique,
  category text not null check (category in (
    'profile_photo',
    'identity_document',
    'business_document',
    'skill_certificate',
    'service_evidence',
    'support_attachment'
  )),
  original_name text not null,
  content_type text not null check (content_type in (
    'image/jpeg','image/png','image/webp','application/pdf'
  )),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  review_status text not null default 'pending'
    check (review_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_files_owner_created_idx
  on public.user_files (owner_user_id, created_at desc);
create index if not exists user_files_category_status_idx
  on public.user_files (category, review_status, created_at desc);

alter table public.user_files enable row level security;
revoke all on public.user_files from anon, authenticated;
grant all on public.user_files to service_role;

-- Storage access is mediated by authenticated server routes. The bucket is private;
-- no anon/authenticated object policy is created. service_role bypasses Storage RLS.
