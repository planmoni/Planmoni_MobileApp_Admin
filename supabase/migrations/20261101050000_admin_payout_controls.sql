-- Admin payout controls (user profile): pause / resume / cancel a payout plan, mark a payout
-- transaction Completed or Refunded, and release a failed payout so it is retried.
--
-- Everything reuses the payout engine's own functions so wallet and ledger rules stay in one place:
--   Completed -> complete_manual_payout_installment  (debits the wallet if that never happened,
--                                                     completes the installment, advances the plan)
--   Refunded  -> fail_payout_installment             (refunds the wallet debit, marks the
--                                                     installment failed and the transaction refunded)
--   Retry     -> releases the failed installment (refund + clear hold) so the process-due-payouts
--                job, which runs every 5 minutes, claims it again. The admin app triggers that job
--                right after so the retry starts now.
--   Cancel    -> cancel_payout_plan (fee refund rules), which only accepts the plan owner, so the
--                call runs with the owner's identity inside this function.
--
-- Permission: Super Admins, or anyone granted payout_plans.manage.
-- Every action is written to audit_logs (user_id = the admin) with the previous and new state.
--
-- Read:   admin_user_payout_actions(user)            -> what each plan / payout transaction allows
-- Write:  admin_pause_payout_plan(plan, reason)
--         admin_resume_payout_plan(plan)
--         admin_cancel_payout_plan(plan, reason)
--         admin_complete_payout_transaction(tx, reference, notes)
--         admin_refund_payout_transaction(tx, reason, pause_plan)
--         admin_prepare_payout_retry(automated_payout, confirm_not_paid)

INSERT INTO public.permissions (name, resource, action, description, is_system, category_id)
SELECT 'payout_plans.manage', 'payout_plans', 'manage',
       'Pause, resume and cancel payout plans; mark payouts Completed or Refunded; retry failed payouts',
       true,
       (SELECT category_id FROM public.permissions WHERE name = 'payout_plans.details' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE name = 'payout_plans.manage');

-- ---------------------------------------------------------------------------------------------
-- internal helpers (not callable from the API)
-- ---------------------------------------------------------------------------------------------

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
END;
$$;

