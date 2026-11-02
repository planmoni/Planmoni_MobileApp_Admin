-- Process Due Payouts (admin)
--
-- A plan is "due" when it is active, has a next_payout_date in the past and installments left: the same
-- rule as public.get_due_payout_plans() (no arguments). Every due plan is listed, whatever the state of its
-- current installment, so an admin can see what the 5 minute job has not finished.
--
-- State of a due plan, from its CURRENT installment (the automated_payouts row whose installment_index
-- equals plan.completed_payouts; older failed retries of earlier installments are ignored):
--   ready            no attempt yet: the job has not started this installment
--   in_flight        pending / processing for less than 30 minutes: wait for the provider
--   stuck            pending / processing for more than 30 minutes: money may be held
--   failed_held      failed but the wallet debit was not refunded, or a manual hold is set
--   failed_retrying  failed and refunded: the hourly retry job will claim it again
--   anomaly          the installment is completed but the plan did not advance (reconcile fixes it)
--
-- Needs: _admin_payout_assert / _admin_payout_audit from 20261101050000 (APPLY_PAYOUT_CONTROLS.sql).
--
-- admin_list_due_payouts            one page of due plans + counts and amounts per state
-- admin_due_payout_fingerprint      state fingerprint of one plan (used by the edge function to inspect)
-- admin_begin_payout_process        verifies the fingerprint the admin reviewed, takes the per-plan lock, audits
-- admin_finish_payout_process       service role only: releases the lock and records the outcome
--
-- Permission: Super Admins, or payouts.process. All values are bound parameters.

INSERT INTO public.permissions (name, resource, action, description, is_system, category_id)
SELECT 'payouts.process', 'payouts', 'process',
       'List due payouts and process them one plan at a time from the admin (sends real money)',
       true,
       (SELECT category_id FROM public.permissions WHERE name = 'payout_plans.details' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'payouts.process');

-- ---------------------------------------------------------------------------------------------
-- per-plan lock + run history. Written only through the functions below (RLS on, no policies).
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payout_process_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  automated_payout_id uuid,
  requested_by uuid NOT NULL,
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'finished', 'error')),
  outcome text,
  result jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE public.payout_process_runs ENABLE ROW LEVEL SECURITY;

-- one running process per plan, enforced by the database
CREATE UNIQUE INDEX IF NOT EXISTS payout_process_runs_one_running
  ON public.payout_process_runs (plan_id) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS payout_process_runs_plan_started
  ON public.payout_process_runs (plan_id, started_at DESC);

REVOKE ALL ON TABLE public.payout_process_runs FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- helpers (not callable from the API)
-- ---------------------------------------------------------------------------------------------

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
END;
$$;

