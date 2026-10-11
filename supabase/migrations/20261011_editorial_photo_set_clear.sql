-- Atomic Master Admin clear for one editorial destination.
-- Deletes only editorial photo rows attached to the requested destination; never touches trips/snapshots.
create or replace function public.roamsonio_admin_clear_editorial_photo_set(p_destination_id bigint)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_deleted integer := 0;
begin
  if not public.roamsonio_is_master_admin()
     or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'Master Admin MFA verification required';
  end if;

  if p_destination_id is null then
    raise exception 'Destination is required';
  end if;

  delete from public.roamsonio_editorial_photos
   where destination_id = p_destination_id;
  get diagnostics v_deleted = row_count;

  insert into public.roamsonio_admin_audit_log(actor_user_id,action,details)
  values(auth.uid(),'editorial_photo_set_clear',
    jsonb_build_object('editorial_id',p_destination_id,'deleted_count',v_deleted));

  return v_deleted;
end;
$$;

revoke all on function public.roamsonio_admin_clear_editorial_photo_set(bigint) from public,anon,authenticated;
grant execute on function public.roamsonio_admin_clear_editorial_photo_set(bigint) to authenticated;
