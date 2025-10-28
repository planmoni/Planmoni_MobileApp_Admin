/*
  # Optimize RLS Policies - Part 3 (Profiles, 2FA, Automated Payouts)

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid()) in RLS policies
  
  2. Tables Updated
    - profiles: Update all RLS policies
    - two_factor_secrets: Update all RLS policies
    - automated_payouts: Update all RLS policies
    - emergency_withdrawals: Update all RLS policies
*/

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- Two factor secrets policies
DROP POLICY IF EXISTS "Users can insert own 2FA secrets" ON two_factor_secrets;
DROP POLICY IF EXISTS "Users can update own 2FA secrets" ON two_factor_secrets;
DROP POLICY IF EXISTS "Users can view own 2FA secrets" ON two_factor_secrets;

CREATE POLICY "Users can insert own 2FA secrets" ON two_factor_secrets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own 2FA secrets" ON two_factor_secrets
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can view own 2FA secrets" ON two_factor_secrets
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Automated payouts policies
DROP POLICY IF EXISTS "Users can view own automated payouts" ON automated_payouts;

CREATE POLICY "Users can view own automated payouts" ON automated_payouts
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Emergency withdrawals policies
DROP POLICY IF EXISTS "Users can update own emergency withdrawals" ON emergency_withdrawals;
DROP POLICY IF EXISTS "Users can view own emergency withdrawals" ON emergency_withdrawals;
DROP POLICY IF EXISTS "Users can view their own emergency withdrawals" ON emergency_withdrawals;
DROP POLICY IF EXISTS "Users can insert own emergency withdrawals" ON emergency_withdrawals;
DROP POLICY IF EXISTS "Users can create their own emergency withdrawals" ON emergency_withdrawals;
DROP POLICY IF EXISTS "Users can update their own emergency withdrawals" ON emergency_withdrawals;

CREATE POLICY "Users can view own emergency withdrawals" ON emergency_withdrawals
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own emergency withdrawals" ON emergency_withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own emergency withdrawals" ON emergency_withdrawals
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));