-- Everything an admin's decision depends on, hashed: if any of it changes after the admin opened the
-- review, the fingerprint no longer matches and the action is refused.
CREATE OR REPLACE FUNCTION public._due_payout_fingerprint(p_plan_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT md5(concat_ws('|',
    pp.id::text,
    pp.status,
    COALESCE(pp.next_payout_date::text, ''),
    COALESCE(pp.payout_amount::text, ''),
    COALESCE(pp.completed_payouts::text, ''),
    COALESCE(pp.payout_account_id::text, ''),
    COALESCE(ap.id::text, ''),
    COALESCE(ap.status, ''),
    COALESCE(ap.transfer_reference, ''),
    COALESCE(ap.updated_at::text, ''),
    COALESCE(ap.metadata->>'wallet_debited', ''),
    COALESCE(ap.metadata->>'wallet_refund_applied', ''),
    COALESCE(ap.metadata->>'safehaven_transfer_initiated', '')
  ))
  FROM public.payout_plans pp
  LEFT JOIN LATERAL (
    SELECT a.* FROM public.automated_payouts a
    WHERE a.payout_plan_id = pp.id AND a.installment_index = pp.completed_payouts
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 1
  ) ap ON true
  WHERE pp.id = p_plan_id;
$$;

-- ---------------------------------------------------------------------------------------------
-- list
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_due_payouts(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_search text DEFAULT NULL,
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
  v_state  text := NULLIF(btrim(COALESCE(p_state, '')), '');
  v_term   text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_q      text;
  v_rows   jsonb;
  v_facets jsonb;
  v_total  bigint;
BEGIN
  PERFORM public._admin_process_assert();

  IF v_state = 'all' THEN v_state := NULL; END IF;
  IF v_state IS NOT NULL AND v_state NOT IN ('ready', 'in_flight', 'stuck', 'failed_held', 'failed_retrying', 'anomaly') THEN
    RAISE EXCEPTION 'Unknown state filter';
  END IF;

  -- LIKE pattern with the user's own % _ \ treated literally
  IF v_term IS NOT NULL THEN
    v_q := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  WITH due AS MATERIALIZED (
    SELECT
      pp.id AS plan_id,
      pp.user_id,
      pp.name AS plan_name,
      pp.purpose,
      pp.frequency,
      pp.duration,
      pp.completed_payouts,
      pp.payout_amount,
      pp.total_amount,
      pp.next_payout_date,
      pp.payout_account_id,
      pp.bank_account_id,
      ap.id AS ap_id,
      ap.status AS ap_status,
      ap.metadata AS ap_meta,
      ap.updated_at AS ap_updated_at,
      ap.created_at AS ap_created_at,
      ap.transfer_reference,
      ap.error_message,
      ap.retry_count,
      ap.amount AS ap_amount
    FROM public.payout_plans pp
    LEFT JOIN LATERAL (
      SELECT a.* FROM public.automated_payouts a
      WHERE a.payout_plan_id = pp.id AND a.installment_index = pp.completed_payouts
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 1
    ) ap ON true
    -- the get_due_payout_plans() rule, plus "installments left" so a finished plan never shows
    WHERE pp.status = 'active'
      AND pp.next_payout_date IS NOT NULL
      AND pp.next_payout_date <= now()
      AND pp.completed_payouts < pp.duration
      AND (pp.payout_account_id IS NOT NULL OR pp.bank_account_id IS NOT NULL)
      AND (p_from IS NULL OR pp.next_payout_date >= p_from)
      AND (p_to IS NULL OR pp.next_payout_date < p_to)
  ),
  scope AS MATERIALIZED (
    SELECT
      d.*,
      CASE
        WHEN d.ap_id IS NULL THEN 'ready'
        WHEN d.ap_status = 'completed' THEN 'anomaly'
        WHEN d.ap_status IN ('pending', 'processing', 'retrying') AND d.ap_updated_at > now() - interval '30 minutes' THEN 'in_flight'
        WHEN d.ap_status IN ('pending', 'processing', 'retrying') THEN 'stuck'
        WHEN d.ap_status = 'failed' AND (
               (COALESCE(d.ap_meta->>'wallet_debited', 'false') = 'true'
                  AND COALESCE(d.ap_meta->>'wallet_refund_applied', 'false') <> 'true')
            OR (COALESCE(d.ap_meta->>'safehaven_transfer_initiated', 'false') = 'true'
                  AND COALESCE(d.ap_meta->>'wallet_refund_applied', 'false') <> 'true')
            OR COALESCE(d.ap_meta->>'manual_hold', 'false') = 'true') THEN 'failed_held'
        ELSE 'failed_retrying'
      END AS state,
      COALESCE(NULLIF(public.resolve_payout_installment_amount(d.plan_id, d.completed_payouts), 0), d.payout_amount) AS amount,
      p.first_name, p.last_name, p.email,
      pa.bank_name AS pa_bank_name, pa.bank_code AS pa_bank_code,
      pa.account_number AS pa_account_number, pa.account_name AS pa_account_name,
      ba.bank_name AS ba_bank_name, ba.bank_code AS ba_bank_code,
      ba.account_number AS ba_account_number, ba.account_name AS ba_account_name
    FROM due d
    LEFT JOIN public.profiles p ON p.id = d.user_id
    LEFT JOIN public.payout_accounts pa ON pa.id = d.payout_account_id
    LEFT JOIN public.bank_accounts ba ON ba.id = d.bank_account_id
  ),
  matched AS MATERIALIZED (
    SELECT s.* FROM scope s
    WHERE v_q IS NULL
       OR (COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')) ILIKE v_q
       OR s.email ILIKE v_q
       OR s.plan_name ILIKE v_q
       OR s.transfer_reference ILIKE v_q
       OR s.amount::text ILIKE v_q
       OR COALESCE(s.pa_account_number, s.ba_account_number) ILIKE v_q
       OR COALESCE(s.pa_account_name, s.ba_account_name) ILIKE v_q
  ),
  facets AS (
    SELECT state, count(*) AS n, COALESCE(sum(amount), 0) AS amt FROM matched GROUP BY state
  ),
  picked AS (
    SELECT * FROM matched WHERE v_state IS NULL OR state = v_state
  ),
  page AS (
    SELECT * FROM picked ORDER BY next_payout_date ASC, plan_id ASC LIMIT v_limit OFFSET v_offset
  ),
  attempts AS (
    SELECT a.payout_plan_id, a.installment_index, count(*) AS n
    FROM public.automated_payouts a
    JOIN page pg ON pg.plan_id = a.payout_plan_id AND pg.completed_payouts = a.installment_index
    GROUP BY a.payout_plan_id, a.installment_index
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'plan_id', pg.plan_id,
        'state', pg.state,
        'amount', pg.amount,
        'installment', pg.completed_payouts + 1,
        'duration', pg.duration,
        'next_payout_date', pg.next_payout_date,
        'days_overdue', GREATEST(floor(extract(epoch FROM (now() - pg.next_payout_date)) / 86400), 0),
        'attempts', COALESCE(at.n, 0),
        'fingerprint', public._due_payout_fingerprint(pg.plan_id),
        'user', CASE WHEN pg.email IS NULL AND pg.first_name IS NULL THEN NULL ELSE jsonb_build_object(
          'id', pg.user_id, 'first_name', pg.first_name, 'last_name', pg.last_name, 'email', pg.email) END,
        'plan', jsonb_build_object(
          'id', pg.plan_id, 'name', pg.plan_name, 'purpose', pg.purpose, 'frequency', pg.frequency,
          'duration', pg.duration, 'completed_payouts', pg.completed_payouts,
          'payout_amount', pg.payout_amount, 'total_amount', pg.total_amount),
        'account', CASE WHEN COALESCE(pg.pa_account_number, pg.ba_account_number) IS NULL THEN NULL ELSE jsonb_build_object(
          'bank_name', COALESCE(pg.pa_bank_name, pg.ba_bank_name),
          'bank_code', COALESCE(pg.pa_bank_code, pg.ba_bank_code),
          'account_number', COALESCE(pg.pa_account_number, pg.ba_account_number),
          'account_name', COALESCE(pg.pa_account_name, pg.ba_account_name)) END,
        'attempt', CASE WHEN pg.ap_id IS NULL THEN NULL ELSE jsonb_build_object(
          'id', pg.ap_id,
          'status', pg.ap_status,
          'reference', pg.transfer_reference,
          'error', NULLIF(pg.error_message, ''),
          'retry_count', pg.retry_count,
          'updated_at', pg.ap_updated_at,
          'created_at', pg.ap_created_at,
          'wallet_debited', COALESCE(pg.ap_meta->>'wallet_debited', 'false') = 'true',
          'wallet_refund_applied', COALESCE(pg.ap_meta->>'wallet_refund_applied', 'false') = 'true',
          'safehaven_initiated', COALESCE(pg.ap_meta->>'safehaven_transfer_initiated', 'false') = 'true',
          'manual_hold', COALESCE(pg.ap_meta->>'manual_hold', 'false') = 'true',
          'manual_resend', COALESCE(pg.ap_meta->>'manual_resend', 'false') = 'true') END
      ) ORDER BY pg.next_payout_date ASC, pg.plan_id ASC)
      FROM page pg
      LEFT JOIN attempts at ON at.payout_plan_id = pg.plan_id AND at.installment_index = pg.completed_payouts
    ), '[]'::jsonb),
    (SELECT count(*) FROM picked),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('state', f.state, 'count', f.n, 'amount', f.amt)) FROM facets f), '[]'::jsonb)
  INTO v_rows, v_total, v_facets;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total, 'facets', v_facets);
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- fingerprint for one plan (permission-checked; the edge function calls it with the admin's token)
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_due_payout_fingerprint(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_due boolean;
BEGIN
  PERFORM public._admin_process_assert();

  SELECT EXISTS (
    SELECT 1 FROM public.payout_plans pp
    WHERE pp.id = p_plan_id
      AND pp.status = 'active'
      AND pp.next_payout_date IS NOT NULL
      AND pp.next_payout_date <= now()
      AND pp.completed_payouts < pp.duration
      AND (pp.payout_account_id IS NOT NULL OR pp.bank_account_id IS NOT NULL)
  ) INTO v_due;

  RETURN jsonb_build_object('due', v_due, 'fingerprint', public._due_payout_fingerprint(p_plan_id));
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- begin / finish one process run
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_begin_payout_process(p_plan_id uuid, p_fingerprint text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_due boolean;
  v_now_fp text;
  v_run_id uuid;
  v_ap_id uuid;
BEGIN
  PERFORM public._admin_process_assert();

  IF p_plan_id IS NULL OR p_fingerprint IS NULL OR btrim(p_fingerprint) = '' THEN
    RAISE EXCEPTION 'Plan and fingerprint are required';
  END IF;

  -- serialise concurrent begins on the same plan; the unique index is the second line of defence
  PERFORM 1 FROM public.payout_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.payout_plans pp
    WHERE pp.id = p_plan_id
      AND pp.status = 'active'
      AND pp.next_payout_date IS NOT NULL
      AND pp.next_payout_date <= now()
      AND pp.completed_payouts < pp.duration
      AND (pp.payout_account_id IS NOT NULL OR pp.bank_account_id IS NOT NULL)
  ) INTO v_due;
  IF NOT v_due THEN
    RAISE EXCEPTION 'This plan is no longer due. Refresh the list.';
  END IF;

  v_now_fp := public._due_payout_fingerprint(p_plan_id);
  IF v_now_fp IS DISTINCT FROM p_fingerprint THEN
    RAISE EXCEPTION 'This plan changed since you opened it. Refresh and review it again.';
  END IF;

  -- a run that never reported back (crashed function) stops blocking the plan after 10 minutes
  UPDATE public.payout_process_runs
  SET status = 'error', outcome = 'lock_expired', finished_at = now()
  WHERE plan_id = p_plan_id AND status = 'running' AND started_at < now() - interval '10 minutes';

  SELECT a.id INTO v_ap_id
  FROM public.automated_payouts a
  JOIN public.payout_plans pp ON pp.id = a.payout_plan_id AND a.installment_index = pp.completed_payouts
  WHERE pp.id = p_plan_id
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT 1;

  BEGIN
    INSERT INTO public.payout_process_runs (plan_id, automated_payout_id, requested_by, fingerprint)
    VALUES (p_plan_id, v_ap_id, auth.uid(), p_fingerprint)
    RETURNING id INTO v_run_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Another admin is already processing this plan. Wait for it to finish.';
  END;

  PERFORM public._admin_payout_audit(
    'payout_process_started', p_plan_id, '{}'::jsonb,
    jsonb_build_object('run_id', v_run_id, 'automated_payout_id', v_ap_id, 'fingerprint', p_fingerprint)
  );

  RETURN jsonb_build_object('run_id', v_run_id, 'automated_payout_id', v_ap_id, 'requested_by', auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_finish_payout_process(
  p_run_id uuid, p_outcome text, p_result jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.payout_process_runs%ROWTYPE;
BEGIN
  -- service role only (the edge function). The grants below enforce it; this is the second check.
  IF COALESCE(auth.role(), current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.payout_process_runs
  SET status = CASE WHEN p_outcome IN ('error', 'needs_dashboard_check') THEN 'error' ELSE 'finished' END,
      outcome = left(COALESCE(p_outcome, 'unknown'), 100),
      result = COALESCE(p_result, '{}'::jsonb),
      finished_at = now()
  WHERE id = p_run_id AND status = 'running'
  RETURNING * INTO v_run;

  IF NOT FOUND THEN
    -- already finished or expired; keep the latest result anyway
    UPDATE public.payout_process_runs
    SET outcome = left(COALESCE(p_outcome, 'unknown'), 100), result = COALESCE(p_result, '{}'::jsonb),
        finished_at = COALESCE(finished_at, now())
    WHERE id = p_run_id
    RETURNING * INTO v_run;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'run not found');
    END IF;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (
    v_run.requested_by,
    'payout_process_finished',
    'payout',
    v_run.plan_id::text,
    jsonb_build_object('fingerprint', v_run.fingerprint),
    jsonb_build_object('run_id', v_run.id, 'outcome', p_outcome, 'result', COALESCE(p_result, '{}'::jsonb),
                       'admin_id', v_run.requested_by, 'at', now())
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- permissions
-- ---------------------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public._admin_process_assert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._due_payout_fingerprint(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_list_due_payouts(timestamptz, timestamptz, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_due_payouts(timestamptz, timestamptz, text, text, integer, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_due_payout_fingerprint(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_due_payout_fingerprint(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_begin_payout_process(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_begin_payout_process(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_finish_payout_process(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finish_payout_process(uuid, text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
