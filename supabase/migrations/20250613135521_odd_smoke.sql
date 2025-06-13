/*
  # Add Admin Access to All Tables
  
  1. Security
    - Add RLS policies to allow admin users to access all data
    - Modify existing policies to check for admin status
    - Create helper function to check admin status
  
  2. Tables Modified
    - profiles
    - wallets
    - bank_accounts
    - payout_plans
    - custom_payout_dates
    - transactions
    - events
*/

-- Create a helper function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'is_admin' = 'true'
  );
$$;

-- Add admin policies to profiles table
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Add admin policies to wallets table
CREATE POLICY "Admins can view all wallets"
  ON wallets
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all wallets"
  ON wallets
  FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert wallets"
  ON wallets
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete wallets"
  ON wallets
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Add admin policies to bank_accounts table
CREATE POLICY "Admins can view all bank accounts"
  ON bank_accounts
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all bank accounts"
  ON bank_accounts
  FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert bank accounts"
  ON bank_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete bank accounts"
  ON bank_accounts
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Add admin policies to payout_plans table
CREATE POLICY "Admins can view all payout plans"
  ON payout_plans
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all payout plans"
  ON payout_plans
  FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert payout plans"
  ON payout_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete all payout plans"
  ON payout_plans
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Add admin policies to custom_payout_dates table
CREATE POLICY "Admins can view all custom payout dates"
  ON custom_payout_dates
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert custom payout dates"
  ON custom_payout_dates
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update custom payout dates"
  ON custom_payout_dates
  FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete custom payout dates"
  ON custom_payout_dates
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Add admin policies to transactions table
CREATE POLICY "Admins can view all transactions"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert transactions"
  ON transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update transactions"
  ON transactions
  FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete transactions"
  ON transactions
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Add admin policies to events table
CREATE POLICY "Admins can view all events"
  ON events
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update all events"
  ON events
  FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can delete events"
  ON events
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Ensure admin user has is_admin set to true
DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get the admin user ID
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@planmoni.com';
  
  IF v_admin_id IS NOT NULL THEN
    -- Update the user metadata to ensure is_admin is true
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{is_admin}',
      'true'::jsonb
    )
    WHERE id = v_admin_id;
  END IF;
END $$;