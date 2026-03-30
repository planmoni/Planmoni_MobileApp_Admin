/*
  # Fix get_notification_dispatch_logs Function
  
  1. Issue
    - Function references p.full_name which doesn't exist in profiles table
    - Profiles table has first_name and last_name columns instead
    
  2. Changes
    - Replace p.full_name with CONCAT(p.first_name, ' ', p.last_name)
    - This fixes the "column p.full_name does not exist" error
    - Allows dispatch logs to display properly in the admin dashboard
    
  3. Impact
    - Fixes "Dispatched Today: 8" showing but no logs displayed
    - Re-enables dispatch log viewing in Notifications page
*/

-- Drop and recreate the function with correct column references
DROP FUNCTION IF EXISTS get_notification_dispatch_logs(INT, INT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_notification_dispatch_logs(
  limit_count INT DEFAULT 100,
  offset_count INT DEFAULT 0,
  filter_status TEXT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL,
  search_term TEXT DEFAULT NULL,
  date_from TIMESTAMPTZ DEFAULT NULL,
  date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  push_notification_id UUID,
  user_id UUID,
  user_email TEXT,
  user_full_name TEXT,
  notification_title TEXT,
  notification_body TEXT,
  notification_type TEXT,
  notification_category TEXT,
  status TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pnl.id,
    pnl.push_notification_id,
    pnl.user_id,
    p.email as user_email,
    CONCAT(p.first_name, ' ', p.last_name) as user_full_name,
    pn.title as notification_title,
    pn.body as notification_body,
    pn.notification_type,
    pn.notification_category,
    pnl.status,
    pnl.error_message,
    pnl.sent_at,
    pnl.delivered_at,
    pnl.created_at
  FROM push_notification_logs pnl
  LEFT JOIN profiles p ON pnl.user_id = p.id
  LEFT JOIN push_notifications pn ON pnl.push_notification_id = pn.id
  WHERE 
    (filter_status IS NULL OR pnl.status = filter_status)
    AND (filter_category IS NULL OR pn.notification_category = filter_category)
    AND (search_term IS NULL OR 
      p.email ILIKE '%' || search_term || '%' OR 
      CONCAT(p.first_name, ' ', p.last_name) ILIKE '%' || search_term || '%')
    AND (date_from IS NULL OR pnl.sent_at >= date_from)
    AND (date_to IS NULL OR pnl.sent_at <= date_to)
  ORDER BY pnl.sent_at DESC NULLS LAST
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_notification_dispatch_logs TO authenticated;
