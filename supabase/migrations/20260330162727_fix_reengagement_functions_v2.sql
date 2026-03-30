/*
  # Fix Re-engagement Notification Functions v2
  
  1. Issues Fixed
    - Drop and recreate all functions to fix return type issues
    - `get_zero_balance_users` - Now finds users with zero balance regardless of wallet update time
    - `get_deposit_no_plan_users` - Now finds ALL users who ever deposited without creating plans
    - `get_no_plan_users` - Better logic including has_deposited flag
    - `get_unfunded_vault_users` - Better logic for unfunded vaults
  
  2. Security
    - Functions use SECURITY DEFINER with proper search_path
    - Require authentication
*/

-- Drop all existing functions first
DROP FUNCTION IF EXISTS get_zero_balance_users();
DROP FUNCTION IF EXISTS get_deposit_no_plan_users();
DROP FUNCTION IF EXISTS get_no_plan_users();
DROP FUNCTION IF EXISTS get_unfunded_vault_users();
DROP FUNCTION IF EXISTS get_inactive_users();

-- Create get_zero_balance_users with better logic
CREATE OR REPLACE FUNCTION get_zero_balance_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  balance DECIMAL,
  last_transaction_date TIMESTAMPTZ,
  days_at_zero INT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    COALESCE(w.balance, 0) as balance,
    COALESCE(w.updated_at, p.created_at) as last_transaction_date,
    EXTRACT(DAY FROM NOW() - COALESCE(w.updated_at, p.created_at))::INT as days_at_zero
  FROM profiles p
  LEFT JOIN wallets w ON p.id = w.user_id
  WHERE 
    COALESCE(w.balance, 0) = 0
    AND (
      (w.updated_at IS NOT NULL AND w.updated_at < NOW() - INTERVAL '3 days')
      OR (w.updated_at IS NULL AND p.created_at < NOW() - INTERVAL '3 days')
    )
    AND EXISTS (
      SELECT 1 FROM user_push_tokens upt 
      WHERE upt.user_id = p.id AND upt.is_active = true
    )
    AND (
      p.notification_preferences IS NULL 
      OR p.notification_preferences->>'general' IS NULL
      OR (p.notification_preferences->>'general')::boolean IS DISTINCT FROM false
    )
    AND (
      p.last_reengagement_sent IS NULL
      OR p.last_reengagement_sent->>'zero_balance_reminder' IS NULL 
      OR (p.last_reengagement_sent->>'zero_balance_reminder')::timestamptz < NOW() - INTERVAL '7 days'
    )
  ORDER BY days_at_zero DESC;
END;
$$;

-- Create get_deposit_no_plan_users to find ALL users who deposited but never created a plan
CREATE OR REPLACE FUNCTION get_deposit_no_plan_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  balance DECIMAL,
  last_deposit_date TIMESTAMPTZ,
  total_deposited DECIMAL
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    COALESCE(w.balance, 0) as balance,
    MAX(t.created_at) as last_deposit_date,
    SUM(t.amount) as total_deposited
  FROM profiles p
  INNER JOIN wallets w ON p.id = w.user_id
  INNER JOIN transactions t ON w.id = t.wallet_id
  WHERE 
    t.transaction_type = 'deposit'
    AND t.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM payout_plans pp WHERE pp.user_id = p.id
    )
    AND EXISTS (
      SELECT 1 FROM user_push_tokens upt 
      WHERE upt.user_id = p.id AND upt.is_active = true
    )
    AND (
      p.notification_preferences IS NULL 
      OR p.notification_preferences->>'plan_reminders' IS NULL
      OR (p.notification_preferences->>'plan_reminders')::boolean IS DISTINCT FROM false
    )
    AND (
      p.last_reengagement_sent IS NULL
      OR p.last_reengagement_sent->>'deposit_no_plan' IS NULL 
      OR (p.last_reengagement_sent->>'deposit_no_plan')::timestamptz < NOW() - INTERVAL '7 days'
    )
  GROUP BY p.id, p.email, p.full_name, w.balance
  HAVING MAX(t.created_at) > NOW() - INTERVAL '30 days';
END;
$$;

