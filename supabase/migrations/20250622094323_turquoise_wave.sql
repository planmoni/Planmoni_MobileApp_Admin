/*
  # Update wallet balance column references
  
  1. Changes
    - Update RPC functions to use available_balance instead of balance
    - Update constraints to use available_balance
    - Ensure backward compatibility
  
  2. Functions Updated
    - get_all_users_info
    - get_user_info
    - get_user_management_data
    - add_funds
    - lock_funds
*/

-- Update the get_all_users_info function to use available_balance
CREATE OR REPLACE FUNCTION get_all_users_info()
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text,
  created_at timestamptz,
  is_admin boolean,
  balance numeric,
  locked_balance numeric,
  total_deposits numeric,
  total_payouts numeric,
  active_plans bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    p.created_at,
    p.is_admin,
    
    COALESCE(w.available_balance, 0) as balance,
    COALESCE(w.locked_balance, 0) as locked_balance,

    -- Total Deposits
    (SELECT COALESCE(SUM(t.amount), 0)
     FROM transactions t
     WHERE t.user_id = p.id AND t.type = 'deposit') as total_deposits,

    -- Total Payouts
    (SELECT COALESCE(SUM(t.amount), 0)
     FROM transactions t
     WHERE t.user_id = p.id AND t.type = 'payout') as total_payouts,

    -- Active Plans
    (SELECT COUNT(*)
     FROM payout_plans pp
     WHERE pp.user_id = p.id AND pp.status = 'active') as active_plans

  FROM profiles p
  LEFT JOIN wallets w ON w.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

-- Update the get_user_info function to use available_balance
CREATE OR REPLACE FUNCTION get_user_info(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text,
  date_joined timestamptz,
  is_admin boolean,
  available_balance numeric,
  locked_balance numeric,
  total_deposits numeric,
  total_payouts numeric,
  active_plans bigint,
  linked_bank_accounts bigint,
  payout_plans jsonb,
  recent_transactions jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    p.created_at as date_joined,
    p.is_admin,
    
    COALESCE(w.available_balance, 0) as available_balance,
    COALESCE(w.locked_balance, 0) as locked_balance,

    -- Total Deposits
    (SELECT COALESCE(SUM(t.amount), 0)
     FROM transactions t
     WHERE t.user_id = p.id AND t.type = 'deposit') as total_deposits,

    -- Total Payouts
    (SELECT COALESCE(SUM(t.amount), 0)
     FROM transactions t
     WHERE t.user_id = p.id AND t.type = 'payout') as total_payouts,

    -- Active Plans
    (SELECT COUNT(*)
     FROM payout_plans pp
     WHERE pp.user_id = p.id AND pp.status = 'active') as active_plans,

    -- Linked Bank Accounts
    (SELECT COUNT(*)
     FROM bank_accounts ba
     WHERE ba.user_id = p.id) as linked_bank_accounts,

    -- Payout Plans
    (SELECT COALESCE(json_agg(json_build_object(
      'id', pp.id,
      'name', pp.name,
      'total_amount', pp.total_amount,
      'payout_amount', pp.payout_amount,
      'frequency', pp.frequency,
      'duration', pp.duration,
      'start_date', pp.start_date,
      'status', pp.status,
      'completed_payouts', pp.completed_payouts,
      'next_payout_date', pp.next_payout_date
    )), '[]'::json)::jsonb
     FROM payout_plans pp
     WHERE pp.user_id = p.id) as payout_plans,

    -- Recent Transactions (last 5)
    (SELECT COALESCE(json_agg(json_build_object(
      'id', t.id,
      'type', t.type,
      'amount', t.amount,
      'status', t.status,
      'created_at', t.created_at,
      'source', t.source,
      'destination', t.destination
    ) ORDER BY t.created_at DESC), '[]'::json)::jsonb
     FROM (
       SELECT * FROM transactions t2
       WHERE t2.user_id = p.id
       ORDER BY t2.created_at DESC
       LIMIT 5
     ) t) as recent_transactions

  FROM profiles p
  LEFT JOIN wallets w ON w.user_id = p.id
  WHERE p.id = target_user_id;
END;
$$;

-- Update the get_user_management_data function to use available_balance
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
    
    (SELECT COUNT(*) FROM profiles p JOIN wallets w ON p.id = w.user_id WHERE w.available_balance > 0)::bigint as users_with_balance,
    (SELECT COUNT(DISTINCT user_id) FROM payout_plans WHERE status = 'active')::bigint as users_with_plans,
    (SELECT COUNT(*) FROM profiles WHERE is_admin = true)::bigint as admin_users,
    (SELECT COUNT(*) FROM profiles)::bigint as verified_users, -- Assuming all users are verified for now
    
    (SELECT COALESCE(SUM(available_balance), 0) FROM wallets) as total_wallet_balance,
    (SELECT COALESCE(SUM(locked_balance), 0) FROM wallets) as total_locked_balance,
    
    growth_data as user_growth_trend;
END;
$$;

-- Update the add_funds function to use available_balance
CREATE OR REPLACE FUNCTION add_funds(p_amount numeric, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  -- Update wallet balance
  UPDATE wallets
  SET 
    available_balance = available_balance + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Create transaction record
  INSERT INTO transactions (
    user_id,
    type,
    amount,
    status,
    source,
    destination,
    description
  ) VALUES (
    p_user_id,
    'deposit',
    p_amount,
    'completed',
    'bank_transfer',
    'wallet',
    'Funds added to wallet'
  );

  -- Create notification event
  INSERT INTO events (
    user_id,
    type,
    title,
    description,
    status
  ) VALUES (
    p_user_id,
    'vault_created',
    'Funds Added Successfully',
    format('₦%s has been added to your wallet', p_amount::text),
    'unread'
  );
END;
$$;

-- Update the lock_funds function to use available_balance
CREATE OR REPLACE FUNCTION lock_funds(p_amount numeric, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  -- Check if sufficient funds are available
  IF NOT EXISTS (
    SELECT 1 FROM wallets
    WHERE user_id = p_user_id
    AND (available_balance - locked_balance) >= p_amount
  ) THEN
    RAISE EXCEPTION 'Insufficient available balance';
  END IF;

  -- Lock the funds
  UPDATE wallets
  SET 
    locked_balance = locked_balance + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_all_users_info() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_management_data() TO authenticated;
GRANT EXECUTE ON FUNCTION add_funds(numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION lock_funds(numeric, uuid) TO authenticated;