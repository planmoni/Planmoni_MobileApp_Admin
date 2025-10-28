/*
  # Fix Payout Stats Function
  
  1. Changes
    - Drop and recreate get_payout_stats function with proper SECURITY DEFINER
    - Function bypasses RLS to return accurate global counts
    - Returns aggregated stats without fetching all rows
    
  2. Security
    - Uses SECURITY DEFINER to access all records
    - Function is safe as it only returns aggregate counts
    - No sensitive user data is exposed
*/

DROP FUNCTION IF EXISTS get_payout_stats();

CREATE OR REPLACE FUNCTION get_payout_stats()
RETURNS TABLE (
  total bigint,
  processing bigint,
  completed bigint,
  failed bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total,
    COUNT(CASE WHEN status = 'processing' THEN 1 END)::bigint as processing,
    COUNT(CASE WHEN status = 'completed' THEN 1 END)::bigint as completed,
    COUNT(CASE WHEN status = 'failed' THEN 1 END)::bigint as failed
  FROM automated_payouts;
END;
$$;

COMMENT ON FUNCTION get_payout_stats() IS 'Returns aggregated payout statistics. Uses SECURITY DEFINER to bypass RLS for accurate global counts.';
