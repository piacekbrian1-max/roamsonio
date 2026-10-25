-- Fix the clear-editorial-photo-set RPC privileges.
-- The function's actual argument is text; the prior migration targeted bigint,
-- leaving the text signature without the intended explicit privilege restriction.

revoke all on function public.roamsonio_admin_clear_editorial_photo_set(text) from public, anon, authenticated;
grant execute on function public.roamsonio_admin_clear_editorial_photo_set(text) to authenticated;
