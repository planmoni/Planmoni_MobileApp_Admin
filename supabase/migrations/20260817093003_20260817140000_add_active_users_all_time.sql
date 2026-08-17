-- Add active_users_all_time to get_user_management_data
-- Counts all distinct users who have ever had a transaction (not just this month)

DROP FUNCTION IF EXISTS public.get_user_management_data();

CREATE FUNCTION public.get_user_management_data()
RETURNS TABLE(
  total_users bigint,
  new_users_today bigint,
  new_users_this_week bigint,
  new_users_this_month bigint,
  active_users_today bigint,
  active_users_this_week bigint,
  active_users_this_month bigint,
  active_users_all_time bigint,
  users_with_balance bigint,
  users_with_plans bigint,
  admin_users bigint,
  verified_users bigint,
  total_wallet_balance numeric,
  total_locked_balance numeric,
  total_plans_amount numeric,
  user_growth_trend jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  growth_data jsonb := '[]'::jsonb;
BEGIN
  FOR i IN 0..29 LOOP
    DECLARE
      target_date date := CURRENT_DATE - i;
      daily_new_users bigint;
    BEGIN
      SELECT COUNT(*) INTO daily_new_users
      FROM profiles
      WHERE DATE(created_at) = target_date;

      growth_data := jsonb_build_object(
        'date', target_date,
        'new_users', daily_new_users
      ) || growth_data;
    END;
  END LOOP;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM profiles)::bigint as total_users,
    (SELECT COUNT(*) FROM profiles WHERE DATE(created_at) = CURRENT_DATE)::bigint as new_users_today,
    (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE - interval '7 days')::bigint as new_users_this_week,
    (SELECT COUNT(*) FROM profiles WHERE created_at >= date_trunc('month', CURRENT_DATE))::bigint as new_users_this_month,

    (SELECT COUNT(DISTINCT user_id) FROM transactions WHERE DATE(created_at) = CURRENT_DATE)::bigint as active_users_today,
    (SELECT COUNT(DISTINCT user_id) FROM transactions WHERE created_at >= CURRENT_DATE - interval '7 days')::bigint as active_users_week,
    (SELECT COUNT(DISTINCT user_id) FROM transactions WHERE created_at >= date_trunc('month', CURRENT_DATE))::bigint as active_users_this_month,
    (SELECT COUNT(DISTINCT user_id) FROM transactions)::bigint as active_users_all_time,

    (SELECT COUNT(*) FROM profiles p JOIN wallets w ON p.id = w.user_id WHERE w.available_balance > 0)::bigint as users_with_balance,
    (SELECT COUNT(DISTINCT user_id) FROM payout_plans)::bigint as users_with_plans,
    (SELECT COUNT(*) FROM profiles WHERE is_admin = true)::bigint as admin_users,
    (SELECT COUNT(*) FROM profiles)::bigint as verified_users,

    (SELECT COALESCE(SUM(available_balance), 0) FROM wallets) as total_wallet_balance,
    (SELECT COALESCE(SUM(locked_balance), 0) FROM wallets) as total_locked_balance,
    (SELECT COALESCE(SUM(w.locked_balance), 0)
       FROM wallets w
       WHERE w.user_id IN (
         SELECT DISTINCT user_id FROM payout_plans
       )
    ) as total_plans_amount,

    growth_data as user_growth_trend;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_management_data() TO authenticated;
