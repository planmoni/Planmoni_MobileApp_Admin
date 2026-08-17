DROP FUNCTION IF EXISTS public.get_all_transactions_data(text, text, date, date, integer, integer);

CREATE FUNCTION public.get_all_transactions_data(
  search_query text DEFAULT NULL::text,
  transaction_type text DEFAULT NULL::text,
  start_date date DEFAULT NULL::date,
  end_date date DEFAULT NULL::date,
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  type text,
  amount numeric,
  status text,
  source text,
  destination text,
  payout_plan_id uuid,
  payout_plan_name text,
  bank_account_id uuid,
  bank_name text,
  account_number text,
  reference text,
  description text,
  created_at timestamp with time zone,
  metadata jsonb,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  where_clause text := '';
  count_query text;
  main_query text;
  total_records bigint;
BEGIN
  where_clause := 'WHERE 1=1';

  IF search_query IS NOT NULL AND search_query != '' THEN
    where_clause := where_clause || ' AND (p.first_name ILIKE ''%' || search_query || '%'' OR p.last_name ILIKE ''%' || search_query || '%'' OR p.email ILIKE ''%' || search_query || '%'')';
  END IF;

  IF transaction_type IS NOT NULL AND transaction_type != 'all' THEN
    where_clause := where_clause || ' AND t.type = ''' || transaction_type || '''';
  END IF;

  IF start_date IS NOT NULL THEN
    where_clause := where_clause || ' AND DATE(t.created_at) >= ''' || start_date || '''';
  END IF;

  IF end_date IS NOT NULL THEN
    where_clause := where_clause || ' AND DATE(t.created_at) <= ''' || end_date || '''';
  END IF;

  count_query := 'SELECT COUNT(*) FROM transactions t LEFT JOIN profiles p ON t.user_id = p.id ' || where_clause;
  EXECUTE count_query INTO total_records;

  RETURN QUERY EXECUTE '
    SELECT
      t.id,
      t.user_id,
      COALESCE(p.first_name || '' '' || p.last_name, ''Unknown User'') as user_name,
      p.email as user_email,
      t.type,
      t.amount,
      t.status,
      t.source,
      t.destination,
      t.payout_plan_id,
      pp.name as payout_plan_name,
      t.bank_account_id,
      ba.bank_name,
      ba.account_number,
      t.reference,
      t.description,
      t.created_at,
      t.metadata,
      ' || total_records || '::bigint as total_count
    FROM transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    LEFT JOIN payout_plans pp ON t.payout_plan_id = pp.id
    LEFT JOIN bank_accounts ba ON t.bank_account_id = ba.id
    ' || where_clause || '
    ORDER BY t.created_at DESC
    LIMIT ' || limit_count || ' OFFSET ' || offset_count;
END;
$function$;
