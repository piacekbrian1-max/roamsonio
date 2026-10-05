-- RoamSonio Editorial Library administration
-- Safe extension: only the new editorial tables are touched.
-- All write RPCs require Master Admin + AAL2. Existing trip/user/family data is untouched.

alter table public.roamsonio_editorial_destinations
  add column if not exists activities text[] not null default '{}';

create or replace function public.roamsonio_admin_editorial_destinations()
returns table(
  id text,name text,type text,category text,seasons text[],activities text[],buildable boolean,
  build_destination text,tagline text,status text,metadata jsonb,updated_at timestamptz
)
language plpgsql security definer set search_path=''
stable as $$
begin
  if not public.roamsonio_is_master_admin() or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'Master Admin MFA verification required';
  end if;
  return query
  select d.id,d.name,d.type,d.category,d.seasons,d.activities,d.buildable,d.build_destination,
         d.tagline,d.status,d.metadata,d.updated_at
  from public.roamsonio_editorial_destinations d
  order by d.type,d.name;
end;
$$;

create or replace function public.roamsonio_admin_upsert_editorial_destination(
  p_id text,p_name text,p_type text,p_category text,p_seasons text[],p_activities text[],
  p_buildable boolean,p_build_destination text,p_tagline text,p_status text default 'draft',p_metadata jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.roamsonio_is_master_admin() or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'Master Admin MFA verification required';
  end if;
  if p_id is null or trim(p_id)='' then raise exception 'Editorial ID is required'; end if;
  if p_name is null or trim(p_name)='' then raise exception 'Editorial name is required'; end if;
  if p_type not in ('City','Region','Ski & Snowboard','Outdoor','Coast & Island','Road Trip','Seasonal Experience') then raise exception 'Invalid editorial type'; end if;
  if p_status not in ('draft','published','archived') then raise exception 'Invalid editorial status'; end if;
  insert into public.roamsonio_editorial_destinations(id,name,type,category,seasons,activities,buildable,build_destination,tagline,status,metadata,updated_at)
  values(trim(p_id),trim(p_name),p_type,coalesce(nullif(trim(p_category),''),'Travel'),coalesce(p_seasons,'{}'),coalesce(p_activities,'{}'),coalesce(p_buildable,true),nullif(trim(coalesce(p_build_destination,'')),''),nullif(trim(coalesce(p_tagline,'')),''),p_status,coalesce(p_metadata,'{}'::jsonb),now())
  on conflict(id) do update set name=excluded.name,type=excluded.type,category=excluded.category,seasons=excluded.seasons,activities=excluded.activities,
    buildable=excluded.buildable,build_destination=excluded.build_destination,tagline=excluded.tagline,status=excluded.status,metadata=excluded.metadata,updated_at=now();
  insert into public.roamsonio_admin_audit_log(actor_user_id,action,details)
  values(auth.uid(),'editorial_destination_upsert',jsonb_build_object('editorial_id',trim(p_id),'status',p_status));
end;
$$;

create or replace function public.roamsonio_admin_set_editorial_status(p_id text,p_status text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.roamsonio_is_master_admin() or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then raise exception 'Master Admin MFA verification required'; end if;
  if p_status not in ('draft','published','archived') then raise exception 'Invalid editorial status'; end if;
  update public.roamsonio_editorial_destinations set status=p_status,updated_at=now() where id=p_id;
  if not found then raise exception 'Editorial destination not found'; end if;
  insert into public.roamsonio_admin_audit_log(actor_user_id,action,details)
  values(auth.uid(),'editorial_destination_status',jsonb_build_object('editorial_id',p_id,'status',p_status));
end;
$$;

create or replace function public.roamsonio_admin_upsert_editorial_photo(
  p_photo_id bigint,p_destination_id text,p_url text,p_alt_text text,p_credit text,p_source_url text,p_role text,p_sort_order integer,p_approved boolean
)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_id bigint;
begin
  if not public.roamsonio_is_master_admin() or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then raise exception 'Master Admin MFA verification required'; end if;
  if not exists(select 1 from public.roamsonio_editorial_destinations where id=p_destination_id) then raise exception 'Editorial destination not found'; end if;
  if p_url is null or trim(p_url)='' then raise exception 'Photo URL is required'; end if;
  if p_role not in ('hero','secondary','mobile') then raise exception 'Invalid photo role'; end if;
  if p_photo_id is null then
    insert into public.roamsonio_editorial_photos(destination_id,url,alt_text,credit,source_url,role,sort_order,approved)
    values(p_destination_id,trim(p_url),coalesce(p_alt_text,''),coalesce(p_credit,''),coalesce(p_source_url,''),p_role,coalesce(p_sort_order,0),coalesce(p_approved,false)) returning id into v_id;
  else
    update public.roamsonio_editorial_photos set destination_id=p_destination_id,url=trim(p_url),alt_text=coalesce(p_alt_text,''),credit=coalesce(p_credit,''),source_url=coalesce(p_source_url,''),role=p_role,sort_order=coalesce(p_sort_order,0),approved=coalesce(p_approved,false),updated_at=now() where id=p_photo_id returning id into v_id;
    if v_id is null then raise exception 'Photo not found'; end if;
  end if;
  insert into public.roamsonio_admin_audit_log(actor_user_id,action,details)
  values(auth.uid(),'editorial_photo_upsert',jsonb_build_object('photo_id',v_id,'editorial_id',p_destination_id,'approved',p_approved));
  return v_id;
end;
$$;

create or replace function public.roamsonio_admin_delete_editorial_photo(p_photo_id bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.roamsonio_is_master_admin() or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then raise exception 'Master Admin MFA verification required'; end if;
  delete from public.roamsonio_editorial_photos where id=p_photo_id;
  insert into public.roamsonio_admin_audit_log(actor_user_id,action,details)
  values(auth.uid(),'editorial_photo_delete',jsonb_build_object('photo_id',p_photo_id));
end;
$$;

revoke all on function public.roamsonio_admin_editorial_destinations() from public,anon,authenticated;
revoke all on function public.roamsonio_admin_upsert_editorial_destination(text,text,text,text,text[],text[],boolean,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.roamsonio_admin_set_editorial_status(text,text) from public,anon,authenticated;
revoke all on function public.roamsonio_admin_upsert_editorial_photo(bigint,text,text,text,text,text,text,integer,boolean) from public,anon,authenticated;
revoke all on function public.roamsonio_admin_delete_editorial_photo(bigint) from public,anon,authenticated;
grant execute on function public.roamsonio_admin_editorial_destinations() to authenticated;
grant execute on function public.roamsonio_admin_upsert_editorial_destination(text,text,text,text,text[],text[],boolean,text,text,text,jsonb) to authenticated;
grant execute on function public.roamsonio_admin_set_editorial_status(text,text) to authenticated;
grant execute on function public.roamsonio_admin_upsert_editorial_photo(bigint,text,text,text,text,text,text,integer,boolean) to authenticated;
grant execute on function public.roamsonio_admin_delete_editorial_photo(bigint) to authenticated;
