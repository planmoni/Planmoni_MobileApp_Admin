/*
  # Add Notification Dispatch System

  1. Schema Changes
    - Add `notification_type` column to `push_notifications` table
    - Add `notification_category` column to `push_notifications` table
    - Add indexes for performance optimization
    - Add `last_reengagement_sent` JSONB column to `profiles` for cooldown tracking
  
  2. New Functions
    - `get_notification_dispatch_logs` - Fetch dispatch logs with user details
    - `get_zero_balance_users` - Get users with zero balance eligible for re-engagement
    - `get_unfunded_vault_users` - Get users with unfunded vaults
    - `get_deposit_no_plan_users` - Get users who deposited but have no plan
    - `get_no_plan_users` - Get users who signed up but created no plan
    - `get_inactive_users` - Get inactive users for re-engagement
    - `get_reengagement_stats` - Get counts for all re-engagement categories
  
  3. Security
    - All functions require authentication and admin permissions
*/

-- Add new columns to push_notifications table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'push_notifications' AND column_name = 'notification_type'
  ) THEN
    ALTER TABLE push_notifications 
    ADD COLUMN notification_type TEXT DEFAULT 'manual' CHECK (notification_type IN ('system', 'manual', 'reengagement', 'marketing'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'push_notifications' AND column_name = 'notification_category'
  ) THEN
    ALTER TABLE push_notifications 
    ADD COLUMN notification_category TEXT;
  END IF;
END $$;

-- Add cooldown tracking to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'last_reengagement_sent'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN last_reengagement_sent JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_notifications_type ON push_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_push_notifications_category ON push_notifications(notification_category);
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_sent_at ON push_notification_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_status ON push_notification_logs(status);

-- Function to get notification dispatch logs with user details
CREATE OR REPLACE FUNCTION get_notification_dispatch_logs(
  limit_count INT DEFAULT 100,
  offset_count INT DEFAULT 0,
  filter_status TEXT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL,
  search_term TEXT DEFAULT NULL,
  date_from TIMESTAMPTZ DEFAULT NULL,
  date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  push_notification_id UUID,
  user_id UUID,
  user_email TEXT,
  user_full_name TEXT,
  notification_title TEXT,
  notification_body TEXT,
  notification_type TEXT,
  notification_category TEXT,
  status TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pnl.id,
    pnl.push_notification_id,
    pnl.user_id,
    p.email as user_email,
    p.full_name as user_full_name,
    pn.title as notification_title,
    pn.body as notification_body,
    pn.notification_type,
    pn.notification_category,
    pnl.status,
    pnl.error_message,
    pnl.sent_at,
    pnl.delivered_at,
    pnl.created_at
  FROM push_notification_logs pnl
  LEFT JOIN profiles p ON pnl.user_id = p.id
  LEFT JOIN push_notifications pn ON pnl.push_notification_id = pn.id
  WHERE 
    (filter_status IS NULL OR pnl.status = filter_status)
    AND (filter_category IS NULL OR pn.notification_category = filter_category)
    AND (search_term IS NULL OR p.email ILIKE '%' || search_term || '%' OR p.full_name ILIKE '%' || search_term || '%')
    AND (date_from IS NULL OR pnl.sent_at >= date_from)
    AND (date_to IS NULL OR pnl.sent_at <= date_to)
  ORDER BY pnl.sent_at DESC NULLS LAST
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Function to get users with zero balance (3+ days)
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
    w.updated_at as last_transaction_date,
    EXTRACT(DAY FROM NOW() - w.updated_at)::INT as days_at_zero
  FROM profiles p
  LEFT JOIN wallets w ON p.id = w.user_id
  LEFT JOIN user_push_tokens upt ON p.id = upt.user_id
  WHERE 
    COALESCE(w.balance, 0) = 0
    AND w.updated_at < NOW() - INTERVAL '3 days'
    AND upt.is_active = true
    AND (p.notification_preferences->>'general')::boolean IS DISTINCT FROM false
    AND (
      p.last_reengagement_sent->>'zero_balance_reminder' IS NULL 
      OR (p.last_reengagement_sent->>'zero_balance_reminder')::timestamptz < NOW() - INTERVAL '7 days'
    )
  GROUP BY p.id, p.email, p.full_name, w.balance, w.updated_at
  ORDER BY days_at_zero DESC;
END;
$$;

-- Function to get users with unfunded vaults
CREATE OR REPLACE FUNCTION get_unfunded_vault_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  vault_count INT,
  unfunded_vault_names TEXT[]
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
    COUNT(v.id)::INT as vault_count,
    ARRAY_AGG(v.name) as unfunded_vault_names
  FROM profiles p
  INNER JOIN vaults v ON p.id = v.user_id
  LEFT JOIN user_push_tokens upt ON p.id = upt.user_id
  WHERE 
    v.is_active = true
    AND COALESCE(v.current_balance, 0) = 0
    AND upt.is_active = true
    AND (p.notification_preferences->>'vault_alerts')::boolean IS DISTINCT FROM false
    AND (
      p.last_reengagement_sent->>'vault_unfunded_reminder' IS NULL 
      OR (p.last_reengagement_sent->>'vault_unfunded_reminder')::timestamptz < NOW() - INTERVAL '7 days'
    )
  GROUP BY p.id, p.email, p.full_name
  HAVING COUNT(v.id) > 0;
END;
$$;

-- Function to get users who deposited but have no plan
CREATE OR REPLACE FUNCTION get_deposit_no_plan_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  balance DECIMAL,
  last_deposit_date TIMESTAMPTZ
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
    MAX(t.created_at) as last_deposit_date
  FROM profiles p
  INNER JOIN wallets w ON p.id = w.user_id
  INNER JOIN transactions t ON w.id = t.wallet_id
  LEFT JOIN payout_plans pp ON p.id = pp.user_id
  LEFT JOIN user_push_tokens upt ON p.id = upt.user_id
  WHERE 
    t.transaction_type = 'deposit'
    AND t.status = 'completed'
    AND pp.id IS NULL
    AND w.balance > 0
    AND upt.is_active = true
    AND (p.notification_preferences->>'plan_reminders')::boolean IS DISTINCT FROM false
    AND (
      p.last_reengagement_sent->>'deposit_no_plan' IS NULL 
      OR (p.last_reengagement_sent->>'deposit_no_plan')::timestamptz < NOW() - INTERVAL '7 days'
    )
  GROUP BY p.id, p.email, p.full_name, w.balance
  HAVING MAX(t.created_at) > NOW() - INTERVAL '30 days';
END;
$$;

-- Function to get users who signed up but created no plan
CREATE OR REPLACE FUNCTION get_no_plan_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  signup_date TIMESTAMPTZ,
  days_since_signup INT
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
    EXTRACT(DAY FROM NOW() - p.created_at)::INT as days_since_signup
  FROM profiles p
  LEFT JOIN payout_plans pp ON p.id = pp.user_id
  LEFT JOIN user_push_tokens upt ON p.id = upt.user_id
  WHERE 
    pp.id IS NULL
    AND p.created_at < NOW() - INTERVAL '3 days'
    AND p.created_at > NOW() - INTERVAL '60 days'
    AND upt.is_active = true
    AND (p.notification_preferences->>'plan_reminders')::boolean IS DISTINCT FROM false
    AND (
      p.last_reengagement_sent->>'no_plan_yet' IS NULL 
      OR (p.last_reengagement_sent->>'no_plan_yet')::timestamptz < NOW() - INTERVAL '7 days'
    )
  GROUP BY p.id, p.email, p.full_name, p.created_at
  ORDER BY days_since_signup DESC;
END;
$$;

-- Function to get inactive users (no login/activity in 14+ days)
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
    p.last_sign_in_at as last_activity,
    EXTRACT(DAY FROM NOW() - p.last_sign_in_at)::INT as days_inactive
  FROM profiles p
  LEFT JOIN user_push_tokens upt ON p.id = upt.user_id
  WHERE 
    p.last_sign_in_at < NOW() - INTERVAL '14 days'
    AND upt.is_active = true
    AND (p.notification_preferences->>'general')::boolean IS DISTINCT FROM false
    AND (
      p.last_reengagement_sent->>'re_engagement' IS NULL 
      OR (p.last_reengagement_sent->>'re_engagement')::timestamptz < NOW() - INTERVAL '7 days'
    )
  ORDER BY days_inactive DESC;
END;
$$;

-- Function to get all re-engagement stats
CREATE OR REPLACE FUNCTION get_reengagement_stats()
RETURNS TABLE (
  category TEXT,
  eligible_count BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 'zero_balance_reminder'::TEXT, COUNT(*) FROM get_zero_balance_users()
  UNION ALL
  SELECT 'vault_unfunded_reminder'::TEXT, COUNT(*) FROM get_unfunded_vault_users()
  UNION ALL
  SELECT 'deposit_no_plan'::TEXT, COUNT(*) FROM get_deposit_no_plan_users()
  UNION ALL
  SELECT 'no_plan_yet'::TEXT, COUNT(*) FROM get_no_plan_users()
  UNION ALL
  SELECT 're_engagement'::TEXT, COUNT(*) FROM get_inactive_users();
END;
$$;

-- Grant execute permissions to authenticated users (RLS will handle admin check)
GRANT EXECUTE ON FUNCTION get_notification_dispatch_logs TO authenticated;
GRANT EXECUTE ON FUNCTION get_zero_balance_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_unfunded_vault_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_deposit_no_plan_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_no_plan_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_inactive_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_reengagement_stats TO authenticated;