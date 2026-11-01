-- Run this once in the Supabase SQL editor of the project the admin app points to
-- (the one in VITE_SUPABASE_URL). Safe to re-run.
--
-- Adds "Delete user" to the admin user profile:
--   admin_user_delete_check(user)  -> can this user be deleted, and if not, why
--   admin_delete_user(user, email) -> deletes the user and everything they own
--   + the users.delete permission (Super Admins always have it; grant it to other roles
--     from the roles/permissions screen)
--
-- A user can only be deleted when they have no active payout plan, vault or expense plan,
-- no money in the wallet or in flight, are not an admin, and the admin types their email.
-- Transactions, plans, KYC data and wallet are removed; audit_logs (user.deleted) and the
-- append-only wallet_ledger are kept.
--
-- Uploaded files (storage) are removed by the admin app after the delete succeeds.

-- Preflight: lists anything the functions read that is missing in this project.
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  t text;
  c text[];
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'permissions', 'user_roles', 'role_permissions', 'audit_logs',
    'wallets', 'payout_plans', 'budget_plans', 'expense_plans', 'transactions',
    'automated_payouts', 'emergency_withdrawals', 'events',
    'safehaven_accounts', 'safehaven_deposit_webhooks', 'safehaven_user_accounts',
    'kyc_audit_logs', 'campaign_recipients', 'payout_plan_schedule_dates',
    'campaign_segments', 'marketing_campaigns', 'partner_api_keys',
    'sender_email_addresses', 'blog_authors', 'blog_categories'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      v_missing := array_append(v_missing, 'table public.' || t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY['is_super_admin', 'has_permission'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = t) THEN
      v_missing := array_append(v_missing, 'function ' || t);
    END IF;
  END LOOP;

  -- table.column pairs the functions touch
  FOREACH t IN ARRAY ARRAY[
    'profiles.is_admin', 'profiles.referred_by', 'permissions.category_id',
    'wallets.available_balance', 'wallets.locked_balance', 'wallets.balance',
    'events.payout_plan_id', 'events.transaction_id', 'events.user_id',
    'kyc_audit_logs.previous_log_id', 'safehaven_deposit_webhooks.user_account_id',
    'campaign_segments.created_by', 'marketing_campaigns.created_by', 'partner_api_keys.created_by',
    'sender_email_addresses.created_by', 'role_permissions.granted_by', 'user_roles.assigned_by',
    'blog_authors.created_by', 'blog_categories.created_by'
  ] LOOP
    c := string_to_array(t, '.');
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = c[1] AND column_name = c[2]
    ) THEN
      v_missing := array_append(v_missing, 'column ' || t);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Missing dependencies in this project: %', array_to_string(v_missing, ', ');
  END IF;
END $$;

-- Permission so the right can be granted from the Super Admin screen
INSERT INTO public.permissions (name, resource, action, description, is_system, category_id)
SELECT 'users.delete', 'users', 'delete',
       'Permanently delete a user account (only users with no live plans, vaults or balance)',
       true,
       (SELECT category_id FROM public.permissions WHERE name = 'users.details' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'users.delete');

