/*
  Re-engagement alerts sent to ONE user from the user's page are stored as notification_type = 'reengagement'
  with an explicit target_user_ids. Only a re-engagement send with no explicit users should resolve its audience
  from the eligibility function (category); otherwise the single-user alert would go to everyone eligible.
*/
CREATE OR REPLACE FUNCTION public.push_enqueue_recipients(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n public.push_notifications%ROWTYPE;
  v_users bigint;
  v_opted_out bigint;
  v_over_cap bigint;
  v_queued bigint;
BEGIN
  SELECT * INTO n FROM public.push_notifications WHERE id = p_notification_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found';
  END IF;

  WITH a AS MATERIALIZED (
    SELECT * FROM public._push_audience(
      n.target_type, n.target_segment_id, n.target_user_ids,
      CASE WHEN n.notification_type = 'reengagement' AND n.target_user_ids IS NULL THEN n.notification_category END,
      n.respect_marketing_pref
    )
  ),
  ins AS (
    INSERT INTO public.push_notification_recipients (push_notification_id, user_id, expo_push_token, status)
    SELECT n.id, a.user_id, a.expo_push_token, 'pending'
    FROM a
    WHERE NOT a.opted_out AND a.rn <= n.max_tokens_per_user
    ON CONFLICT (push_notification_id, expo_push_token) DO NOTHING
    RETURNING 1
  )
  SELECT (SELECT count(DISTINCT user_id) FROM a WHERE NOT opted_out),
         (SELECT count(DISTINCT user_id) FROM a WHERE opted_out),
         (SELECT count(*) FROM a WHERE NOT opted_out AND rn > n.max_tokens_per_user),
         (SELECT count(*) FROM ins)
  INTO v_users, v_opted_out, v_over_cap, v_queued;

  IF (SELECT count(*) FROM public.push_notification_recipients WHERE push_notification_id = n.id) = 0 THEN
    UPDATE public.push_notifications
    SET status = 'failed', queue_enabled = true, error = 'No eligible devices for this audience',
        total_recipients = 0, sent_at = now(), updated_at = now()
    WHERE id = n.id;
  ELSE
    UPDATE public.push_notifications
    SET status = 'sending', queue_enabled = true, next_send_at = NULL, error = NULL, updated_at = now()
    WHERE id = n.id AND status IN ('draft', 'scheduled', 'sending', 'failed');
    PERFORM public.push_recount(n.id);
  END IF;

  RETURN jsonb_build_object(
    'users', v_users,
    'devices_queued', v_queued,
    'opted_out_users', v_opted_out,
    'devices_over_cap', v_over_cap
  );
END;
$$;
REVOKE ALL ON FUNCTION public.push_enqueue_recipients(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_enqueue_recipients(uuid) TO service_role;
