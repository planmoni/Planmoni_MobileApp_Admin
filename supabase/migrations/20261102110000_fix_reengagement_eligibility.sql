/*
  Fix re-engagement eligibility (the Notifications page showed 0 for every category).

  The five get_*_users() functions referenced columns and a table that do not exist in the live schema
  (profiles.full_name, profiles.last_sign_in_at, transactions.wallet_id / transaction_type, a "vaults" table),
  so every call failed and get_reengagement_stats() failed with them.

  Live schema used here:
    - name:      profiles.first_name + last_name (fallback email)
    - sign-in:   auth.users.last_sign_in_at
    - deposits:  transactions.user_id, type = 'deposit', status = 'completed'
    - vaults:    budget_plans (status, current_balance)
    - opt-outs:  profiles.push_notifications -> 'enabled' and the category key; a missing key means "on"

  Return columns are unchanged. Callers: the Notifications page, and push_enqueue_recipients (category audience).
  The functions return personal data, so they are now admin-only for signed-in users (internal/service calls,
  which have no auth.uid(), are still allowed) and are no longer executable by anon.
*/

CREATE OR REPLACE FUNCTION public.get_zero_balance_users()
RETURNS TABLE(user_id uuid, email text, full_name text, balance numeric, last_transaction_date timestamptz, days_at_zero integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NOT NULL THEN PERFORM public._admin_push_assert(false); END IF;

  RETURN QUERY
  SELECT p.id,
         p.email::text,
         COALESCE(NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), p.email)::text,
         COALESCE(w.bal, 0)::numeric,
         COALESCE(w.upd, p.created_at),
         EXTRACT(DAY FROM now() - COALESCE(w.upd, p.created_at))::integer
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT sum(x.balance) AS bal, max(x.updated_at) AS upd FROM public.wallets x WHERE x.user_id = p.id
  ) w ON true
  WHERE COALESCE(w.bal, 0) = 0
    AND COALESCE(w.upd, p.created_at) < now() - interval '3 days'
    AND EXISTS (SELECT 1 FROM public.user_push_tokens t WHERE t.user_id = p.id AND t.is_active)
    AND COALESCE(p.push_notifications -> 'enabled', 'true'::jsonb) <> 'false'::jsonb
    AND (p.last_reengagement_sent ->> 'zero_balance_reminder' IS NULL
         OR (p.last_reengagement_sent ->> 'zero_balance_reminder')::timestamptz < now() - interval '7 days')
  ORDER BY 6 DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unfunded_vault_users()
