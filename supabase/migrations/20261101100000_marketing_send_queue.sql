-- Marketing email send queue
--
-- Why: sending a campaign used to happen inside one edge function call. That call
--   * read recipients through the REST API, which returns at most 1000 rows per request (so "All users" stopped at 1000
--     and big `.in(...)` lists broke the URL length limit), and
--   * had to finish within the edge function time limit, so large campaigns were left half sent ("sending" forever).
--
-- Now a campaign is turned into a queue of `campaign_recipients` rows in ONE SQL statement (no row limit), and a worker
-- (the marketing-campaigns edge function, started by pg_cron every minute and right after pressing Send) takes a batch
-- of `batch_size` recipients (default 50, max 100), sends them, and waits `send_delay_seconds` (default 10) before the
-- next batch. The wait is stored in the database (`marketing_campaigns.next_send_at`), so several workers can run
-- without ever sending faster than that.
--
-- Only campaigns with queue_enabled = true are touched by the worker. Existing campaigns are left alone until someone
-- presses Send / Retry on them.

-- ---------------------------------------------------------------------------
-- 1. Columns and constraints
-- ---------------------------------------------------------------------------
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS queue_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS send_delay_seconds integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS next_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS batch_size integer NOT NULL DEFAULT 50;

ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_batch_size_check;
ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_batch_size_check CHECK (batch_size BETWEEN 1 AND 100);

ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_send_delay_check;
ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_send_delay_check CHECK (send_delay_seconds BETWEEN 1 AND 3600);

ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

-- a recipient being sent right now
ALTER TABLE public.campaign_recipients DROP CONSTRAINT IF EXISTS campaign_recipients_status_check;
ALTER TABLE public.campaign_recipients
  ADD CONSTRAINT campaign_recipients_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced'));

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_queue
  ON public.campaign_recipients (campaign_id, created_at, id)
  WHERE status = 'pending';

