Tier 1 BVN face-mismatch manual review

Product shape (locked in)

Mirror Tier 3 proof-of-address: customer requests review → row is pending in DB → admin approves/rejects → app reflects status. On approve, set bvn_verified, bump KYC tier, and create the Nomba virtual account (same outcome as automatic Dojah success). “Dojah account” here means that deposit account path, not a Dojah product.

Request CTA appears on the Tier 1 processing failure screen after automatic face mismatch (including when attempts are locked). One open pending request per user.

Data model

New migration on [kyc_data](supabase/migrations/20261031193530_tier3_manual_proof_of_address_review.sql) pattern:





bvn_face_review_status — not_submitted | pending | approved | rejected (default not_submitted)



bvn_face_review_submitted_at, bvn_face_reviewed_at, bvn_face_reviewed_by



bvn_face_review_note / bvn_face_rejection_reason



bvn_face_review_job_id (uuid, last failed job that prompted the request)



bvn_face_review_selfie_url (snapshot of selfie at request time)

Protect customer writes to review outcome fields (same idea as protect_utility_bill_review_fields). Customers may only move status to pending via the request edge function / controlled path.

BVN itself is already written on enqueue ([enqueue-kyc-bvn](supabase/functions/enqueue-kyc-bvn/index.ts)) and encrypted at rest. Manual review does not clear it.

Admin RPC (this repo; UI stays external)

Add admin_review_tier1_bvn(p_user_id, p_decision, p_reason) modeled on [admin_review_tier3](supabase/migrations/20261103162000_kyc_tier3_rejection_reason_wiring.sql):





Permissions: kyc.approve / kyc.reject or is_admin()



Only when bvn_face_review_status = 'pending'



Approve: require kyc_data.bvn + selfie_url (or review selfie snapshot); set review approved; set kyc_progress.bvn_verified = true, current_step = 'review'; update_user_kyc_tier; audit + notify_kyc_tier_decision; best-effort kick [create-nomba-virtual-account](supabase/functions/create-nomba-virtual-account/index.ts) (Home already creates VA when bvn_verified if kick fails)



Reject: set rejected + reason; leave bvn_verified false; notify user

No admin panel work in this app repo (same as Tier 3).

Customer request API

New authenticated edge function request-kyc-bvn-manual-review:





User JWT; bvn_verified must be false



Latest BVN job failed with face_mismatch (from kyc_identity_checks or job last_error), or attempts locked after face mismatches



kyc_data.bvn and selfie present



Reject if status already pending / approved



Set review fields to pending, snapshot selfie + job id



Return { success, status: 'pending' }

App UX

Failure screen — [app/kyc/tier1/processing.tsx](app/kyc/tier1/processing.tsx):





If bvn_face_review_status === 'pending': copy like Tier 3 (“Manual review in progress”), no Try again required; Go Home



If failed face mismatch and not pending: keep Try again / Retake; add Request manual review (and still show it when locked instead of only Intercom-only lock)



After request → stay on pending state

BVN step prefill — today [useKYCData](hooks/useKYCData.ts) strips enc:v1: BVN so [BVNStep](components/kyc/tier1/BVNStep.tsx) always looks empty after submit.





Add kyc_reveal_own_bvn() SECURITY DEFINER: returns decrypted BVN only when auth.uid() = user_id and row exists; GRANT to authenticated



BVNStep loads that into local state when verified is false so the field is filled for retry / review context



Do not put ciphertext into cache; do not log plaintext

Types: extend KYCFormData / progress consumers with the new review fields; optional small status on Tier 1 entry if pending (redirect to processing like an in-flight job).

flowchart TD
  submit[User submits BVN plus selfie]
  dojah[process-kyc-bvn Dojah]
  ok[bvn_verified plus Nomba]
  fail[face_mismatch failed screen]
  req[Request manual review]
  pending[bvn_face_review_status pending]
  admin[admin_review_tier1_bvn]
  submit --> dojah
  dojah -->|match| ok
  dojah -->|mismatch| fail
  fail --> req --> pending --> admin
  admin -->|approve| ok
  admin -->|reject| fail

Out of scope





Building Planmoni admin UI screens



Changing Dojah thresholds



Auto-pending every mismatch without an explicit user request

