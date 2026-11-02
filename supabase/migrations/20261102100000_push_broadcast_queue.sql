-- Mass push notification queue
--
-- Why: a broadcast used to run inside ONE edge function request. It read recipients through the REST API, which returns at
-- most 1000 rows, so "All users" stopped at 1000 (we have ~6,600 reachable users). It also wrote one log row per
-- device, one after the other, and could not resume if the function was stopped.
--
-- Now a notification is turned into queue rows (push_notification_recipients) by ONE SQL statement with no row limit, and
-- a worker (the push-broadcast-worker edge function, woken by pg_cron every minute and right after pressing Send) takes
-- batches of up to 100 devices, sends them to Expo and records the result. The pace is stored in the database
-- (push_notifications.next_send_at / rate_per_minute) so several workers can run without ever sending faster than the
-- chosen rate.
--
-- Broadcast has its own tables and worker on purpose: transactional pushes (payouts, security) use the separate
-- push_notification_queue and are never delayed by a broadcast.
--
-- Only notifications with queue_enabled = true are touched by the worker. Existing rows are left alone.
--
-- Audience rules (same for the preview and the send, so the numbers always match):
--   * the user must not have switched push off (profiles.push_notifications.enabled is not false)
--   * optionally (per send) marketing_alerts must not be false
--   * only active, well-formed Expo tokens; at most max_tokens_per_user newest tokens per user (some users have 40)

-- ---------------------------------------------------------------------------
-- 1. Columns, constraints, queue table
-- ---------------------------------------------------------------------------
ALTER TABLE public.push_notifications
  ADD COLUMN IF NOT EXISTS queue_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS respect_marketing_pref boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rate_per_minute integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS batch_size integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_tokens_per_user integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS personalize boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS error text;

ALTER TABLE public.push_notifications DROP CONSTRAINT IF EXISTS push_notifications_rate_check;
ALTER TABLE public.push_notifications
  ADD CONSTRAINT push_notifications_rate_check CHECK (rate_per_minute BETWEEN 100 AND 6000);
ALTER TABLE public.push_notifications DROP CONSTRAINT IF EXISTS push_notifications_batch_check;
ALTER TABLE public.push_notifications
  ADD CONSTRAINT push_notifications_batch_check CHECK (batch_size BETWEEN 1 AND 100);
ALTER TABLE public.push_notifications DROP CONSTRAINT IF EXISTS push_notifications_max_tokens_check;
ALTER TABLE public.push_notifications
  ADD CONSTRAINT push_notifications_max_tokens_check CHECK (max_tokens_per_user BETWEEN 1 AND 10);

-- stops a double click (or a retried request) from sending the same notification twice
CREATE UNIQUE INDEX IF NOT EXISTS push_notifications_request_id_key
  ON public.push_notifications (request_id) WHERE request_id IS NOT NULL;

-- allow the 'paused' status (the check constraint has a generated name, find it)
DO $$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.push_notifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%scheduled%sending%'
  LOOP
    EXECUTE format('ALTER TABLE public.push_notifications DROP CONSTRAINT %I', v_name);
  END LOOP;
END $$;
ALTER TABLE public.push_notifications
  ADD CONSTRAINT push_notifications_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'paused', 'sent', 'failed', 'cancelled'));

CREATE TABLE IF NOT EXISTS public.push_notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  push_notification_id uuid NOT NULL REFERENCES public.push_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  expo_push_token text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  ticket_id text,
  error_message text,
  sent_at timestamptz,
  receipt_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (push_notification_id, expo_push_token)
);

