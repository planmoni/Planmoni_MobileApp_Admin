/*
# Add complete user search function

1. New Functions
- `search_users_info(search_query text)` searches the complete profiles dataset before returning results.
- It returns the same user summary fields used by the Users page, including wallet totals, deposit totals, payout totals, and active plans.

2. Search Behavior
- The query is split into words and every word must appear somewhere in the user's first name, last name, or email.
- Matching happens in the database, so results are not limited by the browser/API first-page row cap.
- Empty or whitespace-only searches return all users, preserving the existing Users page behavior.

3. Security
- The function runs as `SECURITY DEFINER` with a fixed `public` search path, matching the existing administrative user-summary function pattern.
- No tables, columns, or existing data are changed.

4. Important Notes
- This is an additive database change only.
- Existing `get_all_users_info()` behavior remains unchanged for other callers.
*/

CREATE OR REPLACE FUNCTION public.search_users_info(search_query text)
RETURNS TABLE(
  id uuid,
  first_name text,
  last_name text,
  email text,
  created_at timestamptz,
  is_admin boolean,
  balance numeric,
  locked_balance numeric,
  total_deposits numeric,
  total_payouts numeric,
  active_plans bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.email,
    p.created_at,
    p.is_admin,
    COALESCE(w.available_balance, 0) AS balance,
    COALESCE(w.locked_balance, 0) AS locked_balance,
    (
      SELECT COALESCE(SUM(t.amount), 0)
      FROM transactions t
      WHERE t.user_id = p.id
        AND t.type = 'deposit'
        AND t.status = 'completed'
    ) AS total_deposits,
    (
      SELECT COALESCE(SUM(t.amount), 0)
      FROM transactions t
      WHERE t.user_id = p.id
        AND t.type = 'payout'
        AND t.status = 'completed'
    ) AS total_payouts,
    (
      SELECT COUNT(*)
      FROM payout_plans pp
      WHERE pp.user_id = p.id
        AND pp.status = 'active'
    ) AS active_plans
  FROM profiles p
  LEFT JOIN wallets w ON w.user_id = p.id
  WHERE NULLIF(trim(search_query), '') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM unnest(regexp_split_to_array(lower(trim(search_query)), '\s+')) AS search_term
       WHERE search_term <> ''
         AND lower(concat_ws(' ', p.first_name, p.last_name, p.email)) NOT LIKE '%' || search_term || '%'
     )
  ORDER BY p.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.search_users_info(text) TO authenticated;
