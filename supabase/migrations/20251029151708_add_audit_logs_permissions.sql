/*
  # Add Audit Logs Permissions

  1. New Permissions
    - `audit_logs.view` - View audit logs from kyc_audit_logs and safehaven_audit_logs tables
    - `audit_logs.export` - Export audit logs data
    - `audit_logs.filter` - Filter and search audit logs

  2. Security
    - Add RLS policies for audit log tables to allow admins with proper permissions to view logs
*/

-- Insert audit_logs permissions
INSERT INTO permissions (name, resource, action, description) VALUES
  ('audit_logs.view', 'audit_logs', 'view', 'View audit logs'),
  ('audit_logs.export', 'audit_logs', 'export', 'Export audit logs'),
  ('audit_logs.filter', 'audit_logs', 'filter', 'Filter and search audit logs')
ON CONFLICT (name) DO NOTHING;

-- Add RLS policies for kyc_audit_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'kyc_audit_logs' 
    AND policyname = 'Admins can view all KYC audit logs'
  ) THEN
    CREATE POLICY "Admins can view all KYC audit logs"
      ON kyc_audit_logs
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );
  END IF;
END $$;

-- Add RLS policies for safehaven_audit_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'safehaven_audit_logs' 
    AND policyname = 'Admins can view all SafeHaven audit logs'
  ) THEN
    CREATE POLICY "Admins can view all SafeHaven audit logs"
      ON safehaven_audit_logs
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );
  END IF;
END $$;
