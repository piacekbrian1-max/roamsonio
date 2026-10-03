create extension if not exists pgcrypto;

create table if not exists public.roamsonio_trip_baselines (
  baseline_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  browser_trip_id text,
  trip_id uuid,
  trip_name text,
  snapshot jsonb not null,
  snapshot_hash text not null,
  source text not null default 'browser-preservation',
  captured_at timestamptz not null default now()
);

create index if not exists roamsonio_trip_baselines_owner_idx
  on public.roamsonio_trip_baselines(owner_id, captured_at desc);

alter table public.roamsonio_trip_baselines enable row level security;

revoke all on public.roamsonio_trip_baselines from public, anon, authenticated;

create or replace function public.roamsonio_protect_trip_baseline(
  p_browser_trip_id text,
  p_trip_id uuid,
  p_trip_name text,
  p_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  h text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to protect a trip baseline';
  end if;

  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'Trip snapshot is missing or invalid';
  end if;

  h := encode(
    extensions.digest(
      convert_to(p_snapshot::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  insert into public.roamsonio_trip_baselines(
    owner_id,
    browser_trip_id,
    trip_id,
    trip_name,
    snapshot,
    snapshot_hash,
    source
  )
  values(
    auth.uid(),
    p_browser_trip_id,
    p_trip_id,
    coalesce(nullif(trim(p_trip_name), ''), 'RoamSonio Trip'),
    p_snapshot,
    h,
    'browser-preservation'
  )
  returning baseline_id into new_id;

  return new_id;
end;
$$;

revoke all on function public.roamsonio_protect_trip_baseline(text, uuid, text, jsonb) from public;
grant execute on function public.roamsonio_protect_trip_baseline(text, uuid, text, jsonb) to authenticated;

create or replace function public.roamsonio_admin_trip_baselines()
returns table(
  baseline_id uuid,
  owner_id uuid,
  owner_email text,
  trip_id uuid,
  browser_trip_id text,
  trip_name text,
  snapshot_hash text,
  source text,
  captured_at timestamptz,
  snapshot jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not public.roamsonio_is_master_admin()
     or (auth.jwt()->>'aal') <> 'aal2'
  then
    raise exception 'Master Admin AAL2 required';
  end if;

  return query
  select
    b.baseline_id,
    b.owner_id,
    u.email::text,
    b.trip_id,
    b.browser_trip_id,
    b.trip_name,
    b.snapshot_hash,
    b.source,
    b.captured_at,
    b.snapshot
  from public.roamsonio_trip_baselines b
  left join auth.users u on u.id=b.owner_id
  order by b.captured_at desc;
end;
$$;

revoke all on function public.roamsonio_admin_trip_baselines() from public;
grant execute on function public.roamsonio_admin_trip_baselines() to authenticated;
