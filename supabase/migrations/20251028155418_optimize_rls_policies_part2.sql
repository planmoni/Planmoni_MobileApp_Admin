/*
  # Optimize RLS Policies - Part 2 (Custom Payout Dates, Transactions, Events)

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid()) in RLS policies
    - Prevents re-evaluation of auth function for each row
  
  2. Tables Updated
    - custom_payout_dates: Update all RLS policies
    - transactions: Update all RLS policies
    - events: Update all RLS policies
*/

-- Custom payout dates policies
DROP POLICY IF EXISTS "Users can view own custom payout dates" ON custom_payout_dates;
DROP POLICY IF EXISTS "Users can insert own custom payout dates" ON custom_payout_dates;

CREATE POLICY "Users can view own custom payout dates" ON custom_payout_dates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payout_plans
      WHERE payout_plans.id = custom_payout_dates.payout_plan_id
      AND payout_plans.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own custom payout dates" ON custom_payout_dates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM payout_plans
      WHERE payout_plans.id = custom_payout_dates.payout_plan_id
      AND payout_plans.user_id = (select auth.uid())
    )
  );

-- Transactions policies
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;

CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- Events policies
DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Users can update own events" ON events;
DROP POLICY IF EXISTS "Users can insert own events" ON events;

CREATE POLICY "Users can view own events" ON events
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can update own events" ON events
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own events" ON events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));