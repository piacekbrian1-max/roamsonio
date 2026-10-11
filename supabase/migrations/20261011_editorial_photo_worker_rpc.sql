-- RoamSonio editorial photo worker RPCs.
-- These are machine-only, narrow editorial operations for the service-role Edge Function.
-- They do not weaken Master Admin MFA for browser/admin RPCs.
-- No trip, snapshot, family, or user tables are read or modified.

create or replace function public.roamsonio_worker_editorial_drafts()
returns table(
  id text, name text, type text, category text, seasons text[], activities text[],
  buildable boolean, build_destination text, tagline text, status text, metadata jsonb, updated_at timestamptz
)
language plpgsql security definer set search_path='' stable as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  return query
  select d.id,d.name,d.type,d.category,d.seasons,d.activities,d.buildable,d.build_destination,
         d.tagline,d.status,d.metadata,d.updated_at
  from public.roamsonio_editorial_destinations d
  where d.status='draft'
  order by d.updated_at asc, d.name asc;
end;
$$;

create or replace function public.roamsonio_worker_editorial_photos(p_destination_id text)
returns table(
  id bigint,destination_id text,url text,alt_text text,credit text,source_url text,
  role text,sort_order integer,approved boolean,created_at timestamptz,updated_at timestamptz
)
language plpgsql security definer set search_path='' stable as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_destination_id is null or not exists (
    select 1 from public.roamsonio_editorial_destinations d
    where d.id=p_destination_id and d.status='draft'
  ) then
    raise exception 'Draft editorial destination required';
  end if;
  return query
  select p.id,p.destination_id,p.url,p.alt_text,p.credit,p.source_url,p.role,p.sort_order,
         p.approved,p.created_at,p.updated_at
  from public.roamsonio_editorial_photos p
  where p.destination_id=p_destination_id
  order by p.sort_order,p.id;
end;
$$;

create or replace function public.roamsonio_worker_insert_editorial_photo(
  p_destination_id text,p_url text,p_alt_text text,p_credit text,p_source_url text,p_role text,p_sort_order integer
)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_id bigint;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_destination_id is null or not exists (
    select 1 from public.roamsonio_editorial_destinations d
    where d.id=p_destination_id and d.status='draft'
  ) then
    raise exception 'Draft editorial destination required';
  end if;
  if p_url is null or trim(p_url) !~ '^https://' then raise exception 'HTTPS photo URL required'; end if;
  if p_source_url is null or trim(p_source_url) !~ '^https://' then raise exception 'HTTPS source URL required'; end if;
  if p_credit is null or trim(p_credit)='' then raise exception 'Photo credit required'; end if;
  if p_alt_text is null or trim(p_alt_text)='' then raise exception 'Photo alt text required'; end if;
  if p_role not in ('hero','secondary','mobile') then raise exception 'Invalid photo role'; end if;
  -- Candidates are always unapproved. The worker cannot approve or publish photos.
  insert into public.roamsonio_editorial_photos(destination_id,url,alt_text,credit,source_url,role,sort_order,approved)
  values(p_destination_id,trim(p_url),trim(p_alt_text),trim(p_credit),trim(p_source_url),p_role,coalesce(p_sort_order,0),false)
  returning id into v_id;
  insert into public.roamsonio_admin_audit_log(actor_user_id,action,details)
  values(null,'editorial_photo_worker_insert',jsonb_build_object('photo_id',v_id,'editorial_id',p_destination_id,'approved',false,'role',p_role));
  return v_id;
end;
$$;

create or replace function public.roamsonio_worker_delete_unapproved_commons_photos(p_destination_id text)
returns integer language plpgsql security definer set search_path='' as $
declare v_deleted integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_destination_id is null or not exists (
    select 1 from public.roamsonio_editorial_destinations d
    where d.id=p_destination_id and d.status='draft'
      and coalesce(d.metadata->>'photo_preparation_source','')='Wikimedia Commons'
  ) then
    raise exception 'Draft must have prior worker photo-preparation metadata';
  end if;
  delete from public.roamsonio_editorial_photos p
   where p.destination_id=p_destination_id
     and coalesce(p.approved,false)=false
     and p.credit ilike '%Wikimedia Commons%';
  get diagnostics v_deleted = row_count;
  insert into public.roamsonio_admin_audit_log(actor_user_id,action,details)
  values(null,'editorial_photo_worker_replace_unapproved',jsonb_build_object('editorial_id',p_destination_id,'deleted_count',v_deleted,'approved_rows_touched',false));
  return v_deleted;
end;
$;

create or replace function public.roamsonio_worker_update_draft_metadata(p_id text,p_metadata jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_id is null or p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Draft ID and metadata object required';
  end if;
  update public.roamsonio_editorial_destinations
     set metadata=p_metadata,updated_at=now()
   where id=p_id and status='draft';
  if not found then raise exception 'Draft editorial destination not found'; end if;
  insert into public.roamsonio_admin_audit_log(actor_user_id,action,details)
  values(null,'editorial_photo_worker_metadata',jsonb_build_object('editorial_id',p_id,'photo_preparation_status',p_metadata->>'photo_preparation_status'));
end;
$$;

revoke all on function public.roamsonio_worker_editorial_drafts() from public,anon,authenticated;
revoke all on function public.roamsonio_worker_editorial_photos(text) from public,anon,authenticated;
revoke all on function public.roamsonio_worker_insert_editorial_photo(text,text,text,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.roamsonio_worker_delete_unapproved_commons_photos(text) from public,anon,authenticated;
revoke all on function public.roamsonio_worker_update_draft_metadata(text,jsonb) from public,anon,authenticated;
grant execute on function public.roamsonio_worker_editorial_drafts() to service_role;
grant execute on function public.roamsonio_worker_editorial_photos(text) to service_role;
grant execute on function public.roamsonio_worker_insert_editorial_photo(text,text,text,text,text,text,integer) to service_role;
grant execute on function public.roamsonio_worker_delete_unapproved_commons_photos(text) to service_role;
grant execute on function public.roamsonio_worker_update_draft_metadata(text,jsonb) to service_role;

notify pgrst, 'reload schema';
