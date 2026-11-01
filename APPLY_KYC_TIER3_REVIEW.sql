-- =============================================================================
-- KYC Tier 3 manual review: all-in-one setup
-- =============================================================================
-- Run this ONCE in the Supabase SQL editor of the project your admin app's .env
-- points at. It is idempotent (safe to re-run).
--
-- Adds:
--   * kyc_data.utility_bill_review_status (+ reviewer columns) - the app already
--     writes 'pending' here when a user submits their Tier 3 proof of address
--   * a guard trigger so end users can never set review / approval fields
--   * RPCs used by the admin dashboard:
--       admin_kyc_tier_stats, admin_list_kyc, admin_get_kyc_detail, admin_review_tier3
--
-- Equivalent to supabase/migrations/20261101010000, ...0100 and ...0200 applied
-- in order.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Pre-flight: make sure this project has everything the feature depends on.
--    Fails with a readable list instead of a half-applied migration.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing text[] := '{}';
  t text;
  c record;
BEGIN
  FOREACH t IN ARRAY ARRAY['kyc_data','kyc_progress','profiles','audit_logs','kyc_audit_logs'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN missing := missing || ('table public.' || t); END IF;
  END LOOP;

  IF to_regprocedure('public.has_permission(text,uuid)') IS NULL THEN missing := missing || 'function has_permission(text, uuid)'; END IF;
  IF to_regprocedure('public.is_admin()') IS NULL THEN missing := missing || 'function is_admin()'; END IF;
  IF to_regprocedure('public.calculate_user_kyc_tier(uuid)') IS NULL THEN missing := missing || 'function calculate_user_kyc_tier(uuid)'; END IF;
  IF to_regprocedure('public.update_user_kyc_tier(uuid)') IS NULL THEN missing := missing || 'function update_user_kyc_tier(uuid)'; END IF;
  IF to_regproc('public.create_kyc_audit_log') IS NULL THEN missing := missing || 'function create_kyc_audit_log(...)'; END IF;

  FOR c IN
    SELECT * FROM (VALUES
      ('kyc_data','user_id'),('kyc_data','first_name'),('kyc_data','last_name'),('kyc_data','middle_name'),
      ('kyc_data','phone_number'),('kyc_data','address'),('kyc_data','address_no'),('kyc_data','lga'),
      ('kyc_data','state'),('kyc_data','bvn'),('kyc_data','nin'),('kyc_data','document_type'),
      ('kyc_data','utility_bill_url'),('kyc_data','utility_bill_validated'),('kyc_data','utility_bill_verified'),
      ('kyc_data','utility_bill_validation_result'),('kyc_data','house_url'),('kyc_data','approved'),
      ('kyc_data','updated_at'),('kyc_data','created_at'),
      ('kyc_progress','user_id'),('kyc_progress','current_step'),('kyc_progress','tier_1_completed'),
      ('kyc_progress','tier_2_completed'),('kyc_progress','tier_3_completed'),('kyc_progress','liveness_test_completed'),
      ('kyc_progress','bvn_verified'),('kyc_progress','id_face_verified'),('kyc_progress','personal_info_completed'),
      ('kyc_progress','documents_verified'),('kyc_progress','address_completed'),('kyc_progress','utility_bill_verified'),
      ('profiles','email'),('profiles','first_name'),('profiles','last_name'),('profiles','kyc_tier'),('profiles','is_admin'),
      ('audit_logs','user_id'),('audit_logs','action'),('audit_logs','resource_type'),('audit_logs','resource_id'),
      ('audit_logs','old_values'),('audit_logs','new_values')
    ) AS v(tbl, col)
  LOOP
    IF to_regclass('public.' || c.tbl) IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = c.tbl AND column_name = c.col
    ) THEN
      missing := missing || ('column public.' || c.tbl || '.' || c.col);
    END IF;
  END LOOP;

  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'This project is missing objects required by the KYC Tier 3 review feature:\n - %',
      array_to_string(missing, E'\n - ');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.kyc_data
  ADD COLUMN IF NOT EXISTS utility_bill_review_status text,
  ADD COLUMN IF NOT EXISTS utility_bill_reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS utility_bill_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS utility_bill_rejection_reason text;

ALTER TABLE public.kyc_data
  DROP CONSTRAINT IF EXISTS kyc_data_utility_bill_review_status_check;
