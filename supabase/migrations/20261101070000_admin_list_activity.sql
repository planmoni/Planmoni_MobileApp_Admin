-- Admin Activity page
--
-- The page used to show audit_logs (admin actions, 3 rows) and the `events` table, which is 90% repeated
-- "disbursement_failed" retries and "payout_scheduled" notices. Real user activity lives in many tables.
--
-- admin_list_activity builds ONE timeline from the real sources:
--   account : signup, login, account_deletion_requested, statement_requested, wallet_created, bank_account_added
--   kyc     : kyc_started, kyc_submitted, kyc_document_uploaded, kyc_bvn_verified, kyc_nin_verified,
--             kyc_liveness_passed, kyc_liveness_failed, kyc_verified
--   plans   : payout_plan_created, vault_created, vault_topup
--   money   : deposit, payout, emergency_withdrawal
--   admin   : admin_action (audit_logs), post_no_debit
-- and returns one page of it, plus counts per category/kind for the whole period so the page can put a
-- number on every filter. Requires activity.view (Super Admins always pass). Holders of only
-- dashboard.lists.todays_activities get a limited peek (last 24 hours, 10 rows) for the dashboard card.
-- All values are bound parameters.

CREATE OR REPLACE FUNCTION public.admin_list_activity(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_kind text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit    integer := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
  v_offset   integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_category text := NULLIF(btrim(COALESCE(p_category, '')), '');
  v_kind     text := NULLIF(btrim(COALESCE(p_kind, '')), '');
  v_term     text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_q        text;
  v_rows     jsonb;
  v_facets   jsonb;
  v_total    bigint;
  v_full     boolean := public.is_super_admin() OR public.has_permission('activity.view');
BEGIN
  IF NOT v_full THEN
    -- Whoever may see the dashboard's "Today's Activities" card gets a short peek only: the last 24 hours,
    -- at most 10 rows, no search and no single-user view. The full timeline needs activity.view.
    IF NOT public.has_permission('dashboard.lists.todays_activities') THEN
      RAISE EXCEPTION 'Permission denied: you are not allowed to view activity';
    END IF;
    p_from := GREATEST(COALESCE(p_from, now() - interval '1 day'), now() - interval '1 day');
    p_user_id := NULL;
    v_term := NULL;
    v_limit := LEAST(v_limit, 10);
    v_offset := 0;
  END IF;

  IF v_category = 'all' THEN v_category := NULL; END IF;
  IF v_kind = 'all' THEN v_kind := NULL; END IF;

  -- LIKE pattern with the user's own % _ \ treated literally
  IF v_term IS NOT NULL THEN
    v_q := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH feed AS MATERIALIZED (
    -- ---------------------------------------------------------------- account
    SELECT 'signup:' || p.id AS id, 'signup' AS kind, 'account' AS category, p.created_at AS at,
           p.id AS user_id, NULL::uuid AS actor_id,
           jsonb_build_object('referred', p.referred_by IS NOT NULL, 'email_verified', p.email_verified) AS details,
           '' AS s
    FROM profiles p
    WHERE (p_from IS NULL OR p.created_at >= p_from) AND (p_to IS NULL OR p.created_at < p_to)

    UNION ALL
    SELECT 'login:' || ls.id, 'login', 'account', COALESCE(ls.login_timestamp, ls.created_at), ls.user_id, NULL::uuid,
           jsonb_build_object(
             'device', COALESCE(NULLIF(ls.device_model, ''), NULLIF(ls.device_type, '')),
             'os', ls.os_name, 'browser', ls.browser_name, 'city', ls.city, 'region', ls.region,
             'country', ls.country, 'ip', ls.ip_address, 'suspicious', COALESCE(ls.is_suspicious, false)),
           concat_ws(' ', ls.city, ls.country, ls.ip_address, ls.device_model)
    FROM login_sessions ls
    WHERE (p_from IS NULL OR COALESCE(ls.login_timestamp, ls.created_at) >= p_from)
      AND (p_to IS NULL OR COALESCE(ls.login_timestamp, ls.created_at) < p_to)

    UNION ALL
    SELECT 'deletion:' || d.id, 'account_deletion_requested', 'account', COALESCE(d.requested_at, d.created_at), d.user_id, NULL::uuid,
           jsonb_build_object('status', d.status, 'scheduled_for', d.scheduled_for, 'cancelled_at', d.cancelled_at),
           ''
    FROM account_deletion_requests d
    WHERE (p_from IS NULL OR COALESCE(d.requested_at, d.created_at) >= p_from)
      AND (p_to IS NULL OR COALESCE(d.requested_at, d.created_at) < p_to)

    UNION ALL
    SELECT 'statement:' || sr.id, 'statement_requested', 'account', sr.created_at, sr.user_id, NULL::uuid,
           jsonb_build_object('start_date', sr.start_date, 'end_date', sr.end_date, 'status', sr.status),
           ''
    FROM account_statement_requests sr
    WHERE (p_from IS NULL OR sr.created_at >= p_from) AND (p_to IS NULL OR sr.created_at < p_to)

    UNION ALL
    SELECT 'wallet:' || sa.id, 'wallet_created', 'account', sa.created_at, sa.user_id, NULL::uuid,
           jsonb_build_object('account_number', sa.account_number, 'account_name', sa.account_name),
           concat_ws(' ', sa.account_number, sa.account_name)
    FROM safehaven_accounts sa
    WHERE COALESCE(sa.is_sub_account, false) = false AND COALESCE(sa.is_deleted, false) = false
      AND (p_from IS NULL OR sa.created_at >= p_from) AND (p_to IS NULL OR sa.created_at < p_to)

    UNION ALL
    SELECT 'payacct:' || pa.id, 'bank_account_added', 'account', pa.created_at, pa.user_id, NULL::uuid,
           jsonb_build_object('account', jsonb_build_object(
             'bank_name', pa.bank_name, 'bank_code', pa.bank_code,
             'account_number', pa.account_number, 'account_name', pa.account_name)),
           concat_ws(' ', pa.bank_name, pa.account_number, pa.account_name)
    FROM payout_accounts pa
    WHERE (p_from IS NULL OR pa.created_at >= p_from) AND (p_to IS NULL OR pa.created_at < p_to)

    -- ---------------------------------------------------------------- kyc
    UNION ALL
    SELECT 'kyc:' || k.id, k.kind, 'kyc', k.created_at, k.user_id, NULL::uuid,
           jsonb_build_object('verification_type', k.verification_type, 'status', k.status,
                              'message', left(k.result_message, 200), 'provider', k.verification_provider),
           concat_ws(' ', k.verification_type, k.result_message)
    FROM (
      SELECT l.*,
        CASE
          WHEN l.operation_type = 'kyc_submitted' THEN 'kyc_submitted'
          WHEN l.operation_type = 'kyc_initiated' THEN 'kyc_started'
          WHEN l.operation_type = 'kyc_verified' THEN 'kyc_verified'
          WHEN l.operation_type = 'document_uploaded' THEN 'kyc_document_uploaded'
          WHEN l.operation_type = 'bvn_verified' AND l.status = 'success' THEN 'kyc_bvn_verified'
          WHEN l.operation_type = 'nin_verified' AND l.status = 'success' THEN 'kyc_nin_verified'
          WHEN l.operation_type = 'liveness_check' AND l.status = 'success' THEN 'kyc_liveness_passed'
          WHEN l.operation_type = 'liveness_check' AND l.status = 'failed' THEN 'kyc_liveness_failed'
        END AS kind
      FROM kyc_audit_logs l
      WHERE (p_from IS NULL OR l.created_at >= p_from) AND (p_to IS NULL OR l.created_at < p_to)
    ) k
    WHERE k.kind IS NOT NULL

    -- ---------------------------------------------------------------- plans and vaults
    UNION ALL
    SELECT 'plan:' || pl.id, 'payout_plan_created', 'plans', pl.created_at, pl.user_id, NULL::uuid,
           jsonb_build_object(
             'plan_id', pl.id, 'name', pl.name, 'purpose', pl.purpose, 'frequency', pl.frequency,
             'duration', pl.duration, 'payout_amount', pl.payout_amount, 'total_amount', pl.total_amount,
             'status', pl.status, 'start_date', pl.start_date,
             'account', CASE WHEN COALESCE(pa.id, ba.id) IS NULL THEN NULL ELSE jsonb_build_object(
               'bank_name', COALESCE(pa.bank_name, ba.bank_name), 'bank_code', COALESCE(pa.bank_code, ba.bank_code),
               'account_number', COALESCE(pa.account_number, ba.account_number),
               'account_name', COALESCE(pa.account_name, ba.account_name)) END),
           concat_ws(' ', pl.name, pl.purpose, COALESCE(pa.account_number, ba.account_number))
    FROM payout_plans pl
    LEFT JOIN payout_accounts pa ON pa.id = pl.payout_account_id
    LEFT JOIN bank_accounts ba ON ba.id = pl.bank_account_id
    WHERE (p_from IS NULL OR pl.created_at >= p_from) AND (p_to IS NULL OR pl.created_at < p_to)

    UNION ALL
    SELECT 'vault:' || bp.id, 'vault_created', 'plans', bp.created_at, bp.user_id, NULL::uuid,
           jsonb_build_object(
             'name', COALESCE(bp.name, bp.plan_name), 'total_budget', bp.total_budget,
             'categories', bp.categories, 'subcategories', bp.subcategories,
             'start_date', bp.start_date, 'end_date', bp.end_date, 'funding_method', bp.funding_method),
           COALESCE(bp.name, bp.plan_name, '')
    FROM budget_plans bp
    WHERE (p_from IS NULL OR bp.created_at >= p_from) AND (p_to IS NULL OR bp.created_at < p_to)

    UNION ALL
    SELECT 'topup:' || t.id, 'vault_topup', 'plans', t.created_at, t.user_id, NULL::uuid,
           jsonb_build_object(
             'amount', t.amount, 'source', t.source, 'status', t.status,
             'name', COALESCE(bp.name, bp.plan_name), 'categories', bp.categories, 'subcategories', bp.subcategories),
           COALESCE(bp.name, bp.plan_name, '')
    FROM expense_plan_topups t
    LEFT JOIN budget_plans bp ON bp.id = t.budget_plan_id
    WHERE (p_from IS NULL OR t.created_at >= p_from) AND (p_to IS NULL OR t.created_at < p_to)

    -- ---------------------------------------------------------------- money
    UNION ALL
    SELECT 'tx:' || tx.id, tx.type, 'money', tx.created_at, tx.user_id, NULL::uuid,
           jsonb_build_object('transaction_id', tx.id, 'reference', tx.reference, 'amount', tx.amount, 'status', tx.status),
           COALESCE(tx.reference, '')
    FROM transactions tx
    WHERE tx.type IN ('deposit', 'payout')
      AND (p_from IS NULL OR tx.created_at >= p_from) AND (p_to IS NULL OR tx.created_at < p_to)

    UNION ALL
    SELECT 'emergency:' || ew.id, 'emergency_withdrawal', 'money', COALESCE(ew.requested_at, ew.created_at), ew.user_id, NULL::uuid,
           jsonb_build_object(
             'amount', ew.withdrawal_amount, 'fee', ew.fee_amount, 'net', ew.net_amount,
             'type', ew.withdrawal_type, 'status', ew.status, 'error', left(ew.error_message, 200),
             'plan_name', pl.name,
             'account', CASE WHEN pa.id IS NULL THEN NULL ELSE jsonb_build_object(
               'bank_name', pa.bank_name, 'bank_code', pa.bank_code,
               'account_number', pa.account_number, 'account_name', pa.account_name) END),
           concat_ws(' ', pl.name, pa.account_number, ew.reference)
    FROM emergency_withdrawals ew
    LEFT JOIN payout_plans pl ON pl.id = ew.payout_plan_id
    LEFT JOIN payout_accounts pa ON pa.id = ew.payout_account_id
    WHERE (p_from IS NULL OR COALESCE(ew.requested_at, ew.created_at) >= p_from)
      AND (p_to IS NULL OR COALESCE(ew.requested_at, ew.created_at) < p_to)

    -- ---------------------------------------------------------------- admin
    UNION ALL
    SELECT 'audit:' || al.id, 'admin_action', 'admin', al.created_at,
           -- the person the action was about, when the log says so
           CASE
             WHEN al.resource_type IN ('profiles', 'kyc_data')
                  AND al.resource_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
               THEN al.resource_id::uuid
             WHEN al.new_values->>'plan_owner' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
               THEN (al.new_values->>'plan_owner')::uuid
             ELSE COALESCE(
               (SELECT t.user_id FROM transactions t WHERE al.resource_type = 'payout' AND t.id::text = al.resource_id),
               (SELECT a.user_id FROM automated_payouts a WHERE al.resource_type = 'payout' AND a.id::text = al.resource_id))
           END,
           al.user_id,
           jsonb_build_object(
             'action', al.action, 'resource_type', al.resource_type, 'resource_id', al.resource_id,
             'reason', COALESCE(al.new_values->>'reason', al.new_values->>'notes'),
             'plan_name', COALESCE(al.new_values->>'plan_name', al.old_values->>'plan_name'),
             'amount', al.new_values->'amount',
             'email', al.old_values->>'email',
             'name', al.old_values->>'name',
             'resulting_tier', al.new_values->'resulting_tier',
             'external_reference', al.new_values->>'external_reference'),
           concat_ws(' ', al.action, al.resource_type, al.old_values->>'email', al.new_values->>'plan_name')
    FROM audit_logs al
    WHERE (p_from IS NULL OR al.created_at >= p_from) AND (p_to IS NULL OR al.created_at < p_to)

    UNION ALL
    SELECT 'pnd:' || pr.id, 'post_no_debit', 'admin', pr.post_no_debit_at, pr.id, NULL::uuid,
           jsonb_build_object('reason', pr.post_no_debit_reason, 'by', pr.post_no_debit_by, 'active', COALESCE(pr.post_no_debit, false)),
           COALESCE(pr.post_no_debit_reason, '')
    FROM profiles pr
    WHERE pr.post_no_debit_at IS NOT NULL
      AND (p_from IS NULL OR pr.post_no_debit_at >= p_from) AND (p_to IS NULL OR pr.post_no_debit_at < p_to)
  ),
  scope AS MATERIALIZED (
    SELECT f.*
    FROM feed f
    LEFT JOIN profiles p ON p.id = f.user_id
    WHERE (p_user_id IS NULL OR f.user_id = p_user_id)
      AND (
        v_q IS NULL
        OR (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) ILIKE v_q
        OR p.email ILIKE v_q
        OR f.s ILIKE v_q
      )
  ),
  facets AS (
    SELECT category, kind, count(*) AS n FROM scope GROUP BY category, kind
  ),
  picked AS (
    SELECT * FROM scope
    WHERE (v_category IS NULL OR category = v_category) AND (v_kind IS NULL OR kind = v_kind)
  ),
  page AS (
    SELECT * FROM picked ORDER BY at DESC, id DESC LIMIT v_limit OFFSET v_offset
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pg.id,
          'kind', pg.kind,
          'category', pg.category,
          'at', pg.at,
          'user', CASE WHEN up.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', up.id, 'first_name', up.first_name, 'last_name', up.last_name, 'email', up.email) END,
          'actor', CASE WHEN ap.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', ap.id, 'first_name', ap.first_name, 'last_name', ap.last_name, 'email', ap.email) END,
          'details', CASE
            WHEN pg.category = 'money' AND pg.kind IN ('deposit', 'payout')
              THEN pg.details || jsonb_build_object('tx', public._admin_tx_item((pg.details->>'transaction_id')::uuid))
            ELSE pg.details END
        ) ORDER BY pg.at DESC, pg.id DESC)
      FROM page pg
      LEFT JOIN profiles up ON up.id = pg.user_id
      LEFT JOIN profiles ap ON ap.id = pg.actor_id
    ), '[]'::jsonb),
    (SELECT count(*) FROM picked),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('category', f.category, 'kind', f.kind, 'count', f.n)) FROM facets f), '[]'::jsonb)
  INTO v_rows, v_total, v_facets;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total, 'facets', v_facets);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_activity(timestamptz, timestamptz, text, text, text, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_activity(timestamptz, timestamptz, text, text, text, uuid, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
