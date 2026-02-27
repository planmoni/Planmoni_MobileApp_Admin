/*
  # Add Highest Balance User Name to Analytics

  1. Updates
    - Modifies get_analytics_data() to include user name with highest balance
    - Changes highest_user_balance from numeric to jsonb containing amount and user_name
    - Maintains backward compatibility with amount field

  2. Return Structure
    - highest_user_balance now returns: { amount: numeric, user_name: text }
*/

DROP FUNCTION IF EXISTS get_analytics_data();

CREATE FUNCTION get_analytics_data()
RETURNS TABLE (
  user_growth jsonb,
  transaction_volume jsonb,
  payout_distribution jsonb,
  retention_rate jsonb,
  daily_transactions jsonb,
  total_users bigint,
  total_users_balance numeric,
  total_amount_in_plans numeric,
  total_completed_payouts bigint,
  highest_user_balance jsonb,
  most_recent_deposit jsonb,
  most_recent_payout jsonb
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
  
  v_total_users bigint;
  v_total_users_balance numeric;
  v_total_amount_in_plans numeric;
  v_total_completed_payouts bigint;
  v_highest_user_balance jsonb;
  v_most_recent_deposit jsonb;
  v_most_recent_payout jsonb;
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
  
  -- Payout Distribution
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
  
  -- Retention Rate
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

  -- NEW METRICS
  
  SELECT COUNT(*) INTO v_total_users FROM profiles;
  total_users := v_total_users;
  
  SELECT COALESCE(SUM(balance + locked_balance), 0) INTO v_total_users_balance FROM wallets;
  total_users_balance := v_total_users_balance;
  
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_amount_in_plans 
  FROM payout_plans 
  WHERE status IN ('active', 'paused');
  total_amount_in_plans := v_total_amount_in_plans;
  
  SELECT COUNT(*) INTO v_total_completed_payouts 
  FROM payout_plans 
  WHERE status = 'completed';
  total_completed_payouts := v_total_completed_payouts;
  
  -- Highest User Balance with user name
  SELECT jsonb_build_object(
    'amount', w.balance + w.locked_balance,
    'user_name', p.first_name || ' ' || p.last_name
  ) INTO v_highest_user_balance
  FROM wallets w
  JOIN profiles p ON w.user_id = p.id
  ORDER BY (w.balance + w.locked_balance) DESC
  LIMIT 1;
  
  highest_user_balance := COALESCE(v_highest_user_balance, jsonb_build_object('amount', 0, 'user_name', ''));
  
  SELECT jsonb_build_object(
    'amount', t.amount,
    'date', t.created_at,
    'user_name', p.first_name || ' ' || p.last_name
  ) INTO v_most_recent_deposit
  FROM transactions t
  JOIN profiles p ON t.user_id = p.id
  WHERE t.type = 'deposit'
  ORDER BY t.created_at DESC
  LIMIT 1;
  
  most_recent_deposit := COALESCE(v_most_recent_deposit, 'null'::jsonb);
  
  SELECT jsonb_build_object(
    'amount', t.amount,
    'date', t.created_at,
    'user_name', p.first_name || ' ' || p.last_name
  ) INTO v_most_recent_payout
  FROM transactions t
  JOIN profiles p ON t.user_id = p.id
  WHERE t.type = 'payout'
  ORDER BY t.created_at DESC
  LIMIT 1;
  
  most_recent_payout := COALESCE(v_most_recent_payout, 'null'::jsonb);
  
  RETURN NEXT;
END;
$$;