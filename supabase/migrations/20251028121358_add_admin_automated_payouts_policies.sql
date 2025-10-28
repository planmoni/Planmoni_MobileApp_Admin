/*
  # Add Admin Access Policies for Automated Payouts

  1. Changes
    - Add SELECT policy for admins to view all automated_payouts
    - Add UPDATE policy for admins to update automated_payouts (for retry/status management)
    
  2. Security
    - Policies check is_admin flag from profiles table
    - Only admin users can access all payout data
    - Regular users can still only see their own data through existing policies
*/

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can view all automated payouts" ON automated_payouts;
  DROP POLICY IF EXISTS "Admins can update automated payouts" ON automated_payouts;
END $$;

-- Allow admins to view all automated_payouts
CREATE POLICY "Admins can view all automated payouts"
  ON automated_payouts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Allow admins to update automated_payouts
CREATE POLICY "Admins can update automated payouts"
  ON automated_payouts
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
