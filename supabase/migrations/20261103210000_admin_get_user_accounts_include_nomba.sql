-- Include Nomba deposit NUBANs on the admin user profile, same panel as SafeHaven.
-- nomba_virtual_accounts is RLS-restricted; this SECURITY DEFINER function already
-- exposes only display fields for SafeHaven / Paystack.

CREATE OR REPLACE FUNCTION public.admin_get_user_accounts(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.has_permission('users.details')
          OR public.has_permission('users.list')
          OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: user access required';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.is_default DESC, a.created_at ASC NULLS LAST), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT DISTINCT ON (u.account_number)
           u.source, u.account_number, u.account_name, u.bank_name, u.bank_code,
           u.status, u.is_default, u.created_at
    FROM (
      SELECT 'safehaven'::text AS source,
             s.account_number,
             s.account_name,
             'Safe Haven Microfinance Bank'::text AS bank_name,
             '51113'::text AS bank_code,
             s.status,
             COALESCE(s.is_default, false) AS is_default,
             s.created_at,
             1 AS priority
      FROM public.safehaven_accounts s
      WHERE s.user_id = p_user_id
        AND COALESCE(s.is_deleted, false) = false
        AND s.account_number IS NOT NULL AND s.account_number <> ''

      UNION ALL

      SELECT 'safehaven',
             su.account_number,
             su.account_name,
             COALESCE(NULLIF(su.bank_name, ''), 'Safe Haven Microfinance Bank'),
             COALESCE(NULLIF(su.bank_code, ''), '51113'),
             su.status,
             COALESCE(su.is_primary, false),
             su.created_at,
             2
      FROM public.safehaven_user_accounts su
      WHERE su.user_id = p_user_id
        AND su.account_number IS NOT NULL AND su.account_number <> ''

      UNION ALL

      SELECT 'nomba',
             n.bank_account_number,
             COALESCE(
               NULLIF(btrim(n.bank_account_name), ''),
               NULLIF(btrim(n.account_name), '')
             ),
             COALESCE(NULLIF(btrim(n.bank_name), ''), 'Nombank MFB'),
             NULL,
             n.status,
             lower(COALESCE(n.status, '')) = 'active',
             n.created_at,
             3
      FROM public.nomba_virtual_accounts n
      WHERE n.user_id = p_user_id
        AND n.bank_account_number IS NOT NULL AND n.bank_account_number <> ''

      UNION ALL

      SELECT 'paystack',
             pa.account_number,
             pa.account_name,
             pa.bank_name,
             NULL,
             CASE WHEN COALESCE(pa.is_active, true) THEN 'Active' ELSE 'Inactive' END,
             false,
             pa.created_at,
             4
      FROM public.paystack_accounts pa
      WHERE pa.user_id = p_user_id
        AND pa.account_number IS NOT NULL AND pa.account_number <> ''

      UNION ALL

      SELECT 'safehaven',
             pr.safehaven_account_number,
             NULLIF(btrim(COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, '')), ''),
             'Safe Haven Microfinance Bank',
             '51113',
             NULL,
             false,
             NULL::timestamptz,
             5
      FROM public.profiles pr
      WHERE pr.id = p_user_id
        AND pr.safehaven_account_number IS NOT NULL AND pr.safehaven_account_number <> ''
    ) u
    ORDER BY u.account_number, u.priority
  ) a;

  RETURN v_result;
END;
$$;
