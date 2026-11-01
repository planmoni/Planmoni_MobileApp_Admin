-- Run this once in the Supabase SQL editor of the project the admin app points to
-- (the one in VITE_SUPABASE_URL). Safe to re-run.
--
-- Powers the redesigned Transactions page:
--   admin_list_transactions   one page of transactions with the user, payout plan, destination bank
--                             account and failure reason already joined, plus per type / per status
--                             totals for the whole filtered period (Today, This week, ...)
--   admin_get_transaction     the same record for one transaction (details modal everywhere)
--
-- It replaces the page's use of get_all_transactions_data / get_transaction_stats. Those two are not
-- touched here, but get_all_transactions_data builds its SQL by concatenating the search text, so it
-- should be locked down or dropped (see the note after the migration in the chat).
--
-- Requires transactions.list (or Super Admin). Every value is a bound parameter.

-- Preflight: lists anything the functions read that is missing in this project.
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  t text;
  c text[];
BEGIN
  FOREACH t IN ARRAY ARRAY['transactions', 'profiles', 'payout_plans', 'automated_payouts', 'payout_accounts', 'bank_accounts', 'budget_plans'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      v_missing := array_append(v_missing, 'table public.' || t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY['is_super_admin', 'has_permission'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = t) THEN
      v_missing := array_append(v_missing, 'function ' || t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'transactions.id', 'transactions.type', 'transactions.status', 'transactions.amount', 'transactions.fees',
    'transactions.gateway_fee', 'transactions.source', 'transactions.destination', 'transactions.reference',
    'transactions.description', 'transactions.created_at', 'transactions.completed_at',
    'transactions.payment_gateway', 'transactions.payment_method', 'transactions.metadata',
    'transactions.user_id', 'transactions.payout_plan_id', 'transactions.bank_account_id',
    'profiles.first_name', 'profiles.last_name', 'profiles.email',
    'payout_plans.name', 'payout_plans.purpose', 'payout_plans.frequency', 'payout_plans.duration',
    'payout_plans.status', 'payout_plans.payout_amount', 'payout_plans.total_amount',
    'payout_plans.completed_payouts', 'payout_plans.payout_account_id', 'payout_plans.bank_account_id',
    'automated_payouts.installment_index', 'automated_payouts.error_message', 'automated_payouts.transfer_provider',
    'automated_payouts.payment_reference', 'automated_payouts.transfer_reference', 'automated_payouts.transfer_code',
    'automated_payouts.session_id', 'automated_payouts.scheduled_date', 'automated_payouts.transferred_at',
    'automated_payouts.payout_account_id',
    'payout_accounts.bank_name', 'payout_accounts.bank_code', 'payout_accounts.account_number', 'payout_accounts.account_name',
    'bank_accounts.bank_name', 'bank_accounts.bank_code', 'bank_accounts.account_number', 'bank_accounts.account_name',
    'budget_plans.name', 'budget_plans.plan_name', 'budget_plans.categories', 'budget_plans.subcategories'
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

  RAISE NOTICE 'preflight ok';
END $$;

CREATE OR REPLACE FUNCTION public._admin_tx_item(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', t.id,
    'type', t.type,
    'status', t.status,
    'amount', t.amount,
    'fee', COALESCE(NULLIF(t.fees, 0), NULLIF(t.gateway_fee, 0)),
    'source', t.source,
    'destination', t.destination,
    'reference', t.reference,
    'description', t.description,
    'created_at', t.created_at,
    'completed_at', t.completed_at,
    'payment_gateway', t.payment_gateway,
    'payment_method', t.payment_method,
    'channel', t.metadata->>'channel',
    'user', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', p.id, 'first_name', p.first_name, 'last_name', p.last_name, 'email', p.email) END,
    'plan', CASE WHEN pp.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', pp.id, 'name', pp.name, 'purpose', pp.purpose, 'frequency', pp.frequency,
      'duration', pp.duration, 'status', pp.status, 'payout_amount', pp.payout_amount,
      'total_amount', pp.total_amount, 'completed_payouts', pp.completed_payouts) END,
    'installment', CASE WHEN ap.installment_index IS NULL THEN NULL ELSE ap.installment_index + 1 END,
    'account', CASE
      WHEN pa.id IS NOT NULL THEN jsonb_build_object(
        'bank_name', pa.bank_name, 'bank_code', pa.bank_code,
        'account_number', pa.account_number, 'account_name', pa.account_name)
      WHEN ba.id IS NOT NULL THEN jsonb_build_object(
        'bank_name', ba.bank_name, 'bank_code', ba.bank_code,
        'account_number', ba.account_number, 'account_name', ba.account_name)
      WHEN t.metadata->'response'->'data'->>'creditAccountNumber' IS NOT NULL THEN jsonb_build_object(
        'bank_name', NULL, 'bank_code', NULL,
        'account_number', t.metadata->'response'->'data'->>'creditAccountNumber',
        'account_name', t.metadata->'response'->'data'->>'creditAccountName')
      ELSE NULL END,
    'error', CASE
      WHEN t.type IN ('payout', 'withdrawal') AND t.status <> 'completed' THEN
        COALESCE(NULLIF(ap.error_message, ''), NULLIF(t.metadata->>'retry_failure_reason', ''),
                 NULLIF(t.metadata->>'safehaven_response_message', ''), NULLIF(t.metadata->>'wallet_refund_reason', ''))
      ELSE NULL END,
    'provider', COALESCE(NULLIF(t.metadata->>'provider', ''), NULLIF(ap.transfer_provider, '')),
    'automated_payout_id', ap.id,
    'transfer', CASE WHEN ap.id IS NULL THEN NULL ELSE jsonb_build_object(
      'reference', COALESCE(ap.payment_reference, ap.transfer_reference),
      'code', COALESCE(ap.transfer_code, t.metadata->>'safehaven_transfer_code', t.metadata->>'transfer_code'),
      'session_id', COALESCE(ap.session_id, t.metadata->>'safehaven_transfer_session_id'),
      'scheduled_date', ap.scheduled_date,
      'transferred_at', ap.transferred_at) END,
    'manual', CASE WHEN t.metadata->>'completed_via' IS NULL AND t.metadata->>'manual_external_reference' IS NULL THEN NULL
      ELSE jsonb_build_object(
        'via', t.metadata->>'completed_via',
        'reference', t.metadata->>'manual_external_reference',
        'notes', t.metadata->>'manual_notes') END,
    'vault', CASE WHEN bp.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name', COALESCE(bp.name, bp.plan_name), 'categories', bp.categories, 'subcategories', bp.subcategories) END
  )
  FROM transactions t
  LEFT JOIN profiles p ON p.id = t.user_id
  LEFT JOIN payout_plans pp ON pp.id = t.payout_plan_id
  LEFT JOIN automated_payouts ap ON ap.id = CASE
    WHEN t.metadata->>'automated_payout_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (t.metadata->>'automated_payout_id')::uuid END
  LEFT JOIN payout_accounts pa ON pa.id = COALESCE(ap.payout_account_id, pp.payout_account_id)
  LEFT JOIN bank_accounts ba ON ba.id = COALESCE(pp.bank_account_id, t.bank_account_id)
  LEFT JOIN budget_plans bp ON bp.id = CASE
    WHEN t.metadata->>'plan_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (t.metadata->>'plan_id')::uuid END
  WHERE t.id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_transactions(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit  integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_type   text := NULLIF(btrim(COALESCE(p_type, '')), '');
  v_status text := NULLIF(btrim(COALESCE(p_status, '')), '');
  v_term   text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_q      text;
  v_rows   jsonb;
  v_facets jsonb;
  v_total  bigint;
BEGIN
  IF NOT (public.is_super_admin() OR public.has_permission('transactions.list')) THEN
    RAISE EXCEPTION 'Permission denied: you are not allowed to view transactions';
  END IF;

  IF v_type IN ('all') THEN v_type := NULL; END IF;
  IF v_status IN ('all') THEN v_status := NULL; END IF;

  -- LIKE pattern with the user's own % _ \ treated literally
  IF v_term IS NOT NULL THEN
    v_q := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH scope AS MATERIALIZED (
  SELECT t.id, t.type, t.status, t.amount, t.created_at
  FROM transactions t
  LEFT JOIN profiles p ON p.id = t.user_id
  LEFT JOIN payout_plans pp ON pp.id = t.payout_plan_id
  LEFT JOIN automated_payouts ap ON ap.id = CASE
    WHEN t.metadata->>'automated_payout_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (t.metadata->>'automated_payout_id')::uuid END
  LEFT JOIN payout_accounts pa ON pa.id = COALESCE(ap.payout_account_id, pp.payout_account_id)
  LEFT JOIN bank_accounts ba ON ba.id = COALESCE(pp.bank_account_id, t.bank_account_id)
  WHERE (p_from IS NULL OR t.created_at >= p_from)
    AND (p_to IS NULL OR t.created_at < p_to)
    AND (p_user_id IS NULL OR t.user_id = p_user_id)
    AND (
      v_q IS NULL
      OR (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) ILIKE v_q
      OR p.email ILIKE v_q
      OR t.reference ILIKE v_q
      OR pp.name ILIKE v_q
      OR COALESCE(pa.account_number, ba.account_number) ILIKE v_q
      OR COALESCE(pa.account_name, ba.account_name) ILIKE v_q
    )
  ),
  -- totals for the whole period/search, ignoring the type and status filters, so the page can show
  -- counts on every filter chip and the money summary for any combination
  facets AS (
    SELECT type, status, count(*) AS n, COALESCE(sum(amount), 0) AS amt
    FROM scope
    GROUP BY type, status
  ),
  picked AS (
    SELECT id, created_at
    FROM scope
    WHERE (v_type IS NULL OR type = v_type) AND (v_status IS NULL OR status = v_status)
  ),
  page AS (
    SELECT id, created_at FROM picked ORDER BY created_at DESC, id DESC LIMIT v_limit OFFSET v_offset
  )
  SELECT
    COALESCE((SELECT jsonb_agg(public._admin_tx_item(pg.id) ORDER BY pg.created_at DESC, pg.id DESC) FROM page pg), '[]'::jsonb),
    (SELECT count(*) FROM picked),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('type', f.type, 'status', f.status, 'count', f.n, 'amount', f.amt)) FROM facets f), '[]'::jsonb)
  INTO v_rows, v_total, v_facets;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total, 'facets', v_facets);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_transaction(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_super_admin() OR public.has_permission('transactions.details') OR public.has_permission('transactions.list')) THEN
    RAISE EXCEPTION 'Permission denied: you are not allowed to view transactions';
  END IF;
  RETURN public._admin_tx_item(p_transaction_id);
END;
$$;

REVOKE ALL ON FUNCTION public._admin_tx_item(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_transactions(timestamptz, timestamptz, text, text, text, uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_transaction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_transactions(timestamptz, timestamptz, text, text, text, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_transaction(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
