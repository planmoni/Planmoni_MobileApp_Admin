/*
  # Fix Total Deposits Calculation
  
  1. Investigation
    - Check if get_dashboard_stats function is correctly calculating deposits
    - Verify transaction data integrity
    - Update function to handle edge cases
  
  2. Fixes
    - Ensure proper filtering of deposit transactions
    - Add status filtering for completed transactions only
    - Improve error handling and data validation
*/

-- First, let's check the current get_dashboard_stats function and fix any issues
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_users bigint,
  total_deposits numeric,
  total_payouts numeric,
  total_plans bigint,
  transaction_trends jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trend_data jsonb := '[]'::jsonb;
  day_data jsonb;
  current_date_iter date;
  transaction_count bigint;
BEGIN
  -- Get total users count
  SELECT COUNT(*) INTO total_users FROM profiles;
  
  -- Get total deposits amount (only completed transactions)
  SELECT COALESCE(SUM(amount), 0) INTO total_deposits 
  FROM transactions 
  WHERE type = 'deposit' 
  AND status = 'completed';
  
  -- Get total payouts amount (only completed transactions)
  SELECT COALESCE(SUM(amount), 0) INTO total_payouts 
  FROM transactions 
  WHERE type = 'payout'
  AND status = 'completed';
  
  -- Get total payout plans count
  SELECT COUNT(*) INTO total_plans FROM payout_plans;
  
  -- Generate transaction trends for last 7 days
  FOR i IN 0..6 LOOP
    current_date_iter := CURRENT_DATE - i;
    
    SELECT COUNT(*) INTO transaction_count
    FROM transactions
    WHERE DATE(created_at) = current_date_iter
    AND status = 'completed';
    
    day_data := jsonb_build_object(
      'day', current_date_iter::text,
      'total_transactions', transaction_count
    );
    
    trend_data := trend_data || day_data;
  END LOOP;
  
  -- Reverse the array to have oldest date first
  SELECT jsonb_agg(value ORDER BY (value->>'day')::date) INTO transaction_trends
  FROM jsonb_array_elements(trend_data) AS value;
  
  RETURN NEXT;
END;
$$;

