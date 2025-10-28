/*
  # Fix User Deposits and Payouts Calculation

  1. Changes
    - Update get_user_info to only count completed transactions for deposits/payouts
    - Update get_all_users_info to only count completed transactions for deposits/payouts

  2. Security
    - Maintains existing RLS policies
    - No changes to table structure
*/

-- Update get_user_info to filter by completed status
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

    -- Total Deposits (only completed)
    (SELECT COALESCE(SUM(t.amount), 0)
     FROM transactions t
     WHERE t.user_id = p.id AND t.type = 'deposit' AND t.status = 'completed') as total_deposits,

    -- Total Payouts (only completed)
    (SELECT COALESCE(SUM(t.amount), 0)
     FROM transactions t
     WHERE t.user_id = p.id AND t.type = 'payout' AND t.status = 'completed') as total_payouts,

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

    -- Recent Transactions (last 50)
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
       WHERE t2.user_id = target_user_id
       ORDER BY t2.created_at DESC
       LIMIT 50
     ) t) as recent_transactions

  FROM profiles p
  LEFT JOIN wallets w ON w.user_id = p.id
  WHERE p.id = target_user_id;
END;
$$;

-- Update get_all_users_info to filter by completed status
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

    -- Total Deposits (only completed)
    (SELECT COALESCE(SUM(t.amount), 0)
     FROM transactions t
     WHERE t.user_id = p.id AND t.type = 'deposit' AND t.status = 'completed') as total_deposits,

    -- Total Payouts (only completed)
    (SELECT COALESCE(SUM(t.amount), 0)
     FROM transactions t
     WHERE t.user_id = p.id AND t.type = 'payout' AND t.status = 'completed') as total_payouts,

    -- Active Plans
    (SELECT COUNT(*)
     FROM payout_plans pp
     WHERE pp.user_id = p.id AND pp.status = 'active') as active_plans

  FROM profiles p
  LEFT JOIN wallets w ON w.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$$;
