-- Admin two-factor authentication (Google Authenticator / any TOTP app) on Supabase Auth MFA.
--
-- The authenticator itself is Supabase's built-in MFA (auth.mfa_factors). This migration adds the
-- parts Supabase does not give us:
--
--   * Server-side enforcement for money actions. When "require_mfa_for_money" is on, every payout
--     control and "Process Due Payouts" call is refused unless the caller's session is aal2
--     (signed in with password AND an authenticator code). This is checked from the JWT, so it
--     cannot be bypassed by calling the API directly. Admin RPCs and the admin-process-payouts
--     edge function only; the consumer app shares this project, so nothing here touches RLS.
--
--   * Super Admin reset for a lost phone: admin_reset_user_2fa removes the admin's authenticator
--     and signs them out everywhere. At next sign-in they are forced to set up a new one.
--
--   * admin_2fa_overview: who has 2FA and the enforcement switch, for the Super Admin screen.
--
-- Enforcement ships OFF so deploying this cannot lock anyone out before the new sign-in screens
-- are live. A Super Admin turns it on from Super Admin > Security once admins are enrolled
-- (admin_set_mfa_enforcement refuses unless the Super Admin is themselves signed in with 2FA).
--
-- EMERGENCY OFF SWITCH (SQL editor):
--   UPDATE public.admin_security_settings SET require_mfa_for_money = false;
-- EMERGENCY RESET of a locked-out admin (SQL editor):
--   DELETE FROM auth.mfa_factors WHERE user_id = '<admin uuid>';

CREATE TABLE IF NOT EXISTS public.admin_security_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  require_mfa_for_money boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.admin_security_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.admin_security_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_security_settings FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- internal helpers (not callable from the API)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._admin_mfa_assert()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE((SELECT s.require_mfa_for_money FROM public.admin_security_settings s WHERE s.id), false)
     AND COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'Two-factor verification required: sign in again and enter the code from your authenticator app';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._admin_mfa_assert() FROM PUBLIC, anon, authenticated;

-- Payout controls (pause / resume / cancel / complete / refund / retry) all start here.
CREATE OR REPLACE FUNCTION public._admin_payout_assert()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_super_admin() OR public.has_permission('payout_plans.manage')) THEN
    RAISE EXCEPTION 'Permission denied: you are not allowed to manage payouts';
  END IF;
  PERFORM public._admin_mfa_assert();
END;
$$;
REVOKE ALL ON FUNCTION public._admin_payout_assert() FROM PUBLIC, anon, authenticated;

-- Process Due Payouts (list, inspect, begin) starts here.
CREATE OR REPLACE FUNCTION public._admin_process_assert()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_super_admin() OR public.has_permission('payouts.process')) THEN
    RAISE EXCEPTION 'Permission denied: you are not allowed to process payouts';
  END IF;
  PERFORM public._admin_mfa_assert();
END;
$$;
REVOKE ALL ON FUNCTION public._admin_process_assert() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Super Admin: overview, enforcement switch, reset
-- ---------------------------------------------------------------------------------------------

-- { require_mfa_for_money, caller_has_2fa, caller_aal, admins: [{ user_id, name, email, enrolled, enrolled_at }] }
CREATE OR REPLACE FUNCTION public.admin_2fa_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admins jsonb;
  v_caller boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied: only a Super Admin can view 2FA status';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.enrolled, t.name), '[]'::jsonb) INTO v_admins
  FROM (
    SELECT
      p.id AS user_id,
      NULLIF(btrim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '') AS name,
      p.email,
      EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = p.id AND f.status = 'verified') AS enrolled,
      (SELECT min(f.created_at) FROM auth.mfa_factors f WHERE f.user_id = p.id AND f.status = 'verified') AS enrolled_at
    FROM public.profiles p
    WHERE COALESCE(p.is_admin, false)
       OR EXISTS (
         SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = p.id AND ur.is_active
           AND (ur.expires_at IS NULL OR ur.expires_at > now())
       )
  ) t;

  SELECT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified') INTO v_caller;

  RETURN jsonb_build_object(
    'require_mfa_for_money', COALESCE((SELECT s.require_mfa_for_money FROM public.admin_security_settings s WHERE s.id), false),
    'caller_has_2fa', v_caller,
    'caller_aal', COALESCE(auth.jwt() ->> 'aal', 'aal1'),
    'admins', v_admins
  );
END;
$$;

-- Turn server-side enforcement on/off. Turning it ON needs the caller to be signed in with 2FA
-- themselves, so a Super Admin cannot lock themselves out by flipping it from a password-only session.
CREATE OR REPLACE FUNCTION public.admin_set_mfa_enforcement(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied: only a Super Admin can change this';
  END IF;
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'p_enabled is required';
  END IF;
  IF p_enabled AND COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'Two-factor verification required: sign in with your authenticator code before turning this on';
  END IF;

  SELECT s.require_mfa_for_money INTO v_old FROM public.admin_security_settings s WHERE s.id FOR UPDATE;

  UPDATE public.admin_security_settings
     SET require_mfa_for_money = p_enabled, updated_at = now(), updated_by = auth.uid()
   WHERE id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (auth.uid(), 'admin_2fa.enforcement_changed', 'admin_2fa', 'require_mfa_for_money',
          jsonb_build_object('require_mfa_for_money', v_old),
          jsonb_build_object('require_mfa_for_money', p_enabled, 'admin_id', auth.uid(), 'at', now()));

  RETURN jsonb_build_object('require_mfa_for_money', p_enabled);
END;
$$;

-- Lost phone: remove another admin's authenticator and sign them out everywhere.
-- At next sign-in they are forced to set up a new one.
CREATE OR REPLACE FUNCTION public.admin_reset_user_2fa(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_factors int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied: only a Super Admin can reset 2FA';
  END IF;
  PERFORM public._admin_mfa_assert();

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot reset your own 2FA here. Use "Set up a new device" instead, or ask another Super Admin.';
  END IF;

  SELECT p.email INTO v_email FROM public.profiles p WHERE p.id = p_user_id;
  IF v_email IS NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  DELETE FROM auth.mfa_factors WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_factors = ROW_COUNT;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (auth.uid(), 'admin_2fa.reset', 'admin_2fa', p_user_id::text,
          jsonb_build_object('factors_removed', v_factors),
          jsonb_build_object('target_email', v_email, 'admin_id', auth.uid(), 'at', now()));

  RETURN jsonb_build_object('reset', true, 'factors_removed', v_factors, 'email', v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_2fa_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_mfa_enforcement(boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reset_user_2fa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_2fa_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_mfa_enforcement(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_2fa(uuid) TO authenticated;
