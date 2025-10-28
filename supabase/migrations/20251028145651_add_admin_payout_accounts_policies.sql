/*
  # Add Admin Policies for Payout Accounts

  1. Changes
    - Add SELECT policy for admins to view all payout accounts
    - Allows admin dashboard to display user payout account information

  2. Security
    - Only users with is_admin = true can view all payout accounts
    - Regular users can still only view their own accounts
*/

-- Allow admins to view all payout accounts
CREATE POLICY "Admins can view all payout accounts"
  ON payout_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
