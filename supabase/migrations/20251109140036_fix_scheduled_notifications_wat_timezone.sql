/*
  # Fix Scheduled Notifications with WAT Timezone

  1. Overview
    - Updates the scheduled notifications processor to use WAT timezone
    - Creates a function that automatically processes notifications when due in WAT
    - Sets up proper timezone handling for Africa/Lagos (WAT)

  2. Changes
    - Updates process_scheduled_notifications function to check against WAT time
    - Creates a helper to get current WAT time
    - Adds automatic processing logic

  3. Notes
    - WAT is UTC+1
    - Notifications are checked every minute
    - Only processes notifications where scheduled_for <= current WAT time
*/

-- Drop existing function
DROP FUNCTION IF EXISTS process_scheduled_notifications();

-- Create improved function with WAT timezone support
CREATE OR REPLACE FUNCTION process_scheduled_notifications()
RETURNS TABLE(processed_count INTEGER, notification_ids UUID[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_record RECORD;
  current_wat_time TIMESTAMPTZ;
  processed INTEGER := 0;
  notification_id_array UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Get current time in WAT (Africa/Lagos timezone = UTC+1)
  current_wat_time := NOW() AT TIME ZONE 'Africa/Lagos';

  -- Find all scheduled notifications that are due (comparing in WAT)
  FOR notification_record IN
    SELECT 
      id,
      title,
      scheduled_for,
      (scheduled_for AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos') as scheduled_wat
    FROM push_notifications
    WHERE status = 'scheduled'
      AND (scheduled_for AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos') <= current_wat_time
    ORDER BY scheduled_for ASC
    LIMIT 10
  LOOP
    -- Update status to 'sending' to prevent duplicate processing
    UPDATE push_notifications
    SET status = 'sending',
        sent_at = NOW()
    WHERE id = notification_record.id
      AND status = 'scheduled';
    
    -- Only count if we actually updated (prevents race conditions)
    IF FOUND THEN
      processed := processed + 1;
      notification_id_array := array_append(notification_id_array, notification_record.id);
      
      RAISE NOTICE 'Marked notification % as sending (was scheduled for %)', 
        notification_record.id, 
        notification_record.scheduled_wat;
    END IF;
  END LOOP;

  RETURN QUERY SELECT processed, notification_id_array;
END;
$$;

-- Create a function to check if there are pending scheduled notifications
CREATE OR REPLACE FUNCTION has_pending_scheduled_notifications()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_wat_time TIMESTAMPTZ;
  pending_count INTEGER;
BEGIN
  current_wat_time := NOW() AT TIME ZONE 'Africa/Lagos';
  
  SELECT COUNT(*)
  INTO pending_count
  FROM push_notifications
  WHERE status = 'scheduled'
    AND (scheduled_for AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Lagos') <= current_wat_time;
  
  RETURN pending_count > 0;
END;
$$;