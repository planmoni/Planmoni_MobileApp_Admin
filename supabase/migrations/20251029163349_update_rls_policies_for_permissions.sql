/*
  # Update RLS Policies for Granular Permissions

  1. Changes
    - Drop old admin-only RLS policies that check is_admin or is_user_admin
    - Create new RLS policies that check for granular permissions
    - Policies now use has_permission() function for proper permission checks
    - Super admins automatically have access through has_permission function
    
  2. Security
    - Users with specific permissions can access data
    - Regular users can still view and update their own data
    - Super admins have full access through the has_permission function
    
  3. Tables Updated
    - profiles: users.list, users.details
    - payout_plans: payout_plans.list, payout_plans.details
    - payout_accounts: (no specific permissions, uses admin check)
    - transactions: transactions.list, transactions.details
    - kyc_data: (no specific permissions created yet, will use admin check for now)
*/

-- ===============================================
-- PROFILES TABLE
-- ===============================================

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;

-- Create new permission-based policies for viewing profiles
CREATE POLICY "Users with permission can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    has_permission('users.list')
    OR has_permission('users.details')
    OR is_admin()
  );

-- Create new permission-based policies for updating profiles
CREATE POLICY "Users with permission can update profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    has_permission('users.details')
    OR is_admin()
  )
  WITH CHECK (
    has_permission('users.details')
    OR is_admin()
  );

-- ===============================================
-- PAYOUT_PLANS TABLE
-- ===============================================

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can view all payout plans" ON payout_plans;
DROP POLICY IF EXISTS "Admins can update all payout plans" ON payout_plans;
DROP POLICY IF EXISTS "Admins can delete all payout plans" ON payout_plans;
DROP POLICY IF EXISTS "Admins can insert payout plans" ON payout_plans;

-- Create new permission-based policies for viewing payout plans
CREATE POLICY "Users with permission can view all payout plans"
  ON payout_plans
  FOR SELECT
  TO authenticated
  USING (
    has_permission('payout_plans.list')
    OR has_permission('payout_plans.details')
    OR has_permission('dashboard.stats.new_plans')
    OR has_permission('dashboard.stats.cancelled_plans')
    OR is_admin()
  );

-- Create new permission-based policies for updating payout plans
CREATE POLICY "Users with permission can update payout plans"
  ON payout_plans
  FOR UPDATE
  TO authenticated
  USING (
    has_permission('payout_plans.details')
    OR is_admin()
  )
  WITH CHECK (
    has_permission('payout_plans.details')
    OR is_admin()
  );

-- ===============================================
-- PAYOUT_ACCOUNTS TABLE
-- ===============================================

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can view all payout accounts" ON payout_accounts;

-- Create new permission-based policies for viewing payout accounts
CREATE POLICY "Users with permission can view all payout accounts"
  ON payout_accounts
  FOR SELECT
  TO authenticated
  USING (
    has_permission('payout_plans.details')
    OR has_permission('emergency_withdrawals.view')
    OR is_admin()
  );

-- ===============================================
-- TRANSACTIONS TABLE
-- ===============================================

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can delete transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can insert transactions" ON transactions;

-- Create new permission-based policies for viewing transactions
CREATE POLICY "Users with permission can view all transactions"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (
    has_permission('transactions.list')
    OR has_permission('transactions.details')
    OR has_permission('dashboard.lists.todays_transactions')
    OR is_admin()
  );

-- Create new permission-based policies for updating transactions
CREATE POLICY "Users with permission can update transactions"
  ON transactions
  FOR UPDATE
  TO authenticated
  USING (
    is_admin()
  )
  WITH CHECK (
    is_admin()
  );

-- Create new permission-based policies for inserting transactions
CREATE POLICY "Users with permission can insert transactions"
  ON transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin()
  );

-- Create new permission-based policies for deleting transactions
CREATE POLICY "Users with permission can delete transactions"
  ON transactions
  FOR DELETE
  TO authenticated
  USING (
    is_admin()
  );

-- ===============================================
-- KYC_DATA TABLE
-- ===============================================

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can view all kyc data" ON kyc_data;
DROP POLICY IF EXISTS "Admins can update kyc data" ON kyc_data;

-- Create new permission-based policies for viewing kyc data
CREATE POLICY "Users with permission can view all kyc data"
  ON kyc_data
  FOR SELECT
  TO authenticated
  USING (
    has_permission('dashboard.stats.kyc_completed')
    OR is_admin()
  );

-- Create new permission-based policies for updating kyc data
CREATE POLICY "Users with permission can update kyc data"
  ON kyc_data
  FOR UPDATE
  TO authenticated
  USING (
    is_admin()
  )
  WITH CHECK (
    is_admin()
  );
