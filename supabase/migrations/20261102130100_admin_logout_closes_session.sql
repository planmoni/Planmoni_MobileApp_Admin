/*
  A normal sign-out (kind 'logout') now also closes that browser's admin_sessions row, so the team list does not keep
  counting it as an active session. Everything else in admin_log_activity is unchanged.
*/
CREATE OR REPLACE FUNCTION public.admin_log_activity(
  p_kind text,
  p_action text,
  p_path text DEFAULT NULL,
  p_resource_type text DEFAULT NULL,
  p_resource_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_details jsonb := COALESCE(p_details, '{}'::jsonb);
  v_session uuid;
  v_sid uuid := public._admin_jwt_session_id();
BEGIN
  IF v_uid IS NULL OR p_kind NOT IN ('page_view', 'action', 'login', 'logout') THEN
    RETURN false;
  END IF;
  IF public._admin_is_blocked(v_uid) OR NOT public._admin_is_staff(v_uid) THEN
    RETURN false;
  END IF;
  IF NULLIF(trim(COALESCE(p_action, '')), '') IS NULL THEN
    RETURN false;
  END IF;

  SELECT s.id INTO v_session FROM public.admin_sessions s
  WHERE s.user_id = v_uid AND v_sid IS NOT NULL AND s.auth_session_id = v_sid
  ORDER BY s.last_active DESC LIMIT 1;

  IF p_kind = 'logout' AND v_session IS NOT NULL THEN
    UPDATE public.admin_sessions SET is_active = false WHERE id = v_session;
  END IF;

  -- flood protection
  IF (SELECT count(*) FROM public.admin_activity a WHERE a.user_id = v_uid AND a.created_at > now() - interval '1 minute') >= 120 THEN
    RETURN false;
  END IF;

  IF length(v_details::text) > 4000 THEN
    v_details := jsonb_build_object('truncated', true);
  END IF;

  INSERT INTO public.admin_activity (user_id, kind, action, path, resource_type, resource_id, details, session_id)
  VALUES (v_uid, p_kind, left(trim(p_action), 200), left(p_path, 300), left(p_resource_type, 100), left(p_resource_id, 200), v_details, v_session);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_log_activity(text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_activity(text, text, text, text, text, jsonb) TO authenticated;
