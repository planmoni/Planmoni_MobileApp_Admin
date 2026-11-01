-- Fixes for admin_review_tier3:
--  * search_path must include `extensions` so create_kyc_audit_log can call
--    gen_random_bytes() (otherwise the KYC audit row is silently skipped)
--  * reset the app.kyc_review guard flag before returning so it can't leak to
--    later statements in the same transaction

CREATE OR REPLACE FUNCTION public.admin_review_tier3(
  p_user_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_kyc public.kyc_data%ROWTYPE;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_tier integer;
  v_new_tier integer;
  v_new_status text;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;

  IF p_decision = 'approve' THEN
    IF NOT (public.has_permission('kyc.approve') OR public.is_admin()) THEN
      RAISE EXCEPTION 'Permission denied: kyc.approve required';
    END IF;
  ELSE
    IF NOT (public.has_permission('kyc.reject') OR public.is_admin()) THEN
      RAISE EXCEPTION 'Permission denied: kyc.reject required';
    END IF;
    IF v_reason IS NULL THEN
      RAISE EXCEPTION 'A rejection reason is required';
    END IF;
  END IF;

  SELECT * INTO v_kyc FROM public.kyc_data WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No KYC record found for this user';
  END IF;

  IF v_kyc.utility_bill_review_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'No pending Tier 3 submission for this user (status: %)',
      COALESCE(v_kyc.utility_bill_review_status, 'not submitted');
  END IF;

  PERFORM set_config('app.kyc_review', 'on', true);

  IF p_decision = 'approve' THEN
    IF v_kyc.utility_bill_url IS NULL THEN
      RAISE EXCEPTION 'No proof of address document has been uploaded';
    END IF;
    IF NULLIF(btrim(COALESCE(v_kyc.address, '')), '') IS NULL THEN
      RAISE EXCEPTION 'User has no address on file';
    END IF;

    v_tier := public.calculate_user_kyc_tier(p_user_id);
    IF v_tier < 2 THEN
      RAISE EXCEPTION 'User must complete Tier 2 before Tier 3 can be approved (current tier: %)', v_tier;
    END IF;

    v_new_status := 'approved';

    UPDATE public.kyc_data
    SET utility_bill_review_status = 'approved',
        utility_bill_reviewed_by = v_admin_id,
        utility_bill_reviewed_at = now(),
        utility_bill_rejection_reason = NULL,
        utility_bill_validated = true,
        utility_bill_verified = true,
        approved = true
    WHERE user_id = p_user_id;

    UPDATE public.kyc_progress
    SET address_completed = true,
        utility_bill_verified = true
    WHERE user_id = p_user_id;

    v_new_tier := public.update_user_kyc_tier(p_user_id);
  ELSE
    v_new_status := 'rejected';

    UPDATE public.kyc_data
    SET utility_bill_review_status = 'rejected',
        utility_bill_reviewed_by = v_admin_id,
        utility_bill_reviewed_at = now(),
        utility_bill_rejection_reason = v_reason,
        utility_bill_validated = false
    WHERE user_id = p_user_id;

    v_new_tier := public.calculate_user_kyc_tier(p_user_id);
  END IF;

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (
    v_admin_id,
    CASE WHEN p_decision = 'approve' THEN 'kyc.tier3.approved' ELSE 'kyc.tier3.rejected' END,
    'kyc_data',
    p_user_id::text,
    jsonb_build_object('utility_bill_review_status', v_kyc.utility_bill_review_status),
    jsonb_build_object(
      'utility_bill_review_status', v_new_status,
      'reason', v_reason,
      'resulting_tier', v_new_tier
    )
  );

  -- Mirror into the KYC audit trail (best effort: never block the review)
  BEGIN
    PERFORM public.create_kyc_audit_log(
      p_user_id := p_user_id,
      p_operation_type := CASE WHEN p_decision = 'approve' THEN 'address_verified' ELSE 'document_rejected' END,
      p_verification_type := 'document',
      p_verification_provider := 'manual',
      p_status := CASE WHEN p_decision = 'approve' THEN 'success' ELSE 'rejected' END,
      p_result_message := COALESCE(v_reason, 'Tier 3 proof of address approved by admin'),
      p_metadata := jsonb_build_object('reviewed_by', v_admin_id, 'resulting_tier', v_new_tier)
    );
  EXCEPTION WHEN others THEN
    RAISE WARNING 'create_kyc_audit_log failed for tier 3 review: %', SQLERRM;
  END;

  PERFORM set_config('app.kyc_review', 'off', true);

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'decision', p_decision,
    'review_status', v_new_status,
    'tier', v_new_tier
  );
END;
$$;
