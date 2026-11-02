/*
  Super Admin user search.

  The Super Admin page loaded `profiles` with a plain select, which PostgREST caps at 1,000 rows (there are 10,000+ users),
  and then called get_user_roles() once per row. Search only ever saw the newest 1,000 users, so most users could not be found
  or given a role.

  admin_search_users searches all profiles on the server (name, "first last", email), returns each user with their active roles
  in one call, and is Super Admin only. With no query it returns the staff list (admins and anyone holding an active role).
*/
CREATE OR REPLACE FUNCTION public.admin_search_users(
  p_query text DEFAULT NULL,
  p_only_staff boolean DEFAULT false,
  p_limit integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := NULLIF(trim(COALESCE(p_query, '')), '');
  v_pattern text;
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50);
  v_total bigint;
  v_users jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super Admin privileges required';
  END IF;

  IF v_q IS NOT NULL THEN
    -- literal match: escape LIKE wildcards typed by the admin
    v_pattern := '%' || replace(replace(replace(lower(v_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH matched AS (
    SELECT p.id, p.first_name, p.last_name, p.email, p.is_admin, p.created_at
    FROM public.profiles p
    WHERE (
        v_q IS NULL
        OR lower(COALESCE(p.first_name, '')) LIKE v_pattern
        OR lower(COALESCE(p.last_name, '')) LIKE v_pattern
        OR lower(COALESCE(p.email, '')) LIKE v_pattern
        OR lower(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))) LIKE v_pattern
      )
      AND (
        NOT (p_only_staff OR v_q IS NULL)
        OR COALESCE(p.is_admin, false)
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.is_active)
      )
  ),
  counted AS (SELECT count(*) AS n FROM matched),
  page AS (
    SELECT * FROM matched ORDER BY created_at DESC LIMIT v_limit
  )
  SELECT (SELECT n FROM counted),
         COALESCE(jsonb_agg(
           jsonb_build_object(
             'id', g.id,
             'first_name', g.first_name,
             'last_name', g.last_name,
             'email', g.email,
             'is_admin', COALESCE(g.is_admin, false),
             'created_at', g.created_at,
             'roles', COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                        'role_id', r.id, 'role_name', r.name, 'role_color', r.color,
                        'role_description', r.description, 'role_level', r.level)
                      ORDER BY r.level DESC)
               FROM public.user_roles ur
               JOIN public.roles r ON r.id = ur.role_id
               WHERE ur.user_id = g.id AND ur.is_active
             ), '[]'::jsonb)
           ) ORDER BY g.created_at DESC), '[]'::jsonb)
  INTO v_total, v_users
  FROM page g;

  RETURN jsonb_build_object('users', v_users, 'total', COALESCE(v_total, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_users(text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_users(text, boolean, integer) TO authenticated, service_role;
