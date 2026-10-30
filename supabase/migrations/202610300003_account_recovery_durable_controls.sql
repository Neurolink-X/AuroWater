-- Durable abuse protection and transactional audit guarantees for account recovery.
create table if not exists public.account_recovery_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);
alter table public.account_recovery_rate_limits enable row level security;
revoke all on public.account_recovery_rate_limits from anon, authenticated;
grant all on public.account_recovery_rate_limits to service_role;

create or replace function public.consume_account_recovery_rate_limit(
  p_key_hash text,
  p_max integer default 5,
  p_window_seconds integer default 3600
) returns table(allowed boolean, retry_after integer)
language plpgsql security definer set search_path = public
as $$
declare v_row public.account_recovery_rate_limits%rowtype; v_now timestamptz := clock_timestamp();
begin
  if p_key_hash is null or length(p_key_hash) <> 64 or p_max < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit parameters';
  end if;
  insert into public.account_recovery_rate_limits(key_hash, window_started_at, request_count, updated_at)
  values (p_key_hash, v_now, 1, v_now)
  on conflict (key_hash) do update set
    window_started_at = case
      when public.account_recovery_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now then v_now
      else public.account_recovery_rate_limits.window_started_at end,
    request_count = case
      when public.account_recovery_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now then 1
      else public.account_recovery_rate_limits.request_count + 1 end,
    updated_at = v_now
  returning * into v_row;
  if v_row.request_count > p_max then
    return query select false, greatest(1, ceil(extract(epoch from (v_row.window_started_at + make_interval(secs => p_window_seconds) - v_now)))::integer);
  else
    return query select true, 0;
  end if;
end;
$$;
revoke all on function public.consume_account_recovery_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_account_recovery_rate_limit(text, integer, integer) to service_role;

create or replace function public.submit_account_recovery_request(
  p_user_id uuid,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_category text,
  p_message text
) returns table(id uuid, request_number bigint, status text, created_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare v_request public.account_recovery_requests%rowtype;
begin
  insert into public.account_recovery_requests(
    user_id, contact_name, contact_email, contact_phone, category, message, status
  ) values (
    p_user_id, p_contact_name, p_contact_email, p_contact_phone, p_category, p_message, 'open'
  ) returning * into v_request;

  insert into public.account_recovery_audit(request_id, actor_user_id, action, details)
  values (v_request.id, p_user_id, 'request_submitted',
    jsonb_build_object('category', p_category, 'authenticated', p_user_id is not null));

  return query select v_request.id, v_request.request_number, v_request.status, v_request.created_at;
end;
$$;
revoke all on function public.submit_account_recovery_request(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_account_recovery_request(uuid, text, text, text, text, text) to service_role;

create or replace function public.update_account_recovery_review(
  p_request_id uuid,
  p_admin_id uuid,
  p_status text,
  p_admin_note text,
  p_verify_ownership boolean
) returns table(id uuid, status text, ownership_verified_at timestamptz, resolved_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare v_existing public.account_recovery_requests%rowtype; v_updated public.account_recovery_requests%rowtype; v_now timestamptz := clock_timestamp();
begin
  if p_status not in ('open','in_review','waiting_customer','resolved','rejected') then
    raise exception 'invalid status';
  end if;
  if p_verify_ownership and length(trim(coalesce(p_admin_note,''))) < 10 then
    raise exception 'verification note required';
  end if;
  select * into v_existing from public.account_recovery_requests where account_recovery_requests.id = p_request_id for update;
  if not found then raise exception 'request not found'; end if;
  if v_existing.status in ('resolved','rejected') then raise exception 'request already closed'; end if;

  update public.account_recovery_requests set
    status = p_status,
    admin_note = nullif(left(trim(coalesce(p_admin_note,'')),1000),''),
    assigned_admin_id = p_admin_id,
    updated_at = v_now,
    ownership_verified_at = case when p_verify_ownership then v_now else ownership_verified_at end,
    ownership_verified_by = case when p_verify_ownership then p_admin_id else ownership_verified_by end,
    resolved_at = case when p_status in ('resolved','rejected') then v_now else null end
  where account_recovery_requests.id = p_request_id
  returning * into v_updated;

  insert into public.account_recovery_audit(request_id, actor_user_id, action, details)
  values (p_request_id, p_admin_id,
    case when p_verify_ownership then 'ownership_verified_and_review_updated' else 'review_updated' end,
    jsonb_build_object('from_status',v_existing.status,'to_status',p_status,
      'note_added',length(trim(coalesce(p_admin_note,''))) > 0,'ownership_verified',p_verify_ownership));

  return query select v_updated.id, v_updated.status, v_updated.ownership_verified_at, v_updated.resolved_at, v_updated.updated_at;
end;
$$;
revoke all on function public.update_account_recovery_review(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.update_account_recovery_review(uuid, uuid, text, text, boolean) to service_role;

-- Audit events are append-only for application roles; service_role writes via trusted routes/functions.