CREATE OR REPLACE FUNCTION public.admin_user_delete_check(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
  v_reasons text[] := ARRAY[]::text[];
  v_live_plans int;
  v_live_vaults int;
  v_live_expense int;
  v_available numeric;
  v_locked numeric;
  v_payouts_in_flight int;
  v_withdrawals_pending int;
  v_tx_pending int;
  v_roles int;
  v_admin_content int;
  v_plans_total int;
  v_transactions int;
BEGIN
  IF NOT (public.is_super_admin() OR public.has_permission('users.delete')) THEN
    RAISE EXCEPTION 'Permission denied: you are not allowed to delete users';
  END IF;

  SELECT id, email, first_name, last_name, is_admin
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT count(*) INTO v_live_plans
  FROM public.payout_plans
  WHERE user_id = p_user_id AND status NOT IN ('completed', 'cancelled');

  SELECT count(*) INTO v_live_vaults
  FROM public.budget_plans
  WHERE user_id = p_user_id AND status NOT IN ('completed', 'cancelled');

  SELECT count(*) INTO v_live_expense
  FROM public.expense_plans
  WHERE user_id = p_user_id AND status NOT IN ('completed', 'cancelled');

  SELECT COALESCE(sum(GREATEST(COALESCE(available_balance, 0), COALESCE(balance, 0))), 0),
         COALESCE(sum(COALESCE(locked_balance, 0)), 0)
  INTO v_available, v_locked
  FROM public.wallets
  WHERE user_id = p_user_id;

  SELECT count(*) INTO v_payouts_in_flight
  FROM public.automated_payouts
  WHERE user_id = p_user_id AND status IN ('pending', 'processing');

  SELECT count(*) INTO v_withdrawals_pending
  FROM public.emergency_withdrawals
  WHERE user_id = p_user_id AND status = 'pending';

  SELECT count(*) INTO v_tx_pending
  FROM public.transactions
  WHERE user_id = p_user_id AND status = 'pending';

  SELECT count(*) INTO v_roles FROM public.user_roles WHERE user_id = p_user_id;

  SELECT (SELECT count(*) FROM public.campaign_segments WHERE created_by = p_user_id)
       + (SELECT count(*) FROM public.marketing_campaigns WHERE created_by = p_user_id)
       + (SELECT count(*) FROM public.partner_api_keys WHERE created_by = p_user_id)
       + (SELECT count(*) FROM public.sender_email_addresses WHERE created_by = p_user_id)
       + (SELECT count(*) FROM public.role_permissions WHERE granted_by = p_user_id)
       + (SELECT count(*) FROM public.user_roles WHERE assigned_by = p_user_id)
       + (SELECT count(*) FROM public.blog_authors WHERE created_by = p_user_id)
       + (SELECT count(*) FROM public.blog_categories WHERE created_by = p_user_id)
  INTO v_admin_content;

  SELECT count(*) INTO v_plans_total FROM public.payout_plans WHERE user_id = p_user_id;
  SELECT count(*) INTO v_transactions FROM public.transactions WHERE user_id = p_user_id;

  IF p_user_id = auth.uid() THEN
    v_reasons := array_append(v_reasons, 'You cannot delete your own account');
  END IF;
  IF COALESCE(v_profile.is_admin, false) OR v_roles > 0 THEN
    v_reasons := array_append(v_reasons, 'This is an administrator account. Remove its admin access first');
  END IF;
  IF v_live_plans > 0 THEN
    v_reasons := array_append(v_reasons, v_live_plans || ' active payout plan' || CASE WHEN v_live_plans = 1 THEN '' ELSE 's' END);
  END IF;
  IF v_live_vaults > 0 THEN
    v_reasons := array_append(v_reasons, v_live_vaults || ' active vault' || CASE WHEN v_live_vaults = 1 THEN '' ELSE 's' END);
  END IF;
  IF v_live_expense > 0 THEN
    v_reasons := array_append(v_reasons, v_live_expense || ' active expense plan' || CASE WHEN v_live_expense = 1 THEN '' ELSE 's' END);
  END IF;
  IF v_available > 0 OR v_locked > 0 THEN
    v_reasons := array_append(v_reasons, 'Wallet still holds money (available ' || v_available || ', locked ' || v_locked || ')');
  END IF;
  IF v_payouts_in_flight > 0 THEN
    v_reasons := array_append(v_reasons, v_payouts_in_flight || ' payout' || CASE WHEN v_payouts_in_flight = 1 THEN '' ELSE 's' END || ' in progress');
  END IF;
  IF v_withdrawals_pending > 0 THEN
    v_reasons := array_append(v_reasons, v_withdrawals_pending || ' pending emergency withdrawal' || CASE WHEN v_withdrawals_pending = 1 THEN '' ELSE 's' END);
  END IF;
  IF v_tx_pending > 0 THEN
    v_reasons := array_append(v_reasons, v_tx_pending || ' pending transaction' || CASE WHEN v_tx_pending = 1 THEN '' ELSE 's' END);
  END IF;
  IF v_admin_content > 0 THEN
    v_reasons := array_append(v_reasons, 'Created admin content (campaigns, roles, API keys or blog entries)');
  END IF;

  RETURN jsonb_build_object(
    'can_delete', array_length(v_reasons, 1) IS NULL,
    'reasons', to_jsonb(v_reasons),
    'email', v_profile.email,
    'name', NULLIF(btrim(COALESCE(v_profile.first_name, '') || ' ' || COALESCE(v_profile.last_name, '')), ''),
    'counts', jsonb_build_object(
      'live_plans', v_live_plans,
      'live_vaults', v_live_vaults,
      'live_expense_plans', v_live_expense,
      'available_balance', v_available,
      'locked_balance', v_locked,
      'plans_total', v_plans_total,
      'transactions', v_transactions
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid, p_confirm_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check jsonb;
  v_email text;
BEGIN
  -- permission + eligibility (raises if the caller is not allowed)
  v_check := public.admin_user_delete_check(p_user_id);

  IF NOT (v_check->>'can_delete')::boolean THEN
    RAISE EXCEPTION 'Cannot delete user: %',
      (SELECT string_agg(r, '; ') FROM jsonb_array_elements_text(v_check->'reasons') r);
  END IF;

  v_email := v_check->>'email';
  IF v_email IS NULL OR lower(btrim(COALESCE(p_confirm_email, ''))) <> lower(btrim(v_email)) THEN
    RAISE EXCEPTION 'Confirmation email does not match';
  END IF;

  -- one deletion per user at a time
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 9918));

  -- audit first, so the record exists even though the user does not
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (
    auth.uid(),
    'user.deleted',
    'profiles',
    p_user_id::text,
    jsonb_build_object('email', v_email, 'name', v_check->'name', 'counts', v_check->'counts'),
    jsonb_build_object('deleted_by', auth.uid(), 'deleted_at', now())
  );

  -- 1. rows that would block the delete, or that live outside the cascade
  DELETE FROM public.events
  WHERE user_id = p_user_id
     OR payout_plan_id IN (SELECT id FROM public.payout_plans WHERE user_id = p_user_id)
     OR transaction_id IN (SELECT id FROM public.transactions WHERE user_id = p_user_id);

  DELETE FROM public.safehaven_deposit_webhooks
  WHERE user_account_id IN (SELECT id FROM public.safehaven_accounts WHERE user_id = p_user_id);

  DELETE FROM public.safehaven_user_accounts WHERE user_id = p_user_id;

  UPDATE public.kyc_audit_logs
  SET previous_log_id = NULL
  WHERE previous_log_id IN (SELECT id FROM public.kyc_audit_logs WHERE user_id = p_user_id);

  DELETE FROM public.campaign_recipients WHERE user_id = p_user_id;
  -- NOTE: public.wallet_ledger is an append-only financial ledger (its DELETE/UPDATE rules
  -- are DO INSTEAD NOTHING) and has no FK, so those rows are intentionally kept.
  DELETE FROM public.payout_plan_schedule_dates WHERE user_id = p_user_id;

  UPDATE public.profiles SET referred_by = NULL WHERE referred_by = p_user_id;

  -- keep the history, drop the link to the deleted user
  UPDATE public.audit_logs SET user_id = NULL WHERE user_id = p_user_id;

  -- 2. the auth account; profiles and everything else owned by the user cascades
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('deleted', true, 'user_id', p_user_id, 'email', v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_delete_check(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_delete_check(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
