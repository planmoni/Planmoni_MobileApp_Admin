-- Wakes the marketing email worker every minute while a campaign is still being sent.
-- marketing_queue_tick() does nothing (no HTTP call) when no campaign is in the queue.
-- Needs pg_cron and pg_net. Without them the worker is still started when you press Send, but nothing
-- restarts it if it stops, so enable them for large campaigns.

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE WARNING 'pg_cron is not installed: the marketing email queue will not restart itself. Enable pg_cron and re-run this.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-marketing-email-queue';
  PERFORM cron.schedule('process-marketing-email-queue', '* * * * *', 'SELECT public.marketing_queue_tick();');
END $$;
