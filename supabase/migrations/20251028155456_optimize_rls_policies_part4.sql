/*
  # Optimize RLS Policies - Part 4 (User Roles, Paystack, Notifications)

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid()) in RLS policies
  
  2. Tables Updated
    - user_roles: Update all RLS policies
    - paystack_accounts: Update all RLS policies
    - notifications: Update all RLS policies
    - payout_accounts: Update all RLS policies
*/

-- User roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;

CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Paystack accounts policies (clean up duplicates)
DROP POLICY IF EXISTS "Users can view own Paystack accounts" ON paystack_accounts;
DROP POLICY IF EXISTS "Users can view own paystack accounts" ON paystack_accounts;
DROP POLICY IF EXISTS "Users can update own Paystack accounts" ON paystack_accounts;
DROP POLICY IF EXISTS "Users can update own paystack accounts" ON paystack_accounts;
DROP POLICY IF EXISTS "Users can insert own paystack accounts" ON paystack_accounts;
DROP POLICY IF EXISTS "Users can delete own paystack accounts" ON paystack_accounts;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON paystack_accounts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON paystack_accounts;
DROP POLICY IF EXISTS "Planmoni" ON paystack_accounts;

CREATE POLICY "Users can view own paystack accounts" ON paystack_accounts
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can update own paystack accounts" ON paystack_accounts
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own paystack accounts" ON paystack_accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own paystack accounts" ON paystack_accounts
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- Notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Payout accounts policies
DROP POLICY IF EXISTS "Users can view own payout accounts" ON payout_accounts;
DROP POLICY IF EXISTS "Users can insert own payout accounts" ON payout_accounts;
DROP POLICY IF EXISTS "Users can update own payout accounts" ON payout_accounts;
DROP POLICY IF EXISTS "Users can delete own payout accounts" ON payout_accounts;

CREATE POLICY "Users can view own payout accounts" ON payout_accounts
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own payout accounts" ON payout_accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own payout accounts" ON payout_accounts
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own payout accounts" ON payout_accounts
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));