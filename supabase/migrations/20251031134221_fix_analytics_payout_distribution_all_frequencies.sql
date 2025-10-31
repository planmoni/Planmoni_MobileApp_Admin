/*
  # Fix Analytics Payout Distribution - Include All Frequency Types

  1. Changes
    - Updates get_analytics_data() function to include all 10 frequency types
    - Uses correct database frequency values
    
  2. Frequency Types (Complete List)
    - daily
    - weekly
    - weekly_specific (specific days)
    - biweekly
    - monthly
    - end_of_month (month end)
    - quarterly
    - biannual (bi-annually)
    - annually
    - custom
*/

CREATE OR REPLACE FUNCTION get_analytics_data()
RETURNS TABLE (
  user_growth jsonb,
  transaction_volume jsonb,
  payout_distribution jsonb,
  retention_rate jsonb,
  daily_transactions jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_month_start date := date_trunc('month', CURRENT_DATE);
  last_month_start date := date_trunc('month', CURRENT_DATE - interval '1 month');
  last_month_end date := date_trunc('month', CURRENT_DATE) - interval '1 day';
  six_months_ago date := CURRENT_DATE - interval '6 months';
  thirty_days_ago date := CURRENT_DATE - interval '30 days';
  seven_days_ago date := CURRENT_DATE - interval '7 days';
  
  this_month_users bigint;
  last_month_users bigint;
  this_month_volume numeric;
  last_month_volume numeric;
  monthly_user_data jsonb := '[]'::jsonb;
  monthly_volume_data jsonb := '[]'::jsonb;
  daily_data jsonb := '[]'::jsonb;
  payout_dist jsonb;
  retention_data jsonb;
BEGIN
  -- User Growth Data
  SELECT COUNT(*) INTO this_month_users
  FROM profiles
  WHERE created_at >= current_month_start;
  
  SELECT COUNT(*) INTO last_month_users
  FROM profiles
  WHERE created_at >= last_month_start AND created_at <= last_month_end;
  
  -- Monthly user growth for last 6 months
  FOR i IN 0..5 LOOP
    DECLARE
      month_start date := date_trunc('month', CURRENT_DATE - (i || ' months')::interval);
      month_end date := date_trunc('month', CURRENT_DATE - (i || ' months')::interval) + interval '1 month' - interval '1 day';
      month_users bigint;
    BEGIN
      SELECT COUNT(*) INTO month_users
      FROM profiles
      WHERE created_at >= month_start AND created_at <= month_end;
      
      monthly_user_data := jsonb_build_object(
        'month', month_start,
        'users', month_users
      ) || monthly_user_data;
    END;
  END LOOP;
  
  user_growth := jsonb_build_object(
    'this_month', this_month_users,
    'last_month', last_month_users,
    'percent_change', CASE 
      WHEN last_month_users = 0 THEN 100
      ELSE ROUND(((this_month_users - last_month_users)::numeric / last_month_users * 100), 1)
    END,
    'monthly_data', monthly_user_data
  );
  
  -- Transaction Volume Data
  SELECT COALESCE(SUM(amount), 0) INTO this_month_volume
  FROM transactions
  WHERE created_at >= current_month_start;
  
  SELECT COALESCE(SUM(amount), 0) INTO last_month_volume
  FROM transactions
  WHERE created_at >= last_month_start AND created_at <= last_month_end;
  
  -- Monthly volume for last 6 months
  FOR i IN 0..5 LOOP
    DECLARE
      month_start date := date_trunc('month', CURRENT_DATE - (i || ' months')::interval);
      month_end date := date_trunc('month', CURRENT_DATE - (i || ' months')::interval) + interval '1 month' - interval '1 day';
      month_volume numeric;
    BEGIN
      SELECT COALESCE(SUM(amount), 0) INTO month_volume
      FROM transactions
      WHERE created_at >= month_start AND created_at <= month_end;
      
      monthly_volume_data := jsonb_build_object(
        'month', month_start,
        'volume', month_volume
      ) || monthly_volume_data;
    END;
  END LOOP;
  
  transaction_volume := jsonb_build_object(
    'this_month', this_month_volume,
    'last_month', last_month_volume,
    'percent_change', CASE 
      WHEN last_month_volume = 0 THEN 100
      ELSE ROUND(((this_month_volume - last_month_volume) / last_month_volume * 100), 1)
    END,
    'monthly_data', monthly_volume_data
  );
  
  -- Payout Distribution - ALL 10 FREQUENCY TYPES with correct database values
  SELECT jsonb_build_object(
    'daily', COUNT(*) FILTER (WHERE frequency = 'daily'),
    'weekly', COUNT(*) FILTER (WHERE frequency = 'weekly'),
    'biweekly', COUNT(*) FILTER (WHERE frequency = 'biweekly'),
    'specificDays', COUNT(*) FILTER (WHERE frequency = 'weekly_specific'),
    'monthEnd', COUNT(*) FILTER (WHERE frequency = 'end_of_month'),
    'monthly', COUNT(*) FILTER (WHERE frequency = 'monthly'),
    'quarterly', COUNT(*) FILTER (WHERE frequency = 'quarterly'),
    'biAnnually', COUNT(*) FILTER (WHERE frequency = 'biannual'),
    'annually', COUNT(*) FILTER (WHERE frequency = 'annually'),
    'custom', COUNT(*) FILTER (WHERE frequency = 'custom')
  ) INTO payout_dist
  FROM payout_plans;
  
  payout_distribution := payout_dist;
  
  -- Daily Transaction Activity (last 7 days)
  FOR i IN 0..6 LOOP
    DECLARE
      target_date date := CURRENT_DATE - i;
      deposits_count bigint;
      payouts_count bigint;
      deposits_amount numeric;
      payouts_amount numeric;
    BEGIN
      SELECT 
        COUNT(*) FILTER (WHERE type = 'deposit'),
        COUNT(*) FILTER (WHERE type = 'payout'),
        COALESCE(SUM(amount) FILTER (WHERE type = 'deposit'), 0),
        COALESCE(SUM(amount) FILTER (WHERE type = 'payout'), 0)
      INTO deposits_count, payouts_count, deposits_amount, payouts_amount
      FROM transactions
      WHERE DATE(created_at) = target_date;
      
      daily_data := jsonb_build_object(
        'date', target_date,
        'deposits_count', deposits_count,
        'payouts_count', payouts_count,
        'deposits_amount', deposits_amount,
        'payouts_amount', payouts_amount
      ) || daily_data;
    END;
  END LOOP;
  
  daily_transactions := daily_data;
  
  -- Retention Rate (users with multiple transactions in last 30 days)
  DECLARE
    users_with_multiple_transactions bigint;
    total_active_users bigint;
    retention_rate_value numeric;
  BEGIN
    SELECT COUNT(DISTINCT user_id) INTO total_active_users
    FROM transactions
    WHERE created_at >= thirty_days_ago;
    
    SELECT COUNT(*) INTO users_with_multiple_transactions
    FROM (
      SELECT user_id
      FROM transactions
      WHERE created_at >= thirty_days_ago
      GROUP BY user_id
      HAVING COUNT(*) >= 2
    ) subq;
    
    retention_rate_value := CASE 
      WHEN total_active_users = 0 THEN 0
      ELSE ROUND((users_with_multiple_transactions::numeric / total_active_users * 100), 1)
    END;
    
    retention_rate := jsonb_build_object(
      'value', retention_rate_value,
      'trend', 'up',
      'percent_change', 0
    );
  END;
  
  RETURN NEXT;
END;
$$;
