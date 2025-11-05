/*
  # Add Admin Policies for App Versions Table

  1. Changes
    - Add policies for authenticated admin users to manage app versions
    - Allow admins to view all app versions
    - Allow admins to update app versions
    - Allow admins to insert new app versions
    
  2. Security
    - Only authenticated users with is_admin = true can manage app versions
    - Maintains existing public read access for active versions
    - Service role retains full access
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Anyone can read active app versions" ON app_versions;
DROP POLICY IF EXISTS "Service role can manage app versions" ON app_versions;

-- Allow public to read active versions
CREATE POLICY "Public can read active versions"
  ON app_versions
  FOR SELECT
  TO public
  USING (is_active = true);

-- Allow authenticated admins to view all versions
CREATE POLICY "Admins can view all versions"
  ON app_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Allow authenticated admins to insert versions
CREATE POLICY "Admins can insert versions"
  ON app_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Allow authenticated admins to update versions
CREATE POLICY "Admins can update versions"
  ON app_versions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Allow authenticated admins to delete versions
CREATE POLICY "Admins can delete versions"
  ON app_versions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Keep service role with full access
CREATE POLICY "Service role has full access"
  ON app_versions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
