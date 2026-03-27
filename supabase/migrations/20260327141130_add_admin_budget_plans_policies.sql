/*
  # Add Admin Policies for Budget Plans

  1. New Policies
    - Add SELECT policy for admins to view all budget plans
    - Add SELECT policy for admins to view all plan_wallets
  
  2. Purpose
    - Allow admin users to view vault statistics on the dashboard
    - Enable admin users to see all vaults across all users
  
  3. Security
    - Policies check for admin status using is_admin() function
    - Only affects SELECT operations
    - Does not grant admins ability to modify other users' vaults
*/

-- Add admin policy for budget_plans SELECT
CREATE POLICY "Admins can view all budget plans"
  ON budget_plans
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Add admin policy for plan_wallets SELECT
CREATE POLICY "Admins can view all plan wallets"
  ON plan_wallets
  FOR SELECT
  TO authenticated
  USING (is_admin());
