-- Single-user KYC detail for the admin review drawer (full row incl. documents,
-- progress flags, profile email and reviewer name). Gated by kyc.details / kyc.list.

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
