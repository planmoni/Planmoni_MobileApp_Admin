/*
  # Fix Payout Plans Stats Function

  1. Changes
    - Fixes ambiguous column references by using table-qualified column names
    - Ensures the function returns correct aggregated statistics

  2. Returns
    - total: Total number of payout plans
    - active: Number of active plans
    - completed: Number of completed plans
    - cancelled: Number of cancelled plans
    - daily: Number of daily frequency plans
    - specific_days: Number of specific days frequency plans
    - weekly: Number of weekly frequency plans
    - bi_weekly: Number of bi-weekly frequency plans
    - monthly: Number of monthly frequency plans
    - month_end: Number of month-end frequency plans
    - quarterly: Number of quarterly frequency plans
    - bi_annually: Number of bi-annually frequency plans
    - annually: Number of annually frequency plans
    - custom: Number of custom frequency plans
    - total_amount: Sum of all total_amount values
    - total_payout_amount: Sum of all payout_amount values
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
  total_payout_amount numeric
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
    COUNT(*) FILTER (WHERE pp.frequency = 'specific_days')::bigint as specific_days,
    COUNT(*) FILTER (WHERE pp.frequency = 'weekly')::bigint as weekly,
    COUNT(*) FILTER (WHERE pp.frequency = 'bi-weekly')::bigint as bi_weekly,
    COUNT(*) FILTER (WHERE pp.frequency = 'monthly')::bigint as monthly,
    COUNT(*) FILTER (WHERE pp.frequency = 'month_end')::bigint as month_end,
    COUNT(*) FILTER (WHERE pp.frequency = 'quarterly')::bigint as quarterly,
    COUNT(*) FILTER (WHERE pp.frequency = 'bi-annually')::bigint as bi_annually,
    COUNT(*) FILTER (WHERE pp.frequency = 'annually')::bigint as annually,
    COUNT(*) FILTER (WHERE pp.frequency = 'custom')::bigint as custom,
    COALESCE(SUM(pp.total_amount), 0) as total_amount,
    COALESCE(SUM(pp.payout_amount), 0) as total_payout_amount
  FROM payout_plans pp;
END;
$$;
