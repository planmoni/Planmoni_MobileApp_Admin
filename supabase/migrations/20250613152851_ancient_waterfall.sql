-- Create the get_dashboard_stats function
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_users bigint,
  total_deposits numeric,
  total_payouts numeric,
  total_plans bigint,
  transaction_trends jsonb
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trend_data jsonb := '[]'::jsonb;
  day_data jsonb;
  current_date_iter date;
  transaction_count bigint;
BEGIN
  -- Get total users count
  SELECT COUNT(*) INTO total_users FROM profiles;
  
  -- Get total deposits amount
  SELECT COALESCE(SUM(amount), 0) INTO total_deposits 
  FROM transactions 
  WHERE type = 'deposit';
  
  -- Get total payouts amount
  SELECT COALESCE(SUM(amount), 0) INTO total_payouts 
  FROM transactions 
  WHERE type = 'payout';
  
  -- Get total payout plans count
  SELECT COUNT(*) INTO total_plans FROM payout_plans;
  
  -- Generate transaction trends for last 7 days
  FOR i IN 0..6 LOOP
    current_date_iter := CURRENT_DATE - i;
    
    SELECT COUNT(*) INTO transaction_count
    FROM transactions
    WHERE DATE(created_at) = current_date_iter;
    
    day_data := jsonb_build_object(
      'day', current_date_iter::text,
      'total_transactions', transaction_count
    );
    
    trend_data := trend_data || day_data;
  END LOOP;
  
  -- Reverse the array to have oldest date first
  SELECT jsonb_agg(value ORDER BY (value->>'day')::date) INTO transaction_trends
  FROM jsonb_array_elements(trend_data) AS value;
  
  RETURN NEXT;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;