-- Also update the analytics function to ensure consistency
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
  
  -- Transaction Volume Data (only completed transactions)
  SELECT COALESCE(SUM(amount), 0) INTO this_month_volume
  FROM transactions
  WHERE created_at >= current_month_start
  AND status = 'completed';
  
  SELECT COALESCE(SUM(amount), 0) INTO last_month_volume
  FROM transactions
  WHERE created_at >= last_month_start 
  AND created_at <= last_month_end
  AND status = 'completed';
  
  -- Monthly volume for last 6 months (only completed transactions)
  FOR i IN 0..5 LOOP
    DECLARE
      month_start date := date_trunc('month', CURRENT_DATE - (i || ' months')::interval);
      month_end date := date_trunc('month', CURRENT_DATE - (i || ' months')::interval) + interval '1 month' - interval '1 day';
      month_volume numeric;
    BEGIN
      SELECT COALESCE(SUM(amount), 0) INTO month_volume
      FROM transactions
      WHERE created_at >= month_start 
      AND created_at <= month_end
      AND status = 'completed';
      
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
  
  -- Payout Distribution
  SELECT jsonb_build_object(
    'weekly', COUNT(*) FILTER (WHERE frequency = 'weekly'),
    'biweekly', COUNT(*) FILTER (WHERE frequency = 'biweekly'),
    'monthly', COUNT(*) FILTER (WHERE frequency = 'monthly'),
    'custom', COUNT(*) FILTER (WHERE frequency = 'custom')
  ) INTO payout_dist
  FROM payout_plans;
  
  payout_distribution := payout_dist;
  
  -- Daily Transaction Activity (last 7 days) - only completed transactions
  FOR i IN 0..6 LOOP
    DECLARE
      target_date date := CURRENT_DATE - i;
      deposits_count bigint;
      payouts_count bigint;
      deposits_amount numeric;
      payouts_amount numeric;
    BEGIN
      SELECT 
        COUNT(*) FILTER (WHERE type = 'deposit' AND status = 'completed'),
        COUNT(*) FILTER (WHERE type = 'payout' AND status = 'completed'),
        COALESCE(SUM(amount) FILTER (WHERE type = 'deposit' AND status = 'completed'), 0),
        COALESCE(SUM(amount) FILTER (WHERE type = 'payout' AND status = 'completed'), 0)
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
    WHERE created_at >= thirty_days_ago
    AND status = 'completed';
    
    SELECT COUNT(*) INTO users_with_multiple_transactions
    FROM (
      SELECT user_id
      FROM transactions
      WHERE created_at >= thirty_days_ago
      AND status = 'completed'
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

-- Update transaction statistics function to only count completed transactions
CREATE OR REPLACE FUNCTION get_transaction_stats(
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL
)
RETURNS TABLE (
  total_transactions bigint,
  total_volume numeric,
  total_deposits numeric,
  total_payouts numeric,
  total_withdrawals numeric,
  pending_transactions bigint,
  completed_transactions bigint,
  failed_transactions bigint,
  avg_transaction_amount numeric,
  largest_transaction numeric,
  transactions_today bigint,
  volume_today numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  where_clause text := '';
BEGIN
  -- Build WHERE clause for date filtering
  IF start_date IS NOT NULL THEN
    where_clause := where_clause || ' AND DATE(created_at) >= ''' || start_date || '''';
  END IF;
  
  IF end_date IS NOT NULL THEN
    where_clause := where_clause || ' AND DATE(created_at) <= ''' || end_date || '''';
  END IF;
  
  RETURN QUERY EXECUTE '
    SELECT 
      COUNT(*)::bigint as total_transactions,
      COALESCE(SUM(amount) FILTER (WHERE status = ''completed''), 0) as total_volume,
      COALESCE(SUM(amount) FILTER (WHERE type = ''deposit'' AND status = ''completed''), 0) as total_deposits,
      COALESCE(SUM(amount) FILTER (WHERE type = ''payout'' AND status = ''completed''), 0) as total_payouts,
      COALESCE(SUM(amount) FILTER (WHERE type = ''withdrawal'' AND status = ''completed''), 0) as total_withdrawals,
      COUNT(*) FILTER (WHERE status = ''pending'')::bigint as pending_transactions,
      COUNT(*) FILTER (WHERE status = ''completed'')::bigint as completed_transactions,
      COUNT(*) FILTER (WHERE status = ''failed'')::bigint as failed_transactions,
      COALESCE(AVG(amount) FILTER (WHERE status = ''completed''), 0) as avg_transaction_amount,
      COALESCE(MAX(amount) FILTER (WHERE status = ''completed''), 0) as largest_transaction,
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE AND status = ''completed'')::bigint as transactions_today,
      COALESCE(SUM(amount) FILTER (WHERE DATE(created_at) = CURRENT_DATE AND status = ''completed''), 0) as volume_today
    FROM transactions
    WHERE 1=1 ' || where_clause;
END;
$$;

-- Create a diagnostic function to check transaction data integrity
CREATE OR REPLACE FUNCTION diagnose_transaction_data()
RETURNS TABLE (
  metric text,
  value text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Total Transactions'::text as metric,
    COUNT(*)::text as value
  FROM transactions
  
  UNION ALL
  
  SELECT 
    'Deposit Transactions'::text as metric,
    COUNT(*)::text as value
  FROM transactions
  WHERE type = 'deposit'
  
  UNION ALL
  
  SELECT 
    'Completed Deposit Transactions'::text as metric,
    COUNT(*)::text as value
  FROM transactions
  WHERE type = 'deposit' AND status = 'completed'
  
  UNION ALL
  
  SELECT 
    'Pending Deposit Transactions'::text as metric,
    COUNT(*)::text as value
  FROM transactions
  WHERE type = 'deposit' AND status = 'pending'
  
  UNION ALL
  
  SELECT 
    'Failed Deposit Transactions'::text as metric,
    COUNT(*)::text as value
  FROM transactions
  WHERE type = 'deposit' AND status = 'failed'
  
  UNION ALL
  
  SELECT 
    'Total Deposit Amount (All)'::text as metric,
    COALESCE(SUM(amount), 0)::text as value
  FROM transactions
  WHERE type = 'deposit'
  
  UNION ALL
  
  SELECT 
    'Total Deposit Amount (Completed Only)'::text as metric,
    COALESCE(SUM(amount), 0)::text as value
  FROM transactions
  WHERE type = 'deposit' AND status = 'completed'
  
  UNION ALL
  
  SELECT 
    'Unique Transaction Types'::text as metric,
    string_agg(DISTINCT type, ', ') as value
  FROM transactions
  
  UNION ALL
  
  SELECT 
    'Unique Transaction Statuses'::text as metric,
    string_agg(DISTINCT status, ', ') as value
  FROM transactions;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_analytics_data() TO authenticated;
GRANT EXECUTE ON FUNCTION get_transaction_stats(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION diagnose_transaction_data() TO authenticated;