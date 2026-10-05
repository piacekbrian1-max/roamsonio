-- RoamSonio Editorial Photography administration read access
-- Safe extension: read-only admin listing through protected RPC. Writes remain in the existing protected photo RPCs.

create or replace function public.roamsonio_admin_editorial_photos(p_destination_id text)
returns table(
  id bigint,destination_id text,url text,alt_text text,credit text,source_url text,
  role text,sort_order integer,approved boolean,created_at timestamptz,updated_at timestamptz
)
language plpgsql security definer set search_path='' stable as $$
begin
  if not public.roamsonio_is_master_admin() or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'Master Admin MFA verification required';
  end if;
  return query
  select p.id,p.destination_id,p.url,p.alt_text,p.credit,p.source_url,p.role,p.sort_order,p.approved,p.created_at,p.updated_at
  from public.roamsonio_editorial_photos p
  where p_destination_id is null or p.destination_id=p_destination_id
  order by p.destination_id,p.sort_order,p.id;
end;
$$;

revoke all on function public.roamsonio_admin_editorial_photos(text) from public,anon,authenticated;
grant execute on function public.roamsonio_admin_editorial_photos(text) to authenticated;
