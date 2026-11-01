-- Run this once in the Supabase SQL editor of the project the admin app points to
-- (the one in VITE_SUPABASE_URL). Safe to re-run.
--
-- The Calendar page shows deposits made into vaults (Wallet -> Vault, Paystack -> Vault).
-- Those live in expense_plan_topups, which admins cannot read directly, so the page reads them
-- through admin_calendar_vault_deposits(from, to). Read-only. Allowed for Super Admins and
-- anyone with the calendar.view / calendar.events permission.
--
-- Without this, the Calendar still works and shows a notice that vault deposits are missing.

-- Preflight: lists anything the function reads that is missing in this project.
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
  t text;
  c text[];
BEGIN
  FOREACH t IN ARRAY ARRAY['expense_plan_topups', 'profiles', 'budget_plans'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      v_missing := array_append(v_missing, 'table public.' || t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY['is_super_admin', 'has_permission'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = t) THEN
      v_missing := array_append(v_missing, 'function ' || t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'expense_plan_topups.id', 'expense_plan_topups.amount', 'expense_plan_topups.source',
    'expense_plan_topups.status', 'expense_plan_topups.created_at', 'expense_plan_topups.user_id',
    'expense_plan_topups.budget_plan_id',
    'profiles.first_name', 'profiles.last_name',
    'budget_plans.name', 'budget_plans.plan_name', 'budget_plans.categories', 'budget_plans.subcategories'
  ] LOOP
    c := string_to_array(t, '.');
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = c[1] AND column_name = c[2]
    ) THEN
      v_missing := array_append(v_missing, 'column ' || t);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'Missing dependencies in this project: %', array_to_string(v_missing, ', ');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_calendar_vault_deposits(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.is_super_admin()
          OR public.has_permission('calendar.view')
          OR public.has_permission('calendar.events')) THEN
    RAISE EXCEPTION 'Permission denied: calendar access required';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.created_at), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT e.id,
           e.amount,
           e.source,
           e.created_at,
           e.user_id,
           p.first_name,
           p.last_name,
           bp.id AS vault_id,
           COALESCE(NULLIF(btrim(bp.name), ''), NULLIF(btrim(bp.plan_name), '')) AS vault_name,
           bp.categories,
           bp.subcategories
    FROM public.expense_plan_topups e
    LEFT JOIN public.profiles p ON p.id = e.user_id
    LEFT JOIN public.budget_plans bp ON bp.id = e.budget_plan_id
    WHERE e.status = 'completed'
      AND e.created_at >= p_from
      AND e.created_at < p_to
    ORDER BY e.created_at
    LIMIT 5000
  ) d;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_calendar_vault_deposits(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_calendar_vault_deposits(timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
