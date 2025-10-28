/*
  # Add Admin Access Policies for KYC Data

  1. Changes
    - Add SELECT policy for admins to view all kyc_data
    - Add SELECT policy for admins to view all kyc_progress
    - Add UPDATE policy for admins to update kyc_data (for approval)
    
  2. Security
    - Policies check is_admin flag from profiles table
    - Only admin users can access all KYC data
    - Regular users can still only see their own data
*/

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can view all kyc data" ON kyc_data;
  DROP POLICY IF EXISTS "Admins can update kyc data" ON kyc_data;
  DROP POLICY IF EXISTS "Admins can view all kyc progress" ON kyc_progress;
END $$;

-- Allow admins to view all kyc_data
CREATE POLICY "Admins can view all kyc data"
  ON kyc_data
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Allow admins to update kyc_data (for approval)
CREATE POLICY "Admins can update kyc data"
  ON kyc_data
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

-- Allow admins to view all kyc_progress
CREATE POLICY "Admins can view all kyc progress"
  ON kyc_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
