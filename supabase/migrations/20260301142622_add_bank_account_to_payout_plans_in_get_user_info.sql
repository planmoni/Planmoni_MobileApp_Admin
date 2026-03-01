/*
  # Add Bank Account Info to Payout Plans in get_user_info Function

  1. Changes
    - Updates the get_user_info function to include bank account details in payout_plans JSON
    - Adds account_name, account_number, and bank_name to each payout plan
    - Uses LEFT JOIN to include bank_accounts data

  2. Purpose
    - Allows the user details page to display which bank account is linked to each payout plan
    - Improves visibility of payout plan configurations
*/

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

    -- Payout Plans with Bank Account Info
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
      'next_payout_date', pp.next_payout_date,
      'created_at', pp.created_at,
      'bank_account', CASE 
        WHEN ba.id IS NOT NULL THEN json_build_object(
          'id', ba.id,
          'account_name', ba.account_name,
          'account_number', ba.account_number,
          'bank_name', ba.bank_name
        )
        ELSE NULL
      END
    )), '[]'::json)::jsonb
     FROM payout_plans pp
     LEFT JOIN bank_accounts ba ON ba.id = pp.bank_account_id
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
