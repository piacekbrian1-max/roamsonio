-- Safely move one trip without moving an entire account.
create or replace function public.roamsonio_transfer_trip(
  p_trip_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_target_admin boolean;
  v_trip_name text;
begin
  if auth.uid() is null
     or not public.roamsonio_is_master_admin()
     or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'Master Admin MFA verification required';
  end if;
  if p_trip_id is null or p_target_user_id is null then
    raise exception 'Trip and target user are required';
  end if;
  select owner_id,name into v_owner,v_trip_name from public.trips where id=p_trip_id for update;
  if v_owner is null then raise exception 'Trip not found'; end if;
  if v_owner <> auth.uid() then raise exception 'For safety, Master Admin can only correct trips currently owned by the signed-in Master Admin account'; end if;
  select exists(select 1 from public.roamsonio_admin_roles where user_id=p_target_user_id and active=true) into v_target_admin;
  if v_target_admin then raise exception 'Target account has an active admin role'; end if;
  if not exists(select 1 from auth.users where id=p_target_user_id) then raise exception 'Target account not found'; end if;
  update public.trips set owner_id=p_target_user_id, updated_at=now() where id=p_trip_id and owner_id=auth.uid();
  if not found then raise exception 'Trip ownership update failed'; end if;
  insert into public.roamsonio_admin_audit_log(actor_user_id,action,target_user_id,details)
  values(auth.uid(),'TRIP_OWNERSHIP_TRANSFER',p_target_user_id,
    jsonb_build_object('trip_id',p_trip_id,'trip_name',v_trip_name,'source_user_id',auth.uid(),'target_user_id',p_target_user_id,'snapshot_preserved',true,'trip_id_preserved',true));
  return jsonb_build_object('status','TRANSFER_COMPLETE','trip_id',p_trip_id,'trip_name',v_trip_name,'source_user_id',auth.uid(),'target_user_id',p_target_user_id,'snapshot_preserved',true);
end;
$$;
revoke all on function public.roamsonio_transfer_trip(uuid,uuid) from public,anon,authenticated;
grant execute on function public.roamsonio_transfer_trip(uuid,uuid) to authenticated;
