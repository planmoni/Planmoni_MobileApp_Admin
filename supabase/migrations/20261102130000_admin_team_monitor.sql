/*
  Super Admin team monitor: presence, realtime activity, forced logout, role removal, suspension.

  Before this: admin_sessions were written once at sign-in and never refreshed or enforced, "Logout" only flipped a flag,
  audit_logs held 4 rows, and there was no way to remove a role or suspend an admin.

  Everything is additive. Suspension is enforced inside is_super_admin() and has_permission(), so a suspended admin loses
  access to anything protected by RLS at once, even with a token that has not expired. The Supabase Auth "ban" is NOT used
  (it would also lock the account out of the mobile app).
*/

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.admin_sessions ADD COLUMN IF NOT EXISTS auth_session_id uuid;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_seen ON public.admin_sessions (user_id, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_auth_session ON public.admin_sessions (auth_session_id) WHERE auth_session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.admin_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('page_view', 'action', 'login', 'logout', 'role', 'access')),
  action text NOT NULL,
  path text,
  resource_type text,
  resource_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON public.admin_activity (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_user_created ON public.admin_activity (user_id, created_at DESC);

ALTER TABLE public.admin_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Super admin can view admin activity" ON public.admin_activity;
CREATE POLICY "Super admin can view admin activity" ON public.admin_activity
  FOR SELECT TO authenticated USING (public.is_super_admin());
REVOKE ALL ON public.admin_activity FROM anon, authenticated;
GRANT SELECT ON public.admin_activity TO authenticated;

CREATE TABLE IF NOT EXISTS public.admin_access_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  blocked_by uuid,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_access_blocks_active ON public.admin_access_blocks (user_id) WHERE lifted_at IS NULL;
ALTER TABLE public.admin_access_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_access_blocks FROM anon, authenticated;

-- realtime (RLS still applies: only Super Admins receive rows)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admin_activity') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_activity;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'admin_sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_sessions;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._admin_is_blocked(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admin_access_blocks b WHERE b.user_id = p_uid AND b.lifted_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public._admin_is_blocked(uuid) FROM PUBLIC, anon, authenticated;

-- admins and anyone holding an active role
CREATE OR REPLACE FUNCTION public._admin_is_staff(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_uid IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_uid AND COALESCE(p.is_admin, false))
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_uid AND ur.is_active)
  );