CREATE OR REPLACE FUNCTION public._admin_payout_audit(
  p_action text, p_resource_id uuid, p_old jsonb, p_new jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (
    auth.uid(),
    p_action,
    'payout',
    p_resource_id::text,
    COALESCE(p_old, '{}'::jsonb),
    COALESCE(p_new, '{}'::jsonb) || jsonb_build_object('admin_id', auth.uid(), 'at', now())
  );
END;
$$;

-- What can be done with one installment (automated_payout) / payout transaction, and why not.
-- State: completed | in_flight | stuck | failed_held | failed | unlinked
--   in_flight    a transfer was started in the last 30 minutes, wait for the provider result
--   stuck        pending/processing/retrying for longer than that (money may be held)
--   failed_held  failed but the wallet debit was not refunded, or a manual hold is set
--   failed       failed and nothing is held (the engine retries these on its own)
CREATE OR REPLACE FUNCTION public._admin_payout_state(p_ap_id uuid, p_tx_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap automated_payouts%ROWTYPE;
  v_tx transactions%ROWTYPE;
  v_plan payout_plans%ROWTYPE;
  v_ap_id uuid := p_ap_id;
  v_debited boolean;
  v_refunded boolean;
  v_hold boolean;
  v_initiated boolean;
  v_in_flight boolean;
  v_current boolean;
  v_unsettled boolean;
  v_state text;
  v_amount numeric;
  v_can_complete boolean := false;
  v_can_refund boolean := false;
  v_can_retry boolean := false;
  v_complete_why text;
  v_refund_why text;
  v_retry_why text;
BEGIN
  IF p_tx_id IS NOT NULL THEN
    SELECT * INTO v_tx FROM transactions WHERE id = p_tx_id;
    IF v_ap_id IS NULL AND v_tx.id IS NOT NULL
       AND (v_tx.metadata->>'automated_payout_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_ap_id := (v_tx.metadata->>'automated_payout_id')::uuid;
    END IF;
  END IF;

  IF v_ap_id IS NOT NULL THEN
    SELECT * INTO v_ap FROM automated_payouts WHERE id = v_ap_id;
  END IF;

  IF v_ap.id IS NULL THEN
    RETURN jsonb_build_object(
      'tx_id', v_tx.id, 'tx_status', v_tx.status, 'state', 'unlinked',
      'can_complete', false, 'can_refund', false, 'can_retry', false, 'retry_needs_confirm', false,
      'complete_blocker', 'This payout has no installment record, so it cannot be changed safely from here.',
      'refund_blocker',   'This payout has no installment record, so it cannot be changed safely from here.',
      'retry_blocker',    'This payout has no installment record, so it cannot be retried from here.'
    );
  END IF;

  IF v_tx.id IS NULL THEN
    SELECT * INTO v_tx
    FROM transactions
    WHERE type = 'payout' AND metadata->>'automated_payout_id' = v_ap.id::text
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  SELECT * INTO v_plan FROM payout_plans WHERE id = v_ap.payout_plan_id;

  v_debited   := COALESCE(v_ap.metadata->>'wallet_debited', 'false') = 'true';
  v_refunded  := COALESCE(v_ap.metadata->>'wallet_refund_applied', 'false') = 'true';
  v_hold      := COALESCE(v_ap.metadata->>'manual_hold', 'false') = 'true';
  v_initiated := COALESCE(v_ap.metadata->>'safehaven_transfer_initiated', 'false') = 'true';
  v_in_flight := v_ap.status IN ('pending', 'processing', 'retrying')
                 AND v_ap.updated_at > now() - interval '30 minutes';
  v_current   := v_plan.id IS NOT NULL
                 AND v_ap.installment_index IS NOT DISTINCT FROM v_plan.completed_payouts
                 AND v_plan.completed_payouts < v_plan.duration;
  v_unsettled := (v_debited AND NOT v_refunded)
                 OR (v_initiated AND NOT v_refunded)
                 OR v_hold
                 OR v_ap.status IN ('pending', 'processing', 'retrying');
  v_amount    := COALESCE(NULLIF(v_ap.metadata->>'wallet_debited_amount', '')::numeric, v_ap.amount, v_tx.amount);

  v_state := CASE
    WHEN v_ap.status = 'completed' THEN 'completed'
    WHEN v_in_flight THEN 'in_flight'
    WHEN v_ap.status IN ('pending', 'processing', 'retrying') THEN 'stuck'
    WHEN v_ap.status = 'failed' AND v_unsettled THEN 'failed_held'
    ELSE 'failed'
  END;

  -- Completed
  IF v_state = 'completed' OR v_tx.status = 'completed' THEN
    v_complete_why := 'This payout is already completed.';
  ELSIF v_state = 'in_flight' THEN
    v_complete_why := 'A transfer was started a few minutes ago. Wait for the provider result.';
  ELSE
    v_can_complete := true;
  END IF;

  -- Refunded
  IF v_state = 'completed' OR v_tx.status = 'completed' THEN
    v_refund_why := 'A completed payout has already left the wallet, so it cannot be refunded here.';
  ELSIF v_tx.status = 'refunded' THEN
    v_refund_why := 'This payout is already refunded.';
  ELSIF v_state = 'in_flight' THEN
    v_refund_why := 'A transfer was started a few minutes ago. Wait for the provider result.';
  ELSIF (v_tx.id IS NOT NULL AND v_tx.status IN ('pending', 'failed'))
        OR (v_tx.id IS NULL AND v_state IN ('stuck', 'failed_held')) THEN
    v_can_refund := true;
  ELSE
    v_refund_why := 'There is nothing to refund for this payout.';
  END IF;

  -- Retry
  IF v_state = 'completed' OR v_tx.status = 'completed' THEN
    v_retry_why := 'This payout is already completed.';
  ELSIF v_state = 'in_flight' THEN
    v_retry_why := 'A transfer was started a few minutes ago. Wait for the provider result.';
  ELSIF v_plan.id IS NULL THEN
    v_retry_why := 'The payout plan no longer exists.';
  ELSIF v_plan.status = 'paused' THEN
    v_retry_why := 'The plan is paused. Resume it first.';
  ELSIF v_plan.status <> 'active' THEN
    v_retry_why := format('The plan is %s, so its payouts are not retried.', v_plan.status);
  ELSIF NOT v_current THEN
    v_retry_why := 'Only the plan''s current installment can be retried.';
  ELSE
    v_can_retry := true;
  END IF;

  RETURN jsonb_build_object(
    'ap_id', v_ap.id,
    'tx_id', v_tx.id,
    'plan_id', v_plan.id,
    'plan_name', v_plan.name,
    'plan_status', v_plan.status,
    'installment_index', v_ap.installment_index,
    'ap_status', v_ap.status,
    'tx_status', v_tx.status,
    'amount', v_amount,
    'reference', COALESCE(v_ap.transfer_reference, v_tx.reference),
    'error', v_ap.error_message,
    'state', v_state,
    'is_current', v_current,
    'manual_hold', v_hold,
    'can_complete', v_can_complete,
    'can_refund', v_can_refund,
    'can_retry', v_can_retry,
    'retry_needs_confirm', v_can_retry AND v_unsettled,
    'complete_debits_wallet', v_can_complete AND NOT (v_debited AND NOT v_refunded),
    'refund_credits_wallet', v_can_refund AND v_debited AND NOT v_refunded,
    'complete_blocker', v_complete_why,
    'refund_blocker', v_refund_why,
    'retry_blocker', v_retry_why
  );
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- read: what the user profile may offer
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_user_payout_actions(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plans jsonb := '[]'::jsonb;
  v_txs jsonb := '{}'::jsonb;
  r record;
  v_ap_id uuid;
  v_cur jsonb;
  v_cancel_why text;
BEGIN
  PERFORM public._admin_payout_assert();

  FOR r IN
    SELECT id, status, completed_payouts, duration, next_payout_date
    FROM payout_plans
    WHERE user_id = p_user_id AND status IN ('active', 'paused')
    ORDER BY created_at DESC
  LOOP
    SELECT id INTO v_ap_id
    FROM automated_payouts
    WHERE payout_plan_id = r.id
      AND installment_index = r.completed_payouts
      AND status <> 'completed'
    ORDER BY created_at DESC
    LIMIT 1;

    v_cur := CASE WHEN v_ap_id IS NULL THEN NULL ELSE public._admin_payout_state(v_ap_id, NULL) END;

    v_cancel_why := CASE
      WHEN v_cur IS NOT NULL AND v_cur->>'state' = 'in_flight'
        THEN 'A transfer for this plan is in progress. Wait for it to finish before cancelling.'
      WHEN v_cur IS NOT NULL AND v_cur->>'state' IN ('stuck', 'failed_held')
        THEN 'The current payout is unresolved. Mark it Completed or Refunded first, then cancel.'
      ELSE NULL
    END;

    v_plans := v_plans || jsonb_build_array(jsonb_build_object(
      'plan_id', r.id,
      'status', r.status,
      'can_pause', r.status = 'active',
      'can_resume', r.status = 'paused',
      'can_cancel', v_cancel_why IS NULL,
      'cancel_blocker', v_cancel_why,
      'due_now', r.next_payout_date IS NOT NULL AND r.next_payout_date <= now()
                 AND r.completed_payouts < r.duration,
      'current', v_cur
    ));
    v_ap_id := NULL;
  END LOOP;

  FOR r IN
    SELECT id
    FROM transactions
    WHERE user_id = p_user_id AND type = 'payout' AND status IN ('pending', 'failed', 'refunded')
    ORDER BY created_at DESC
    LIMIT 100
  LOOP
    v_txs := v_txs || jsonb_build_object(r.id::text, public._admin_payout_state(NULL, r.id));
  END LOOP;

  RETURN jsonb_build_object('plans', v_plans, 'transactions', v_txs);
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- pause / resume / cancel
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_pause_payout_plan(p_plan_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
BEGIN
  PERFORM public._admin_payout_assert();

  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;
  IF v_plan.status <> 'active' THEN
    RAISE EXCEPTION 'Only an active plan can be paused (this one is %)', v_plan.status;
  END IF;

  UPDATE payout_plans SET status = 'paused', updated_at = now() WHERE id = p_plan_id;

  PERFORM public._admin_payout_audit(
    'payout_plan.paused', p_plan_id,
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'paused', 'reason', NULLIF(btrim(p_reason), ''), 'plan_owner', v_plan.user_id, 'plan_name', v_plan.name)
  );

  RETURN jsonb_build_object('success', true, 'plan_id', p_plan_id, 'status', 'paused');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resume_payout_plan(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_due boolean;
BEGIN
  PERFORM public._admin_payout_assert();

  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;
  IF v_plan.status <> 'paused' THEN
    RAISE EXCEPTION 'Only a paused plan can be resumed (this one is %)', v_plan.status;
  END IF;

  UPDATE payout_plans SET status = 'active', updated_at = now() WHERE id = p_plan_id;

  v_due := v_plan.next_payout_date IS NOT NULL AND v_plan.next_payout_date <= now()
           AND v_plan.completed_payouts < v_plan.duration;

  PERFORM public._admin_payout_audit(
    'payout_plan.resumed', p_plan_id,
    jsonb_build_object('status', 'paused'),
    jsonb_build_object('status', 'active', 'plan_owner', v_plan.user_id, 'plan_name', v_plan.name, 'payout_due_now', v_due)
  );

  RETURN jsonb_build_object('success', true, 'plan_id', p_plan_id, 'status', 'active', 'due_now', v_due);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_payout_plan(p_plan_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan payout_plans%ROWTYPE;
  v_ap_id uuid;
  v_cur jsonb;
  v_prev_sub text;
  v_prev_claims text;
  v_result jsonb;
BEGIN
  PERFORM public._admin_payout_assert();

  SELECT * INTO v_plan FROM payout_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout plan not found';
  END IF;
  IF v_plan.status NOT IN ('active', 'paused') THEN
    RAISE EXCEPTION 'Only an active or paused plan can be cancelled (this one is %)', v_plan.status;
  END IF;

  -- never cancel around money that is in flight or unresolved
  SELECT id INTO v_ap_id
  FROM automated_payouts
  WHERE payout_plan_id = p_plan_id
    AND installment_index = v_plan.completed_payouts
    AND status <> 'completed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_ap_id IS NOT NULL THEN
    v_cur := public._admin_payout_state(v_ap_id, NULL);
    IF v_cur->>'state' = 'in_flight' THEN
      RAISE EXCEPTION 'A transfer for this plan is in progress. Wait for it to finish before cancelling.';
    ELSIF v_cur->>'state' IN ('stuck', 'failed_held') THEN
      RAISE EXCEPTION 'The current payout is unresolved. Mark it Completed or Refunded first, then cancel.';
    END IF;
  END IF;

  -- cancel_payout_plan only accepts the plan owner. Run it as the owner, then restore the admin.
  v_prev_sub := current_setting('request.jwt.claim.sub', true);
  v_prev_claims := current_setting('request.jwt.claims', true);
  PERFORM set_config('request.jwt.claim.sub', v_plan.user_id::text, true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_plan.user_id::text, 'role', 'authenticated')::text, true);

  v_result := public.cancel_payout_plan(p_plan_id);

  PERFORM set_config('request.jwt.claim.sub', COALESCE(v_prev_sub, ''), true);
  PERFORM set_config('request.jwt.claims', COALESCE(v_prev_claims, ''), true);

  IF COALESCE(v_result->>'success', 'false') <> 'true' THEN
    RAISE EXCEPTION '%', COALESCE(v_result->>'error', 'The plan could not be cancelled');
  END IF;

  PERFORM public._admin_payout_audit(
    'payout_plan.cancelled', p_plan_id,
    jsonb_build_object('status', v_plan.status, 'completed_payouts', v_plan.completed_payouts, 'duration', v_plan.duration),
    jsonb_build_object('status', 'cancelled', 'reason', NULLIF(btrim(p_reason), ''), 'plan_owner', v_plan.user_id,
                       'plan_name', v_plan.name, 'fee_refund', v_result->'fee_refund')
  );

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- mark a payout transaction Completed / Refunded
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_complete_payout_transaction(
  p_transaction_id uuid, p_reference text, p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state jsonb;
  v_ap_id uuid;
  v_result jsonb;
BEGIN
  PERFORM public._admin_payout_assert();

  IF NULLIF(btrim(p_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Enter the bank or SafeHaven reference that proves the user was paid';
  END IF;

  v_state := public._admin_payout_state(NULL, p_transaction_id);
  IF v_state->>'ap_id' IS NULL OR NOT (v_state->>'can_complete')::boolean THEN
    RAISE EXCEPTION '%', COALESCE(v_state->>'complete_blocker', 'This payout cannot be marked completed');
  END IF;
  v_ap_id := (v_state->>'ap_id')::uuid;

  v_result := public.complete_manual_payout_installment(v_ap_id, btrim(p_reference), NULLIF(btrim(p_notes), ''), false);
  IF COALESCE(v_result->>'success', 'false') <> 'true' THEN
    RAISE EXCEPTION '%', COALESCE(v_result->>'error', 'The payout could not be completed');
  END IF;

  PERFORM public._admin_payout_audit(
    'payout.marked_completed', p_transaction_id,
    jsonb_build_object('tx_status', v_state->>'tx_status', 'ap_status', v_state->>'ap_status', 'state', v_state->>'state'),
    jsonb_build_object('tx_status', 'completed', 'automated_payout_id', v_ap_id, 'plan_id', v_state->>'plan_id',
                       'amount', v_state->'amount', 'external_reference', btrim(p_reference),
                       'notes', NULLIF(btrim(p_notes), ''), 'wallet_debited_now', v_state->'complete_debits_wallet')
  );

  RETURN v_result || jsonb_build_object('transaction_id', p_transaction_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_refund_payout_transaction(
  p_transaction_id uuid, p_reason text, p_pause_plan boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state jsonb;
  v_ap_id uuid;
  v_plan_id uuid;
  v_result jsonb;
  v_paused boolean := false;
BEGIN
  PERFORM public._admin_payout_assert();

  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Enter the reason for the refund';
  END IF;

  v_state := public._admin_payout_state(NULL, p_transaction_id);
  IF v_state->>'ap_id' IS NULL OR NOT (v_state->>'can_refund')::boolean THEN
    RAISE EXCEPTION '%', COALESCE(v_state->>'refund_blocker', 'This payout cannot be refunded');
  END IF;
  v_ap_id := (v_state->>'ap_id')::uuid;
  v_plan_id := NULLIF(v_state->>'plan_id', '')::uuid;

  v_result := public.fail_payout_installment(
    v_ap_id,
    'Refunded by admin: ' || btrim(p_reason),
    jsonb_build_object('admin_refund', true, 'admin_refund_by', auth.uid(), 'admin_refund_reason', btrim(p_reason))
  );
  IF COALESCE(v_result->>'success', 'false') <> 'true' THEN
    RAISE EXCEPTION '%', COALESCE(v_result->>'error', 'The payout could not be refunded');
  END IF;

  -- Without this the engine would debit the wallet again and re-send the installment on its next run.
  IF p_pause_plan AND v_plan_id IS NOT NULL THEN
    UPDATE payout_plans SET status = 'paused', updated_at = now()
    WHERE id = v_plan_id AND status = 'active';
    v_paused := FOUND;
  END IF;

  PERFORM public._admin_payout_audit(
    'payout.marked_refunded', p_transaction_id,
    jsonb_build_object('tx_status', v_state->>'tx_status', 'ap_status', v_state->>'ap_status', 'state', v_state->>'state'),
    jsonb_build_object('tx_status', 'refunded', 'automated_payout_id', v_ap_id, 'plan_id', v_plan_id,
                       'amount', v_state->'amount', 'reason', btrim(p_reason),
                       'wallet_credited', v_state->'refund_credits_wallet', 'plan_paused', v_paused)
  );

  RETURN jsonb_build_object(
    'success', true, 'transaction_id', p_transaction_id, 'automated_payout_id', v_ap_id,
    'wallet_credited', (v_state->>'refund_credits_wallet')::boolean, 'plan_paused', v_paused
  );
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- retry a failed payout
-- ---------------------------------------------------------------------------------------------
-- Releases the plan's current installment so the engine claims it again (new debit + new transfer).
-- If the installment still holds money (wallet debited and not refunded, in progress, or a manual
-- hold), the admin must confirm the bank transfer was NOT made: the wallet is refunded first.

CREATE OR REPLACE FUNCTION public.admin_prepare_payout_retry(
  p_automated_payout_id uuid, p_confirm_not_paid boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ap automated_payouts%ROWTYPE;
  v_plan payout_plans%ROWTYPE;
  v_state jsonb;
  v_res jsonb;
  v_debited boolean;
  v_refunded boolean;
  v_initiated boolean;
  v_released_wallet boolean := false;
  v_info jsonb;
BEGIN
  PERFORM public._admin_payout_assert();

  SELECT * INTO v_ap FROM automated_payouts WHERE id = p_automated_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout installment not found';
  END IF;

  v_state := public._admin_payout_state(v_ap.id, NULL);
  IF NOT (v_state->>'can_retry')::boolean THEN
    RAISE EXCEPTION '%', COALESCE(v_state->>'retry_blocker', 'This payout cannot be retried');
  END IF;
  IF (v_state->>'retry_needs_confirm')::boolean AND NOT COALESCE(p_confirm_not_paid, false) THEN
    RAISE EXCEPTION 'Confirm that the bank transfer for this payout was not made before retrying';
  END IF;

  v_debited   := COALESCE(v_ap.metadata->>'wallet_debited', 'false') = 'true';
  v_refunded  := COALESCE(v_ap.metadata->>'wallet_refund_applied', 'false') = 'true';
  v_initiated := COALESCE(v_ap.metadata->>'safehaven_transfer_initiated', 'false') = 'true';
  v_info := jsonb_build_object('admin_retry_by', auth.uid(), 'admin_retry_at', now());

  IF (v_debited AND NOT v_refunded) OR (v_initiated AND NOT v_refunded) OR v_ap.status <> 'failed' THEN
    -- money may be held: refund it and mark the attempt failed
    v_res := public.fail_payout_installment(v_ap.id, 'Released for retry by admin', v_info || jsonb_build_object('admin_retry', true));
    IF COALESCE(v_res->>'success', 'false') <> 'true' THEN
      RAISE EXCEPTION '%', COALESCE(v_res->>'error', 'The payout could not be released for retry');
    END IF;
    v_released_wallet := v_debited AND NOT v_refunded;
  ELSE
    -- failed with nothing debited: there is nothing to refund, mark it so the engine will claim it again
    UPDATE automated_payouts
    SET metadata = COALESCE(metadata, '{}'::jsonb) || v_info || jsonb_build_object('wallet_refund_applied', true),
        updated_at = now()
    WHERE id = v_ap.id;
  END IF;

  -- a manual hold would keep the engine away from this installment
  UPDATE automated_payouts
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('manual_hold', false) || v_info,
      updated_at = now()
  WHERE id = v_ap.id;

  SELECT * INTO v_plan FROM payout_plans WHERE id = v_ap.payout_plan_id;

  PERFORM public._admin_payout_audit(
    'payout.retry_released', v_ap.id,
    jsonb_build_object('ap_status', v_ap.status, 'state', v_state->>'state', 'error', v_ap.error_message),
    jsonb_build_object('plan_id', v_ap.payout_plan_id, 'installment_index', v_ap.installment_index,
                       'amount', v_state->'amount', 'wallet_refunded', v_released_wallet,
                       'confirmed_not_paid', COALESCE(p_confirm_not_paid, false))
  );

  RETURN jsonb_build_object(
    'success', true,
    'automated_payout_id', v_ap.id,
    'plan_id', v_ap.payout_plan_id,
    'wallet_refunded', v_released_wallet,
    'due_now', v_plan.next_payout_date IS NOT NULL AND v_plan.next_payout_date <= now()
  );
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- permissions
-- ---------------------------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public._admin_payout_assert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._admin_payout_audit(text, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._admin_payout_state(uuid, uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_user_payout_actions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_pause_payout_plan(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_resume_payout_plan(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_payout_plan(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_complete_payout_transaction(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_refund_payout_transaction(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_prepare_payout_retry(uuid, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_user_payout_actions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pause_payout_plan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resume_payout_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_payout_plan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_payout_transaction(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_payout_transaction(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_prepare_payout_retry(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
