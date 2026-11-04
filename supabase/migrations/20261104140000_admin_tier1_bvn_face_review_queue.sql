-- Expose Tier 1 BVN face-mismatch manual review in admin list/stats/detail.
-- Review decisions already live in admin_review_tier1_bvn (app repo).

DROP FUNCTION IF EXISTS public.admin_list_kyc(text, integer, text, integer, integer);

CREATE OR REPLACE FUNCTION public.admin_list_kyc(
  p_search text DEFAULT NULL,
  p_tier integer DEFAULT NULL,
  p_review_status text DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_bvn_review_status text DEFAULT NULL
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
      d.id, d.user_id, d.first_name, d.last_name, pr.email, d.phone_number, d.state,
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
      d.bvn_face_review_status AS bvn_review_status,
      d.bvn_face_review_submitted_at AS bvn_submitted_at,
      d.bvn_face_reviewed_at AS bvn_reviewed_at,
      d.bvn_face_rejection_reason AS bvn_rejection_reason,
      d.created_at,
      d.updated_at,
      CASE WHEN k.tier_3_completed THEN 3 WHEN k.tier_2_completed THEN 2 WHEN k.tier_1_completed THEN 1 ELSE 0 END AS tier,
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
    WHERE (
      p_review_status IS NULL
      OR (
        p_review_status = 'none'
        AND (d.utility_bill_review_status IS NULL OR d.utility_bill_review_status = 'not_submitted')
      )
      OR d.utility_bill_review_status = p_review_status
    )
      AND (
        p_bvn_review_status IS NULL
        OR (
          p_bvn_review_status = 'none'
          AND (d.bvn_face_review_status IS NULL OR d.bvn_face_review_status = 'not_submitted')
        )
        OR d.bvn_face_review_status = p_bvn_review_status
      )
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
        SELECT
          f.*,
          CASE
            WHEN p_bvn_review_status = 'pending' THEN f.bvn_submitted_at
            WHEN p_review_status = 'pending' THEN f.submitted_at
            ELSE NULL
          END AS sort_key
        FROM filtered f
        ORDER BY
          CASE
            WHEN p_bvn_review_status = 'pending' THEN f.bvn_submitted_at
            WHEN p_review_status = 'pending' THEN f.submitted_at
            ELSE NULL
          END ASC NULLS LAST,
          f.created_at DESC
        LIMIT v_limit OFFSET v_offset
      ) p
    ), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

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
  IF NOT (
    public.has_permission('kyc.stats')
    OR public.has_permission('kyc.list')
    OR public.has_permission('dashboard.stats.kyc_completed')
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Permission denied: KYC access required';
  END IF;

  SELECT jsonb_build_object(
    'total', count(*),
    'tier0', count(*) FILTER (WHERE tier = 0),
    'tier1', count(*) FILTER (WHERE tier = 1),
    'tier2', count(*) FILTER (WHERE tier = 2),
    'tier3', count(*) FILTER (WHERE tier = 3),
    'tier3_pending', count(*) FILTER (WHERE review_status = 'pending'),
    'tier3_rejected', count(*) FILTER (WHERE review_status = 'rejected'),
    'tier1_bvn_pending', count(*) FILTER (WHERE bvn_review_status = 'pending'),
    'tier1_bvn_rejected', count(*) FILTER (WHERE bvn_review_status = 'rejected')
  )
  INTO v_result
  FROM (
    SELECT
      CASE WHEN k.tier_3_completed THEN 3 WHEN k.tier_2_completed THEN 2 WHEN k.tier_1_completed THEN 1 ELSE 0 END AS tier,
      d.utility_bill_review_status AS review_status,
      d.bvn_face_review_status AS bvn_review_status
    FROM public.kyc_data d
    LEFT JOIN public.kyc_progress k ON k.user_id = d.user_id
  ) s;

  RETURN v_result;
END;
$$;

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
  IF NOT (public.has_permission('kyc.details') OR public.has_permission('kyc.list') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: KYC access required';
  END IF;

  SELECT jsonb_build_object(
    'kyc', to_jsonb(d),
    'progress', to_jsonb(k),
    'email', pr.email,
    'tier', CASE WHEN k.tier_3_completed THEN 3 WHEN k.tier_2_completed THEN 2 WHEN k.tier_1_completed THEN 1 ELSE 0 END,
    'reviewer_name', NULLIF(btrim(COALESCE(rv.first_name, '') || ' ' || COALESCE(rv.last_name, '')), ''),
    'bvn_reviewer_name', NULLIF(btrim(COALESCE(br.first_name, '') || ' ' || COALESCE(br.last_name, '')), '')
  )
  INTO v_result
  FROM public.kyc_data d
  LEFT JOIN public.kyc_progress k ON k.user_id = d.user_id
  LEFT JOIN public.profiles pr ON pr.id = d.user_id
  LEFT JOIN public.profiles rv ON rv.id = d.utility_bill_reviewed_by
  LEFT JOIN public.profiles br ON br.id = d.bvn_face_reviewed_by
  WHERE d.user_id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_kyc(text, integer, text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_kyc_tier_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_kyc_detail(uuid) TO authenticated;
