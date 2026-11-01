-- Admin Calendar: deposits made into vaults (Wallet -> Vault, Paystack -> Vault).
--
-- Vault funding is stored in expense_plan_topups, which admins cannot read under RLS, so the
-- calendar gets it through this SECURITY DEFINER function. Read-only; returns display fields only.
--
-- admin_calendar_vault_deposits(from, to) -> [{ id, amount, source, created_at, user_id,
--   first_name, last_name, vault_id, vault_name, categories, subcategories }]

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
