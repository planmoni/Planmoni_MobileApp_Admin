/*
  # Optimize RLS Policies - Part 6 (2FA, Utility Bills, KYC Audit, SafeHaven)

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid()) in RLS policies
  
  2. Tables Updated
    - two_factor_backup_codes: Update all RLS policies
    - two_factor_verification_attempts: Update all RLS policies
    - utility_bill_validations: Update all RLS policies
    - kyc_audit_logs: Update all RLS policies
    - kyc_audit_events: Update all RLS policies
    - kyc_audit_attachments: Update all RLS policies
    - kyc_audit_summary: Update all RLS policies
    - safehaven_tokens: Update all RLS policies
    - safehaven_accounts: Update all RLS policies
    - safehaven_audit_logs: Update all RLS policies
*/

-- Two factor backup codes policies
DROP POLICY IF EXISTS "Users can view own backup codes" ON two_factor_backup_codes;
DROP POLICY IF EXISTS "Users can insert own backup codes" ON two_factor_backup_codes;
DROP POLICY IF EXISTS "Users can update own backup codes" ON two_factor_backup_codes;

CREATE POLICY "Users can view own backup codes" ON two_factor_backup_codes
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own backup codes" ON two_factor_backup_codes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own backup codes" ON two_factor_backup_codes
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Two factor verification attempts policies
DROP POLICY IF EXISTS "Users can view own verification attempts" ON two_factor_verification_attempts;
DROP POLICY IF EXISTS "Users can insert own verification attempts" ON two_factor_verification_attempts;

CREATE POLICY "Users can view own verification attempts" ON two_factor_verification_attempts
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own verification attempts" ON two_factor_verification_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- Utility bill validations policies
DROP POLICY IF EXISTS "Users can view their own utility bill validations" ON utility_bill_validations;
DROP POLICY IF EXISTS "Users can insert their own utility bill validations" ON utility_bill_validations;

CREATE POLICY "Users can view their own utility bill validations" ON utility_bill_validations
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert their own utility bill validations" ON utility_bill_validations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- KYC audit logs policies
DROP POLICY IF EXISTS "Users can view own kyc audit logs" ON kyc_audit_logs;

CREATE POLICY "Users can view own kyc audit logs" ON kyc_audit_logs
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- KYC audit events policies
DROP POLICY IF EXISTS "Users can view own kyc audit events" ON kyc_audit_events;

CREATE POLICY "Users can view own kyc audit events" ON kyc_audit_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kyc_audit_logs
      WHERE kyc_audit_logs.id = kyc_audit_events.audit_log_id
      AND kyc_audit_logs.user_id = (select auth.uid())
    )
  );

-- KYC audit attachments policies
DROP POLICY IF EXISTS "Users can view own kyc audit attachments" ON kyc_audit_attachments;

CREATE POLICY "Users can view own kyc audit attachments" ON kyc_audit_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM kyc_audit_logs
      WHERE kyc_audit_logs.id = kyc_audit_attachments.audit_log_id
      AND kyc_audit_logs.user_id = (select auth.uid())
    )
  );

-- KYC audit summary policies
DROP POLICY IF EXISTS "Users can view own kyc audit summary" ON kyc_audit_summary;

CREATE POLICY "Users can view own kyc audit summary" ON kyc_audit_summary
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- SafeHaven tokens policies
DROP POLICY IF EXISTS "Users can view own safehaven tokens" ON safehaven_tokens;

CREATE POLICY "Users can view own safehaven tokens" ON safehaven_tokens
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- SafeHaven accounts policies
DROP POLICY IF EXISTS "Users can view own safehaven accounts" ON safehaven_accounts;

CREATE POLICY "Users can view own safehaven accounts" ON safehaven_accounts
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- SafeHaven audit logs policies
DROP POLICY IF EXISTS "Users can view own safehaven audit logs" ON safehaven_audit_logs;

CREATE POLICY "Users can view own safehaven audit logs" ON safehaven_audit_logs
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));