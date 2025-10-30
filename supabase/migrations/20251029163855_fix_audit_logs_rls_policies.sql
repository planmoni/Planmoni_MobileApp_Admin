/*
  # Fix Audit Logs RLS Policies

  1. Changes
    - Drop the super admin only policy
    - Create new RLS policies that check for granular permissions
    - Policies check for 'audit_logs.view', 'audit_logs.filter', 'audit_logs.export' permissions
    - Super admins automatically have access through has_permission function
    
  2. Security
    - Users with audit_logs permissions can view all audit logs
    - Super admins have full access through the has_permission function
*/

-- Drop old super admin only policy
DROP POLICY IF EXISTS "Super admins can view audit logs" ON audit_logs;

-- Create new permission-based policy for viewing audit logs
CREATE POLICY "Users with permission can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    has_permission('audit_logs.view')
    OR has_permission('audit_logs.filter')
    OR has_permission('audit_logs.export')
    OR is_admin()
  );
