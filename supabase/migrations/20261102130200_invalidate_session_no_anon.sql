-- invalidate_session now ends a real login, so signed-out visitors must not be able to call it at all
-- (it already returned false for anyone who is not a Super Admin).
REVOKE ALL ON FUNCTION public.invalidate_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invalidate_session(uuid) TO authenticated;
