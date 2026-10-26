-- Make support-request browser access explicit; RLS continues to scope rows.
-- Users may read/submit their own requests; admins may read through the policy/RPC.

revoke all on table public.roamsonio_support_requests from public, anon;
grant select, insert on table public.roamsonio_support_requests to authenticated;

notify pgrst, 'reload schema';
