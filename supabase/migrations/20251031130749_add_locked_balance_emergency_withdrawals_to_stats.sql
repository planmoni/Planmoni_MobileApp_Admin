/*
  # Add Locked Balance and Emergency Withdrawals to Payout Plans Stats

  1. Changes
    - Adds total_locked_balance: Sum of all locked_balance from wallets
    - Adds total_emergency_withdrawals: Sum of all completed withdrawal transactions
    - This migration combines the frequency fixes with locked balance calculations

  2. Calculations
    - Total Locked Balance: Sum of locked_balance from wallets table
    - Total Emergency Withdrawals: Sum of amounts from transactions where type='withdrawal' AND status='completed'
*/

DROP FUNCTION IF EXISTS get_payout_plans_stats();

CREATE OR REPLACE FUNCTION get_payout_plans_stats()
RETURNS TABLE (
  total bigint,
  active bigint,
  completed bigint,
  cancelled bigint,
  daily bigint,
  specific_days bigint,
  weekly bigint,
  bi_weekly bigint,
  monthly bigint,
  month_end bigint,
  quarterly bigint,
  bi_annually bigint,
  annually bigint,
  custom bigint,
  total_amount numeric,
  total_payout_amount numeric,
  daily_amount numeric,
  specific_days_amount numeric,
  weekly_amount numeric,
  bi_weekly_amount numeric,
  monthly_amount numeric,
  month_end_amount numeric,
  quarterly_amount numeric,
  bi_annually_amount numeric,
  annually_amount numeric,
  custom_amount numeric,
  total_locked_balance numeric,
  total_emergency_withdrawals numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total,
    COUNT(*) FILTER (WHERE pp.status = 'active')::bigint as active,
    COUNT(*) FILTER (WHERE pp.status = 'completed')::bigint as completed,
    COUNT(*) FILTER (WHERE pp.status = 'cancelled')::bigint as cancelled,
    COUNT(*) FILTER (WHERE pp.frequency = 'daily')::bigint as daily,
    COUNT(*) FILTER (WHERE pp.frequency = 'weekly_specific')::bigint as specific_days,
    COUNT(*) FILTER (WHERE pp.frequency = 'weekly')::bigint as weekly,
    COUNT(*) FILTER (WHERE pp.frequency = 'biweekly')::bigint as bi_weekly,
    COUNT(*) FILTER (WHERE pp.frequency = 'monthly')::bigint as monthly,
    COUNT(*) FILTER (WHERE pp.frequency = 'end_of_month')::bigint as month_end,
    COUNT(*) FILTER (WHERE pp.frequency = 'quarterly')::bigint as quarterly,
    COUNT(*) FILTER (WHERE pp.frequency = 'biannual')::bigint as bi_annually,
    COUNT(*) FILTER (WHERE pp.frequency = 'annually')::bigint as annually,
    COUNT(*) FILTER (WHERE pp.frequency = 'custom')::bigint as custom,
    COALESCE(SUM(pp.total_amount), 0) as total_amount,
    COALESCE(SUM(pp.payout_amount), 0) as total_payout_amount,
    COALESCE(SUM(pp.total_amount) FILTER (WHERE pp.frequency = 'daily'), 0) as daily_amount,
    COALESCE(SUM(pp.total_amount) FILTER (WHERE pp.frequency = 'weekly_specific'), 0) as specific_days_amount,
    COALESCE(SUM(pp.total_amount) FILTER (WHERE pp.frequency = 'weekly'), 0) as weekly_amount,
    COALESCE(SUM(pp.total_amount) FILTER (WHERE pp.frequency = 'biweekly'), 0) as bi_weekly_amount,
    COALESCE(SUM(pp.total_amount) FILTER (WHERE pp.frequency = 'monthly'), 0) as monthly_amount,
    COALESCE(SUM(pp.total_amount) FILTER (WHERE pp.frequency = 'end_of_month'), 0) as month_end_amount,
    COALESCE(SUM(pp.total_amount) FILTER (WHERE pp.frequency = 'quarterly'), 0) as quarterly_amount,
    COALESCE(SUM(pp.total_amount) FILTER (WHERE pp.frequency = 'biannual'), 0) as bi_annually_amount,
    COALESCE(SUM(pp.total_amount) FILTER (WHERE pp.frequency = 'annually'), 0) as annually_amount,
    COALESCE(SUM(pp.total_amount) FILTER (WHERE pp.frequency = 'custom'), 0) as custom_amount,
    (SELECT COALESCE(SUM(w.locked_balance), 0) FROM wallets w) as total_locked_balance,
    (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t WHERE t.type = 'withdrawal' AND t.status = 'completed') as total_emergency_withdrawals
  FROM payout_plans pp;
END;
$$;
