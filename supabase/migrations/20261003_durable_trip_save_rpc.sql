-- Durable owner-controlled trip snapshot save
create or replace function public.roamsonio_save_trip_snapshot(
  p_trip_id uuid,
  p_name text,
  p_snapshot jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to save a trip';
  end if;

  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'Trip snapshot is missing or invalid';
  end if;

  update public.trips
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    trip_snapshot = p_snapshot,
    updated_at = now()
  where id = p_trip_id
    and owner_id = auth.uid();

  if not found then
    raise exception 'Trip not found or not owned by the signed-in user';
  end if;

  return true;
end;
$$;

revoke all on function public.roamsonio_save_trip_snapshot(uuid,text,jsonb) from public;
grant execute on function public.roamsonio_save_trip_snapshot(uuid,text,jsonb) to authenticated;

comment on function public.roamsonio_save_trip_snapshot(uuid,text,jsonb) is
  'Owner-only durable save of the complete RoamSonio trip snapshot.';
