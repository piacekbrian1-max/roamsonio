-- Refresh PostgREST's schema cache after the protected editorial photo RPC was created.
-- This is metadata/cache maintenance only; no trip, user, family, or editorial data is changed.

notify pgrst, 'reload schema';
