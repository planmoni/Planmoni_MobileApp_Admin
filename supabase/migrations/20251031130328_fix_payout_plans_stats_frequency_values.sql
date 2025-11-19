/*
  # Fix Payout Plans Stats Function - Correct Frequency Values

  1. Changes
    - Updates frequency filters to match actual database values
    - Changes 'specific_days' to 'weekly_specific'
    - Changes 'month_end' to 'end_of_month'
    - Changes 'bi-weekly' to 'biweekly'
    - Changes 'bi-annually' to 'biannual'

  2. Database Frequency Values (from payout_plans table)
    - daily
    - weekly
    - weekly_specific (was specific_days)
    - biweekly (was bi-weekly)
    - monthly
    - end_of_month (was month_end)
    - quarterly
    - biannual (was bi-annually)
    - annually
    - custom
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
  custom_amount numeric
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
    COALESCE(SUM(pp.total_amount) FILTER (WHERE pp.frequency = 'custom'), 0) as custom_amount
  FROM payout_plans pp;
END;
$$;
