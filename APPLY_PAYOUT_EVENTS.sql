-- Run this once in the Supabase SQL editor of the project the admin app points to
-- (the one in VITE_SUPABASE_URL). Safe to re-run.
--
-- RUN APPLY_PAYOUT_CONTROLS.sql FIRST: the Retry / Mark completed / Refund controls on this page use its
-- _admin_payout_state() and _admin_payout_assert() functions.
--
-- Powers the redesigned Payout Events page and the dashboard's "Today's Payout Events":
--   admin_list_payout_events   one page of payout events (installments of payout plans) with the user, plan,
--                              destination bank account, provider reference, failure reason and the
--                              manual / refund trail already joined, plus counts and amounts per status for
--                              the whole filtered period, and a "needs attention" state for events that are
--                              stuck or failed with money still held.
--   admin_payout_event_state   what an admin may do with one event (retry / mark completed / refund). Needs
--                              payout_plans.manage, like the same controls on a user's profile.
--
-- Requires payout_events.list (or Super Admin). Holders of only dashboard.lists.todays_payout_events get a
-- limited peek (last 24 hours, 10 rows) for the dashboard card. Every value is a bound parameter.

-- Preflight: lists anything the functions read that is missing in this project.
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  t text;
  c text[];
BEGIN
  FOREACH t IN ARRAY ARRAY['automated_payouts', 'profiles', 'payout_plans', 'payout_accounts', 'bank_accounts', 'transactions'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      v_missing := array_append(v_missing, 'table public.' || t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY['is_super_admin', 'has_permission', '_admin_payout_assert', '_admin_payout_state'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = t) THEN
      v_missing := array_append(v_missing, 'function ' || t || CASE WHEN t LIKE '\_admin\_payout%' THEN ' (run APPLY_PAYOUT_CONTROLS.sql first)' ELSE '' END);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'automated_payouts.id', 'automated_payouts.user_id', 'automated_payouts.payout_plan_id', 'automated_payouts.status',
    'automated_payouts.amount', 'automated_payouts.scheduled_date', 'automated_payouts.installment_index',
    'automated_payouts.created_at', 'automated_payouts.updated_at', 'automated_payouts.transferred_at',
    'automated_payouts.completed_at', 'automated_payouts.execution_date', 'automated_payouts.retry_count',
    'automated_payouts.retry_after', 'automated_payouts.error_message', 'automated_payouts.transfer_provider',
    'automated_payouts.payment_reference', 'automated_payouts.transfer_reference', 'automated_payouts.transfer_code',
    'automated_payouts.session_id', 'automated_payouts.payout_account_id', 'automated_payouts.metadata',
    'profiles.first_name', 'profiles.last_name', 'profiles.email',
    'payout_plans.name', 'payout_plans.purpose', 'payout_plans.frequency', 'payout_plans.duration',
    'payout_plans.status', 'payout_plans.payout_amount', 'payout_plans.total_amount',
    'payout_plans.completed_payouts', 'payout_plans.payout_account_id', 'payout_plans.bank_account_id',
    'payout_accounts.bank_name', 'payout_accounts.bank_code', 'payout_accounts.account_number', 'payout_accounts.account_name',
    'bank_accounts.bank_name', 'bank_accounts.bank_code', 'bank_accounts.account_number', 'bank_accounts.account_name',
    'transactions.id', 'transactions.type', 'transactions.status', 'transactions.created_at', 'transactions.metadata'
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

CREATE OR REPLACE FUNCTION public.admin_list_payout_events(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
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
  v_status text := NULLIF(btrim(COALESCE(p_status, '')), '');
  v_term   text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_q      text;
  v_rows   jsonb;
  v_facets jsonb;
  v_total  bigint;
  v_full   boolean := public.is_super_admin() OR public.has_permission('payout_events.list');
BEGIN
  IF NOT v_full THEN
    -- the dashboard's "Today's Payout Events" card: a short, recent, unfiltered peek
    IF NOT public.has_permission('dashboard.lists.todays_payout_events') THEN
      RAISE EXCEPTION 'Permission denied: you are not allowed to view payout events';
    END IF;
    p_from := GREATEST(COALESCE(p_from, now() - interval '1 day'), now() - interval '1 day');
    p_user_id := NULL;
    v_term := NULL;
    v_limit := LEAST(v_limit, 10);
    v_offset := 0;
  END IF;

  IF v_status = 'all' THEN v_status := NULL; END IF;

  -- LIKE pattern with the user's own % _ \ treated literally
  IF v_term IS NOT NULL THEN
    v_q := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH scope AS MATERIALIZED (
    SELECT
      ap.id,
      ap.created_at,
      ap.amount,
      CASE WHEN ap.status IN ('pending', 'processing', 'retrying') THEN 'in_progress' ELSE ap.status END AS grp,
      -- same rules as _admin_payout_state: completed | in_flight | stuck | failed_held | failed
      CASE
        WHEN ap.status = 'completed' THEN 'completed'
        WHEN ap.status IN ('pending', 'processing', 'retrying') AND ap.updated_at > now() - interval '30 minutes' THEN 'in_flight'
        WHEN ap.status IN ('pending', 'processing', 'retrying') THEN 'stuck'
        WHEN ap.status = 'failed' AND (
               (COALESCE(ap.metadata->>'wallet_debited', 'false') = 'true'
                  AND COALESCE(ap.metadata->>'wallet_refund_applied', 'false') <> 'true')
            OR (COALESCE(ap.metadata->>'safehaven_transfer_initiated', 'false') = 'true'
                  AND COALESCE(ap.metadata->>'wallet_refund_applied', 'false') <> 'true')
            OR COALESCE(ap.metadata->>'manual_hold', 'false') = 'true') THEN 'failed_held'
        ELSE 'failed'
      END AS state
    FROM automated_payouts ap
    LEFT JOIN profiles p ON p.id = ap.user_id
    LEFT JOIN payout_plans pp ON pp.id = ap.payout_plan_id
    LEFT JOIN payout_accounts pa ON pa.id = COALESCE(ap.payout_account_id, pp.payout_account_id)
    LEFT JOIN bank_accounts ba ON ba.id = pp.bank_account_id
    WHERE (p_from IS NULL OR ap.created_at >= p_from)
      AND (p_to IS NULL OR ap.created_at < p_to)
      AND (p_user_id IS NULL OR ap.user_id = p_user_id)
      AND (
        v_q IS NULL
        OR (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) ILIKE v_q
        OR p.email ILIKE v_q
        OR pp.name ILIKE v_q
        OR ap.transfer_reference ILIKE v_q
        OR ap.payment_reference ILIKE v_q
        OR ap.amount::text ILIKE v_q
        OR COALESCE(pa.account_number, ba.account_number) ILIKE v_q
        OR COALESCE(pa.account_name, ba.account_name) ILIKE v_q
      )
  ),
  -- totals for the whole period and search, ignoring the status filter, so every chip can show a count
  facets AS (
    SELECT grp, state, count(*) AS n, COALESCE(sum(amount), 0) AS amt FROM scope GROUP BY grp, state
  ),
  picked AS (
    SELECT id, created_at FROM scope
    WHERE v_status IS NULL
       OR (v_status = 'attention' AND state IN ('stuck', 'failed_held'))
       OR (v_status <> 'attention' AND grp = v_status)
  ),
  page AS (
    SELECT id, created_at FROM picked ORDER BY created_at DESC, id DESC LIMIT v_limit OFFSET v_offset
  ),
  -- the payout transaction of each event on this page (one scan, not one per row)
  txs AS (
    SELECT DISTINCT ON (t.metadata->>'automated_payout_id')
           t.metadata->>'automated_payout_id' AS ap_id, t.id, t.status
    FROM transactions t
    WHERE t.type = 'payout'
      AND t.metadata->>'automated_payout_id' IN (SELECT id::text FROM page)
    ORDER BY t.metadata->>'automated_payout_id', t.created_at DESC
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ap.id,
          'status', ap.status,
          'state', sc.state,
          'amount', ap.amount,
          'scheduled_date', ap.scheduled_date,
          'installment', ap.installment_index + 1,
          'created_at', ap.created_at,
          'executed_at', COALESCE(ap.transferred_at, ap.completed_at, ap.execution_date),
          'retry_count', ap.retry_count,
          'retry_after', ap.retry_after,
          'error', NULLIF(ap.error_message, ''),
          'provider', COALESCE(NULLIF(ap.transfer_provider, ''), NULLIF(ap.metadata->>'provider', '')),
          'reference', COALESCE(ap.payment_reference, ap.transfer_reference),
          'transfer_code', ap.transfer_code,
          'session_id', ap.session_id,
          'transaction_id', tx.id,
          'transaction_status', tx.status,
          'user', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', p.id, 'first_name', p.first_name, 'last_name', p.last_name, 'email', p.email) END,
          'plan', CASE WHEN pp.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', pp.id, 'name', pp.name, 'purpose', pp.purpose, 'frequency', pp.frequency,
            'duration', pp.duration, 'status', pp.status, 'payout_amount', pp.payout_amount,
            'total_amount', pp.total_amount, 'completed_payouts', pp.completed_payouts) END,
          'account', CASE WHEN COALESCE(pa.id, ba.id) IS NULL THEN NULL ELSE jsonb_build_object(
            'bank_name', COALESCE(pa.bank_name, ba.bank_name),
            'bank_code', COALESCE(pa.bank_code, ba.bank_code),
            'account_number', COALESCE(pa.account_number, ba.account_number),
            'account_name', COALESCE(pa.account_name, ba.account_name)) END,
          'meta', jsonb_strip_nulls(jsonb_build_object(
            'wallet_debited', ap.metadata->'wallet_debited',
            'wallet_debited_at', ap.metadata->'wallet_debited_at',
            'wallet_refund_applied', ap.metadata->'wallet_refund_applied',
            'wallet_refunded_at', ap.metadata->'wallet_refunded_at',
            'wallet_refund_reason', ap.metadata->'wallet_refund_reason',
            'manual_hold', ap.metadata->'manual_hold',
            'completed_via', ap.metadata->'completed_via',
            'manual_notes', ap.metadata->'manual_notes',
            'manual_external_reference', ap.metadata->'manual_external_reference',
            'manual_payment_at', ap.metadata->'manual_payment_at',
            'ops_unblock_reason', ap.metadata->'ops_unblock_reason',
            'ops_unblocked_at', ap.metadata->'ops_unblocked_at'))
        ) ORDER BY pg.created_at DESC, pg.id DESC)
      FROM page pg
      JOIN automated_payouts ap ON ap.id = pg.id
      JOIN scope sc ON sc.id = pg.id
      LEFT JOIN profiles p ON p.id = ap.user_id
      LEFT JOIN payout_plans pp ON pp.id = ap.payout_plan_id
      LEFT JOIN payout_accounts pa ON pa.id = COALESCE(ap.payout_account_id, pp.payout_account_id)
      LEFT JOIN bank_accounts ba ON ba.id = pp.bank_account_id
      LEFT JOIN txs tx ON tx.ap_id = ap.id::text
    ), '[]'::jsonb),
    (SELECT count(*) FROM picked),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'status', f.grp, 'state', f.state, 'count', f.n, 'amount', f.amt)) FROM facets f), '[]'::jsonb)
  INTO v_rows, v_total, v_facets;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total, 'facets', v_facets);
END;
$$;

-- What can be done with one payout event, and why not. Same answer the user profile gets.
CREATE OR REPLACE FUNCTION public.admin_payout_event_state(p_automated_payout_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._admin_payout_assert();
  RETURN public._admin_payout_state(p_automated_payout_id, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_payout_events(timestamptz, timestamptz, text, text, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_payout_events(timestamptz, timestamptz, text, text, uuid, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_payout_event_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_payout_event_state(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
