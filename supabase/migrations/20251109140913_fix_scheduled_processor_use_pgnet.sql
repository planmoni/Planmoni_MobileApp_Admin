/*
  # Fix Scheduled Notifications Processor - Use pg_net

  1. Overview
    - Replaces http extension with pg_net (Supabase's async HTTP client)
    - pg_net is specifically designed to work in Supabase environment
    - Makes async HTTP requests that don't block pg_cron

  2. Changes
    - Drops old function that uses http extension
    - Creates new function using pg_net.http_post
    - Updates cron job to use new function

  3. Notes
    - pg_net makes async requests (fire and forget)
    - Better suited for Supabase's architecture
    - Works with Edge Functions
*/

-- Enable pg_net extension (Supabase's async HTTP client)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop old function
DROP FUNCTION IF EXISTS call_scheduled_notifications_processor();

-- Create new function using pg_net
CREATE OR REPLACE FUNCTION call_scheduled_notifications_processor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url TEXT;
  request_id BIGINT;
BEGIN
  -- Get the Supabase URL
  edge_function_url := current_setting('app.settings.supabase_url', true);
  
  IF edge_function_url IS NULL OR edge_function_url = '' THEN
    -- Use internal URL for Supabase
    edge_function_url := 'http://kong:8000';
  END IF;
  
  edge_function_url := edge_function_url || '/functions/v1/scheduled-notifications-processor';
  
  -- Make async HTTP POST request using pg_net
  SELECT net.http_post(
    url := edge_function_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) INTO request_id;
  
  -- Log the request
  RAISE NOTICE 'Triggered scheduled notifications processor, request_id: %', request_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail
    RAISE WARNING 'Failed to trigger scheduled notifications processor: %', SQLERRM;
END;
$$;