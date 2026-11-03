-- Tier 3 approve updated kyc_data to "approved", but the progress flag never stuck.
--
-- protect_utility_bill_verified_flag treats every authenticated session (including
-- admins and the review RPC) as a mobile client and reverts utility_bill_verified /
-- tier_3_completed. sync_utility_bill_review_to_tier and admin_review_tier3 both
-- write those columns, so the user stayed on Tier 2 in the admin panel.
--
-- Allow the change when app.kyc_review is on or the caller is an admin.

CREATE OR REPLACE FUNCTION public.protect_utility_bill_verified_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
BEGIN
  IF current_setting('app.kyc_review', true) = 'on'
     OR public.is_admin()
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mobile client: may update other progress fields, but not Tier 3 approval flags
  IF COALESCE(auth.role(), '') = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.utility_bill_verified := false;
      NEW.tier_3_completed := false;
    ELSE
      NEW.utility_bill_verified := OLD.utility_bill_verified;
      NEW.tier_3_completed := OLD.tier_3_completed;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Repair users already approved on kyc_data whose progress flag was blocked
DO $$
DECLARE
  r record;
BEGIN
  PERFORM set_config('app.kyc_review', 'on', true);

  FOR r IN
    SELECT d.user_id
    FROM public.kyc_data d
    JOIN public.kyc_progress k ON k.user_id = d.user_id
    WHERE d.utility_bill_review_status = 'approved'
      AND COALESCE(k.utility_bill_verified, false) = false
  LOOP
    UPDATE public.kyc_progress
    SET utility_bill_verified = true,
        address_completed = true,
        updated_at = now()
    WHERE user_id = r.user_id;

    PERFORM public.update_user_kyc_tier(r.user_id);
  END LOOP;

  PERFORM set_config('app.kyc_review', 'off', true);
END;
$$;
