-- Safe recovery of the original browser trip into the signed-in owner's account.
-- The browser copy is the recovery source. Existing complete/conflicting server data is never overwritten.
create or replace function public.roamsonio_restore_browser_trip(
  p_browser_trip_id text,
  p_name text,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip public.trips%rowtype;
  v_trip_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to recover a trip';
  end if;

  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'The browser trip snapshot is missing or invalid';
  end if;

  -- First use the original durable trip ID when the browser copy has one.
  if coalesce(trim(p_browser_trip_id),'') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
    v_trip_id := trim(p_browser_trip_id)::uuid;

    select * into v_trip
    from public.trips
    where id=v_trip_id and owner_id=auth.uid()
    for update;

    if found then
      -- Safe repair: replace only when the browser copy is a superset of the
      -- server snapshot, or the server has no snapshot at all.
      if v_trip.trip_snapshot is null
         or p_snapshot @> v_trip.trip_snapshot then
        update public.trips
        set name=coalesce(nullif(trim(p_name),''),name),
            trip_snapshot=p_snapshot,
            updated_at=now()
        where id=v_trip.id and owner_id=auth.uid();

        return jsonb_build_object(
          'id',v_trip.id,
          'name',coalesce(nullif(trim(p_name),''),v_trip.name),
          'status','restored_browser_copy',
          'trip_snapshot',p_snapshot
        );
      end if;

      -- If the durable copy is already a superset, nothing needs to be changed.
      if v_trip.trip_snapshot @> p_snapshot then
        return jsonb_build_object(
          'id',v_trip.id,
          'name',v_trip.name,
          'status','server_copy_already_complete',
          'trip_snapshot',v_trip.trip_snapshot
        );
      end if;

      raise exception 'An existing saved trip has different data; nothing was overwritten';
    end if;
  end if;

  -- If the original ID is unavailable, avoid duplicates by matching the exact
  -- protected browser snapshot already stored for this owner.
  select * into v_trip
  from public.trips
  where owner_id=auth.uid()
    and trip_snapshot = p_snapshot
  order by updated_at desc nulls last
  limit 1;

  if found then
    return jsonb_build_object(
      'id',v_trip.id,
      'name',v_trip.name,
      'status','already_restored',
      'trip_snapshot',v_trip.trip_snapshot
    );
  end if;

  -- If a same-named server row exists but has no snapshot, safely fill it
  -- instead of creating a duplicate.
  select * into v_trip
  from public.trips
  where owner_id=auth.uid()
    and lower(trim(name))=lower(trim(coalesce(p_name,'')))
    and trip_snapshot is null
  order by updated_at desc nulls last
  limit 1
  for update;

  if found then
    update public.trips
    set trip_snapshot=p_snapshot,
        updated_at=now()
    where id=v_trip.id and owner_id=auth.uid();

    return jsonb_build_object(
      'id',v_trip.id,
      'name',v_trip.name,
      'status','restored_into_existing_record',
      'trip_snapshot',p_snapshot
    );
  end if;

  insert into public.trips(
    owner_id,name,visibility,surprise_mode,trip_snapshot
  )
  values(
    auth.uid(),
    coalesce(nullif(trim(p_name),''),'RoamSonio Trip'),
    'private',
    false,
    p_snapshot
  )
  returning * into v_trip;

  return jsonb_build_object(
    'id',v_trip.id,
    'name',v_trip.name,
    'status','created_from_browser_copy',
    'trip_snapshot',p_snapshot
  );
end;
$$;

revoke all on function public.roamsonio_restore_browser_trip(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.roamsonio_restore_browser_trip(text,text,jsonb) to authenticated;
