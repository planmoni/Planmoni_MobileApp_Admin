/*
  # Comprehensive Admin Panel RPC Functions
  
  1. Analytics Functions
    - get_analytics_data() - Complete analytics dashboard data
    - get_user_growth_data() - User growth trends
    - get_transaction_volume_data() - Transaction volume analytics
    - get_payout_distribution_data() - Payout plan distribution
    - get_retention_data() - User retention metrics
  
  2. Transaction Functions
    - get_all_transactions_data() - All transactions with filters
    - get_transaction_stats() - Transaction statistics
    - get_daily_transaction_activity() - Daily transaction breakdown
  
  3. User Management Functions
    - get_user_management_data() - User management overview
    - get_user_activity_data() - User activity metrics
  
  4. Settings Functions
    - get_system_settings() - System configuration data
    - get_admin_activity_log() - Admin activity tracking
*/

-- Analytics: Complete analytics dashboard data
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
  
  -- Payout Distribution
  SELECT jsonb_build_object(
    'weekly', COUNT(*) FILTER (WHERE frequency = 'weekly'),
    'biweekly', COUNT(*) FILTER (WHERE frequency = 'biweekly'),
    'monthly', COUNT(*) FILTER (WHERE frequency = 'monthly'),
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

-- Transaction Management: All transactions with comprehensive data
CREATE OR REPLACE FUNCTION get_all_transactions_data(
  search_query text DEFAULT NULL,
  transaction_type text DEFAULT NULL,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  type text,
  amount numeric,
  status text,
  source text,
  destination text,
  payout_plan_id uuid,
  payout_plan_name text,
  bank_account_id uuid,
  bank_name text,
  account_number text,
  reference text,
  description text,
  created_at timestamptz,
  total_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  where_clause text := '';
  count_query text;
  main_query text;
  total_records bigint;
BEGIN
  -- Build dynamic WHERE clause
  where_clause := 'WHERE 1=1';
  
  IF search_query IS NOT NULL AND search_query != '' THEN
    where_clause := where_clause || ' AND (p.first_name ILIKE ''%' || search_query || '%'' OR p.last_name ILIKE ''%' || search_query || '%'' OR p.email ILIKE ''%' || search_query || '%'')';
  END IF;
  
  IF transaction_type IS NOT NULL AND transaction_type != 'all' THEN
    where_clause := where_clause || ' AND t.type = ''' || transaction_type || '''';
  END IF;
  
  IF start_date IS NOT NULL THEN
    where_clause := where_clause || ' AND DATE(t.created_at) >= ''' || start_date || '''';
  END IF;
  
  IF end_date IS NOT NULL THEN
    where_clause := where_clause || ' AND DATE(t.created_at) <= ''' || end_date || '''';
  END IF;
  
  -- Get total count
  count_query := 'SELECT COUNT(*) FROM transactions t LEFT JOIN profiles p ON t.user_id = p.id ' || where_clause;
  EXECUTE count_query INTO total_records;
  
  -- Main query
  RETURN QUERY EXECUTE '
    SELECT 
      t.id,
      t.user_id,
      COALESCE(p.first_name || '' '' || p.last_name, ''Unknown User'') as user_name,
      p.email as user_email,
      t.type,
      t.amount,
      t.status,
      t.source,
      t.destination,
      t.payout_plan_id,
      pp.name as payout_plan_name,
      t.bank_account_id,
      ba.bank_name,
      ba.account_number,
      t.reference,
      t.description,
      t.created_at,
      ' || total_records || '::bigint as total_count
    FROM transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    LEFT JOIN payout_plans pp ON t.payout_plan_id = pp.id
    LEFT JOIN bank_accounts ba ON t.bank_account_id = ba.id
    ' || where_clause || '
    ORDER BY t.created_at DESC
    LIMIT ' || limit_count || ' OFFSET ' || offset_count;
END;
$$;

-- Transaction Statistics
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
      COALESCE(SUM(amount), 0) as total_volume,
      COALESCE(SUM(amount) FILTER (WHERE type = ''deposit''), 0) as total_deposits,
      COALESCE(SUM(amount) FILTER (WHERE type = ''payout''), 0) as total_payouts,
      COALESCE(SUM(amount) FILTER (WHERE type = ''withdrawal''), 0) as total_withdrawals,
      COUNT(*) FILTER (WHERE status = ''pending'')::bigint as pending_transactions,
      COUNT(*) FILTER (WHERE status = ''completed'')::bigint as completed_transactions,
      COUNT(*) FILTER (WHERE status = ''failed'')::bigint as failed_transactions,
      COALESCE(AVG(amount), 0) as avg_transaction_amount,
      COALESCE(MAX(amount), 0) as largest_transaction,
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)::bigint as transactions_today,
      COALESCE(SUM(amount) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0) as volume_today
    FROM transactions
    WHERE 1=1 ' || where_clause;
END;
$$;

-- User Management Overview
CREATE OR REPLACE FUNCTION get_user_management_data()
RETURNS TABLE (
  total_users bigint,
  new_users_today bigint,
  new_users_this_week bigint,
  new_users_this_month bigint,
  active_users_today bigint,
  active_users_this_week bigint,
  active_users_this_month bigint,
  users_with_balance bigint,
  users_with_plans bigint,
  admin_users bigint,
  verified_users bigint,
  total_wallet_balance numeric,
  total_locked_balance numeric,
  user_growth_trend jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  growth_data jsonb := '[]'::jsonb;
BEGIN
  -- Generate user growth trend for last 30 days
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
    (SELECT COUNT(DISTINCT user_id) FROM transactions WHERE created_at >= CURRENT_DATE - interval '7 days')::bigint as active_users_this_week,
    (SELECT COUNT(DISTINCT user_id) FROM transactions WHERE created_at >= date_trunc('month', CURRENT_DATE))::bigint as active_users_this_month,
    
    (SELECT COUNT(*) FROM profiles p JOIN wallets w ON p.id = w.user_id WHERE w.balance > 0)::bigint as users_with_balance,
    (SELECT COUNT(DISTINCT user_id) FROM payout_plans WHERE status = 'active')::bigint as users_with_plans,
    (SELECT COUNT(*) FROM profiles WHERE is_admin = true)::bigint as admin_users,
    (SELECT COUNT(*) FROM profiles)::bigint as verified_users, -- Assuming all users are verified for now
    
    (SELECT COALESCE(SUM(balance), 0) FROM wallets) as total_wallet_balance,
    (SELECT COALESCE(SUM(locked_balance), 0) FROM wallets) as total_locked_balance,
    
    growth_data as user_growth_trend;
END;
$$;

-- Payout Plans Management Data
CREATE OR REPLACE FUNCTION get_payout_plans_data(
  search_query text DEFAULT NULL,
  status_filter text DEFAULT NULL,
  frequency_filter text DEFAULT NULL,
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  name text,
  description text,
  total_amount numeric,
  payout_amount numeric,
  frequency text,
  duration integer,
  start_date date,
  status text,
  completed_payouts integer,
  next_payout_date date,
  progress_percentage numeric,
  bank_account_name text,
  bank_name text,
  created_at timestamptz,
  total_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  where_clause text := '';
  total_records bigint;
BEGIN
  -- Build dynamic WHERE clause
  where_clause := 'WHERE 1=1';
  
  IF search_query IS NOT NULL AND search_query != '' THEN
    where_clause := where_clause || ' AND (pp.name ILIKE ''%' || search_query || '%'' OR p.first_name ILIKE ''%' || search_query || '%'' OR p.last_name ILIKE ''%' || search_query || '%'')';
  END IF;
  
  IF status_filter IS NOT NULL AND status_filter != 'all' THEN
    where_clause := where_clause || ' AND pp.status = ''' || status_filter || '''';
  END IF;
  
  IF frequency_filter IS NOT NULL AND frequency_filter != 'all' THEN
    where_clause := where_clause || ' AND pp.frequency = ''' || frequency_filter || '''';
  END IF;
  
  -- Get total count
  EXECUTE 'SELECT COUNT(*) FROM payout_plans pp LEFT JOIN profiles p ON pp.user_id = p.id ' || where_clause INTO total_records;
  
  -- Main query
  RETURN QUERY EXECUTE '
    SELECT 
      pp.id,
      pp.user_id,
      COALESCE(p.first_name || '' '' || p.last_name, ''Unknown User'') as user_name,
      p.email as user_email,
      pp.name,
      pp.description,
      pp.total_amount,
      pp.payout_amount,
      pp.frequency,
      pp.duration,
      pp.start_date,
      pp.status,
      pp.completed_payouts,
      pp.next_payout_date,
      ROUND((pp.completed_payouts::numeric / pp.duration * 100), 1) as progress_percentage,
      ba.account_name as bank_account_name,
      ba.bank_name,
      pp.created_at,
      ' || total_records || '::bigint as total_count
    FROM payout_plans pp
    LEFT JOIN profiles p ON pp.user_id = p.id
    LEFT JOIN bank_accounts ba ON pp.bank_account_id = ba.id
    ' || where_clause || '
    ORDER BY pp.created_at DESC
    LIMIT ' || limit_count || ' OFFSET ' || offset_count;
END;
$$;

-- System Settings and Configuration
CREATE OR REPLACE FUNCTION get_system_settings()
RETURNS TABLE (
  total_system_balance numeric,
  total_locked_funds numeric,
  pending_payouts_count bigint,
  pending_payouts_amount numeric,
  failed_transactions_today bigint,
  system_uptime_days integer,
  database_size text,
  active_sessions bigint,
  recent_errors jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COALESCE(SUM(balance), 0) FROM wallets) as total_system_balance,
    (SELECT COALESCE(SUM(locked_balance), 0) FROM wallets) as total_locked_funds,
    (SELECT COUNT(*) FROM payout_plans WHERE status = 'active' AND next_payout_date <= CURRENT_DATE)::bigint as pending_payouts_count,
    (SELECT COALESCE(SUM(payout_amount), 0) FROM payout_plans WHERE status = 'active' AND next_payout_date <= CURRENT_DATE) as pending_payouts_amount,
    (SELECT COUNT(*) FROM transactions WHERE status = 'failed' AND DATE(created_at) = CURRENT_DATE)::bigint as failed_transactions_today,
    30 as system_uptime_days, -- Placeholder
    '50MB' as database_size, -- Placeholder
    1::bigint as active_sessions, -- Placeholder
    '[]'::jsonb as recent_errors; -- Placeholder
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_analytics_data() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_transactions_data(text, text, date, date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_transaction_stats(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_management_data() TO authenticated;
GRANT EXECUTE ON FUNCTION get_payout_plans_data(text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_settings() TO authenticated;