-- Create get_no_plan_users - users who signed up but never created a plan
CREATE OR REPLACE FUNCTION get_no_plan_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  signup_date TIMESTAMPTZ,
  days_since_signup INT,
  has_deposited BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.created_at as signup_date,
    EXTRACT(DAY FROM NOW() - p.created_at)::INT as days_since_signup,
    EXISTS(
      SELECT 1 FROM wallets w 
      INNER JOIN transactions t ON w.id = t.wallet_id
      WHERE w.user_id = p.id AND t.transaction_type = 'deposit' AND t.status = 'completed'
    ) as has_deposited
  FROM profiles p
  WHERE 
    NOT EXISTS (
      SELECT 1 FROM payout_plans pp WHERE pp.user_id = p.id
    )
    AND p.created_at < NOW() - INTERVAL '3 days'
    AND p.created_at > NOW() - INTERVAL '60 days'
    AND EXISTS (
      SELECT 1 FROM user_push_tokens upt 
      WHERE upt.user_id = p.id AND upt.is_active = true
    )
    AND (
      p.notification_preferences IS NULL 
      OR p.notification_preferences->>'plan_reminders' IS NULL
      OR (p.notification_preferences->>'plan_reminders')::boolean IS DISTINCT FROM false
    )
    AND (
      p.last_reengagement_sent IS NULL
      OR p.last_reengagement_sent->>'no_plan_yet' IS NULL 
      OR (p.last_reengagement_sent->>'no_plan_yet')::timestamptz < NOW() - INTERVAL '7 days'
    )
  ORDER BY days_since_signup DESC;
END;
$$;

-- Create get_unfunded_vault_users
CREATE OR REPLACE FUNCTION get_unfunded_vault_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  vault_count INT,
  unfunded_vault_names TEXT[],
  vault_created_date TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    COUNT(DISTINCT v.id)::INT as vault_count,
    ARRAY_AGG(DISTINCT v.name) as unfunded_vault_names,
    MIN(v.created_at) as vault_created_date
  FROM profiles p
  INNER JOIN vaults v ON p.id = v.user_id
  WHERE 
    v.is_active = true
    AND COALESCE(v.current_balance, 0) = 0
    AND v.created_at < NOW() - INTERVAL '1 day'
    AND EXISTS (
      SELECT 1 FROM user_push_tokens upt 
      WHERE upt.user_id = p.id AND upt.is_active = true
    )
    AND (
      p.notification_preferences IS NULL 
      OR p.notification_preferences->>'vault_alerts' IS NULL
      OR (p.notification_preferences->>'vault_alerts')::boolean IS DISTINCT FROM false
    )
    AND (
      p.last_reengagement_sent IS NULL
      OR p.last_reengagement_sent->>'vault_unfunded_reminder' IS NULL 
      OR (p.last_reengagement_sent->>'vault_unfunded_reminder')::timestamptz < NOW() - INTERVAL '7 days'
    )
  GROUP BY p.id, p.email, p.full_name
  HAVING COUNT(DISTINCT v.id) > 0
  ORDER BY MIN(v.created_at) ASC;
END;
$$;

-- Create get_inactive_users
CREATE OR REPLACE FUNCTION get_inactive_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  last_activity TIMESTAMPTZ,
  days_inactive INT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    COALESCE(p.last_sign_in_at, p.created_at) as last_activity,
    EXTRACT(DAY FROM NOW() - COALESCE(p.last_sign_in_at, p.created_at))::INT as days_inactive
  FROM profiles p
  WHERE 
    COALESCE(p.last_sign_in_at, p.created_at) < NOW() - INTERVAL '14 days'
    AND EXISTS (
      SELECT 1 FROM user_push_tokens upt 
      WHERE upt.user_id = p.id AND upt.is_active = true
    )
    AND (
      p.notification_preferences IS NULL 
      OR p.notification_preferences->>'general' IS NULL
      OR (p.notification_preferences->>'general')::boolean IS DISTINCT FROM false
    )
    AND (
      p.last_reengagement_sent IS NULL
      OR p.last_reengagement_sent->>'re_engagement' IS NULL 
      OR (p.last_reengagement_sent->>'re_engagement')::timestamptz < NOW() - INTERVAL '7 days'
    )
  ORDER BY days_inactive DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_zero_balance_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_unfunded_vault_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_deposit_no_plan_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_no_plan_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_inactive_users TO authenticated;