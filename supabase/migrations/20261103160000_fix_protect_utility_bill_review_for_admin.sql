-- Admin Tier 3 approve/reject was silently undone.
--
-- protect_utility_bill_review_fields treats any authenticated auth.uid() as a
-- "customer" and reverts review-status changes that are not a fresh submission.
-- admin_review_tier3 runs as the signed-in admin (authenticated + uid), so its
-- UPDATE to approved/rejected was overwritten back to pending. The toast still
-- said success because the RPC returned before anyone noticed.
--
-- Bypass the customer protection when the review RPC flag is on, or the caller
-- is an admin — same rules as guard_kyc_review_columns.

CREATE OR REPLACE FUNCTION public.protect_utility_bill_review_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_is_customer boolean :=
    COALESCE(auth.role(), '') = 'authenticated'
    AND auth.uid() IS NOT NULL;
  v_is_submission boolean;
  v_admin_review boolean :=
    current_setting('app.kyc_review', true) = 'on'
    OR public.is_admin();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF v_is_customer AND NOT v_admin_review THEN
      v_is_submission := NULLIF(btrim(NEW.utility_bill_url), '') IS NOT NULL;
      NEW.utility_bill_review_status :=
        CASE WHEN v_is_submission THEN 'pending' ELSE 'not_submitted' END;
      NEW.utility_bill_submitted_at :=
        CASE WHEN v_is_submission THEN now() ELSE NULL END;
      NEW.utility_bill_reviewed_at := NULL;
      NEW.utility_bill_review_note := NULL;
      NEW.utility_bill_validated := false;
      NEW.approved := false;
    ELSE
      NEW.approved := NEW.utility_bill_review_status = 'approved';
      IF NEW.utility_bill_review_status IN ('approved', 'rejected') THEN
        NEW.utility_bill_reviewed_at := COALESCE(NEW.utility_bill_reviewed_at, now());
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Admin / review RPC / service role: allow the status change through
  IF (NOT v_is_customer) OR v_admin_review THEN
    NEW.approved := NEW.utility_bill_review_status = 'approved';
    IF NEW.utility_bill_review_status IN ('approved', 'rejected')
       AND NEW.utility_bill_review_status IS DISTINCT FROM OLD.utility_bill_review_status THEN
      NEW.utility_bill_reviewed_at := COALESCE(NEW.utility_bill_reviewed_at, now());
    ELSIF NEW.utility_bill_review_status = 'pending' THEN
      NEW.utility_bill_reviewed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Customer path: only a new bill submission may move status to pending
  v_is_submission :=
    NULLIF(btrim(NEW.utility_bill_url), '') IS NOT NULL
    AND (
      NEW.utility_bill_url IS DISTINCT FROM OLD.utility_bill_url
      OR NEW.utility_bill_validation_result IS DISTINCT FROM OLD.utility_bill_validation_result
      OR (
        NEW.utility_bill_review_status = 'pending'
        AND NEW.utility_bill_review_status IS DISTINCT FROM OLD.utility_bill_review_status
      )
    );

  IF v_is_submission THEN
    NEW.utility_bill_review_status := 'pending';
    NEW.utility_bill_submitted_at := now();
    NEW.utility_bill_reviewed_at := NULL;
    NEW.utility_bill_review_note := NULL;
    NEW.utility_bill_validated := false;
    NEW.approved := false;
  ELSE
    NEW.utility_bill_review_status := OLD.utility_bill_review_status;
    NEW.utility_bill_submitted_at := OLD.utility_bill_submitted_at;
    NEW.utility_bill_reviewed_at := OLD.utility_bill_reviewed_at;
    NEW.utility_bill_review_note := OLD.utility_bill_review_note;
    NEW.utility_bill_validated := OLD.utility_bill_validated;
    NEW.approved := OLD.approved;
  END IF;

  RETURN NEW;
END;
$$;
