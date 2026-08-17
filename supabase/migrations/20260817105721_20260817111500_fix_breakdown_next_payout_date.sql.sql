/*
# Align breakdown with the stored next payout date

## Problem
The breakdown correctly used `automated_payouts` for completed installments,
but when it generated the remaining installment it advanced the last recorded
date using a generic `custom` interval. For a plan whose next payout was stored
as Aug 23, this produced Aug 17 and incorrectly marked the payout as due.

## Fix
- Read `payout_plans.next_payout_date`.
- Use its calendar date as the first missing installment date when it is later
  than the last recorded payout date.
- Continue calculating any installments after that date using the plan's
  frequency.
- Keep actual `automated_payouts.scheduled_date` values as the source of truth
  for recorded installments.

## Security
- SECURITY DEFINER with fixed search_path = public.
- Granted to authenticated role.
- No tables or columns modified.
*/

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
  v_plan_next_payout_date date;
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
    p.completed_payouts,
    p.next_payout_date::date
  INTO
    v_start_date,
    v_frequency,
    v_duration,
    v_payout_amount,
    v_total_amount,
    v_fee_percentage,
    v_total_fee_amount,
    v_completed_payouts,
    v_plan_next_payout_date
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

  IF v_idx = 0 THEN
    v_next_date := v_start_date;
    v_installment := 1;
  ELSIF v_plan_next_payout_date IS NOT NULL AND v_plan_next_payout_date > v_next_date THEN
    v_next_date := v_plan_next_payout_date;
  END IF;

  WHILE v_installment <= v_duration LOOP
    IF NOT (v_idx > 0 AND v_installment = v_idx + 1 AND v_plan_next_payout_date IS NOT NULL AND v_plan_next_payout_date > v_next_date) THEN
      v_next_date := public.compute_next_payout_date(v_next_date, v_frequency);
    END IF;

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