$$;
REVOKE ALL ON FUNCTION public._admin_is_staff(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._admin_has_super_role(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_uid AND r.name = 'Super Admin' AND ur.is_active
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  );
$$;
REVOKE ALL ON FUNCTION public._admin_has_super_role(uuid) FROM PUBLIC, anon, authenticated;

-- the auth session id carried by the caller's JWT
CREATE OR REPLACE FUNCTION public._admin_jwt_session_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE v text;
BEGIN
  v := nullif(auth.jwt() ->> 'session_id', '');
  RETURN v::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- one place that writes both the activity feed and the audit log for control actions
CREATE OR REPLACE FUNCTION public._admin_record(p_kind text, p_action text, p_resource_id uuid, p_details jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_activity (user_id, kind, action, resource_type, resource_id, details)
  VALUES (auth.uid(), p_kind, p_action, 'user', p_resource_id::text, COALESCE(p_details, '{}'::jsonb));

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (auth.uid(), p_action, 'user', p_resource_id::text, COALESCE(p_details, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public._admin_record(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- closes every admin session of a user and deletes their auth sessions (refresh tokens cascade), so they cannot refresh
CREATE OR REPLACE FUNCTION public._admin_end_sessions(p_uid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_closed integer;
BEGIN
  UPDATE public.admin_sessions SET is_active = false WHERE user_id = p_uid AND is_active;
  GET DIAGNOSTICS v_closed = ROW_COUNT;
  DELETE FROM auth.sessions WHERE user_id = p_uid;
  RETURN v_closed;
END;
$$;
REVOKE ALL ON FUNCTION public._admin_end_sessions(uuid) FROM PUBLIC, anon, authenticated;

-- common checks for the control RPCs
CREATE OR REPLACE FUNCTION public._admin_control_guard(p_target uuid, p_forbid_super boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super Admin privileges required';
  END IF;
  IF p_target IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF p_target = auth.uid() THEN
    RAISE EXCEPTION 'You cannot do this to your own account';
  END IF;
  IF NOT public._admin_is_staff(p_target) THEN
    RAISE EXCEPTION 'This user is not an admin or role holder';
  END IF;
  IF p_forbid_super AND public._admin_has_super_role(p_target) THEN
    RAISE EXCEPTION 'A Super Admin cannot be suspended. Remove their Super Admin role first.';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._admin_control_guard(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Enforce suspension in the two permission functions (bodies unchanged apart from the block checks)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  role_check boolean := false;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public._admin_is_blocked(current_user_id) THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = current_user_id
      AND r.name = 'Super Admin'
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) INTO role_check;

  RETURN role_check;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(permission_name text, user_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id uuid;
  has_perm boolean;
BEGIN
  target_user_id := COALESCE(user_id, auth.uid());

  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- a suspended admin has no permissions
  IF public._admin_is_blocked(target_user_id) THEN
    RETURN false;
  END IF;

  IF (user_id IS NULL OR user_id = auth.uid()) AND is_super_admin() THEN
    RETURN true;
  END IF;

  IF user_id IS NOT NULL AND user_id != auth.uid() THEN
    IF is_super_admin() THEN
      SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = target_user_id
          AND p.name = permission_name
          AND ur.is_active = true
          AND (ur.expires_at IS NULL OR ur.expires_at > now())
      ) INTO has_perm;
      RETURN has_perm;
    ELSE
      RETURN false;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = target_user_id
      AND p.name = permission_name
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) INTO has_perm;

  RETURN has_perm;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. What the app calls: heartbeat, activity logging, access status
-- ---------------------------------------------------------------------------
-- Called every 30 seconds by the open admin app. Keeps "online" and "last seen" accurate and tells the app to sign out
-- when the session was closed, the auth session was deleted, or the account was suspended.
CREATE OR REPLACE FUNCTION public.admin_heartbeat(p_session_token text DEFAULT NULL, p_path text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sid uuid := public._admin_jwt_session_id();
  v_row public.admin_sessions%ROWTYPE;
  v_token text := NULLIF(trim(COALESCE(p_session_token, '')), '');
  v_ua text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'unauthenticated');
  END IF;
  IF public._admin_is_blocked(v_uid) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'suspended');
  END IF;
  IF v_sid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = v_sid) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'logged_out');
  END IF;
  IF NOT public._admin_is_staff(v_uid) THEN
    RETURN jsonb_build_object('valid', true, 'tracked', false);
  END IF;

  IF v_token IS NOT NULL THEN
    SELECT * INTO v_row FROM public.admin_sessions WHERE session_token = v_token AND user_id = v_uid;
  END IF;

  IF FOUND THEN
    IF NOT v_row.is_active OR v_row.expires_at < now() THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'logged_out');
    END IF;
    UPDATE public.admin_sessions
    SET last_active = now(), auth_session_id = COALESCE(auth_session_id, v_sid)
    WHERE id = v_row.id;
    RETURN jsonb_build_object('valid', true, 'tracked', true, 'session_token', v_row.session_token);
  END IF;

  -- no usable session row for this browser (older login): start tracking it
  BEGIN
    v_ua := (current_setting('request.headers', true)::json) ->> 'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_ua := NULL;
  END;
  v_token := gen_random_uuid()::text;
  INSERT INTO public.admin_sessions (user_id, session_token, user_agent, expires_at, auth_session_id)
  VALUES (v_uid, v_token, v_ua, now() + interval '24 hours', v_sid);
  RETURN jsonb_build_object('valid', true, 'tracked', true, 'session_token', v_token);
END;
$$;

-- Client-side activity (page views, actions, sign-in/out). Control actions are written by the RPCs below, not by clients.
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

  -- flood protection
  IF (SELECT count(*) FROM public.admin_activity a WHERE a.user_id = v_uid AND a.created_at > now() - interval '1 minute') >= 120 THEN
    RETURN false;
  END IF;

  IF length(v_details::text) > 4000 THEN
    v_details := jsonb_build_object('truncated', true);
  END IF;

  SELECT s.id INTO v_session FROM public.admin_sessions s
  WHERE s.user_id = v_uid AND s.auth_session_id = public._admin_jwt_session_id()
  ORDER BY s.last_active DESC LIMIT 1;

  INSERT INTO public.admin_activity (user_id, kind, action, path, resource_type, resource_id, details, session_id)
  VALUES (v_uid, p_kind, left(trim(p_action), 200), left(p_path, 300), left(p_resource_type, 100), left(p_resource_id, 200), v_details, v_session);
  RETURN true;
END;
$$;

-- Called right after sign-in so a suspended admin is turned away immediately.
CREATE OR REPLACE FUNCTION public.admin_access_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN jsonb_build_object('blocked', false)
    ELSE COALESCE(
      (SELECT jsonb_build_object('blocked', true, 'reason', b.reason)
       FROM public.admin_access_blocks b WHERE b.user_id = auth.uid() AND b.lifted_at IS NULL),
      jsonb_build_object('blocked', false))
  END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Super Admin reads: team overview and activity feed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_team_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super Admin privileges required';
  END IF;

  SELECT COALESCE(jsonb_agg(t ORDER BY
           CASE t->>'status' WHEN 'online' THEN 0 WHEN 'offline' THEN 1 ELSE 2 END,
           (t->>'last_seen') DESC NULLS LAST), '[]'::jsonb)
  INTO v
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'email', p.email,
      'is_admin', COALESCE(p.is_admin, false),
      'is_super_admin', public._admin_has_super_role(p.id),
      'roles', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('role_id', r.id, 'role_name', r.name, 'role_color', r.color, 'role_level', r.level)
                         ORDER BY r.level DESC)
        FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = p.id AND ur.is_active), '[]'::jsonb),
      'suspended', b.id IS NOT NULL,
      'suspension', CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object(
        'reason', b.reason, 'blocked_at', b.blocked_at,
        'blocked_by', NULLIF(trim(COALESCE(bp.first_name, '') || ' ' || COALESCE(bp.last_name, '')), '')) END,
      'status', CASE WHEN b.id IS NOT NULL THEN 'suspended'
                     WHEN sess.online THEN 'online' ELSE 'offline' END,
      'last_seen', sess.last_seen,
      'active_sessions', COALESCE(sess.active_sessions, 0),
      'last_page', pv.path,
      'last_page_at', pv.created_at,
      'last_action', ac.action,
      'last_action_at', ac.created_at
    ) AS t
    FROM public.profiles p
    LEFT JOIN public.admin_access_blocks b ON b.user_id = p.id AND b.lifted_at IS NULL
    LEFT JOIN public.profiles bp ON bp.id = b.blocked_by
    LEFT JOIN LATERAL (
      SELECT max(s.last_active) AS last_seen,
             bool_or(s.is_active AND s.expires_at > now() AND s.last_active > now() - interval '90 seconds') AS online,
             count(*) FILTER (WHERE s.is_active AND s.expires_at > now()) AS active_sessions
      FROM public.admin_sessions s WHERE s.user_id = p.id
    ) sess ON true
    LEFT JOIN LATERAL (
      SELECT a.path, a.created_at FROM public.admin_activity a
      WHERE a.user_id = p.id AND a.kind = 'page_view' ORDER BY a.created_at DESC LIMIT 1
    ) pv ON true
    LEFT JOIN LATERAL (
      SELECT a.action, a.created_at FROM public.admin_activity a
      WHERE a.user_id = p.id AND a.kind IN ('action', 'role', 'access') ORDER BY a.created_at DESC LIMIT 1
    ) ac ON true
    WHERE COALESCE(p.is_admin, false)
       OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.is_active)
       OR b.id IS NOT NULL
  ) q;

  RETURN v;
