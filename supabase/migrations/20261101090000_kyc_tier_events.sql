-- KYC completions per day (dashboard "KYC Completed" card)
--
-- Nothing in the schema records WHEN a user reached Tier 1 / 2 / 3, only the tier they are on now. This adds:
--   1. kyc_tier_events           one row per user per tier, written the moment profiles.kyc_tier goes up
--   2. a trigger on profiles     (the same column the app and handle_kyc_progress_update / update_user_kyc_tier move)
--   3. a best-effort backfill    each user's CURRENT tier is stamped with kyc_progress.updated_at (approximate:
--                                lower tiers they passed earlier have no known date and are not backfilled)
--   4. admin_kyc_completed()     counts per tier and the latest completions for a time window
--
-- Access: the table has RLS on and no policies, so it is only reachable through the SECURITY DEFINER RPC.
-- Same permission rule as admin_kyc_tier_stats: dashboard.stats.kyc_completed, kyc.stats, kyc.list or an admin.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kyc_tier_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier smallint NOT NULL CHECK (tier BETWEEN 1 AND 3),
  completed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'live' CHECK (source IN ('live', 'backfill')),
  UNIQUE (user_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_kyc_tier_events_completed_at
  ON public.kyc_tier_events (completed_at DESC);

ALTER TABLE public.kyc_tier_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kyc_tier_events FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trigger: record each tier a user newly reaches (a jump 0 -> 2 records tiers 1 and 2)
--    Never blocks the profile update, whatever happens here.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_kyc_tier_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.kyc_tier_events (user_id, tier, source)
    SELECT NEW.id, t, 'live'
    FROM generate_series(COALESCE(OLD.kyc_tier, 0) + 1, LEAST(NEW.kyc_tier, 3)) AS t
    ON CONFLICT (user_id, tier) DO NOTHING;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'record_kyc_tier_events failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_kyc_tier_events() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS record_kyc_tier_events ON public.profiles;
CREATE TRIGGER record_kyc_tier_events
  AFTER UPDATE OF kyc_tier ON public.profiles
  FOR EACH ROW
  WHEN (NEW.kyc_tier IS NOT NULL AND NEW.kyc_tier > COALESCE(OLD.kyc_tier, 0))
  EXECUTE FUNCTION public.record_kyc_tier_events();

-- ---------------------------------------------------------------------------
-- 3. Backfill (approximate, see header). Only runs for users with no event yet.
-- ---------------------------------------------------------------------------
INSERT INTO public.kyc_tier_events (user_id, tier, completed_at, source)
SELECT p.id, LEAST(p.kyc_tier, 3), k.updated_at, 'backfill'
FROM public.profiles p
JOIN public.kyc_progress k ON k.user_id = p.id
WHERE COALESCE(p.kyc_tier, 0) >= 1
ON CONFLICT (user_id, tier) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Counts + latest completions for a window
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_kyc_completed(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := COALESCE(p_from, date_trunc('day', now()));
  v_to timestamptz := COALESCE(p_to, now() + interval '1 minute');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_result jsonb;
BEGIN
  IF NOT (public.has_permission('dashboard.stats.kyc_completed')
          OR public.has_permission('kyc.stats')
          OR public.has_permission('kyc.list')
          OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied: KYC access required';
  END IF;

  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.kyc_tier_events e WHERE e.completed_at >= v_from AND e.completed_at < v_to),
    'tier1', (SELECT count(*) FROM public.kyc_tier_events e WHERE e.completed_at >= v_from AND e.completed_at < v_to AND e.tier = 1),
    'tier2', (SELECT count(*) FROM public.kyc_tier_events e WHERE e.completed_at >= v_from AND e.completed_at < v_to AND e.tier = 2),
    'tier3', (SELECT count(*) FROM public.kyc_tier_events e WHERE e.completed_at >= v_from AND e.completed_at < v_to AND e.tier = 3),
    'rows', COALESCE((
      SELECT jsonb_agg(r ORDER BY r.completed_at DESC)
      FROM (
        SELECT e.user_id, e.tier, e.completed_at,
               pr.first_name, pr.last_name, pr.email
        FROM public.kyc_tier_events e
        LEFT JOIN public.profiles pr ON pr.id = e.user_id
        WHERE e.completed_at >= v_from AND e.completed_at < v_to
        ORDER BY e.completed_at DESC, e.tier DESC
        LIMIT v_limit
      ) r
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_kyc_completed(timestamptz, timestamptz, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kyc_completed(timestamptz, timestamptz, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
