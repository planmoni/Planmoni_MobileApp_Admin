-- Email users when Tier 1 BVN / Tier 3 proof-of-address manual reviews are decided.
-- Edge function: notify-kyc-review (Resend via send-email).

CREATE OR REPLACE FUNCTION public.notify_utility_bill_review_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note text;
BEGIN
  IF NEW.utility_bill_review_status IS NOT DISTINCT FROM OLD.utility_bill_review_status THEN
    RETURN NEW;
  END IF;

  IF NEW.utility_bill_review_status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  v_note := NULLIF(
    btrim(
      COALESCE(
        NEW.utility_bill_rejection_reason,
        NEW.utility_bill_review_note,
        ''
      )
    ),
    ''
  );

  PERFORM net.http_post(
    url := rtrim(public.get_internal_supabase_url(), '/') || '/functions/v1/notify-kyc-review',
    headers := public.get_internal_supabase_auth_headers(),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'status', NEW.utility_bill_review_status,
      'note', v_note,
      'kind', 'tier3'
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_utility_bill_review_status failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_bvn_face_review_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note text;
BEGIN
  IF NEW.bvn_face_review_status IS NOT DISTINCT FROM OLD.bvn_face_review_status THEN
    RETURN NEW;
  END IF;

  IF NEW.bvn_face_review_status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  v_note := NULLIF(
    btrim(
      COALESCE(
        NEW.bvn_face_rejection_reason,
        NEW.bvn_face_review_note,
        ''
      )
    ),
    ''
  );

  PERFORM net.http_post(
    url := rtrim(public.get_internal_supabase_url(), '/') || '/functions/v1/notify-kyc-review',
    headers := public.get_internal_supabase_auth_headers(),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'status', NEW.bvn_face_review_status,
      'note', v_note,
      'kind', 'tier1_bvn'
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_bvn_face_review_status failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bvn_face_review_status ON public.kyc_data;
CREATE TRIGGER trg_notify_bvn_face_review_status
  AFTER UPDATE OF bvn_face_review_status ON public.kyc_data
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_bvn_face_review_status();
