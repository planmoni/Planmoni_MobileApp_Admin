/*
  # Add Payout Stats Function

  1. New Functions
    - `get_payout_stats()` - Returns aggregated stats for all automated payouts
      - Counts total, processing, completed, and failed payouts
      - Respects RLS policies (admins see all, users see their own)
      
  2. Security
    - Function uses SECURITY INVOKER to respect RLS
    - Returns accurate counts based on user permissions
*/

-- Drop function if exists
DROP FUNCTION IF EXISTS get_payout_stats();

-- Create function to get payout statistics
CREATE OR REPLACE FUNCTION get_payout_stats()
RETURNS TABLE (
  total bigint,
  processing bigint,
  completed bigint,
  failed bigint
)
LANGUAGE plpgsql
SECURITY INVOKER
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
