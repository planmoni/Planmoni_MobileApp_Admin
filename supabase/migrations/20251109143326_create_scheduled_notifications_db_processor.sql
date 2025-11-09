/*
  # Create Database-Side Scheduled Notifications Processor

  1. Overview
    - Creates a database function that processes scheduled notifications automatically
    - Uses pg_net to call the Edge Function with proper URL
    - Runs via pg_cron every minute (like payout system)
    - No browser required - fully automated

  2. Changes
    - Creates process_scheduled_notifications_db function
    - Sets up pg_cron job to run every minute
    - Uses service role key for authentication

  3. Notes
    - Checks for notifications where scheduled_for <= NOW()
    - Only processes notifications with status = 'scheduled'
    - Calls admin-push-notifications Edge Function with action='process_scheduled'
*/

-- Drop existing job if any
SELECT cron.unschedule('process-scheduled-push-notifications')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-push-notifications'
);

-- Create function to process scheduled notifications
CREATE OR REPLACE FUNCTION process_scheduled_notifications_db()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_record RECORD;
  request_id BIGINT;
  function_url TEXT;
BEGIN
  -- Construct the Edge Function URL
  -- Use internal URL for better reliability
  function_url := current_setting('request.headers', true)::json->>'host';
  
  IF function_url IS NULL OR function_url = '' THEN
    function_url := 'https://' || current_setting('app.settings.api_url', true);
  END IF;
  
  IF function_url IS NULL OR function_url = '' THEN
    -- Fallback to environment variable if set
    function_url := current_setting('app.settings.supabase_url', true);
  END IF;
  
  -- If still null, try to construct from database name
  IF function_url IS NULL OR function_url = '' THEN
    function_url := 'https://' || current_database() || '.supabase.co';
  END IF;
  
  function_url := function_url || '/functions/v1/admin-push-notifications';
  
  -- Find all scheduled notifications that are due
  FOR notification_record IN
    SELECT id, title, scheduled_for
    FROM push_notifications
    WHERE status = 'scheduled'
      AND scheduled_for IS NOT NULL
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    LIMIT 5  -- Process max 5 at a time to avoid overload
  LOOP
    BEGIN
      -- Call Edge Function using pg_net
      SELECT net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'action', 'process_scheduled',
          'notification_id', notification_record.id::text
        )
      ) INTO request_id;
      
      RAISE NOTICE 'Triggered notification % (request_id: %)', notification_record.id, request_id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue with next notification
        RAISE WARNING 'Failed to process notification %: %', notification_record.id, SQLERRM;
    END;
  END LOOP;
  
END;
$$;

-- Schedule the processor to run every minute
SELECT cron.schedule(
  'process-scheduled-push-notifications',
  '* * * * *',  -- Every minute
  'SELECT process_scheduled_notifications_db();'
);