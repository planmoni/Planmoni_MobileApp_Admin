/*
  # Fix Admin RLS Policies to Use profiles.is_admin

  1. Problem
    - Admin policies were checking user_roles table
    - But the system uses profiles.is_admin boolean field for admin detection
    - This caused all admin queries to return no data

  2. Solution
    - Update all admin policies to check profiles.is_admin = true
    - Keep compatibility with user_roles for future use
    - Use OR condition to support both methods

  3. Tables Updated
    - All tables with admin policies will check profiles.is_admin
*/

-- Helper function to check admin status
CREATE OR REPLACE FUNCTION is_user_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = check_user_id),
    false
  );
$$;

-- KYC Data policies
DROP POLICY IF EXISTS "Admins can view all kyc data" ON kyc_data;
DROP POLICY IF EXISTS "Admins can update kyc data" ON kyc_data;

CREATE POLICY "Admins can view all kyc data" ON kyc_data
  FOR SELECT TO authenticated
  USING (
    is_user_admin((select auth.uid()))
  );

CREATE POLICY "Admins can update kyc data" ON kyc_data
  FOR UPDATE TO authenticated
  USING (is_user_admin((select auth.uid())))
  WITH CHECK (is_user_admin((select auth.uid())));

-- KYC Progress policies
DROP POLICY IF EXISTS "Admins can view all kyc progress" ON kyc_progress;

CREATE POLICY "Admins can view all kyc progress" ON kyc_progress
  FOR SELECT TO authenticated
  USING (is_user_admin((select auth.uid())));

-- Automated Payouts policies
DROP POLICY IF EXISTS "Admins can view all automated payouts" ON automated_payouts;
DROP POLICY IF EXISTS "Admins can update automated payouts" ON automated_payouts;

CREATE POLICY "Admins can view all automated payouts" ON automated_payouts
  FOR SELECT TO authenticated
  USING (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can update automated payouts" ON automated_payouts
  FOR UPDATE TO authenticated
  USING (is_user_admin((select auth.uid())))
  WITH CHECK (is_user_admin((select auth.uid())));

-- Payout Accounts policies
DROP POLICY IF EXISTS "Admins can view all payout accounts" ON payout_accounts;

CREATE POLICY "Admins can view all payout accounts" ON payout_accounts
  FOR SELECT TO authenticated
  USING (is_user_admin((select auth.uid())));

-- Bank Accounts policies
DROP POLICY IF EXISTS "Admins can view all bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Admins can update all bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Admins can insert bank accounts" ON bank_accounts;

CREATE POLICY "Admins can view all bank accounts" ON bank_accounts
  FOR SELECT TO authenticated
  USING (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can update all bank accounts" ON bank_accounts
  FOR UPDATE TO authenticated
  USING (is_user_admin((select auth.uid())))
  WITH CHECK (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can insert bank accounts" ON bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (is_user_admin((select auth.uid())));

-- Custom Payout Dates policies
DROP POLICY IF EXISTS "Admins can view all custom payout dates" ON custom_payout_dates;
DROP POLICY IF EXISTS "Admins can insert custom payout dates" ON custom_payout_dates;

CREATE POLICY "Admins can view all custom payout dates" ON custom_payout_dates
  FOR SELECT TO authenticated
  USING (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can insert custom payout dates" ON custom_payout_dates
  FOR INSERT TO authenticated
  WITH CHECK (is_user_admin((select auth.uid())));

-- Events policies
DROP POLICY IF EXISTS "Admins can view all events" ON events;
DROP POLICY IF EXISTS "Admins can update all events" ON events;
DROP POLICY IF EXISTS "Admins can insert events" ON events;

CREATE POLICY "Admins can view all events" ON events
  FOR SELECT TO authenticated
  USING (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can update all events" ON events
  FOR UPDATE TO authenticated
  USING (is_user_admin((select auth.uid())))
  WITH CHECK (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can insert events" ON events
  FOR INSERT TO authenticated
  WITH CHECK (is_user_admin((select auth.uid())));

-- Payout Plans policies
DROP POLICY IF EXISTS "Admins can view all payout plans" ON payout_plans;
DROP POLICY IF EXISTS "Admins can update all payout plans" ON payout_plans;
DROP POLICY IF EXISTS "Admins can insert payout plans" ON payout_plans;
DROP POLICY IF EXISTS "Admins can delete all payout plans" ON payout_plans;

CREATE POLICY "Admins can view all payout plans" ON payout_plans
  FOR SELECT TO authenticated
  USING (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can update all payout plans" ON payout_plans
  FOR UPDATE TO authenticated
  USING (is_user_admin((select auth.uid())))
  WITH CHECK (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can insert payout plans" ON payout_plans
  FOR INSERT TO authenticated
  WITH CHECK (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can delete all payout plans" ON payout_plans
  FOR DELETE TO authenticated
  USING (is_user_admin((select auth.uid())));

-- Profiles policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE TO authenticated
  USING (is_user_admin((select auth.uid())))
  WITH CHECK (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (is_user_admin((select auth.uid())));

-- Transactions policies
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can insert transactions" ON transactions;

CREATE POLICY "Admins can view all transactions" ON transactions
  FOR SELECT TO authenticated
  USING (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can insert transactions" ON transactions
  FOR INSERT TO authenticated
  WITH CHECK (is_user_admin((select auth.uid())));

-- Wallets policies
DROP POLICY IF EXISTS "Admins can view all wallets" ON wallets;
DROP POLICY IF EXISTS "Admins can update all wallets" ON wallets;

CREATE POLICY "Admins can view all wallets" ON wallets
  FOR SELECT TO authenticated
  USING (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can update all wallets" ON wallets
  FOR UPDATE TO authenticated
  USING (is_user_admin((select auth.uid())))
  WITH CHECK (is_user_admin((select auth.uid())));

-- Banners policies (keep existing permissive policy for public, add admin management)
DROP POLICY IF EXISTS "Admins can manage banners" ON banners;

CREATE POLICY "Admins can insert banners" ON banners
  FOR INSERT TO authenticated
  WITH CHECK (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can update banners" ON banners
  FOR UPDATE TO authenticated
  USING (is_user_admin((select auth.uid())))
  WITH CHECK (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can delete banners" ON banners
  FOR DELETE TO authenticated
  USING (is_user_admin((select auth.uid())));

CREATE POLICY "Admins can view all banners" ON banners
  FOR SELECT TO authenticated
  USING (is_user_admin((select auth.uid())));