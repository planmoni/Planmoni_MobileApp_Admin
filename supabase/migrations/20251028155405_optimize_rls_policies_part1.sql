/*
  # Optimize RLS Policies - Part 1 (Wallets, Bank Accounts, Payout Plans)

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid()) in RLS policies
    - Prevents re-evaluation of auth function for each row
    - Significantly improves query performance at scale
  
  2. Tables Updated
    - wallets: Update all RLS policies
    - bank_accounts: Update all RLS policies
    - payout_plans: Update all RLS policies
*/

-- Wallets policies
DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;
DROP POLICY IF EXISTS "Users can insert own wallet" ON wallets;
DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;

CREATE POLICY "Users can update own wallet" ON wallets
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own wallet" ON wallets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Bank accounts policies
DROP POLICY IF EXISTS "Users can view own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can insert own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can update own bank accounts" ON bank_accounts;

CREATE POLICY "Users can view own bank accounts" ON bank_accounts
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own bank accounts" ON bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own bank accounts" ON bank_accounts
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Payout plans policies
DROP POLICY IF EXISTS "Users can view own payout plans" ON payout_plans;
DROP POLICY IF EXISTS "Users can insert own payout plans" ON payout_plans;
DROP POLICY IF EXISTS "Users can update own payout plans" ON payout_plans;
DROP POLICY IF EXISTS "Users can delete own payout plans" ON payout_plans;

CREATE POLICY "Users can view own payout plans" ON payout_plans
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own payout plans" ON payout_plans
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own payout plans" ON payout_plans
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own payout plans" ON payout_plans
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));