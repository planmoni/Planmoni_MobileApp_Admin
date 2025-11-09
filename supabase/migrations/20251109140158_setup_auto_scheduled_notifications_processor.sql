/*
  # Setup Automatic Scheduled Notifications Processor

  1. Overview
    - Configures pg_cron to automatically process scheduled notifications
    - Calls the Edge Function every minute to check for due notifications
    - Uses http extension to make requests

  2. Setup
    - Enables http extension for making HTTP requests
    - Creates a function to call the Edge Function
    - Schedules it to run every minute via pg_cron

  3. Notes
    - Processes notifications in WAT timezone (UTC+1)
    - Edge Function URL: /functions/v1/scheduled-notifications-processor
    - Runs every minute: '* * * * *'
*/

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Create function to call the Edge Function processor
CREATE OR REPLACE FUNCTION call_scheduled_notifications_processor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT;
  supabase_anon_key TEXT;
  http_response http_response;
BEGIN
  -- Get the Supabase URL from settings or use internal kong URL
  edge_function_url := current_setting('app.settings.supabase_url', true);
  
  IF edge_function_url IS NULL OR edge_function_url = '' THEN
    edge_function_url := 'http://kong:8000';
  END IF;
  
  edge_function_url := edge_function_url || '/functions/v1/scheduled-notifications-processor';
  
  -- Get anon key (optional, the Edge Function doesn't require auth)
  supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);
  
  BEGIN
    -- Make HTTP POST request to the Edge Function
    SELECT * INTO http_response
    FROM http((
      'POST',
      edge_function_url,
      ARRAY[
        http_header('Content-Type', 'application/json')
      ],
      'application/json',
      '{}'
    ));
    
    -- Log the response
    IF http_response.status = 200 THEN
      RAISE NOTICE 'Successfully called scheduled notifications processor: %', http_response.content;
    ELSE
      RAISE WARNING 'Error calling scheduled notifications processor. Status: %, Response: %', 
        http_response.status, 
        http_response.content;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail
      RAISE WARNING 'Failed to call scheduled notifications processor: %', SQLERRM;
  END;
END;
$$;

-- Remove existing job if it exists
SELECT cron.unschedule('process-scheduled-push-notifications')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-push-notifications'
);

-- Schedule the processor to run every minute
SELECT cron.schedule(
  'process-scheduled-push-notifications',
  '* * * * *',
  'SELECT call_scheduled_notifications_processor();'
);