END;
$$;

-- Newest first; pass the created_at of the last row as p_before to load older rows.
CREATE OR REPLACE FUNCTION public.admin_activity_feed(
  p_limit integer DEFAULT 50,
  p_before timestamptz DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_kinds text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super Admin privileges required';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', x.id, 'user_id', x.user_id, 'kind', x.kind, 'action', x.action, 'path', x.path,
           'resource_type', x.resource_type, 'resource_id', x.resource_id, 'details', x.details,
           'created_at', x.created_at,
           'actor_name', NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
           'actor_email', p.email
         ) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v
  FROM (
    SELECT a.* FROM public.admin_activity a
    WHERE (p_before IS NULL OR a.created_at < p_before)
      AND (p_user_id IS NULL OR a.user_id = p_user_id)
      AND (p_kinds IS NULL OR a.kind = ANY (p_kinds))
    ORDER BY a.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  ) x
  LEFT JOIN public.profiles p ON p.id = x.user_id;

  RETURN v;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Controls (Super Admin only; each one writes the activity feed and the audit log)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_force_logout(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_closed integer;
BEGIN
  PERFORM public._admin_control_guard(p_user_id, false);
  v_closed := public._admin_end_sessions(p_user_id);
  PERFORM public._admin_record('access', 'admin.forced_logout', p_user_id, jsonb_build_object('sessions_closed', v_closed));
  RETURN jsonb_build_object('signed_out', true, 'sessions_closed', v_closed);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_role(p_user_id uuid, p_role_id uuid, p_force_logout boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_name text;
BEGIN
  PERFORM public._admin_control_guard(p_user_id, false);

  SELECT r.name INTO v_role_name FROM public.roles r WHERE r.id = p_role_id;
  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  UPDATE public.user_roles SET is_active = false
  WHERE user_id = p_user_id AND role_id = p_role_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The user does not hold this role';
  END IF;

  -- there must always be one active Super Admin left (the caller is one, since they passed the guard)
  IF v_role_name = 'Super Admin' AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
       WHERE r.name = 'Super Admin' AND ur.is_active AND ur.user_id <> p_user_id) THEN
    RAISE EXCEPTION 'The last Super Admin role cannot be removed';
  END IF;

  IF COALESCE(p_force_logout, false) THEN
    PERFORM public._admin_end_sessions(p_user_id);
  END IF;

  PERFORM public._admin_record('role', 'admin.role_removed', p_user_id,
    jsonb_build_object('role_id', p_role_id, 'role_name', v_role_name, 'signed_out', COALESCE(p_force_logout, false)));
  RETURN jsonb_build_object('removed', true, 'role_name', v_role_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_suspend(p_user_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text := NULLIF(trim(COALESCE(p_reason, '')), '');
  v_closed integer;
BEGIN
  PERFORM public._admin_control_guard(p_user_id, true);
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  IF public._admin_is_blocked(p_user_id) THEN
    RAISE EXCEPTION 'This account is already suspended';
  END IF;

  INSERT INTO public.admin_access_blocks (user_id, reason, blocked_by) VALUES (p_user_id, left(v_reason, 500), auth.uid());
  v_closed := public._admin_end_sessions(p_user_id);
  PERFORM public._admin_record('access', 'admin.suspended', p_user_id,
    jsonb_build_object('reason', left(v_reason, 500), 'sessions_closed', v_closed));
  RETURN jsonb_build_object('suspended', true, 'sessions_closed', v_closed);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unsuspend(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super Admin privileges required';
  END IF;
  UPDATE public.admin_access_blocks SET lifted_at = now(), lifted_by = auth.uid()
  WHERE user_id = p_user_id AND lifted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This account is not suspended';
  END IF;
  PERFORM public._admin_record('access', 'admin.unsuspended', p_user_id, '{}'::jsonb);
  RETURN jsonb_build_object('suspended', false);
END;
$$;

-- The per-session Logout button now really ends that login (it used to only flip a flag nothing checked).
CREATE OR REPLACE FUNCTION public.invalidate_session(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.admin_sessions%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RETURN false;
  END IF;

  SELECT * INTO v FROM public.admin_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.admin_sessions SET is_active = false WHERE id = p_session_id;
  IF v.auth_session_id IS NOT NULL THEN
    DELETE FROM auth.sessions WHERE id = v.auth_session_id AND user_id = v.user_id;
  END IF;

  INSERT INTO public.admin_activity (user_id, kind, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'access', 'admin.session_ended', 'user', v.user_id::text,
          jsonb_build_object('session_id', v.id, 'auth_session_ended', v.auth_session_id IS NOT NULL));
  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Retention and grants
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_activity_cleanup()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v integer;
BEGIN
  DELETE FROM public.admin_activity WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v = ROW_COUNT;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_activity_cleanup() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-admin-activity';
  PERFORM cron.schedule('cleanup-admin-activity', '15 3 * * *', 'SELECT public.admin_activity_cleanup()');
END $$;

REVOKE ALL ON FUNCTION public.admin_heartbeat(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_log_activity(text, text, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_access_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_team_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_activity_feed(integer, timestamptz, uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_force_logout(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_role(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_suspend(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_unsuspend(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_heartbeat(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_log_activity(text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_access_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_team_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activity_feed(integer, timestamptz, uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_logout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_role(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unsuspend(uuid) TO authenticated;
