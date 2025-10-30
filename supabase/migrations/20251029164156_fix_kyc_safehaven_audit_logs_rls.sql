/*
  # Fix KYC and SafeHaven Audit Logs RLS Policies

  1. Changes
    - Drop old admin-only RLS policies from kyc_audit_logs and safehaven_audit_logs
    - Create new RLS policies that check for granular audit_logs permissions
    - Policies check for 'audit_logs.view', 'audit_logs.filter', 'audit_logs.export' permissions
    - Super admins automatically have access through has_permission function
    
  2. Security
    - Users with audit_logs permissions can view all audit logs
    - Regular users can still view their own audit logs
    - Super admins have full access through the has_permission function
*/

-- ===============================================
-- KYC_AUDIT_LOGS TABLE
-- ===============================================

-- Drop old admin policy
DROP POLICY IF EXISTS "Admins can view all KYC audit logs" ON kyc_audit_logs;

-- Create new permission-based policy for viewing KYC audit logs
CREATE POLICY "Users with permission can view all KYC audit logs"
  ON kyc_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    has_permission('audit_logs.view')
    OR has_permission('audit_logs.filter')
    OR has_permission('audit_logs.export')
    OR is_admin()
  );

-- ===============================================
-- SAFEHAVEN_AUDIT_LOGS TABLE
-- ===============================================

-- Drop old admin policy
DROP POLICY IF EXISTS "Admins can view all SafeHaven audit logs" ON safehaven_audit_logs;

-- Create new permission-based policy for viewing SafeHaven audit logs
CREATE POLICY "Users with permission can view all SafeHaven audit logs"
  ON safehaven_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    has_permission('audit_logs.view')
    OR has_permission('audit_logs.filter')
    OR has_permission('audit_logs.export')
    OR is_admin()
  );
