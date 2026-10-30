-- Account recovery support workflow. Apply once in Supabase SQL Editor.
create table if not exists public.account_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity,
  user_id uuid null references auth.users(id) on delete set null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text null,
  category text not null check (category in ('forgot_password','lost_email_access','change_email','account_blocked','account_access','other')),
  message text not null,
  status text not null default 'open' check (status in ('open','in_review','waiting_customer','resolved','rejected')),
  assigned_admin_id uuid null references auth.users(id) on delete set null,
  admin_note text null,
  ownership_verified_at timestamptz null,
  ownership_verified_by uuid null references auth.users(id) on delete set null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists account_recovery_requests_status_created_idx
  on public.account_recovery_requests(status, created_at desc);
create index if not exists account_recovery_requests_email_idx
  on public.account_recovery_requests(lower(contact_email));
create index if not exists account_recovery_requests_user_idx
  on public.account_recovery_requests(user_id) where user_id is not null;

create table if not exists public.account_recovery_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.account_recovery_requests(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists account_recovery_audit_request_idx
  on public.account_recovery_audit(request_id, created_at desc);

alter table public.account_recovery_requests enable row level security;
alter table public.account_recovery_audit enable row level security;
-- All access is through server routes using the service-role client after explicit auth checks.
revoke all on public.account_recovery_requests from anon, authenticated;
revoke all on public.account_recovery_audit from anon, authenticated;
grant all on public.account_recovery_requests to service_role;
grant all on public.account_recovery_audit to service_role;
