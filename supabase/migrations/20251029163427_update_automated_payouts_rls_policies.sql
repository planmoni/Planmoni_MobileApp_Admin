/*
  # Update Automated Payouts RLS Policies

  1. Changes
    - Drop old admin-only RLS policies
    - Create new RLS policies that check for granular permissions
    - Policies check for 'payout_events.*' permissions
    - Super admins automatically have access through has_permission function
    
  2. Security
    - Users with payout event permissions can view automated payouts
    - Super admins have full access through the has_permission function
*/

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can view all automated payouts" ON automated_payouts;
DROP POLICY IF EXISTS "Admins can update automated payouts" ON automated_payouts;

-- Create new permission-based policies for viewing automated payouts
CREATE POLICY "Users with permission can view all automated payouts"
  ON automated_payouts
  FOR SELECT
  TO authenticated
  USING (
    has_permission('payout_events.list')
    OR has_permission('payout_events.details')
    OR has_permission('dashboard.lists.todays_payout_events')
    OR has_permission('calendar.events')
    OR is_admin()
  );

-- Create new permission-based policies for updating automated payouts
CREATE POLICY "Users with permission can update automated payouts"
  ON automated_payouts
  FOR UPDATE
  TO authenticated
  USING (
    is_admin()
  )
  WITH CHECK (
    is_admin()
  );
