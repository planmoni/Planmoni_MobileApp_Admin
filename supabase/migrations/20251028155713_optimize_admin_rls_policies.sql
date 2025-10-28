/*
  # Optimize Admin RLS Policies

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid()) in admin RLS policies
  
  2. Tables Updated
    - automated_payouts: Update admin policies
    - payout_accounts: Update admin policies
    - All tables with admin access policies
*/

-- Automated payouts admin policies
DROP POLICY IF EXISTS "Admins can view all automated payouts" ON automated_payouts;
DROP POLICY IF EXISTS "Admins can update automated payouts" ON automated_payouts;

CREATE POLICY "Admins can view all automated payouts" ON automated_payouts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update automated payouts" ON automated_payouts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Payout accounts admin policies
DROP POLICY IF EXISTS "Admins can view all payout accounts" ON payout_accounts;

CREATE POLICY "Admins can view all payout accounts" ON payout_accounts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Bank accounts admin policies
DROP POLICY IF EXISTS "Admins can view all bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Admins can update all bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Admins can insert bank accounts" ON bank_accounts;

CREATE POLICY "Admins can view all bank accounts" ON bank_accounts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update all bank accounts" ON bank_accounts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert bank accounts" ON bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Custom payout dates admin policies
DROP POLICY IF EXISTS "Admins can view all custom payout dates" ON custom_payout_dates;
DROP POLICY IF EXISTS "Admins can insert custom payout dates" ON custom_payout_dates;

CREATE POLICY "Admins can view all custom payout dates" ON custom_payout_dates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert custom payout dates" ON custom_payout_dates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Events admin policies
DROP POLICY IF EXISTS "Admins can view all events" ON events;
DROP POLICY IF EXISTS "Admins can update all events" ON events;
DROP POLICY IF EXISTS "Admins can insert events" ON events;

CREATE POLICY "Admins can view all events" ON events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update all events" ON events
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert events" ON events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Payout plans admin policies
DROP POLICY IF EXISTS "Admins can view all payout plans" ON payout_plans;
DROP POLICY IF EXISTS "Admins can update all payout plans" ON payout_plans;
DROP POLICY IF EXISTS "Admins can insert payout plans" ON payout_plans;
DROP POLICY IF EXISTS "Admins can delete all payout plans" ON payout_plans;

CREATE POLICY "Admins can view all payout plans" ON payout_plans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update all payout plans" ON payout_plans
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert payout plans" ON payout_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can delete all payout plans" ON payout_plans
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Profiles admin policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Transactions admin policies
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can insert transactions" ON transactions;

CREATE POLICY "Admins can view all transactions" ON transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert transactions" ON transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Wallets admin policies
DROP POLICY IF EXISTS "Admins can view all wallets" ON wallets;
DROP POLICY IF EXISTS "Admins can update all wallets" ON wallets;

CREATE POLICY "Admins can view all wallets" ON wallets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update all wallets" ON wallets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );