-- Tighten ACLs on trip preservation/recovery and Master Admin history RPCs.
-- Data ownership/Master Admin AAL2 checks remain enforced inside each function.

revoke all on function public.roamsonio_save_trip_snapshot(uuid,text,jsonb) from public, anon;
grant execute on function public.roamsonio_save_trip_snapshot(uuid,text,jsonb) to authenticated;

revoke all on function public.roamsonio_protect_trip_baseline(text,uuid,text,jsonb) from public, anon;
grant execute on function public.roamsonio_protect_trip_baseline(text,uuid,text,jsonb) to authenticated;

revoke all on function public.roamsonio_admin_trip_baselines() from public, anon, authenticated;
grant execute on function public.roamsonio_admin_trip_baselines() to authenticated;

revoke all on function public.roamsonio_recover_trip(text,jsonb) from public, anon;
grant execute on function public.roamsonio_recover_trip(text,jsonb) to authenticated;

revoke all on function public.roamsonio_admin_trip_versions(uuid) from public, anon, authenticated;
grant execute on function public.roamsonio_admin_trip_versions(uuid) to authenticated;

revoke all on function public.roamsonio_admin_users() from public, anon, authenticated;
revoke all on function public.roamsonio_admin_trips() from public, anon, authenticated;
revoke all on function public.roamsonio_admin_families() from public, anon, authenticated;
revoke all on function public.roamsonio_admin_support_requests() from public, anon, authenticated;
grant execute on function public.roamsonio_admin_users() to authenticated;
grant execute on function public.roamsonio_admin_trips() to authenticated;
grant execute on function public.roamsonio_admin_families() to authenticated;
grant execute on function public.roamsonio_admin_support_requests() to authenticated;

notify pgrst, 'reload schema';
