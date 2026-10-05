-- Repair protected Editorial Library destination read RPC.
-- Safe: reads only Editorial Library data and does not modify trips.

create or replace function public.roamsonio_admin_editorial_destinations()
returns table(
  id text,
  name text,
  type text,
  category text,
  seasons text[],
  activities text[],
  buildable boolean,
  build_destination text,
  tagline text,
  status text,
  metadata jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path=''
stable
as $$
begin
  if not public.roamsonio_is_master_admin()
     or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'Master Admin MFA verification required';
  end if;

  return query
  select
    d.id,
    d.name,
    d.type,
    d.category,
    d.seasons,
    d.activities,
    d.buildable,
    d.build_destination,
    d.tagline,
    d.status,
    d.metadata,
    d.updated_at
  from public.roamsonio_editorial_destinations d
  order by d.type, d.name;
end;
$$;

revoke all on function public.roamsonio_admin_editorial_destinations()
  from public, anon, authenticated;

grant execute on function public.roamsonio_admin_editorial_destinations()
  to authenticated;

notify pgrst, 'reload schema';
