-- Private, bounded diagnostics, separate from immutable financial/audit history.
create table public.platform_errors (
  id bigint generated always as identity primary key,
  code text not null check (code in ('RUNTIME_ERROR','UNHANDLED_REJECTION','CHUNK_LOAD_ERROR','API_SERVER_ERROR','NETWORK_ERROR','SERVER_ERROR','DATABASE_UNAVAILABLE')),
  route_group text not null check (route_group in ('public','customer','supplier','technician','admin')),
  route_path text not null check (length(route_path) <= 200 and route_path ~ '^/[a-z/\[\]-]*$'),
  http_status integer not null check (http_status=0 or http_status between 500 and 599),
  source text not null check (source in ('browser','server')),
  bucket timestamptz not null,
  occurrences integer not null default 1 check (occurrences>0),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique(code,route_group,route_path,http_status,source,bucket)
);
alter table public.platform_errors enable row level security;
revoke all on public.platform_errors from public, anon, authenticated;
grant select,insert,update,delete on public.platform_errors to service_role;
grant usage,select on sequence public.platform_errors_id_seq to service_role;
create index platform_errors_recent on public.platform_errors(last_seen desc,id desc);
create index platform_errors_group_recent on public.platform_errors(route_group,last_seen desc,id desc);

create function public.record_platform_error(p_code text,p_group text,p_path text,p_status integer,p_source text)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  insert into public.platform_errors(code,route_group,route_path,http_status,source,bucket)
  values(p_code,p_group,p_path,p_status,p_source,date_trunc('minute',now()))
  on conflict(code,route_group,route_path,http_status,source,bucket)
  do update set occurrences=least(platform_errors.occurrences+1,1000000),last_seen=now();
  -- Bounded retention work; never touch orders, user data or audit logs.
  delete from public.platform_errors where id in (
    select id from public.platform_errors where last_seen<now()-interval '30 days' order by last_seen limit 100
  );
  delete from public.platform_errors where id in (
    select id from public.platform_errors order by last_seen desc,id desc offset 5000 limit 100
  );
end;
$$;
revoke all on function public.record_platform_error(text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.record_platform_error(text,text,text,integer,text) to service_role;