-- Lets the "already queued?" check in marketing_enqueue_recipients probe by (campaign, email) instead of scanning.
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_email
  ON public.campaign_recipients (campaign_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_sending
  ON public.marketing_campaigns (created_at)
  WHERE status = 'sending' AND queue_enabled;

-- ---------------------------------------------------------------------------
-- 2. Keep the campaign counters honest (counted from the recipients, never incremented by hand)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketing_recount(p_campaign_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.marketing_campaigns c
  SET delivered_count = s.delivered,
      failed_count = s.failed,
      updated_at = now()
  FROM (
    SELECT count(*) FILTER (WHERE status IN ('delivered', 'sent', 'opened', 'clicked')) AS delivered,
           count(*) FILTER (WHERE status IN ('failed', 'bounced')) AS failed
    FROM public.campaign_recipients
    WHERE campaign_id = p_campaign_id
  ) s
  WHERE c.id = p_campaign_id;
$$;

-- ---------------------------------------------------------------------------
-- 3. Turn a segment into queue rows, in one statement.
--    Every profile with a usable email is queued once (duplicate emails are collapsed), and nobody already in this
--    campaign is queued twice, so pressing Send again is harmless.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketing_enqueue_recipients(
  p_campaign_id uuid,
  p_segment text,
  p_segment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filters jsonb := '{}'::jsonb;
  v_has_plan boolean := false;
  v_min_balance numeric;
  v_inactive_days integer;
  v_in_segment bigint;
  v_valid bigint;
  v_queued bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.marketing_campaigns WHERE id = p_campaign_id) THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF p_segment_id IS NOT NULL THEN
    SELECT filters INTO v_filters FROM public.campaign_segments WHERE id = p_segment_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Segment not found';
    END IF;
    IF NULLIF(btrim(COALESCE(v_filters ->> 'kyc_status', '')), '') IS NOT NULL THEN
      RAISE EXCEPTION 'Segments filtered by kyc_status are not supported. Use the KYC tier segments instead.';
    END IF;
    v_has_plan := COALESCE(v_filters ->> 'has_payout_plan', '') = 'true';
    IF (v_filters ->> 'min_balance') ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_min_balance := (v_filters ->> 'min_balance')::numeric;
    END IF;
    IF (v_filters ->> 'inactive_days') ~ '^[0-9]+$' THEN
      v_inactive_days := (v_filters ->> 'inactive_days')::integer;
    END IF;
  ELSIF p_segment IS NULL OR p_segment NOT IN (
    'all', 'active_users', 'users_with_balance', 'users_with_plans',
    'kyc_tier_0', 'kyc_tier_1', 'kyc_tier_2', 'kyc_tier_3', 'users_with_zero_balance'
  ) THEN
    RAISE EXCEPTION 'Unknown segment: %', COALESCE(p_segment, '(none)');
  END IF;

  WITH seg AS MATERIALIZED (
    SELECT pr.id, btrim(pr.email) AS email, pr.created_at
    FROM public.profiles pr
    WHERE CASE
      WHEN p_segment_id IS NOT NULL THEN
        (NOT v_has_plan OR EXISTS (SELECT 1 FROM public.payout_plans pp WHERE pp.user_id = pr.id AND pp.status = 'active'))
        AND (v_min_balance IS NULL OR EXISTS (SELECT 1 FROM public.wallets w WHERE w.user_id = pr.id AND w.balance >= v_min_balance))
        AND (v_inactive_days IS NULL OR pr.last_seen_at IS NULL OR pr.last_seen_at < now() - make_interval(days => v_inactive_days))
      WHEN p_segment = 'all' THEN true
      WHEN p_segment = 'active_users' THEN
        EXISTS (SELECT 1 FROM public.payout_plans pp WHERE pp.user_id = pr.id AND pp.status = 'active')
        OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.user_id = pr.id AND t.created_at >= now() - interval '30 days')
      WHEN p_segment = 'users_with_balance' THEN
        EXISTS (SELECT 1 FROM public.wallets w WHERE w.user_id = pr.id AND w.balance > 0)
      WHEN p_segment = 'users_with_plans' THEN
        EXISTS (SELECT 1 FROM public.payout_plans pp WHERE pp.user_id = pr.id AND pp.status = 'active')
      WHEN p_segment = 'kyc_tier_0' THEN
        NOT EXISTS (
          SELECT 1 FROM public.kyc_progress k
          WHERE k.user_id = pr.id AND (k.tier_1_completed OR k.tier_2_completed OR k.tier_3_completed)
        )
      WHEN p_segment = 'kyc_tier_1' THEN
        EXISTS (SELECT 1 FROM public.kyc_progress k WHERE k.user_id = pr.id AND k.tier_1_completed)
      WHEN p_segment = 'kyc_tier_2' THEN
        EXISTS (SELECT 1 FROM public.kyc_progress k WHERE k.user_id = pr.id AND k.tier_2_completed)
      WHEN p_segment = 'kyc_tier_3' THEN
        EXISTS (SELECT 1 FROM public.kyc_progress k WHERE k.user_id = pr.id AND k.tier_3_completed)
      WHEN p_segment = 'users_with_zero_balance' THEN
        NOT EXISTS (SELECT 1 FROM public.wallets w WHERE w.user_id = pr.id)
        OR EXISTS (SELECT 1 FROM public.wallets w WHERE w.user_id = pr.id AND w.balance = 0)
      ELSE false
    END
  ),
  valid AS MATERIALIZED (
    SELECT DISTINCT ON (lower(email)) id, email
    FROM seg
    WHERE email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ORDER BY lower(email), created_at
  ),
  -- Emails already queued for this campaign, read once and hash-joined (a per-row subquery here is quadratic).
  existing AS MATERIALIZED (
    SELECT DISTINCT lower(r.email) AS email_key
    FROM public.campaign_recipients r
    WHERE r.campaign_id = p_campaign_id
  ),
  ins AS (
    INSERT INTO public.campaign_recipients (campaign_id, user_id, email, status)
    SELECT p_campaign_id, v.id, v.email, 'pending'
    FROM valid v
    LEFT JOIN existing e ON e.email_key = lower(v.email)
    WHERE e.email_key IS NULL
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM seg), (SELECT count(*) FROM valid), (SELECT count(*) FROM ins)
  INTO v_in_segment, v_valid, v_queued;

  RETURN jsonb_build_object(
    'in_segment', v_in_segment,
    'valid_emails', v_valid,
    'queued', v_queued,
    'skipped', v_in_segment - v_queued
  );
END;
$$;

DROP FUNCTION IF EXISTS public.marketing_claim_next_recipient(uuid);
DROP FUNCTION IF EXISTS public.marketing_complete_recipient(uuid, boolean, text, text);

-- ---------------------------------------------------------------------------
-- 4. Worker step 1: take the next BATCH of recipients, but only when the delay since the previous batch has passed.
--    The campaign row is locked while deciding, so two workers can never both send inside the same window.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketing_claim_next_batch(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_c public.marketing_campaigns%ROWTYPE;
  v_open bigint;
  v_recipients jsonb;
BEGIN
  SELECT * INTO v_c FROM public.marketing_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND OR v_c.status <> 'sending' OR NOT v_c.queue_enabled THEN
    RETURN jsonb_build_object('state', 'inactive');
  END IF;

  -- a worker that died mid-send leaves its recipients in 'sending': put them back in the queue after 5 minutes
  UPDATE public.campaign_recipients
  SET status = 'pending', updated_at = now()
  WHERE campaign_id = p_campaign_id AND status = 'sending' AND updated_at < now() - interval '5 minutes';

  IF v_c.next_send_at IS NOT NULL AND v_c.next_send_at > now() THEN
    RETURN jsonb_build_object(
      'state', 'wait',
      'wait_ms', ceil(extract(epoch FROM (v_c.next_send_at - now())) * 1000)
    );
  END IF;

  WITH picked AS (
    SELECT id
    FROM public.campaign_recipients
    WHERE campaign_id = p_campaign_id AND status = 'pending'
    ORDER BY created_at, id
    LIMIT v_c.batch_size
    FOR UPDATE SKIP LOCKED
  ),
  upd AS (
    UPDATE public.campaign_recipients r
    SET status = 'sending', attempts = r.attempts + 1, updated_at = now()
    FROM picked
    WHERE r.id = picked.id
    RETURNING r.id, r.user_id, r.email
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'email', email)), '[]'::jsonb)
  INTO v_recipients
  FROM upd;

  IF jsonb_array_length(v_recipients) = 0 THEN
    SELECT count(*) INTO v_open
    FROM public.campaign_recipients
    WHERE campaign_id = p_campaign_id AND status IN ('pending', 'sending');

    IF v_open = 0 THEN
      PERFORM public.marketing_recount(p_campaign_id);
      UPDATE public.marketing_campaigns
      SET status = 'sent', sent_at = COALESCE(sent_at, now()), next_send_at = NULL, updated_at = now()
      WHERE id = p_campaign_id;
      RETURN jsonb_build_object('state', 'done');
    END IF;

    -- the rest is being sent by another worker right now
    RETURN jsonb_build_object('state', 'wait', 'wait_ms', 5000);
  END IF;

  UPDATE public.marketing_campaigns
  SET next_send_at = now() + make_interval(secs => send_delay_seconds), updated_at = now()
  WHERE id = p_campaign_id;

  RETURN jsonb_build_object('state', 'send', 'recipients', v_recipients);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Worker step 2: record the outcome of a batch.
