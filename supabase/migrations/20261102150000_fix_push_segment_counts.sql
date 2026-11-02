/*
  Push segment numbers shown in the compose modal were not the numbers a send would reach:
    - "All Users" showed 0: the page counted user_push_tokens straight from the browser, and that table only lets a user
      see their own tokens, so an admin always counted 0.
    - "KYC Completed" showed 0: it checked kyc_data.approved, a flag nothing sets any more (all rows false). KYC is
      tracked in kyc_progress tiers now; a user counts as KYC completed once Tier 1 or higher is done.
    - The stored counts used their own SQL, separate from the SQL that builds the send.

  Now a segment's count is computed by the same audience function the send uses (_push_audience): people who match the
  segment, have notifications on and have at least one usable device. A segment type the send does not support
  (High Value Users) counts 0 and is greyed out in the modal.
*/
CREATE OR REPLACE FUNCTION public._push_audience(
  p_target_type text,
  p_segment_id uuid,
  p_user_ids uuid[],
  p_category text,
  p_respect_marketing boolean
)
RETURNS TABLE(user_id uuid, expo_push_token text, first_name text, rn integer, opted_out boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_ids uuid[] := p_user_ids;
  v_type text := p_target_type;
  v_seg text;
  v_days integer;
  v_fn text;
BEGIN
  IF p_category IS NOT NULL THEN
    v_fn := CASE p_category
      WHEN 'zero_balance_reminder' THEN 'get_zero_balance_users'
      WHEN 'vault_unfunded_reminder' THEN 'get_unfunded_vault_users'
      WHEN 'deposit_no_plan' THEN 'get_deposit_no_plan_users'
      WHEN 'no_plan_yet' THEN 'get_no_plan_users'
      WHEN 're_engagement' THEN 'get_inactive_users'
      ELSE NULL
    END;
    IF v_fn IS NULL THEN
      RAISE EXCEPTION 'Invalid re-engagement category';
    END IF;
    EXECUTE format('SELECT COALESCE(array_agg(DISTINCT x.user_id), ARRAY[]::uuid[]) FROM public.%I() x', v_fn)
      INTO v_ids;
    v_type := 'individual';
  END IF;

  IF v_type = 'segment' THEN
    SELECT s.filter_criteria ->> 'type',
           CASE WHEN (s.filter_criteria ->> 'days') ~ '^[0-9]{1,4}$' THEN (s.filter_criteria ->> 'days')::integer END
    INTO v_seg, v_days
    FROM public.push_notification_segments s
    WHERE s.id = p_segment_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Segment not found';
    END IF;
    IF v_seg IS NULL OR v_seg NOT IN ('all', 'has_active_plans', 'kyc_approved', 'joined_recently') THEN
      RAISE EXCEPTION 'This segment type (%) is not supported for sending', COALESCE(v_seg, 'none');
    END IF;
  ELSIF v_type NOT IN ('all', 'individual') THEN
    RAISE EXCEPTION 'Unknown target type';
  END IF;

  RETURN QUERY
  WITH aud AS MATERIALIZED (
    SELECT p.id AS uid,
           p.first_name AS fname,
           (COALESCE(p.push_notifications -> 'enabled' = 'false'::jsonb, false)
            OR (p_respect_marketing AND COALESCE(p.push_notifications -> 'marketing_alerts' = 'false'::jsonb, false))) AS out_
    FROM public.profiles p
    WHERE CASE
      WHEN v_type = 'all' THEN true
      WHEN v_type = 'individual' THEN p.id = ANY (COALESCE(v_ids, ARRAY[]::uuid[]))
      WHEN v_seg = 'all' THEN true
      WHEN v_seg = 'has_active_plans' THEN
        EXISTS (SELECT 1 FROM public.payout_plans pp WHERE pp.user_id = p.id AND pp.status = 'active')
      WHEN v_seg = 'kyc_approved' THEN
        EXISTS (SELECT 1 FROM public.kyc_progress k
                WHERE k.user_id = p.id
                  AND (COALESCE(k.tier_1_completed, false) OR COALESCE(k.tier_2_completed, false) OR COALESCE(k.tier_3_completed, false)))
      WHEN v_seg = 'joined_recently' THEN
        p.created_at >= now() - make_interval(days => COALESCE(v_days, 30))
      ELSE false
    END
  ),
  tok AS (
    SELECT t.user_id AS uid,
           t.expo_push_token AS token,
           row_number() OVER (
             PARTITION BY t.user_id
             ORDER BY GREATEST(COALESCE(t.last_used, '-infinity'::timestamptz),
                               COALESCE(t.updated_at, '-infinity'::timestamptz),
                               COALESCE(t.created_at, '-infinity'::timestamptz)) DESC,
                      t.id
           )::integer AS rn
    FROM public.user_push_tokens t
    WHERE t.is_active
      AND t.user_id IN (SELECT a.uid FROM aud a)
      AND (t.expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$'
           OR t.expo_push_token ~ '^[a-zA-Z0-9_-]{22}$')
  )
  SELECT a.uid, k.token, a.fname, k.rn, a.out_
  FROM aud a
  JOIN tok k ON k.uid = a.uid;
END;
$function$;

REVOKE ALL ON FUNCTION public._push_audience(text, uuid, uuid[], text, boolean) FROM PUBLIC, anon, authenticated;

-- Count = people a send to this segment would reach (same function the send uses). Unsupported segment types count 0.
CREATE OR REPLACE FUNCTION public.calculate_segment_user_count(p_segment_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  SELECT count(DISTINCT a.user_id)::integer INTO v_count
  FROM public._push_audience('segment', p_segment_id, NULL, NULL, false) a
  WHERE NOT a.opted_out;
  RETURN COALESCE(v_count, 0);
EXCEPTION WHEN OTHERS THEN
  RETURN 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_all_segment_user_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_segment RECORD;
BEGIN
  FOR v_segment IN SELECT id FROM public.push_notification_segments
  LOOP
    UPDATE public.push_notification_segments
    SET user_count = public.calculate_segment_user_count(v_segment.id), updated_at = now()
    WHERE id = v_segment.id;
  END LOOP;
END;
$function$;

-- refresh the stored numbers now
SELECT public.update_all_segment_user_counts();
