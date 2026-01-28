/*
  # Create Marketing Recipient Count Functions
  
  1. New Functions
    - get_marketing_recipient_count() - Get count of recipients for a given segment
    - Allows users with marketing permissions to get accurate counts
  
  2. Security
    - Functions check for marketing permissions
    - Super admins have full access
*/

-- Function to get recipient count for "all users"
CREATE OR REPLACE FUNCTION get_all_users_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user has marketing permissions or is admin
  IF NOT (has_permission('marketing.view') 
          OR has_permission('marketing.campaigns.list')
          OR has_permission('marketing.campaigns.create')
          OR is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: Marketing access required';
  END IF;
  
  RETURN (SELECT COUNT(*) FROM profiles);
END;
$$;

-- Function to get recipient count for "active users"
CREATE OR REPLACE FUNCTION get_active_users_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  thirty_days_ago timestamptz;
  active_user_ids uuid[];
BEGIN
  -- Check if user has marketing permissions or is admin
  IF NOT (has_permission('marketing.view') 
          OR has_permission('marketing.campaigns.list')
          OR has_permission('marketing.campaigns.create')
          OR is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: Marketing access required';
  END IF;
  
  thirty_days_ago := now() - INTERVAL '30 days';
  
  -- Get distinct user IDs from active plans and recent transactions
  WITH active_plans AS (
    SELECT DISTINCT user_id
    FROM payout_plans
    WHERE status = 'active'
  ),
  recent_transactions AS (
    SELECT DISTINCT user_id
    FROM transactions
    WHERE created_at >= thirty_days_ago
  )
  SELECT ARRAY_AGG(DISTINCT user_id)
  INTO active_user_ids
  FROM (
    SELECT user_id FROM active_plans
    UNION
    SELECT user_id FROM recent_transactions
  ) combined;
  
  RETURN COALESCE(array_length(active_user_ids, 1), 0);
END;
$$;

-- Function to get recipient count for "users with balance"
CREATE OR REPLACE FUNCTION get_users_with_balance_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user has marketing permissions or is admin
  IF NOT (has_permission('marketing.view') 
          OR has_permission('marketing.campaigns.list')
          OR has_permission('marketing.campaigns.create')
          OR is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: Marketing access required';
  END IF;
  
  RETURN (
    SELECT COUNT(DISTINCT user_id)
    FROM wallets
    WHERE balance > 0
  );
END;
$$;

-- Function to get recipient count for "users with plans"
CREATE OR REPLACE FUNCTION get_users_with_plans_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user has marketing permissions or is admin
  IF NOT (has_permission('marketing.view') 
          OR has_permission('marketing.campaigns.list')
          OR has_permission('marketing.campaigns.create')
          OR is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: Marketing access required';
  END IF;
  
  RETURN (
    SELECT COUNT(DISTINCT user_id)
    FROM payout_plans
    WHERE status = 'active'
  );
END;
$$;

-- Function to get recipient count for "users with zero balance"
CREATE OR REPLACE FUNCTION get_users_with_zero_balance_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user has marketing permissions or is admin
  IF NOT (has_permission('marketing.view') 
          OR has_permission('marketing.campaigns.list')
          OR has_permission('marketing.campaigns.create')
          OR is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: Marketing access required';
  END IF;
  
  -- Include users without wallets (balance IS NULL) OR users with balance = 0
  RETURN (
    SELECT COUNT(*)
    FROM profiles p
    LEFT JOIN wallets w ON w.user_id = p.id
    WHERE w.balance = 0 OR w.balance IS NULL
  );
END;
$$;

-- Function to get recipient count for KYC tiers
CREATE OR REPLACE FUNCTION get_kyc_tier_count(tier_level integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user has marketing permissions or is admin
  IF NOT (has_permission('marketing.view') 
          OR has_permission('marketing.campaigns.list')
          OR has_permission('marketing.campaigns.create')
          OR is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: Marketing access required';
  END IF;
  
  IF tier_level = 0 THEN
    -- Users without any KYC tier completed
    RETURN (
      SELECT COUNT(*)
      FROM profiles p
      WHERE NOT EXISTS (
        SELECT 1
        FROM kyc_progress k
        WHERE k.user_id = p.id
        AND (k.tier_1_completed = true 
             OR k.tier_2_completed = true 
             OR k.tier_3_completed = true)
      )
    );
  ELSIF tier_level = 1 THEN
    RETURN (
      SELECT COUNT(DISTINCT user_id)
      FROM kyc_progress
      WHERE tier_1_completed = true
    );
  ELSIF tier_level = 2 THEN
    RETURN (
      SELECT COUNT(DISTINCT user_id)
      FROM kyc_progress
      WHERE tier_2_completed = true
    );
  ELSIF tier_level = 3 THEN
    RETURN (
      SELECT COUNT(DISTINCT user_id)
      FROM kyc_progress
      WHERE tier_3_completed = true
    );
  ELSE
    RETURN 0;
  END IF;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_all_users_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_users_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_with_balance_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_with_plans_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_with_zero_balance_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_kyc_tier_count(integer) TO authenticated;
