-- Harden the Admin Foundation objects against inherited/default PUBLIC and anon grants.
-- RLS remains enabled; these ACLs make the intended browser role explicit.

revoke all on table public.roamsonio_admin_roles from public, anon;
revoke all on table public.roamsonio_approval_requests from public, anon;
revoke all on table public.roamsonio_admin_audit_log from public, anon;

-- Authenticated admins may read their role (RLS scopes rows), submit approval
-- requests (RLS scopes inserts), and read the permitted approval/audit rows.
grant select on table public.roamsonio_admin_roles to authenticated;
grant select, insert on table public.roamsonio_approval_requests to authenticated;
grant select on table public.roamsonio_admin_audit_log to authenticated;

-- These helpers reveal only the caller's role/level or whether they are Master.
revoke all on function public.roamsonio_role_level(text) from public, anon;
revoke all on function public.roamsonio_my_admin_role() from public, anon;
revoke all on function public.roamsonio_my_admin_level() from public, anon;
revoke all on function public.roamsonio_is_master_admin() from public, anon;

grant execute on function public.roamsonio_role_level(text) to authenticated;
grant execute on function public.roamsonio_my_admin_role() to authenticated;
grant execute on function public.roamsonio_my_admin_level() to authenticated;
grant execute on function public.roamsonio_is_master_admin() to authenticated;

-- Keep the bootstrap function unavailable to browser roles.
revoke all on function public.roamsonio_bootstrap_master_admin(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
