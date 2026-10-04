-- Safe full-trip recovery helpers.
-- The signed-in owner can retrieve their own durable snapshots even when the
-- browser copy no longer has the original database UUID.
create or replace function public.roamsonio_recover_trip(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_trip public.trips%rowtype;
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  if p_trip_id is null then raise exception 'Trip ID is required'; end if;
  select * into v_trip from public.trips where id=p_trip_id and owner_id=auth.uid();
  if not found then raise exception 'Saved trip not found for this account'; end if;
  if v_trip.trip_snapshot is null or jsonb_typeof(v_trip.trip_snapshot) <> 'object' then
    raise exception 'This trip does not have a complete saved snapshot yet';
  end if;
  return jsonb_build_object('id',v_trip.id,'name',v_trip.name,'trip_snapshot',v_trip.trip_snapshot);
end;
$$;

create or replace function public.roamsonio_recover_trip_candidates()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in'; end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',t.id,
        'name',t.name,
        'trip_snapshot',t.trip_snapshot
      ) order by t.updated_at desc nulls last
    )
    from public.trips t
    where t.owner_id=auth.uid()
      and t.trip_snapshot is not null
      and jsonb_typeof(t.trip_snapshot)='object'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.roamsonio_recover_trip(uuid) from public, anon, authenticated;
grant execute on function public.roamsonio_recover_trip(uuid) to authenticated;
revoke all on function public.roamsonio_recover_trip_candidates() from public, anon, authenticated;
grant execute on function public.roamsonio_recover_trip_candidates() to authenticated;
