-- Repair migration: create the protected editorial photo upsert RPC.
-- The live database verification showed this function was missing.
-- No existing trip, user, family, or saved-trip data is modified.

create or replace function public.roamsonio_admin_upsert_editorial_photo(
  p_photo_id bigint,
  p_destination_id text,
  p_url text,
  p_alt_text text,
  p_credit text,
  p_source_url text,
  p_role text,
  p_sort_order integer,
  p_approved boolean
)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id bigint;
begin
  if not public.roamsonio_is_master_admin()
     or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'Master Admin MFA verification required';
  end if;

  if not exists (
    select 1
    from public.roamsonio_editorial_destinations
    where id=p_destination_id
  ) then
    raise exception 'Editorial destination not found';
  end if;

  if p_url is null or trim(p_url)='' then
    raise exception 'Photo URL is required';
  end if;

  if p_role not in ('hero','secondary','mobile') then
    raise exception 'Invalid photo role';
  end if;

  if p_photo_id is null then
    insert into public.roamsonio_editorial_photos(
      destination_id,url,alt_text,credit,source_url,role,sort_order,approved
    )
    values(
      p_destination_id,
      trim(p_url),
      coalesce(p_alt_text,''),
      coalesce(p_credit,''),
      coalesce(p_source_url,''),
      p_role,
      coalesce(p_sort_order,0),
      coalesce(p_approved,false)
    )
    returning id into v_id;
  else
    update public.roamsonio_editorial_photos
       set destination_id=p_destination_id,
           url=trim(p_url),
           alt_text=coalesce(p_alt_text,''),
           credit=coalesce(p_credit,''),
           source_url=coalesce(p_source_url,''),
           role=p_role,
           sort_order=coalesce(p_sort_order,0),
           approved=coalesce(p_approved,false),
           updated_at=now()
     where id=p_photo_id
     returning id into v_id;

    if v_id is null then
      raise exception 'Photo not found';
    end if;
  end if;

  insert into public.roamsonio_admin_audit_log(actor_user_id,action,details)
  values(
    auth.uid(),
    'editorial_photo_upsert',
    jsonb_build_object(
      'photo_id',v_id,
      'editorial_id',p_destination_id,
      'approved',p_approved
    )
  );

  return v_id;
end;
$$;

revoke all
on function public.roamsonio_admin_upsert_editorial_photo(
  bigint,text,text,text,text,text,text,integer,boolean
)
from public,anon,authenticated;

grant execute
on function public.roamsonio_admin_upsert_editorial_photo(
  bigint,text,text,text,text,text,text,integer,boolean
)
to authenticated;

notify pgrst, 'reload schema';
