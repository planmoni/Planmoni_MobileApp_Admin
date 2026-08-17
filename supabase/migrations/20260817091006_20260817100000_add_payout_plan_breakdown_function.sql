/*
# Add payout plan breakdown function

1. New Functions
- `get_payout_plan_breakdown(plan_uuid uuid)` returns the full payout schedule for a single payout plan.
- Each row represents one scheduled payout: installment number, scheduled date, gross payout amount, fee, and net amount.
- The schedule is computed from the plan's start_date, frequency, duration, and payout_amount.

2. Behavior
- Frequencies supported: daily, specific_days, weekly, bi-weekly, monthly, month_end, quarterly, bi-annually, annually, custom.
- For `specific_days`, payouts advance daily (best-effort) since the specific day-of-week is informational.
- For `custom`, payouts advance monthly as a reasonable default.
- The fee is derived from the plan's fee_percentage applied to payout_amount; if fee_amount is already set on the plan, it is used directly.
- Net amount = payout_amount - fee.

3. Security
- SECURITY DEFINER with fixed search_path = public, matching the existing admin function pattern.
- Granted to authenticated role.
- No tables or columns are modified.
*/

CREATE OR REPLACE FUNCTION public.get_payout_plan_breakdown(plan_uuid uuid)
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
  v_fee_percentage numeric;
  v_fee_amount numeric;
  v_net_payout_amount numeric;
  v_completed_payouts integer;
  v_current_date date := v_start_date;
  v_installment integer := 1;
  v_fee numeric;
  v_next_date date;
BEGIN
  SELECT
    p.start_date,
    p.frequency,
    p.duration,
    p.payout_amount,
    p.fee_percentage,
    p.fee_amount,
    p.net_payout_amount,
    p.completed_payouts
  INTO
    v_start_date,
    v_frequency,
    v_duration,
    v_payout_amount,
    v_fee_percentage,
    v_fee_amount,
    v_net_payout_amount,
    v_completed_payouts
  FROM payout_plans p
  WHERE p.id = plan_uuid;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_current_date := v_start_date;
  v_installment := 1;

  WHILE v_installment <= v_duration LOOP
    v_fee := COALESCE(v_fee_amount, ROUND(v_payout_amount * COALESCE(v_fee_percentage, 0) / 100.0, 2));

    RETURN QUERY SELECT
      v_installment,
      v_current_date,
      v_payout_amount,
      v_fee,
      (v_payout_amount - v_fee),
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
