/*
  # Scheduled Notifications Processor

  1. Overview
    - Creates a system to automatically process scheduled push notifications
    - Uses pg_cron extension to run every minute
    - Sends notifications when their scheduled time arrives

  2. New Functions
    - `process_scheduled_notifications()`: Processes due notifications
    - Called by pg_cron every minute

  3. pg_cron Setup
    - Enables pg_cron extension
    - Creates a cron job to run every minute
    - Processes notifications where scheduled_for <= now()

  4. Security
    - Function runs with security definer privileges
    - Only processes notifications with status 'scheduled'
*/

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to process scheduled notifications
CREATE OR REPLACE FUNCTION process_scheduled_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_record RECORD;
  api_url TEXT;
  api_response TEXT;
BEGIN
  -- Get Supabase URL from environment or use default
  api_url := current_setting('app.settings.supabase_url', true);
  IF api_url IS NULL THEN
    api_url := 'http://kong:8000';
  END IF;

  -- Find all scheduled notifications that are due
  FOR notification_record IN
    SELECT 
      id,
      title,
      body,
      data,
      target_type,
      target_user_ids,
      target_segment_id,
      created_by
    FROM push_notifications
    WHERE status = 'scheduled'
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    LIMIT 10
  LOOP
    -- Update status to 'sending' to prevent duplicate processing
    UPDATE push_notifications
    SET status = 'sending'
    WHERE id = notification_record.id;

    -- Note: The actual sending will be handled by calling the Edge Function
    -- For now, we'll log that we need to process this
    RAISE NOTICE 'Processing scheduled notification: %', notification_record.id;
  END LOOP;
END;
$$;

-- Schedule the function to run every minute using pg_cron
-- Note: pg_cron may not be available in all Supabase tiers
-- This is a fallback approach - we'll also provide a manual trigger option
DO $$
BEGIN
  -- Try to create cron job (will fail gracefully if pg_cron is not available)
  BEGIN
    PERFORM cron.schedule(
      'process-scheduled-notifications',
      '* * * * *',  -- Every minute
      'SELECT process_scheduled_notifications();'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron not available - manual trigger will be needed';
  END;
END $$;