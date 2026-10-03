-- RoamSonio durable trip version history
-- Captures the previous trip record before any UPDATE or DELETE.
-- This is append-only from the application perspective and does not alter existing trips.

create table if not exists public.roamsonio_trip_versions (
  version_id bigint generated always as identity primary key,
  trip_id uuid not null,
  operation text not null check (operation in ('UPDATE','DELETE')),
  owner_id uuid,
  family_id uuid,
  name text,
  visibility text,
  surprise_mode boolean,
  trip_snapshot jsonb,
  captured_at timestamptz not null default now(),
  actor_user_id uuid,
  source text not null default 'trips_trigger'
);

create index if not exists roamsonio_trip_versions_trip_idx
  on public.roamsonio_trip_versions(trip_id, captured_at desc);

create index if not exists roamsonio_trip_versions_owner_idx
  on public.roamsonio_trip_versions(owner_id, captured_at desc);

alter table public.roamsonio_trip_versions enable row level security;

revoke all on table public.roamsonio_trip_versions from anon, authenticated;

create or replace function public.roamsonio_capture_trip_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.roamsonio_trip_versions(
    trip_id,
    operation,
    owner_id,
    family_id,
    name,
    visibility,
    surprise_mode,
    trip_snapshot,
    captured_at,
    actor_user_id
  )
  values(
    old.id,
    tg_op,
    old.owner_id,
    old.family_id,
    old.name,
    old.visibility,
    old.surprise_mode,
    old.trip_snapshot,
    now(),
    auth.uid()
  );

  return old;
end;
$$;

drop trigger if exists roamsonio_trip_version_before_change on public.trips;

create trigger roamsonio_trip_version_before_change
before update or delete on public.trips
for each row
execute function public.roamsonio_capture_trip_version();

revoke all on function public.roamsonio_capture_trip_version() from public;

comment on table public.roamsonio_trip_versions is
  'Immutable recovery history containing the prior trip record before each UPDATE or DELETE.';
