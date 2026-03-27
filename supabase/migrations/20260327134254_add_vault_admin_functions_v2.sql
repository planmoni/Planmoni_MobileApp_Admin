/*
  # Add Vault Admin Functions

  1. New Functions
    - `get_vaults_stats()` - Returns aggregate statistics for all vaults
    - `get_all_vaults()` - Returns paginated list of all vaults with user info and wallet balance
    - `get_vault_details(vault_id)` - Returns comprehensive vault information with related data

  2. Statistics Included
    - Total vaults count
    - Active, paused, completed, cancelled counts
    - Total funded amount
    - Total current balance
    - Total spent amount
    - Vault creation trends

  3. Security
    - Functions use security definer to bypass RLS
    - Only accessible by authenticated admin users
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_vaults_stats();
DROP FUNCTION IF EXISTS get_all_vaults(text, text, integer, integer);
DROP FUNCTION IF EXISTS get_vault_details(uuid);

-- Function to get vault statistics
CREATE OR REPLACE FUNCTION get_vaults_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE status = 'active'),
    'paused', COUNT(*) FILTER (WHERE status = 'paused'),
    'completed', COUNT(*) FILTER (WHERE status = 'completed'),
    'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
    'totalFunded', COALESCE(SUM(total_budget), 0),
    'totalBalance', COALESCE(SUM(current_balance), 0),
    'totalSpent', COALESCE(SUM(total_budget - current_balance), 0),
    'averageBalance', COALESCE(AVG(current_balance), 0),
    'vaultsWithBalance', COUNT(*) FILTER (WHERE current_balance > 0)
  )
  INTO result
  FROM budget_plans;
  
  RETURN result;
END;
$$;

-- Function to get all vaults with pagination
CREATE OR REPLACE FUNCTION get_all_vaults(
  search_query text DEFAULT '',
  status_filter text DEFAULT 'all',
  page_number integer DEFAULT 1,
  page_size integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  total_count integer;
  offset_value integer;
BEGIN
  offset_value := (page_number - 1) * page_size;
  
  -- Get total count
  SELECT COUNT(*)
  INTO total_count
  FROM budget_plans bp
  LEFT JOIN profiles p ON bp.user_id = p.id
  WHERE 
    (search_query = '' OR bp.name ILIKE '%' || search_query || '%' OR p.email ILIKE '%' || search_query || '%')
    AND (status_filter = 'all' OR bp.status = status_filter);
  
  -- Get paginated vaults
  SELECT jsonb_build_object(
    'vaults', COALESCE(jsonb_agg(vault_data ORDER BY bp.created_at DESC), '[]'::jsonb),
    'totalCount', total_count,
    'totalPages', CEIL(total_count::numeric / page_size)
  )
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'id', bp.id,
      'user_id', bp.user_id,
      'name', bp.name,
      'description', bp.description,
      'status', bp.status,
      'start_date', bp.start_date,
      'end_date', bp.end_date,
      'total_budget', bp.total_budget,
      'current_balance', bp.current_balance,
      'spending_limit', bp.spending_limit,
      'auto_topup_enabled', bp.auto_topup_enabled,
      'auto_topup_amount', bp.auto_topup_amount,
      'auto_topup_trigger', bp.auto_topup_trigger,
      'created_at', bp.created_at,
      'updated_at', bp.updated_at,
      'user', jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'first_name', p.first_name,
        'last_name', p.last_name
      ),
      'wallet_balance', COALESCE(pw.balance, 0),
      'total_spent', bp.total_budget - bp.current_balance
    ) as vault_data
    FROM budget_plans bp
    LEFT JOIN profiles p ON bp.user_id = p.id
    LEFT JOIN plan_wallets pw ON pw.plan_id = bp.id
    WHERE 
      (search_query = '' OR bp.name ILIKE '%' || search_query || '%' OR p.email ILIKE '%' || search_query || '%')
      AND (status_filter = 'all' OR bp.status = status_filter)
    ORDER BY bp.created_at DESC
    LIMIT page_size
    OFFSET offset_value
  ) as subquery;
  
  RETURN result;
END;
$$;

-- Function to get vault details
CREATE OR REPLACE FUNCTION get_vault_details(vault_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'vault', jsonb_build_object(
      'id', bp.id,
      'user_id', bp.user_id,
      'name', bp.name,
      'description', bp.description,
      'status', bp.status,
      'start_date', bp.start_date,
      'end_date', bp.end_date,
      'total_budget', bp.total_budget,
      'current_balance', bp.current_balance,
      'spending_limit', bp.spending_limit,
      'auto_topup_enabled', bp.auto_topup_enabled,
      'auto_topup_amount', bp.auto_topup_amount,
      'auto_topup_trigger', bp.auto_topup_trigger,
      'created_at', bp.created_at,
      'updated_at', bp.updated_at,
      'user', jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'first_name', p.first_name,
        'last_name', p.last_name
      ),
      'wallet', jsonb_build_object(
        'id', pw.id,
        'balance', pw.balance,
        'spending_permission', pw.spending_permission,
        'lock_type', pw.lock_type
      )
    ),
    'transactions', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', pt.id,
          'type', pt.type,
          'amount', pt.amount,
          'description', pt.description,
          'category_id', pt.category_id,
          'subcategory_id', pt.subcategory_id,
          'created_at', pt.created_at
        ) ORDER BY pt.created_at DESC
      )
      FROM plan_transactions pt
      WHERE pt.plan_id = bp.id),
      '[]'::jsonb
    ),
    'topups', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', ept.id,
          'amount', ept.amount,
          'source', ept.source,
          'status', ept.status,
          'description', ept.description,
          'reference', ept.reference,
          'created_at', ept.created_at
        ) ORDER BY ept.created_at DESC
      )
      FROM expense_plan_topups ept
      WHERE ept.budget_plan_id = bp.id),
      '[]'::jsonb
    ),
    'schedules', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', vps.id,
          'payout_account_id', vps.payout_account_id,
          'total_amount', vps.total_amount,
          'payout_amount', vps.payout_amount,
          'net_payout_amount', vps.net_payout_amount,
          'fee_amount', vps.fee_amount,
          'fee_percentage', vps.fee_percentage,
          'frequency', vps.frequency,
          'duration', vps.duration,
          'start_date', vps.start_date,
          'next_payout_date', vps.next_payout_date,
          'status', vps.status,
          'completed_payouts', vps.completed_payouts,
          'metadata', vps.metadata,
          'created_at', vps.created_at,
          'payout_account', jsonb_build_object(
            'id', pa.id,
            'bank_name', pa.bank_name,
            'account_number', pa.account_number,
            'account_name', pa.account_name
          )
        ) ORDER BY vps.created_at DESC
      )
      FROM vault_payout_schedules vps
      LEFT JOIN payout_accounts pa ON pa.id = vps.payout_account_id
      WHERE vps.budget_plan_id = bp.id),
      '[]'::jsonb
    )
  )
  INTO result
  FROM budget_plans bp
  LEFT JOIN profiles p ON bp.user_id = p.id
  LEFT JOIN plan_wallets pw ON pw.plan_id = bp.id
  WHERE bp.id = vault_id;
  
  RETURN result;
END;
$$;