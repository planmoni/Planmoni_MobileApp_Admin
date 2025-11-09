/*
  # Create Direct Notification Sender in Database

  1. Overview
    - Creates a database function that directly sends scheduled notifications
    - Uses Supabase's http extension to call Expo Push API
    - Runs automatically via pg_cron every minute
    - No Edge Function call needed - fully self-contained

  2. Functions
    - send_scheduled_notification: Sends a single notification
    - process_due_scheduled_notifications: Finds and processes all due notifications
    - Scheduled via pg_cron

  3. Security
    - Uses SECURITY DEFINER for proper permissions
    - Direct HTTP calls to Expo Push API
    - Updates notification status and logs

  4. Notes
    - Processes up to 5 notifications per run
    - Runs every minute via pg_cron
    - Personalizes messages with user's first name
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS http;

-- Drop existing scheduled job
SELECT cron.unschedule('process-scheduled-push-notifications')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-scheduled-push-notifications'
);

-- Function to send a single scheduled notification
CREATE OR REPLACE FUNCTION send_scheduled_notification(p_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification RECORD;
  v_token_record RECORD;
  v_push_tokens JSONB[];
  v_user_ids UUID[];
  v_messages JSONB[];
  v_response http_response;
  v_tickets JSONB;
  v_delivered INTEGER := 0;
  v_failed INTEGER := 0;
  v_total INTEGER := 0;
  v_message_body TEXT;
  v_user_first_name TEXT;
BEGIN
  -- Get notification details
  SELECT * INTO v_notification
  FROM push_notifications
  WHERE id = p_notification_id
    AND status = 'scheduled';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Mark as sending
  UPDATE push_notifications
  SET status = 'sending',
      sent_at = NOW()
  WHERE id = p_notification_id;
  
  -- Get recipient user IDs based on target type
  IF v_notification.target_type = 'all' THEN
    SELECT ARRAY_AGG(DISTINCT user_id)
    INTO v_user_ids
    FROM user_push_tokens
    WHERE is_active = true;
    
  ELSIF v_notification.target_type = 'individual' THEN
    v_user_ids := v_notification.target_user_ids;
    
  ELSIF v_notification.target_type = 'segment' AND v_notification.target_segment_id IS NOT NULL THEN
    -- Handle segment logic
    DECLARE
      v_segment RECORD;
    BEGIN
      SELECT filter_criteria INTO v_segment
      FROM push_notification_segments
      WHERE id = v_notification.target_segment_id;
      
      IF v_segment.filter_criteria->>'type' = 'all' THEN
        SELECT ARRAY_AGG(id) INTO v_user_ids FROM profiles;
      ELSIF v_segment.filter_criteria->>'type' = 'has_active_plans' THEN
        SELECT ARRAY_AGG(DISTINCT user_id) INTO v_user_ids
        FROM payout_plans WHERE status = 'active';
      ELSIF v_segment.filter_criteria->>'type' = 'kyc_approved' THEN
        SELECT ARRAY_AGG(user_id) INTO v_user_ids
        FROM kyc_data WHERE approved = true;
      ELSIF v_segment.filter_criteria->>'type' = 'joined_recently' THEN
        SELECT ARRAY_AGG(id) INTO v_user_ids
        FROM profiles
        WHERE created_at >= NOW() - INTERVAL '30 days';
      END IF;
    END;
  END IF;
  
  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    UPDATE push_notifications
    SET status = 'failed',
        total_recipients = 0,
        failed_count = 0
    WHERE id = p_notification_id;
    RETURN FALSE;
  END IF;
  
  -- Build messages array for Expo
  v_messages := ARRAY[]::JSONB[];
  
  FOR v_token_record IN
    SELECT upt.expo_push_token, upt.user_id, p.first_name
    FROM user_push_tokens upt
    JOIN profiles p ON p.id = upt.user_id
    WHERE upt.user_id = ANY(v_user_ids)
      AND upt.is_active = true
      AND upt.expo_push_token IS NOT NULL
  LOOP
    -- Personalize message if needed
    IF v_notification.personalize AND v_token_record.first_name IS NOT NULL THEN
      v_message_body := 'Hello ' || v_token_record.first_name || ', ' || v_notification.body;
    ELSE
      v_message_body := v_notification.body;
    END IF;
    
    -- Add message to array
    v_messages := array_append(v_messages, jsonb_build_object(
      'to', v_token_record.expo_push_token,
      'sound', 'default',
      'title', v_notification.title,
      'body', v_message_body,
      'data', COALESCE(v_notification.data, '{}'::jsonb),
      'priority', 'high'
    ));
    
    v_total := v_total + 1;
  END LOOP;
  
  -- Update total recipients
  UPDATE push_notifications
  SET total_recipients = v_total
  WHERE id = p_notification_id;
  
  IF v_total = 0 THEN
    UPDATE push_notifications
    SET status = 'failed',
        failed_count = 0
    WHERE id = p_notification_id;
    RETURN FALSE;
  END IF;
  
  -- Send to Expo Push API
  BEGIN
    SELECT * INTO v_response
    FROM http((
      'POST',
      'https://exp.host/--/api/v2/push/send',
      ARRAY[
        http_header('Accept', 'application/json'),
        http_header('Content-Type', 'application/json')
      ],
      'application/json',
      jsonb_build_array(v_messages)::text
    ));
    
    IF v_response.status = 200 THEN
      v_tickets := v_response.content::jsonb->'data';
      v_delivered := v_total;
      v_failed := 0;
      
      UPDATE push_notifications
      SET status = 'sent',
          delivered_count = v_delivered,
          failed_count = v_failed
      WHERE id = p_notification_id;
      
      RETURN TRUE;
    ELSE
      v_failed := v_total;
      
      UPDATE push_notifications
      SET status = 'failed',
          delivered_count = 0,
          failed_count = v_failed
      WHERE id = p_notification_id;
      
      RETURN FALSE;
    END IF;
    
  EXCEPTION
    WHEN OTHERS THEN
      UPDATE push_notifications
      SET status = 'failed',
          delivered_count = 0,
          failed_count = v_total
      WHERE id = p_notification_id;
      
      RAISE WARNING 'Failed to send notification %: %', p_notification_id, SQLERRM;
      RETURN FALSE;
  END;
END;
$$;

-- Function to process all due scheduled notifications
CREATE OR REPLACE FUNCTION process_due_scheduled_notifications()
RETURNS TABLE(processed_count INTEGER, notification_ids UUID[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_record RECORD;
  v_processed INTEGER := 0;
  v_notification_ids UUID[] := ARRAY[]::UUID[];
  v_success BOOLEAN;
BEGIN
  -- Find and process due notifications
  FOR v_notification_record IN
    SELECT id, title, scheduled_for
    FROM push_notifications
    WHERE status = 'scheduled'
      AND scheduled_for IS NOT NULL
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    LIMIT 5  -- Process max 5 per minute
  LOOP
    -- Send the notification
    v_success := send_scheduled_notification(v_notification_record.id);
    
    IF v_success THEN
      v_processed := v_processed + 1;
      v_notification_ids := array_append(v_notification_ids, v_notification_record.id);
      
      RAISE NOTICE 'Successfully sent scheduled notification: % ("%")', 
        v_notification_record.id, 
        v_notification_record.title;
    END IF;
    
    -- Small delay between notifications
    PERFORM pg_sleep(0.5);
  END LOOP;
  
  RETURN QUERY SELECT v_processed, v_notification_ids;
END;
$$;

-- Schedule the processor to run every minute
SELECT cron.schedule(
  'process-scheduled-push-notifications',
  '* * * * *',
  'SELECT process_due_scheduled_notifications();'
);