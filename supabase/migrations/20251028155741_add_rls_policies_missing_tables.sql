/*
  # Add RLS Policies for Tables Without Them

  1. Security Improvements
    - Add RLS policies for admin, is_admin, and push_notification_queue tables
    - These tables currently have RLS enabled but no policies
  
  2. Tables Updated
    - admin: Add admin-only policies
    - is_admin: Add admin-only policies  
    - push_notification_queue: Add system and admin policies
*/

-- Admin table policies (super admin only)
CREATE POLICY "Super admins can view admin table" ON admin
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert into admin table" ON admin
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update admin table" ON admin
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete from admin table" ON admin
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name = 'super_admin'
    )
  );

-- is_admin table policies (super admin only)
CREATE POLICY "Super admins can view is_admin table" ON is_admin
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert into is_admin table" ON is_admin
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update is_admin table" ON is_admin
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name = 'super_admin'
    )
  );

CREATE POLICY "Super admins can delete from is_admin table" ON is_admin
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name = 'super_admin'
    )
  );

-- push_notification_queue table policies (system and admin access)
CREATE POLICY "Admins can view push notification queue" ON push_notification_queue
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "System can insert into push notification queue" ON push_notification_queue
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update push notification queue" ON push_notification_queue
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

CREATE POLICY "Admins can delete from push notification queue" ON push_notification_queue
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );