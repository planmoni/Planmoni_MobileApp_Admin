/*
  # Mark Pending Emails as Failed After Timeout
  
  1. New Function
    - mark_pending_emails_as_failed() - Marks pending emails as failed after 5 minutes
    - Can be called manually or via pg_cron
  
  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only updates campaign_recipients table
*/

CREATE OR REPLACE FUNCTION mark_pending_emails_as_failed()
RETURNS TABLE (
  marked_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  timeout_minutes integer := 5; -- Mark as failed after 5 minutes
  marked_count bigint;
BEGIN
  -- Mark pending emails older than timeout_minutes as failed
  UPDATE campaign_recipients
  SET 
    status = 'failed',
    error_message = 'Email sending timed out after ' || timeout_minutes || ' minutes',
    updated_at = now()
  WHERE 
    status = 'pending'
    AND created_at < now() - (timeout_minutes || ' minutes')::interval
    AND sent_at IS NULL;
  
  GET DIAGNOSTICS marked_count = ROW_COUNT;
  
  RETURN QUERY SELECT marked_count;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION mark_pending_emails_as_failed() TO authenticated;

-- Optional: Create a pg_cron job to run this every minute
-- Note: pg_cron may not be available in all Supabase tiers
-- Uncomment the following if you want automatic timeout handling:
/*
SELECT cron.schedule(
  'mark-pending-emails-failed',
  '* * * * *', -- Every minute
  'SELECT mark_pending_emails_as_failed();'
);
*/