--    p_results is an array of {id, ok, resend_id, error}. ok = true: delivered, false: failed,
--    null: not attempted, goes back in the queue.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketing_complete_batch(p_results jsonb)
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
           NULLIF(e ->> 'resend_id', '') AS resend_id,
           NULLIF(left(e ->> 'error', 500), '') AS err
    FROM jsonb_array_elements(COALESCE(p_results, '[]'::jsonb)) AS e
  ),
  upd AS (
    UPDATE public.campaign_recipients c
    SET status = CASE WHEN r.ok IS NULL THEN 'pending' WHEN r.ok THEN 'delivered' ELSE 'failed' END,
        sent_at = CASE WHEN r.ok IS NULL THEN c.sent_at ELSE now() END,
        delivered_at = CASE WHEN r.ok IS TRUE THEN now() ELSE c.delivered_at END,
        error_message = CASE WHEN r.ok IS FALSE THEN COALESCE(r.err, 'Failed to send email') ELSE NULL END,
        metadata = CASE WHEN r.ok IS TRUE AND r.resend_id IS NOT NULL
                        THEN COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object('resend_id', r.resend_id)
                        ELSE c.metadata END,
        updated_at = now()
    FROM r
    WHERE c.id = r.id AND c.status = 'sending'
    RETURNING c.campaign_id
  )
  SELECT array_agg(DISTINCT campaign_id) INTO v_ids FROM upd;

  IF v_ids IS NOT NULL THEN
    FOREACH v_id IN ARRAY v_ids LOOP
      PERFORM public.marketing_recount(v_id);
    END LOOP;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Retry / resume: put failed, waiting and stuck recipients back in the queue and switch the campaign onto it
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketing_requeue_recipients(
  p_campaign_id uuid,
  p_recipient_ids uuid[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.campaign_recipients
  SET status = 'pending', error_message = NULL, attempts = 0, updated_at = now()
  WHERE campaign_id = p_campaign_id
    AND (p_recipient_ids IS NULL OR id = ANY (p_recipient_ids))
    AND (
      status IN ('failed', 'pending')
      OR (status = 'sending' AND updated_at < now() - interval '2 minutes')
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    UPDATE public.marketing_campaigns
    SET status = 'sending', queue_enabled = true, next_send_at = NULL, updated_at = now()
    WHERE id = p_campaign_id;
    PERFORM public.marketing_recount(p_campaign_id);
  END IF;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Counts per status for the recipients screen (the table API would cap these at 1000 rows)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_marketing_recipient_counts(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_permission('marketing.view')
          OR public.has_permission('marketing.campaigns.list')
          OR public.has_permission('marketing.campaigns.create')
          OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: Marketing access required';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_object_agg(status, n) || jsonb_build_object('total', sum(n))
    FROM (
      SELECT status, count(*) AS n
      FROM public.campaign_recipients
      WHERE campaign_id = p_campaign_id
      GROUP BY status
    ) s
  ), jsonb_build_object('total', 0));
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Cron tick: if any campaign is waiting to be sent, wake the worker (edge function).
--    Uses the same internal URL / auth helpers as the project's other cron jobs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marketing_queue_tick()
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
    SELECT 1
    FROM public.marketing_campaigns c
    WHERE c.status = 'sending' AND c.queue_enabled
      AND EXISTS (
        SELECT 1 FROM public.campaign_recipients r
        WHERE r.campaign_id = c.id AND r.status IN ('pending', 'sending')
      )
  ) THEN
    RETURN;
  END IF;

  IF to_regprocedure('public.get_internal_supabase_url()') IS NULL
     OR to_regprocedure('public.get_internal_supabase_auth_headers()') IS NULL THEN
    RAISE WARNING 'marketing_queue_tick: get_internal_supabase_url() / get_internal_supabase_auth_headers() are missing, cannot wake the email worker';
    RETURN;
  END IF;

  EXECUTE 'SELECT public.get_internal_supabase_url()' INTO v_url;
  EXECUTE 'SELECT public.get_internal_supabase_auth_headers()' INTO v_headers;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/marketing-campaigns',
    headers := v_headers,
    body := jsonb_build_object('action', 'process_queue'),
    timeout_milliseconds := 10000
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. The older "fail anything pending for 5 minutes" cleanup (mark_pending_emails_as_failed, optional cron) must
--    leave queued campaigns alone: their recipients legitimately stay pending while batches go out with a pause between them.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_pending_emails_as_failed()
RETURNS TABLE (marked_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  timeout_minutes integer := 5;
  v_marked bigint;
BEGIN
  UPDATE public.campaign_recipients r
  SET status = 'failed',
      error_message = 'Email sending timed out after ' || timeout_minutes || ' minutes',
      updated_at = now()
  WHERE r.status = 'pending'
    AND r.created_at < now() - (timeout_minutes || ' minutes')::interval
    AND r.sent_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.marketing_campaigns c WHERE c.id = r.campaign_id AND c.queue_enabled
    );

  GET DIAGNOSTICS v_marked = ROW_COUNT;
  RETURN QUERY SELECT v_marked;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants. The queue functions are for the edge function (service role) only.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.marketing_recount(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketing_enqueue_recipients(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketing_claim_next_batch(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketing_complete_batch(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketing_requeue_recipients(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketing_queue_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_recount(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketing_enqueue_recipients(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketing_claim_next_batch(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketing_complete_batch(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.marketing_requeue_recipients(uuid, uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.admin_marketing_recipient_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_marketing_recipient_counts(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