RETURNS TABLE(user_id uuid, email text, full_name text, vault_count integer, unfunded_vault_names text[], vault_created_date timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NOT NULL THEN PERFORM public._admin_push_assert(false); END IF;

  RETURN QUERY
  SELECT p.id,
         p.email::text,
         COALESCE(NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), p.email)::text,
         count(DISTINCT v.id)::integer,
         array_agg(DISTINCT COALESCE(NULLIF(v.name, ''), v.plan_name)),
         min(v.created_at)
  FROM public.profiles p
  JOIN public.budget_plans v ON v.user_id = p.id
  WHERE v.status = 'active'
    AND COALESCE(v.current_balance, 0) = 0
    AND v.created_at < now() - interval '1 day'
    AND EXISTS (SELECT 1 FROM public.user_push_tokens t WHERE t.user_id = p.id AND t.is_active)
    AND COALESCE(p.push_notifications -> 'enabled', 'true'::jsonb) <> 'false'::jsonb
    AND COALESCE(p.push_notifications -> 'vault_updates', 'true'::jsonb) <> 'false'::jsonb
    AND (p.last_reengagement_sent ->> 'vault_unfunded_reminder' IS NULL
         OR (p.last_reengagement_sent ->> 'vault_unfunded_reminder')::timestamptz < now() - interval '7 days')
  GROUP BY p.id, p.email, p.first_name, p.last_name
  ORDER BY min(v.created_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_deposit_no_plan_users()
RETURNS TABLE(user_id uuid, email text, full_name text, balance numeric, last_deposit_date timestamptz, total_deposited numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NOT NULL THEN PERFORM public._admin_push_assert(false); END IF;

  RETURN QUERY
  SELECT p.id,
         p.email::text,
         COALESCE(NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), p.email)::text,
         COALESCE((SELECT sum(x.balance) FROM public.wallets x WHERE x.user_id = p.id), 0)::numeric,
         d.last_deposit,
         d.total
  FROM public.profiles p
  JOIN (
    SELECT t.user_id AS uid, max(t.created_at) AS last_deposit, sum(t.amount) AS total
    FROM public.transactions t
    WHERE t.type = 'deposit' AND t.status = 'completed'
    GROUP BY t.user_id
    HAVING max(t.created_at) > now() - interval '30 days'
  ) d ON d.uid = p.id
  WHERE NOT EXISTS (SELECT 1 FROM public.payout_plans pp WHERE pp.user_id = p.id)
    AND EXISTS (SELECT 1 FROM public.user_push_tokens t WHERE t.user_id = p.id AND t.is_active)
    AND COALESCE(p.push_notifications -> 'enabled', 'true'::jsonb) <> 'false'::jsonb
    AND COALESCE(p.push_notifications -> 'deposit_no_plan_nudge', 'true'::jsonb) <> 'false'::jsonb
    AND (p.last_reengagement_sent ->> 'deposit_no_plan' IS NULL
         OR (p.last_reengagement_sent ->> 'deposit_no_plan')::timestamptz < now() - interval '7 days');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_no_plan_users()
RETURNS TABLE(user_id uuid, email text, full_name text, signup_date timestamptz, days_since_signup integer, has_deposited boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NOT NULL THEN PERFORM public._admin_push_assert(false); END IF;

  RETURN QUERY
  SELECT p.id,
         p.email::text,
         COALESCE(NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), p.email)::text,
         p.created_at,
         EXTRACT(DAY FROM now() - p.created_at)::integer,
         EXISTS (SELECT 1 FROM public.transactions t
                 WHERE t.user_id = p.id AND t.type = 'deposit' AND t.status = 'completed')
  FROM public.profiles p
  WHERE NOT EXISTS (SELECT 1 FROM public.payout_plans pp WHERE pp.user_id = p.id)
    AND p.created_at < now() - interval '3 days'
    AND p.created_at > now() - interval '60 days'
    AND EXISTS (SELECT 1 FROM public.user_push_tokens t WHERE t.user_id = p.id AND t.is_active)
    AND COALESCE(p.push_notifications -> 'enabled', 'true'::jsonb) <> 'false'::jsonb
    AND COALESCE(p.push_notifications -> 'no_plan_nudge', 'true'::jsonb) <> 'false'::jsonb
    AND (p.last_reengagement_sent ->> 'no_plan_yet' IS NULL
         OR (p.last_reengagement_sent ->> 'no_plan_yet')::timestamptz < now() - interval '7 days')
  ORDER BY 5 DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_inactive_users()
RETURNS TABLE(user_id uuid, email text, full_name text, last_activity timestamptz, days_inactive integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NOT NULL THEN PERFORM public._admin_push_assert(false); END IF;

  RETURN QUERY
  SELECT p.id,
         p.email::text,
         COALESCE(NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), p.email)::text,
         COALESCE(u.last_sign_in_at, p.created_at),
         EXTRACT(DAY FROM now() - COALESCE(u.last_sign_in_at, p.created_at))::integer
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE COALESCE(u.last_sign_in_at, p.created_at) < now() - interval '14 days'
    AND EXISTS (SELECT 1 FROM public.user_push_tokens t WHERE t.user_id = p.id AND t.is_active)
    AND COALESCE(p.push_notifications -> 'enabled', 'true'::jsonb) <> 'false'::jsonb
    AND COALESCE(p.push_notifications -> 're_engagement', 'true'::jsonb) <> 'false'::jsonb
    AND (p.last_reengagement_sent ->> 're_engagement' IS NULL
         OR (p.last_reengagement_sent ->> 're_engagement')::timestamptz < now() - interval '7 days')
  ORDER BY 5 DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_reengagement_stats()
RETURNS TABLE(category text, eligible_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN PERFORM public._admin_push_assert(false); END IF;

  RETURN QUERY
  SELECT 'zero_balance_reminder'::text, count(*) FROM public.get_zero_balance_users()
  UNION ALL
  SELECT 'vault_unfunded_reminder'::text, count(*) FROM public.get_unfunded_vault_users()
  UNION ALL
  SELECT 'deposit_no_plan'::text, count(*) FROM public.get_deposit_no_plan_users()
  UNION ALL
  SELECT 'no_plan_yet'::text, count(*) FROM public.get_no_plan_users()
  UNION ALL
  SELECT 're_engagement'::text, count(*) FROM public.get_inactive_users();
END;
$$;

REVOKE ALL ON FUNCTION public.get_zero_balance_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_unfunded_vault_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_deposit_no_plan_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_no_plan_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_inactive_users() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_reengagement_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_zero_balance_users() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_unfunded_vault_users() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_deposit_no_plan_users() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_no_plan_users() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_inactive_users() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_reengagement_stats() TO authenticated, service_role;

-- push_notifications.target_user_ids defaults to '{}', so "no explicit users" must mean NULL or empty.
CREATE OR REPLACE FUNCTION public.push_enqueue_recipients(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n public.push_notifications%ROWTYPE;
  v_users bigint;
  v_opted_out bigint;
  v_over_cap bigint;
  v_queued bigint;
BEGIN
  SELECT * INTO n FROM public.push_notifications WHERE id = p_notification_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found';
  END IF;

  WITH a AS MATERIALIZED (
    SELECT * FROM public._push_audience(
      n.target_type, n.target_segment_id, n.target_user_ids,
      CASE WHEN n.notification_type = 'reengagement' AND COALESCE(cardinality(n.target_user_ids), 0) = 0
           THEN n.notification_category END,
      n.respect_marketing_pref
    )
  ),
  ins AS (
    INSERT INTO public.push_notification_recipients (push_notification_id, user_id, expo_push_token, status)
    SELECT n.id, a.user_id, a.expo_push_token, 'pending'
    FROM a
    WHERE NOT a.opted_out AND a.rn <= n.max_tokens_per_user
    ON CONFLICT (push_notification_id, expo_push_token) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(DISTINCT user_id) FROM a WHERE NOT opted_out),
         (SELECT count(DISTINCT user_id) FROM a WHERE opted_out),
         (SELECT count(*) FROM a WHERE NOT opted_out AND rn > n.max_tokens_per_user),
         (SELECT count(*) FROM ins)
  INTO v_users, v_opted_out, v_over_cap, v_queued;

  IF (SELECT count(*) FROM public.push_notification_recipients WHERE push_notification_id = n.id) = 0 THEN
    UPDATE public.push_notifications
    SET status = 'failed', queue_enabled = true, error = 'No eligible devices for this audience',
        total_recipients = 0, sent_at = now(), updated_at = now()
    WHERE id = n.id;
  ELSE
    UPDATE public.push_notifications
    SET status = 'sending', queue_enabled = true, next_send_at = NULL, error = NULL, updated_at = now()
    WHERE id = n.id AND status IN ('draft', 'scheduled', 'sending', 'failed');
    PERFORM public.push_recount(n.id);
  END IF;

  RETURN jsonb_build_object(
    'users', v_users,
    'devices_queued', v_queued,
    'opted_out_users', v_opted_out,
    'devices_over_cap', v_over_cap
  );
END;
$$;
REVOKE ALL ON FUNCTION public.push_enqueue_recipients(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_enqueue_recipients(uuid) TO service_role;
