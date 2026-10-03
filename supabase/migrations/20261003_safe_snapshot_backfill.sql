-- Safe snapshot backfill: owner can populate a missing snapshot only.
create or replace function public.roamsonio_backfill_trip_snapshot(
  p_trip_id uuid,
  p_snapshot jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'Trip snapshot is missing or invalid';
  end if;
  update public.trips
  set trip_snapshot = p_snapshot, updated_at = now()
  where id = p_trip_id and owner_id = auth.uid() and trip_snapshot is null;
  return found;
end;
$$;
revoke all on function public.roamsonio_backfill_trip_snapshot(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.roamsonio_backfill_trip_snapshot(uuid,jsonb) to authenticated;
