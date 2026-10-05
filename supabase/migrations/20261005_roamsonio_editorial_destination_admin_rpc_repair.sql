-- Repair protected Editorial Library destination save RPC.
-- Safe: touches only the Editorial Library administration function.

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
  insert into public.roamsonio_editorial_destinations
    (id,name,type,category,seasons,activities,buildable,build_destination,tagline,status,metadata,updated_at)
  values
    (trim(p_id),trim(p_name),p_type,coalesce(nullif(trim(p_category),''),'Travel'),
     coalesce(p_seasons,'{}'),coalesce(p_activities,'{}'),coalesce(p_buildable,true),
     nullif(trim(coalesce(p_build_destination,'')),''),nullif(trim(coalesce(p_tagline,'')),''),p_status,
     coalesce(p_metadata,'{}'::jsonb),now())
  on conflict(id) do update set
    name=excluded.name,type=excluded.type,category=excluded.category,seasons=excluded.seasons,
    activities=excluded.activities,buildable=excluded.buildable,build_destination=excluded.build_destination,
    tagline=excluded.tagline,status=excluded.status,metadata=excluded.metadata,updated_at=now();
  insert into public.roamsonio_admin_audit_log(actor_user_id,action,details)
  values(auth.uid(),'editorial_destination_upsert',
         jsonb_build_object('editorial_id',trim(p_id),'status',p_status));
end;
$$;

revoke all on function public.roamsonio_admin_upsert_editorial_destination(text,text,text,text,text[],text[],boolean,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.roamsonio_admin_upsert_editorial_destination(text,text,text,text,text[],text[],boolean,text,text,text,jsonb) to authenticated;

notify pgrst, 'reload schema';