ALTER TABLE public.kyc_data
  ADD CONSTRAINT kyc_data_utility_bill_review_status_check
  CHECK (utility_bill_review_status IS NULL
         OR utility_bill_review_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_kyc_data_utility_bill_pending
  ON public.kyc_data (updated_at)
  WHERE utility_bill_review_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_kyc_data_utility_bill_reviewed_by
  ON public.kyc_data (utility_bill_reviewed_by);

-- Keep status consistent for users already approved before this column existed
UPDATE public.kyc_data d
SET utility_bill_review_status = 'approved'
FROM public.kyc_progress k
WHERE k.user_id = d.user_id
  AND k.utility_bill_verified = true
  AND d.utility_bill_review_status IS NULL;

-- ---------------------------------------------------------------------------
-- Helper: tolerant timestamptz cast (submitted_at comes from user-written JSON)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kyc_safe_timestamptz(p_value text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN p_value::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Guard trigger
--    Service role / SQL (auth.uid() IS NULL), admins and the review RPC
--    (app.kyc_review = 'on') may change anything. Regular users may only set
--    utility_bill_review_status to 'pending' (a submission); they can never set
--    approval/review fields.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_kyc_review_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR current_setting('app.kyc_review', true) = 'on'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.utility_bill_reviewed_by := NULL;
    NEW.utility_bill_reviewed_at := NULL;
    NEW.utility_bill_rejection_reason := NULL;
    NEW.utility_bill_verified := false;
    NEW.approved := false;
    IF NEW.utility_bill_review_status IS DISTINCT FROM 'pending' THEN
      NEW.utility_bill_review_status := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE by a regular user: review/approval fields are read-only
  NEW.utility_bill_reviewed_by := OLD.utility_bill_reviewed_by;
  NEW.utility_bill_reviewed_at := OLD.utility_bill_reviewed_at;
  NEW.utility_bill_rejection_reason := OLD.utility_bill_rejection_reason;
  NEW.utility_bill_verified := OLD.utility_bill_verified;
  NEW.approved := OLD.approved;

  IF NEW.utility_bill_review_status IS DISTINCT FROM OLD.utility_bill_review_status
     AND NEW.utility_bill_review_status IS DISTINCT FROM 'pending' THEN
    NEW.utility_bill_review_status := OLD.utility_bill_review_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_kyc_review_columns ON public.kyc_data;
CREATE TRIGGER guard_kyc_review_columns
  BEFORE INSERT OR UPDATE ON public.kyc_data
  FOR EACH ROW EXECUTE FUNCTION public.guard_kyc_review_columns();

-- ---------------------------------------------------------------------------
-- 3a. Tier stats (users with a kyc_data row, tier from kyc_progress flags)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_kyc_tier_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.has_permission('kyc.stats')
          OR public.has_permission('kyc.list')
          OR public.has_permission('dashboard.stats.kyc_completed')
          OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: KYC access required';
  END IF;

  SELECT jsonb_build_object(
    'total', count(*),
    'tier0', count(*) FILTER (WHERE tier = 0),
    'tier1', count(*) FILTER (WHERE tier = 1),
    'tier2', count(*) FILTER (WHERE tier = 2),
    'tier3', count(*) FILTER (WHERE tier = 3),
    'tier3_pending', count(*) FILTER (WHERE review_status = 'pending'),
    'tier3_rejected', count(*) FILTER (WHERE review_status = 'rejected')
  )
  INTO v_result
  FROM (
    SELECT
      CASE
        WHEN k.tier_3_completed THEN 3
        WHEN k.tier_2_completed THEN 2
        WHEN k.tier_1_completed THEN 1
        ELSE 0
      END AS tier,
      d.utility_bill_review_status AS review_status
    FROM public.kyc_data d
    LEFT JOIN public.kyc_progress k ON k.user_id = d.user_id
  ) s;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3b. Paginated list (light payload: no document bodies / raw BVN / NIN)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_kyc(
  p_search text DEFAULT NULL,
  p_tier integer DEFAULT NULL,
  p_review_status text DEFAULT NULL,
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
  v_search text := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT (public.has_permission('kyc.list') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: KYC access required';
  END IF;

  WITH base AS (
    SELECT
      d.id,
      d.user_id,
      d.first_name,
      d.last_name,
      pr.email,
      d.phone_number,
      d.state,
      (d.bvn IS NOT NULL) AS has_bvn,
      (d.nin IS NOT NULL) AS has_nin,
      d.document_type,
      (d.selfie_url IS NOT NULL) AS has_selfie,
      (d.document_front_url IS NOT NULL) AS has_document_front,
      (d.document_back_url IS NOT NULL) AS has_document_back,
      (d.utility_bill_url IS NOT NULL) AS has_utility_bill,
      (d.house_url IS NOT NULL) AS has_house_photo,
      d.utility_bill_review_status AS review_status,
      d.utility_bill_validation_result ->> 'bill_type_label' AS bill_type_label,
      COALESCE(
        public.kyc_safe_timestamptz(d.utility_bill_validation_result ->> 'submitted_at'),
        d.updated_at
      ) AS submitted_at,
      d.utility_bill_reviewed_at AS reviewed_at,
      d.utility_bill_rejection_reason AS rejection_reason,
      d.created_at,
      d.updated_at,
      CASE
        WHEN k.tier_3_completed THEN 3
        WHEN k.tier_2_completed THEN 2
        WHEN k.tier_1_completed THEN 1
        ELSE 0
      END AS tier,
      k.current_step,
      COALESCE(k.liveness_test_completed, false) AS liveness_done,
      COALESCE(k.bvn_verified, false) AS bvn_verified,
      COALESCE(k.id_face_verified, false) AS id_face_verified,
      COALESCE(k.personal_info_completed, false) AS personal_info_completed,
      COALESCE(k.documents_verified, false) AS documents_verified,
      COALESCE(k.address_completed, false) AS address_completed,
      COALESCE(k.utility_bill_verified, false) AS utility_bill_verified
    FROM public.kyc_data d
    LEFT JOIN public.kyc_progress k ON k.user_id = d.user_id
    LEFT JOIN public.profiles pr ON pr.id = d.user_id
    WHERE (p_review_status IS NULL
           OR (p_review_status = 'none' AND d.utility_bill_review_status IS NULL)
           OR d.utility_bill_review_status = p_review_status)
      AND (
        v_search IS NULL
        OR d.first_name ILIKE '%' || v_search || '%'
        OR d.last_name ILIKE '%' || v_search || '%'
        OR (COALESCE(d.first_name, '') || ' ' || COALESCE(d.last_name, '')) ILIKE '%' || v_search || '%'
        OR d.phone_number ILIKE '%' || v_search || '%'
        OR pr.email ILIKE '%' || v_search || '%'
        OR d.bvn = v_search
        OR d.nin = v_search
      )
  ),
  filtered AS (
    SELECT * FROM base WHERE p_tier IS NULL OR tier = p_tier
  )
  SELECT
    (SELECT count(*) FROM filtered),
    COALESCE((
      SELECT jsonb_agg(to_jsonb(p) - 'sort_key' ORDER BY p.sort_key ASC NULLS LAST, p.created_at DESC)
      FROM (
        SELECT f.*,
               CASE WHEN p_review_status = 'pending' THEN f.submitted_at END AS sort_key
        FROM filtered f
        ORDER BY
          CASE WHEN p_review_status = 'pending' THEN f.submitted_at END ASC NULLS LAST,
          f.created_at DESC
        LIMIT v_limit OFFSET v_offset
      ) p
    ), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3c. Review RPC (approve / reject)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Grants: authenticated only (permission checks happen inside the functions)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.kyc_safe_timestamptz(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_kyc_review_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_kyc_tier_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_kyc(text, integer, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_tier3(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kyc_safe_timestamptz(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_kyc_tier_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_kyc(text, integer, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_tier3(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3d. Detail RPC for the review drawer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_kyc_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.has_permission('kyc.details')
          OR public.has_permission('kyc.list')
          OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: KYC access required';
  END IF;

  SELECT jsonb_build_object(
    'kyc', to_jsonb(d),
    'progress', to_jsonb(k),
    'email', pr.email,
    'tier', CASE
              WHEN k.tier_3_completed THEN 3
              WHEN k.tier_2_completed THEN 2
              WHEN k.tier_1_completed THEN 1
              ELSE 0
            END,
    'reviewer_name', NULLIF(btrim(COALESCE(rv.first_name, '') || ' ' || COALESCE(rv.last_name, '')), '')
  )
  INTO v_result
  FROM public.kyc_data d
  LEFT JOIN public.kyc_progress k ON k.user_id = d.user_id
  LEFT JOIN public.profiles pr ON pr.id = d.user_id
  LEFT JOIN public.profiles rv ON rv.id = d.utility_bill_reviewed_by
  WHERE d.user_id = p_user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_kyc_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_kyc_detail(uuid) TO authenticated;

-- Make PostgREST pick up the new functions/columns immediately
NOTIFY pgrst, 'reload schema';
