-- Replace only unapproved Wikimedia candidate photos on a draft that the worker previously processed.
-- Approved images and all trip/snapshot/user data are untouched.
create or replace function public.roamsonio_worker_delete_unapproved_commons_photos(p_destination_id text)
returns integer language plpgsql security definer set search_path='' as $$
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
$$;
revoke all on function public.roamsonio_worker_delete_unapproved_commons_photos(text) from public,anon,authenticated;
grant execute on function public.roamsonio_worker_delete_unapproved_commons_photos(text) to service_role;
notify pgrst, 'reload schema';
