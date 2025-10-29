/*
  # Fix Emergency Withdrawals RLS Policies

  1. Changes
    - Drop old admin-only RLS policies on emergency_withdrawals table
    - Create new RLS policies that check for granular permissions using has_permission function
    - Policies check for 'emergency_withdrawals.view' and 'emergency_withdrawals.process' permissions
    - Super admins automatically have access through has_permission function
    
  2. Security
    - Users with 'emergency_withdrawals.view' permission can view all emergency withdrawals
    - Users with 'emergency_withdrawals.process' permission can update emergency withdrawals
    - Regular users can still view and update their own emergency withdrawals
    - Super admins have full access through the has_permission function
*/

-- Drop old admin policies
DROP POLICY IF EXISTS "Admins can view all emergency withdrawals" ON emergency_withdrawals;
DROP POLICY IF EXISTS "Admins can update emergency withdrawals" ON emergency_withdrawals;

-- Create new permission-based policies for viewing emergency withdrawals
CREATE POLICY "Users with permission can view all emergency withdrawals"
  ON emergency_withdrawals
  FOR SELECT
  TO authenticated
  USING (
    has_permission('emergency_withdrawals.view')
    OR has_permission('emergency_withdrawals.list')
  );

-- Create new permission-based policies for updating emergency withdrawals
CREATE POLICY "Users with permission can update emergency withdrawals"
  ON emergency_withdrawals
  FOR UPDATE
  TO authenticated
  USING (
    has_permission('emergency_withdrawals.process')
  )
  WITH CHECK (
    has_permission('emergency_withdrawals.process')
  );
