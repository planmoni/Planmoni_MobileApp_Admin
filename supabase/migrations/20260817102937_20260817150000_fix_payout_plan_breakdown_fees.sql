-- Fix get_payout_plan_breakdown: fee_amount and net_payout_amount on payout_plans
-- are TOTALS for the whole plan, not per-installment values. The previous version
-- applied the total fee_amount to every installment, inflating Total Fees by the
-- plan duration.
--
-- Correct per-installment values:
--   gross  = total_amount / duration
--   fee    = fee_amount / duration  (or payout_amount * fee_percentage / 100 fallback)
--   net    = payout_amount  (already the per-installment net the user receives)

DROP FUNCTION IF EXISTS public.get_payout_plan_breakdown(uuid);

CREATE FUNCTION public.get_payout_plan_breakdown(plan_uuid uuid)
RETURNS TABLE(
  installment integer,
  scheduled_date date,
  payout_amount numeric,
  fee_amount numeric,
  net_amount numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_start_date date;
  v_frequency text;
  v_duration integer;
  v_payout_amount numeric;
  v_total_amount numeric;
  v_fee_percentage numeric;
  v_total_fee_amount numeric;
  v_completed_payouts integer;
  v_current_date date;
  v_installment integer := 1;
  v_gross_per_installment numeric;
  v_fee_per_installment numeric;
BEGIN
  SELECT
    p.start_date,
    p.frequency,
    p.duration,
    p.payout_amount,
    p.total_amount,
    p.fee_percentage,
    p.fee_amount,
    p.completed_payouts
  INTO
    v_start_date,
    v_frequency,
    v_duration,
    v_payout_amount,
    v_total_amount,
    v_fee_percentage,
    v_total_fee_amount,
    v_completed_payouts
  FROM payout_plans p
  WHERE p.id = plan_uuid;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Per-installment gross (what the user deposited spread across installments)
  v_gross_per_installment := CASE
    WHEN v_duration > 0 AND v_total_amount IS NOT NULL THEN ROUND(v_total_amount / v_duration, 2)
    ELSE v_payout_amount
  END;

  -- Per-installment fee: prefer the stored total fee split evenly, otherwise
  -- derive from the percentage applied to the per-installment gross.
  v_fee_per_installment := CASE
    WHEN v_total_fee_amount IS NOT NULL AND v_duration > 0 THEN ROUND(v_total_fee_amount / v_duration, 2)
    ELSE ROUND(v_gross_per_installment * COALESCE(v_fee_percentage, 0) / 100.0, 2)
  END;

  v_current_date := v_start_date;
  v_installment := 1;

  WHILE v_installment <= v_duration LOOP
    RETURN QUERY SELECT
      v_installment,
      v_current_date,
      v_gross_per_installment,
      v_fee_per_installment,
      v_payout_amount,
      CASE
        WHEN v_installment <= v_completed_payouts THEN 'completed'
        WHEN v_current_date <= CURRENT_DATE THEN 'due'
        ELSE 'upcoming'
      END;

    v_installment := v_installment + 1;

    CASE v_frequency
      WHEN 'daily' THEN
        v_current_date := v_current_date + 1;
      WHEN 'specific_days' THEN
        v_current_date := v_current_date + 1;
      WHEN 'weekly' THEN
        v_current_date := v_current_date + 7;
      WHEN 'bi-weekly' THEN
        v_current_date := v_current_date + 14;
      WHEN 'monthly' THEN
        v_current_date := (v_current_date + INTERVAL '1 month')::date;
      WHEN 'month_end' THEN
        v_current_date := (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month' - INTERVAL '1 day')::date;
        IF v_installment = 2 THEN
          v_current_date := (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month' - INTERVAL '1 day')::date;
        END IF;
      WHEN 'quarterly' THEN
        v_current_date := (v_current_date + INTERVAL '3 months')::date;
      WHEN 'bi-annually' THEN
        v_current_date := (v_current_date + INTERVAL '6 months')::date;
      WHEN 'annually' THEN
        v_current_date := (v_current_date + INTERVAL '1 year')::date;
      ELSE
        v_current_date := (v_current_date + INTERVAL '1 month')::date;
    END CASE;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_payout_plan_breakdown(uuid) TO authenticated;
