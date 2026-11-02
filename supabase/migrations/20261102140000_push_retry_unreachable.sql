/*
  Retry button honesty. A failed device whose token Expo/FCM reported as dead ("not registered": the app was uninstalled or
  the token expired) is switched off and can never succeed, so "Retry" skips it. The UI used to offer "Retry 5,898 failed"
  and then re-queue 0. Progress now reports how many failed devices are retryable and how many are unreachable, and the
  retry result says how many it skipped.
*/
CREATE OR REPLACE FUNCTION public.admin_push_progress(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n public.push_notifications%ROWTYPE;
  c jsonb;
  v_open bigint;
  v_retryable bigint;
  v_failed bigint;
BEGIN
  PERFORM public._admin_push_assert(false);
  SELECT * INTO n FROM public.push_notifications WHERE id = p_notification_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found';
  END IF;

  SELECT COALESCE(jsonb_object_agg(status, k), '{}'::jsonb) INTO c
  FROM (
    SELECT status, count(*) AS k
    FROM public.push_notification_recipients
    WHERE push_notification_id = p_notification_id
    GROUP BY status
  ) s;

  v_open := COALESCE((c ->> 'pending')::bigint, 0) + COALESCE((c ->> 'sending')::bigint, 0);
  v_failed := COALESCE((c ->> 'failed')::bigint, 0);

  SELECT count(*) INTO v_retryable
  FROM public.push_notification_recipients r
  WHERE r.push_notification_id = p_notification_id AND r.status = 'failed'
    AND EXISTS (SELECT 1 FROM public.user_push_tokens t WHERE t.expo_push_token = r.expo_push_token AND t.is_active);

  RETURN jsonb_build_object(
    'id', n.id,
    'status', n.status,
    'queued', n.queue_enabled,
    'total', COALESCE((SELECT sum(value::bigint) FROM jsonb_each_text(c) WHERE key <> 'skipped'), 0),
    'counts', c,
    'remaining', v_open,
    'retryable', v_retryable,
    'unreachable', v_failed - v_retryable,
    'rate_per_minute', n.rate_per_minute,
    'eta_seconds', CASE WHEN n.status = 'sending' THEN ceil(v_open::numeric / n.rate_per_minute * 60) ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_push_retry_failed(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_unreachable integer;
BEGIN
  PERFORM public._admin_push_assert(true);
  IF NOT EXISTS (SELECT 1 FROM public.push_notifications WHERE id = p_notification_id AND queue_enabled) THEN
    RAISE EXCEPTION 'Notification not found or not sent through the queue';
  END IF;

  UPDATE public.push_notification_recipients r
  SET status = 'pending', error_message = NULL, attempts = 0, ticket_id = NULL, receipt_checked_at = NULL, updated_at = now()
  WHERE r.push_notification_id = p_notification_id AND r.status = 'failed'
    AND EXISTS (SELECT 1 FROM public.user_push_tokens t WHERE t.expo_push_token = r.expo_push_token AND t.is_active);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT count(*) INTO v_unreachable
  FROM public.push_notification_recipients r
  WHERE r.push_notification_id = p_notification_id AND r.status = 'failed';

  IF v_count = 0 THEN
    RETURN jsonb_build_object('requeued', 0, 'unreachable', v_unreachable);
  END IF;

  UPDATE public.push_notifications
  SET status = 'sending', next_send_at = NULL, error = NULL, updated_at = now()
  WHERE id = p_notification_id AND status IN ('sent', 'failed');
  PERFORM public.push_recount(p_notification_id);
  PERFORM public._admin_push_audit('push.retry_failed', p_notification_id,
    jsonb_build_object('requeued', v_count, 'unreachable', v_unreachable));
  RETURN jsonb_build_object('requeued', v_count, 'unreachable', v_unreachable);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_push_progress(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_push_retry_failed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_push_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_push_retry_failed(uuid) TO authenticated;
