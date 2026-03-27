/*
  # Fix Vault Admin Functions - Correct SQL syntax

  1. Changes
    - Fix get_all_vaults to properly reference columns in outer query
    - Ensure all table aliases are correctly scoped
*/

-- Drop and recreate get_all_vaults with correct SQL
DROP FUNCTION IF EXISTS get_all_vaults(text, text, integer, integer);

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
    'vaults', COALESCE(jsonb_agg(vault_data), '[]'::jsonb),
    'totalCount', total_count,
    'totalPages', CEIL(total_count::numeric / page_size)
  )
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'id', bp.id,
      'user_id', bp.user_id,
      'name', bp.name,
      'plan_name', bp.plan_name,
      'status', bp.status,
      'start_date', bp.start_date,
      'end_date', bp.end_date,
      'total_budget', bp.total_budget,
      'current_balance', bp.current_balance,
      'auto_topup_enabled', bp.auto_topup_enabled,
      'auto_topup_amount', bp.auto_topup_amount,
      'auto_topup_frequency', bp.auto_topup_frequency,
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