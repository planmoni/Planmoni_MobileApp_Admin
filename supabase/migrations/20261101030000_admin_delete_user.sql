-- Admin: permanently delete a user (profile, auth account and everything owned by them).
--
-- Rules (enforced here, not just in the UI):
--   * caller must be a Super Admin or hold the users.delete permission
--   * the user must NOT have: a live payout plan, a live vault or expense plan,
--     money in the wallet, money in flight (pending/processing payouts, withdrawals or
--     transactions), admin roles, or admin-authored content
--   * cannot delete yourself
--   * the admin must type the user's email as confirmation
--
-- admin_user_delete_check(user)  -> { can_delete, reasons[], email, name, counts{...} }
-- admin_delete_user(user, email) -> { deleted, email, ... }  (raises with the reasons if blocked)
--
-- Every deletion is written to audit_logs (action 'user.deleted') before the user goes.
-- Existing audit_logs rows about the deleted user are kept with user_id set to NULL.
-- wallet_ledger rows are kept (append-only financial ledger).

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
