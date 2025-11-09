/*
  # Remove Scheduled Notifications Processing System

  1. Overview
    - Removes pg_cron job for scheduled notifications
    - Drops database functions for scheduled notification processing
    - Keeps the notification tables intact (only removes automation)

  2. Changes
    - Unschedules pg_cron job
    - Drops process_due_scheduled_notifications function
    - Drops send_scheduled_notification function

  3. Notes
    - This only removes the automated scheduling system
    - All notification data and tables remain intact
    - Notifications can still be sent immediately through Edge Function
*/

-- Unschedule the cron job
SELECT cron.unschedule('process-scheduled-push-notifications')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-push-notifications'
);

-- Drop the processing functions
DROP FUNCTION IF EXISTS process_due_scheduled_notifications();
DROP FUNCTION IF EXISTS send_scheduled_notification(UUID);