ALTER TABLE public.push_notification_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_notification_recipients FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_push_recipients_queue
  ON public.push_notification_recipients (push_notification_id, created_at, id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_push_recipients_receipts
  ON public.push_notification_recipients (sent_at)
  WHERE status = 'sent' AND ticket_id IS NOT NULL AND receipt_checked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_push_recipients_created
  ON public.push_notification_recipients (created_at);
CREATE INDEX IF NOT EXISTS idx_push_logs_receipt
  ON public.push_notification_logs (expo_receipt_id) WHERE expo_receipt_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Permission helper for the admin RPCs (not callable from the API)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._admin_push_assert(p_write boolean)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Permission denied: sign in required';
  END IF;
  IF public.is_super_admin() THEN
    RETURN;
  END IF;
  IF public.has_permission('notifications.send') OR public.has_permission('notifications.create') THEN
    RETURN;
  END IF;
  IF NOT p_write AND (public.has_permission('notifications.view') OR public.has_permission('notifications.history')) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Permission denied: notification permissions required';
END;
$$;
REVOKE ALL ON FUNCTION public._admin_push_assert(boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._admin_push_audit(p_action text, p_id uuid, p_new jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (auth.uid(), p_action, 'push_notification', p_id::text, '{}'::jsonb,
          COALESCE(p_new, '{}'::jsonb) || jsonb_build_object('admin_id', auth.uid(), 'at', now()));
END;
$$;
REVOKE ALL ON FUNCTION public._admin_push_audit(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The audience, in one place. One row per device (token) of every user in the audience,
--    with rn = 1 for the user's newest token, and opted_out for users who switched push off.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._push_audience(
  p_target_type text,
  p_segment_id uuid,
  p_user_ids uuid[],
  p_category text,
  p_respect_marketing boolean
)
RETURNS TABLE (user_id uuid, expo_push_token text, first_name text, rn integer, opted_out boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_ids uuid[] := p_user_ids;
  v_type text := p_target_type;
  v_seg text;
  v_days integer;
  v_fn text;
BEGIN
  -- re-engagement: the audience is whatever the existing eligibility function returns (no row limit here)
  IF p_category IS NOT NULL THEN
    v_fn := CASE p_category
      WHEN 'zero_balance_reminder' THEN 'get_zero_balance_users'
      WHEN 'vault_unfunded_reminder' THEN 'get_unfunded_vault_users'
      WHEN 'deposit_no_plan' THEN 'get_deposit_no_plan_users'
      WHEN 'no_plan_yet' THEN 'get_no_plan_users'
      WHEN 're_engagement' THEN 'get_inactive_users'
      ELSE NULL
    END;
    IF v_fn IS NULL THEN
      RAISE EXCEPTION 'Invalid re-engagement category';
    END IF;
    EXECUTE format('SELECT COALESCE(array_agg(DISTINCT x.user_id), ARRAY[]::uuid[]) FROM public.%I() x', v_fn)
      INTO v_ids;
    v_type := 'individual';
  END IF;

  IF v_type = 'segment' THEN
    SELECT s.filter_criteria ->> 'type',
           CASE WHEN (s.filter_criteria ->> 'days') ~ '^[0-9]{1,4}$' THEN (s.filter_criteria ->> 'days')::integer END
    INTO v_seg, v_days
    FROM public.push_notification_segments s
    WHERE s.id = p_segment_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Segment not found';
    END IF;
    IF v_seg IS NULL OR v_seg NOT IN ('all', 'has_active_plans', 'kyc_approved', 'joined_recently') THEN
      RAISE EXCEPTION 'This segment type (%) is not supported for sending', COALESCE(v_seg, 'none');
    END IF;
  ELSIF v_type NOT IN ('all', 'individual') THEN
    RAISE EXCEPTION 'Unknown target type';
  END IF;

  RETURN QUERY
  WITH aud AS MATERIALIZED (
    SELECT p.id AS uid,
           p.first_name AS fname,
           (COALESCE(p.push_notifications -> 'enabled' = 'false'::jsonb, false)
            OR (p_respect_marketing AND COALESCE(p.push_notifications -> 'marketing_alerts' = 'false'::jsonb, false))) AS out_
    FROM public.profiles p
    WHERE CASE
      WHEN v_type = 'all' THEN true
      WHEN v_type = 'individual' THEN p.id = ANY (COALESCE(v_ids, ARRAY[]::uuid[]))
      WHEN v_seg = 'all' THEN true
      WHEN v_seg = 'has_active_plans' THEN
        EXISTS (SELECT 1 FROM public.payout_plans pp WHERE pp.user_id = p.id AND pp.status = 'active')
      WHEN v_seg = 'kyc_approved' THEN
        EXISTS (SELECT 1 FROM public.kyc_data k WHERE k.user_id = p.id AND k.approved = true)
      WHEN v_seg = 'joined_recently' THEN
        p.created_at >= now() - make_interval(days => COALESCE(v_days, 30))
      ELSE false
    END
  ),
  tok AS (
    SELECT t.user_id AS uid,
           t.expo_push_token AS token,
           row_number() OVER (
             PARTITION BY t.user_id
             ORDER BY GREATEST(COALESCE(t.last_used, '-infinity'::timestamptz),
                               COALESCE(t.updated_at, '-infinity'::timestamptz),
                               COALESCE(t.created_at, '-infinity'::timestamptz)) DESC,
                      t.id
           )::integer AS rn
    FROM public.user_push_tokens t
    WHERE t.is_active
      AND t.user_id IN (SELECT a.uid FROM aud a)
      AND (t.expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$'
           OR t.expo_push_token ~ '^[a-zA-Z0-9_-]{22}$')
  )
  SELECT a.uid, k.token, a.fname, k.rn, a.out_
  FROM aud a
  JOIN tok k ON k.uid = a.uid;
END;
$$;
REVOKE ALL ON FUNCTION public._push_audience(text, uuid, uuid[], text, boolean) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Admin: preview the audience before sending
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_push_audience_preview(
  p_target_type text,
  p_segment_id uuid DEFAULT NULL,
  p_user_ids uuid[] DEFAULT NULL,
  p_respect_marketing boolean DEFAULT false,
  p_max_tokens integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer := LEAST(GREATEST(COALESCE(p_max_tokens, 3), 1), 10);
  v_r record;
BEGIN
  PERFORM public._admin_push_assert(true);

  SELECT
    count(DISTINCT a.user_id) AS users_with_device,
    count(DISTINCT a.user_id) FILTER (WHERE a.opted_out) AS opted_out_users,
    count(DISTINCT a.user_id) FILTER (WHERE NOT a.opted_out) AS users,
    count(*) FILTER (WHERE NOT a.opted_out AND a.rn <= v_max) AS devices,
    count(*) FILTER (WHERE NOT a.opted_out AND a.rn > v_max) AS devices_over_cap
  INTO v_r
  FROM public._push_audience(p_target_type, p_segment_id, p_user_ids, NULL, COALESCE(p_respect_marketing, false)) a;

  RETURN jsonb_build_object(
    'users', v_r.users,
    'devices', v_r.devices,
    'opted_out_users', v_r.opted_out_users,
    'devices_over_cap', v_r.devices_over_cap,
    'users_with_device', v_r.users_with_device
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Counters, always counted from the recipients (never incremented by hand)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.push_recount(p_notification_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.push_notifications n
  SET total_recipients = s.total,
      delivered_count = s.ok,
      failed_count = s.failed,
      updated_at = now()
  FROM (
    SELECT count(*) FILTER (WHERE status <> 'skipped') AS total,
           count(*) FILTER (WHERE status IN ('sent', 'delivered')) AS ok,
           count(*) FILTER (WHERE status = 'failed') AS failed
    FROM public.push_notification_recipients
    WHERE push_notification_id = p_notification_id
  ) s
  WHERE n.id = p_notification_id;
$$;

-- ---------------------------------------------------------------------------
-- 6. Turn a notification into queue rows, in one statement. Safe to call twice (unique per notification + token).
-- ---------------------------------------------------------------------------
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
      CASE WHEN n.notification_type = 'reengagement' THEN n.notification_category END,
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

-- ---------------------------------------------------------------------------
-- 7. Worker step 1: take the next batch, but only when the pace allows. The notification row is locked while deciding,
--    so two workers can never both send inside the same window.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.push_claim_next_batch(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n public.push_notifications%ROWTYPE;
  v_recipients jsonb;
  v_count integer;
  v_open bigint;
  v_ok bigint;
BEGIN
  SELECT * INTO n FROM public.push_notifications WHERE id = p_notification_id FOR UPDATE;
  IF NOT FOUND OR n.status <> 'sending' OR NOT n.queue_enabled THEN
    RETURN jsonb_build_object('state', 'inactive');
  END IF;

  -- a worker that died mid-send leaves rows in 'sending': put them back after 5 minutes
  UPDATE public.push_notification_recipients
  SET status = 'pending', updated_at = now()
  WHERE push_notification_id = p_notification_id AND status = 'sending' AND updated_at < now() - interval '5 minutes';

  IF n.next_send_at IS NOT NULL AND n.next_send_at > now() THEN
    RETURN jsonb_build_object(
      'state', 'wait',
      'wait_ms', ceil(extract(epoch FROM (n.next_send_at - now())) * 1000)
    );
  END IF;

  WITH picked AS (
    SELECT r.id
    FROM public.push_notification_recipients r
    WHERE r.push_notification_id = p_notification_id AND r.status = 'pending'
    ORDER BY r.created_at, r.id
    LIMIT n.batch_size
    FOR UPDATE SKIP LOCKED
  ),
  upd AS (
    UPDATE public.push_notification_recipients r
    SET status = 'sending', attempts = r.attempts + 1, updated_at = now()
    FROM picked
    WHERE r.id = picked.id
    RETURNING r.id, r.user_id, r.expo_push_token
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', u.id, 'user_id', u.user_id, 'token', u.expo_push_token,
           'first_name', p.first_name)), '[]'::jsonb),
         count(*)
  INTO v_recipients, v_count
  FROM upd u
  LEFT JOIN public.profiles p ON p.id = u.user_id;

  IF v_count = 0 THEN
    SELECT count(*) INTO v_open
    FROM public.push_notification_recipients
    WHERE push_notification_id = p_notification_id AND status IN ('pending', 'sending');

    IF v_open = 0 THEN
      PERFORM public.push_recount(p_notification_id);
      SELECT count(*) INTO v_ok
      FROM public.push_notification_recipients
      WHERE push_notification_id = p_notification_id AND status IN ('sent', 'delivered');
      UPDATE public.push_notifications
      SET status = CASE WHEN v_ok = 0 THEN 'failed' ELSE 'sent' END,
          error = CASE WHEN v_ok = 0 THEN 'Every device failed' ELSE NULL END,
          sent_at = COALESCE(sent_at, now()), next_send_at = NULL, updated_at = now()
      WHERE id = p_notification_id;
      RETURN jsonb_build_object('state', 'done');
    END IF;

    -- the rest is being sent by another worker right now
    RETURN jsonb_build_object('state', 'wait', 'wait_ms', 5000);
  END IF;

  UPDATE public.push_notifications
  SET next_send_at = now() + make_interval(secs => ceil(v_count::numeric / rate_per_minute * 60)),
      updated_at = now()
  WHERE id = p_notification_id;

  RETURN jsonb_build_object(
    'state', 'send',
    'notification', jsonb_build_object(
      'title', n.title, 'body', n.body, 'data', COALESCE(n.data, '{}'::jsonb), 'personalize', n.personalize
    ),
    'recipients', v_recipients
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Worker step 2: record the outcome of a batch.
--    p_results: array of { id, ok, ticket_id, error, deactivate }
--      ok = true   Expo accepted it (ticket id kept for the receipt check)
--      ok = false  failed for good (deactivate = true when the device token is dead)
--      ok = null   not sent (Expo busy / network): goes back in the queue, gives up after 3 attempts
--    Only rows still in 'sending' are changed, so calling this twice is harmless.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.push_complete_batch(p_results jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_id uuid;
BEGIN
  WITH r AS (
    SELECT (e ->> 'id')::uuid AS id,
           CASE WHEN jsonb_typeof(e -> 'ok') = 'boolean' THEN (e ->> 'ok')::boolean ELSE NULL END AS ok,
           NULLIF(e ->> 'ticket_id', '') AS ticket_id,
           NULLIF(left(e ->> 'error', 500), '') AS err,
           COALESCE((e ->> 'deactivate')::boolean, false) AS deactivate
    FROM jsonb_array_elements(COALESCE(p_results, '[]'::jsonb)) AS e
  ),
  upd AS (
    UPDATE public.push_notification_recipients c
    SET status = CASE
          WHEN r.ok IS TRUE THEN 'sent'
          WHEN r.ok IS FALSE THEN 'failed'
          WHEN c.attempts >= 3 THEN 'failed'
          ELSE 'pending' END,
        ticket_id = CASE WHEN r.ok IS TRUE THEN r.ticket_id ELSE c.ticket_id END,
        sent_at = CASE WHEN r.ok IS NULL AND c.attempts < 3 THEN c.sent_at ELSE now() END,
        error_message = CASE
          WHEN r.ok IS TRUE THEN NULL
          WHEN r.ok IS FALSE THEN COALESCE(r.err, 'Failed to send')
          WHEN c.attempts >= 3 THEN COALESCE(r.err, 'Gave up after 3 attempts')
          ELSE c.error_message END,
        updated_at = now()
    FROM r
    WHERE c.id = r.id AND c.status = 'sending'
    RETURNING c.push_notification_id, c.user_id, c.expo_push_token AS token, c.status AS new_status,
              c.ticket_id AS ticket, c.error_message AS err, r.deactivate AS deactivate
  ),
  -- one log row per finished device (the Dispatch Log screen reads these)
  logs AS (
    INSERT INTO public.push_notification_logs
      (push_notification_id, user_id, push_token, status, error_message, expo_receipt_id, sent_at)
    SELECT push_notification_id, user_id, token, new_status, err, ticket, now()
    FROM upd
    WHERE new_status IN ('sent', 'failed')
    RETURNING 1
  ),
  -- dead device tokens stop being used
  dead AS (
    UPDATE public.user_push_tokens t
    SET is_active = false, updated_at = now()
    WHERE t.is_active
      AND t.expo_push_token IN (SELECT u.token FROM upd u WHERE u.new_status = 'failed' AND u.deactivate)
    RETURNING 1
  ),
  -- re-engagement: remember when each user last got it (merge, do not overwrite the other categories)
  reeng AS (
    UPDATE public.profiles pr
    SET last_reengagement_sent = COALESCE(pr.last_reengagement_sent, '{}'::jsonb) || jsonb_build_object(x.category, now()),
        updated_at = now()
    FROM (
      SELECT DISTINCT u.user_id, n.notification_category AS category
      FROM upd u
      JOIN public.push_notifications n ON n.id = u.push_notification_id
      WHERE u.new_status = 'sent' AND n.notification_type = 'reengagement' AND n.notification_category IS NOT NULL
    ) x
    WHERE pr.id = x.user_id
    RETURNING 1
  )
  SELECT array_agg(DISTINCT push_notification_id) INTO v_ids FROM upd;

  IF v_ids IS NOT NULL THEN
    FOREACH v_id IN ARRAY v_ids LOOP
      PERFORM public.push_recount(v_id);
    END LOOP;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Receipts. Expo accepting a message is not delivery. About 15 minutes later the receipt says whether it reached the
--    device (or that the token is dead). Receipts are only kept by Expo for 24 hours.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.push_claim_receipts(p_limit integer DEFAULT 1000)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  WITH picked AS (
    SELECT r.id
    FROM public.push_notification_recipients r
    WHERE r.status = 'sent' AND r.ticket_id IS NOT NULL AND r.receipt_checked_at IS NULL
      AND r.sent_at < now() - interval '15 minutes'
      AND r.sent_at > now() - interval '23 hours'
    ORDER BY r.sent_at
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 1000)
    FOR UPDATE SKIP LOCKED
  ),
  upd AS (
    UPDATE public.push_notification_recipients r
    SET receipt_checked_at = now()
    FROM picked
    WHERE r.id = picked.id
    RETURNING r.id, r.ticket_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'ticket_id', ticket_id)), '[]'::jsonb)
  INTO v_rows
  FROM upd;
  RETURN v_rows;
END;
$$;

-- p_results: array of { id, status: 'ok' | 'error' | 'retry', error, deactivate }
CREATE OR REPLACE FUNCTION public.push_complete_receipts(p_results jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_id uuid;
BEGIN
  WITH r AS (
    SELECT (e ->> 'id')::uuid AS id,
           e ->> 'status' AS st,
           NULLIF(left(e ->> 'error', 500), '') AS err,
           COALESCE((e ->> 'deactivate')::boolean, false) AS deactivate
    FROM jsonb_array_elements(COALESCE(p_results, '[]'::jsonb)) AS e
  ),
  upd AS (
    UPDATE public.push_notification_recipients c
    SET status = CASE WHEN r.st = 'ok' THEN 'delivered' WHEN r.st = 'error' THEN 'failed' ELSE c.status END,
        error_message = CASE WHEN r.st = 'error' THEN COALESCE(r.err, 'Delivery failed') ELSE c.error_message END,
        receipt_checked_at = CASE WHEN r.st = 'retry' THEN NULL ELSE c.receipt_checked_at END,
        updated_at = now()
    FROM r
    WHERE c.id = r.id AND c.status = 'sent'
    RETURNING c.push_notification_id, c.expo_push_token AS token, c.ticket_id AS ticket, r.st AS st,
              r.err AS err, r.deactivate AS deactivate
  ),
  logs AS (
    UPDATE public.push_notification_logs l
    SET status = CASE WHEN d.st = 'ok' THEN 'delivered' ELSE 'failed' END,
        delivered_at = CASE WHEN d.st = 'ok' THEN now() ELSE l.delivered_at END,
        error_message = CASE WHEN d.st = 'error' THEN COALESCE(d.err, 'Delivery failed') ELSE l.error_message END
    FROM upd d
    WHERE d.st IN ('ok', 'error')
      AND l.expo_receipt_id = d.ticket
      AND l.push_notification_id = d.push_notification_id
    RETURNING 1
  ),
  dead AS (
    UPDATE public.user_push_tokens t
    SET is_active = false, updated_at = now()
    WHERE t.is_active
      AND t.expo_push_token IN (SELECT u.token FROM upd u WHERE u.st = 'error' AND u.deactivate)
    RETURNING 1
  )
  SELECT array_agg(DISTINCT push_notification_id) INTO v_ids FROM upd;

  IF v_ids IS NOT NULL THEN
    FOREACH v_id IN ARRAY v_ids LOOP
      PERFORM public.push_recount(v_id);
    END LOOP;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Admin controls: progress, pause / resume / cancel, retry failed, today's stats
-- ---------------------------------------------------------------------------
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

  RETURN jsonb_build_object(
    'id', n.id,
    'status', n.status,
    'queued', n.queue_enabled,
    'total', COALESCE((SELECT sum(value::bigint) FROM jsonb_each_text(c) WHERE key <> 'skipped'), 0),
    'counts', c,
    'remaining', v_open,
    'rate_per_minute', n.rate_per_minute,
    'eta_seconds', CASE WHEN n.status = 'sending' THEN ceil(v_open::numeric / n.rate_per_minute * 60) ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_push_pause(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._admin_push_assert(true);
  UPDATE public.push_notifications SET status = 'paused', updated_at = now()
  WHERE id = p_notification_id AND status = 'sending' AND queue_enabled;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a notification that is currently sending can be paused';
  END IF;
  PERFORM public._admin_push_audit('push.paused', p_notification_id, '{}'::jsonb);
  RETURN jsonb_build_object('status', 'paused');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_push_resume(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._admin_push_assert(true);
  UPDATE public.push_notifications SET status = 'sending', next_send_at = NULL, updated_at = now()
  WHERE id = p_notification_id AND status = 'paused' AND queue_enabled;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a paused notification can be resumed';
  END IF;
  PERFORM public._admin_push_audit('push.resumed', p_notification_id, '{}'::jsonb);
  RETURN jsonb_build_object('status', 'sending');
END;
$$;

-- Stops the send. Devices already sent to stay sent; everything still waiting is skipped.
CREATE OR REPLACE FUNCTION public.admin_push_cancel(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_skipped integer;
BEGIN
  PERFORM public._admin_push_assert(true);
  UPDATE public.push_notifications SET status = 'cancelled', next_send_at = NULL, updated_at = now()
  WHERE id = p_notification_id AND status IN ('sending', 'paused', 'scheduled');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This notification can no longer be cancelled';
  END IF;

  UPDATE public.push_notification_recipients
  SET status = 'skipped', error_message = 'Cancelled', updated_at = now()
  WHERE push_notification_id = p_notification_id AND status = 'pending';
  GET DIAGNOSTICS v_skipped = ROW_COUNT;

  PERFORM public.push_recount(p_notification_id);
  PERFORM public._admin_push_audit('push.cancelled', p_notification_id, jsonb_build_object('skipped', v_skipped));
  RETURN jsonb_build_object('status', 'cancelled', 'skipped', v_skipped);
END;
$$;

-- Failed devices go back in the queue, except those whose token is now dead (they would only fail again).
CREATE OR REPLACE FUNCTION public.admin_push_retry_failed(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
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

  IF v_count = 0 THEN
    RETURN jsonb_build_object('requeued', 0);
  END IF;

  UPDATE public.push_notifications
  SET status = 'sending', next_send_at = NULL, error = NULL, updated_at = now()
  WHERE id = p_notification_id AND status IN ('sent', 'failed');
  PERFORM public.push_recount(p_notification_id);
  PERFORM public._admin_push_audit('push.retry_failed', p_notification_id, jsonb_build_object('requeued', v_count));
  RETURN jsonb_build_object('requeued', v_count);
END;
$$;

-- Today's numbers for the Dispatch Log header (Lagos day). Counted in SQL, not read through the 1000-row REST limit.
CREATE OR REPLACE FUNCTION public.admin_push_dispatch_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := date_trunc('day', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos';
  v_r record;
BEGIN
  PERFORM public._admin_push_assert(false);
  SELECT count(*) AS total,
         count(*) FILTER (WHERE status = 'delivered') AS delivered,
         count(*) FILTER (WHERE status = 'sent') AS accepted,
         count(*) FILTER (WHERE status = 'failed') AS failed,
         COALESCE(round(avg(extract(epoch FROM (delivered_at - sent_at)))
                        FILTER (WHERE delivered_at IS NOT NULL AND sent_at IS NOT NULL)), 0) AS avg_secs
  INTO v_r
  FROM public.push_notification_logs
  WHERE sent_at >= v_start;

  RETURN jsonb_build_object(
    'total_dispatched', v_r.total,
    'total_delivered', v_r.delivered,
    'total_accepted', v_r.accepted,
    'total_failed', v_r.failed,
    'avg_delivery_time', v_r.avg_secs
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. Wake the worker. Cron calls this every minute: it only does anything when there is work.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.push_queue_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_headers jsonb;
BEGIN
  IF NOT EXISTS (
       SELECT 1 FROM public.push_notifications n
       WHERE n.status = 'sending' AND n.queue_enabled
         AND EXISTS (SELECT 1 FROM public.push_notification_recipients r
                     WHERE r.push_notification_id = n.id AND r.status IN ('pending', 'sending'))
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.push_notification_recipients r
       WHERE r.status = 'sent' AND r.ticket_id IS NOT NULL AND r.receipt_checked_at IS NULL
         AND r.sent_at < now() - interval '15 minutes' AND r.sent_at > now() - interval '23 hours'
     ) THEN
    RETURN;
  END IF;

  v_url := public.get_internal_supabase_url();
  v_headers := public.get_internal_supabase_auth_headers();

  PERFORM net.http_post(
    url := v_url || '/functions/v1/push-broadcast-worker',
    headers := v_headers,
    body := jsonb_build_object('action', 'process'),
    timeout_milliseconds := 10000
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 12. Scheduled sends: due notifications go through the same queue (the old function posted to a different
--     function and marked the notification 'sent' straight away whatever happened).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_scheduled_notifications()
RETURNS TABLE(processed_count integer, notification_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  processed integer := 0;
  ids uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR rec IN
    SELECT id
    FROM public.push_notifications
    WHERE status = 'scheduled' AND (scheduled_for IS NULL OR scheduled_for <= now())
    ORDER BY scheduled_for NULLS FIRST
    LIMIT 10
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      PERFORM public.push_enqueue_recipients(rec.id);
      processed := processed + 1;
      ids := array_append(ids, rec.id);
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.push_notifications
      SET status = 'failed', error = left(SQLERRM, 300), queue_enabled = true, updated_at = now()
      WHERE id = rec.id;
    END;
  END LOOP;

  RETURN QUERY SELECT processed, ids;
END;
$$;

-- ---------------------------------------------------------------------------
-- 13. Housekeeping: stuck legacy sends, retention of queue rows
-- ---------------------------------------------------------------------------
UPDATE public.push_notifications
SET status = 'failed', error = 'Stuck in sending (closed by cleanup)', updated_at = now()
WHERE status = 'sending' AND NOT queue_enabled AND created_at < now() - interval '1 day';

CREATE OR REPLACE FUNCTION public.push_recipients_cleanup()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  DELETE FROM public.push_notification_recipients r
  WHERE r.created_at < now() - interval '30 days'
    AND NOT EXISTS (SELECT 1 FROM public.push_notifications n
                    WHERE n.id = r.push_notification_id AND n.status IN ('sending', 'paused'));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.schedule('process-push-broadcast-queue', '* * * * *', 'SELECT public.push_queue_tick()');
    PERFORM cron.schedule('cleanup-push-broadcast-recipients', '30 3 * * *', 'SELECT public.push_recipients_cleanup()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not schedule push queue cron jobs: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Grants. The queue functions are for the edge functions (service role) only; the admin_* ones for signed-in admins
-- (they check permissions inside).
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.push_recount(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_enqueue_recipients(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_claim_next_batch(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_complete_batch(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_claim_receipts(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_complete_receipts(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_queue_tick() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_recipients_cleanup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_scheduled_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_recount(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.push_enqueue_recipients(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.push_claim_next_batch(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.push_complete_batch(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.push_claim_receipts(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.push_complete_receipts(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_scheduled_notifications() TO service_role;

REVOKE ALL ON FUNCTION public.admin_push_audience_preview(text, uuid, uuid[], boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_push_progress(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_push_pause(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_push_resume(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_push_cancel(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_push_retry_failed(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_push_dispatch_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_push_audience_preview(text, uuid, uuid[], boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_push_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_push_pause(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_push_resume(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_push_cancel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_push_retry_failed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_push_dispatch_stats() TO authenticated;

NOTIFY pgrst, 'reload schema';
