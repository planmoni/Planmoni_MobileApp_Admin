/*
# Fix payout plan breakdown dates

## Problem
The `get_payout_plan_breakdown` function computed all installment dates from
`start_date` + frequency math. But its `CASE` statement only matched a subset
of the frequency values that actually exist in the `payout_plans` table:

  DB frequency    →  function handled?  →  result
  weekly_specific →  no (ELSE)          →  monthly dates (WRONG, should be weekly)
  biweekly        →  no (ELSE)          →  monthly dates (WRONG, should be +14d)
  end_of_month    →  no (ELSE)          →  monthly dates (WRONG, should be month-end)
  custom          →  no (ELSE)          →  monthly dates (often wrong)

This caused the breakdown modal to show dates that didn't match the real
payout transactions. Example: a `weekly_specific` plan starting Aug 9 showed
Aug 9 / Sep 9 / Oct 9 / Nov 9 instead of the correct Aug 9 / Aug 16 / Aug 23 / Aug 30.

## Fix
Rewrite the function to use `automated_payouts` records as the source of truth
for installments that already have records — this covers completed payouts and
any scheduled future payouts the system has already generated. For remaining
installments with no record yet, compute the next date from the last known
date using the correct frequency interval.

Frequency mapping now covers all values present in the database:
  daily, weekly, weekly_specific, biweekly, monthly, end_of_month,
  month_end, quarterly, biannually, bi-annually, annually, custom.

For `custom` plans with duration > 1, we advance daily as a best-effort
default (most custom plans have duration 1, so this rarely matters).

## Security
- SECURITY DEFINER with fixed search_path = public (unchanged).
- Granted to authenticated role (unchanged).
- No tables or columns modified.
*/

DROP FUNCTION IF EXISTS public.get_payout_plan_breakdown(uuid);
DROP FUNCTION IF EXISTS public.compute_next_payout_date(date, text);

CREATE OR REPLACE FUNCTION public.compute_next_payout_date(current_date_val date, freq text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
  RETURN CASE freq
    WHEN 'daily' THEN current_date_val + 1
    WHEN 'weekly' THEN current_date_val + 7
    WHEN 'weekly_specific' THEN current_date_val + 7
    WHEN 'specific_days' THEN current_date_val + 1
    WHEN 'biweekly' THEN current_date_val + 14
    WHEN 'bi-weekly' THEN current_date_val + 14
    WHEN 'monthly' THEN (current_date_val + INTERVAL '1 month')::date
    WHEN 'end_of_month' THEN (DATE_TRUNC('month', current_date_val) + INTERVAL '1 month' - INTERVAL '1 day')::date
    WHEN 'month_end' THEN (DATE_TRUNC('month', current_date_val) + INTERVAL '1 month' - INTERVAL '1 day')::date
    WHEN 'quarterly' THEN (current_date_val + INTERVAL '3 months')::date
    WHEN 'biannually' THEN (current_date_val + INTERVAL '6 months')::date
    WHEN 'bi-annually' THEN (current_date_val + INTERVAL '6 months')::date
    WHEN 'annually' THEN (current_date_val + INTERVAL '1 year')::date
    WHEN 'custom' THEN current_date_val + 1
    ELSE (current_date_val + INTERVAL '1 month')::date
  END;
END;
$function$;

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
  v_gross_per_installment numeric;
  v_fee_per_installment numeric;
  v_next_date date;
  v_installment integer := 1;
  v_idx integer := 0;
  v_rec record;
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

  v_gross_per_installment := CASE
    WHEN v_duration > 0 AND v_total_amount IS NOT NULL THEN ROUND(v_total_amount / v_duration, 2)
    ELSE v_payout_amount
  END;

  v_fee_per_installment := CASE
    WHEN v_total_fee_amount IS NOT NULL AND v_duration > 0 THEN ROUND(v_total_fee_amount / v_duration, 2)
    ELSE ROUND(v_gross_per_installment * COALESCE(v_fee_percentage, 0) / 100.0, 2)
  END;

  -- Phase 1: emit rows from actual automated_payouts records (source of truth)
  FOR v_rec IN
    SELECT ap.scheduled_date, ap.status, ap.installment_index
    FROM automated_payouts ap
    WHERE ap.payout_plan_id = plan_uuid
    ORDER BY ap.installment_index NULLS LAST, ap.scheduled_date
  LOOP
    v_installment := COALESCE(v_rec.installment_index, v_idx) + 1;

    RETURN QUERY SELECT
      v_installment,
      v_rec.scheduled_date,
      v_gross_per_installment,
      v_fee_per_installment,
      v_payout_amount,
      CASE
        WHEN v_rec.status = 'completed' THEN 'completed'
        WHEN v_rec.status = 'failed' THEN 'failed'
        WHEN v_rec.scheduled_date <= CURRENT_DATE THEN 'due'
        ELSE 'upcoming'
      END;

    v_next_date := v_rec.scheduled_date;
    v_idx := v_installment;
    v_installment := v_installment + 1;
  END LOOP;

  -- Phase 2: compute remaining installments beyond what's in automated_payouts
  -- Start from the last known date (or plan start_date if no records exist)
  IF v_idx = 0 THEN
    v_next_date := v_start_date;
    v_installment := 1;
  END IF;

  WHILE v_installment <= v_duration LOOP
    v_next_date := public.compute_next_payout_date(v_next_date, v_frequency);

    RETURN QUERY SELECT
      v_installment,
      v_next_date,
      v_gross_per_installment,
      v_fee_per_installment,
      v_payout_amount,
      CASE
        WHEN v_installment <= v_completed_payouts THEN 'completed'
        WHEN v_next_date <= CURRENT_DATE THEN 'due'
        ELSE 'upcoming'
      END;

    v_installment := v_installment + 1;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_payout_plan_breakdown(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_next_payout_date(date, text) TO authenticated;
