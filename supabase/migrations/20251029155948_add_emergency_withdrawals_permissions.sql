/*
  # Add Emergency Withdrawals Permissions

  1. New Permissions
    - `emergency_withdrawals.list` - View list of emergency withdrawals
    - `emergency_withdrawals.view` - View emergency withdrawal details
    - `emergency_withdrawals.process` - Process emergency withdrawals
    - `emergency_withdrawals.cancel` - Cancel emergency withdrawals

  2. Security
    - Add RLS policies for emergency_withdrawals table to allow admins with proper permissions
*/

-- Insert emergency_withdrawals permissions
INSERT INTO permissions (name, resource, action, description) VALUES
  ('emergency_withdrawals.list', 'emergency_withdrawals', 'list', 'View emergency withdrawals list'),
  ('emergency_withdrawals.view', 'emergency_withdrawals', 'view', 'View emergency withdrawal details'),
  ('emergency_withdrawals.process', 'emergency_withdrawals', 'process', 'Process emergency withdrawals'),
  ('emergency_withdrawals.cancel', 'emergency_withdrawals', 'cancel', 'Cancel emergency withdrawals')
ON CONFLICT (name) DO NOTHING;

-- Add RLS policies for emergency_withdrawals if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'emergency_withdrawals' 
    AND policyname = 'Admins can view all emergency withdrawals'
  ) THEN
    CREATE POLICY "Admins can view all emergency withdrawals"
      ON emergency_withdrawals
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

-- Add RLS policy for updating emergency withdrawals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'emergency_withdrawals' 
    AND policyname = 'Admins can update emergency withdrawals'
  ) THEN
    CREATE POLICY "Admins can update emergency withdrawals"
      ON emergency_withdrawals
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );
  END IF;
END $$;
