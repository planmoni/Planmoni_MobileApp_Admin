/*
  # Fix Notifications RLS Policies to Use Granular Permissions

  1. Overview
    - Updates RLS policies on push_notifications table to use has_permission()
    - Updates RLS policies on push_notification_segments table to use has_permission()
    - Updates RLS policies on user_push_tokens table to use has_permission()
    - Allows users with specific notification permissions to access the system

  2. Changes
    - Drops old policies that only check is_admin
    - Creates new policies checking for specific permissions:
      - notifications.view - View notifications
      - notifications.send - Send notifications
      - notifications.create - Create notifications
      - notifications.segments - Manage segments
      - notifications.history - View notification history

  3. Security
    - Super admins still have full access
    - Users with specific permissions can perform allowed actions
    - Regular users can still manage their own push tokens
*/

-- Drop old policies on push_notifications
DROP POLICY IF EXISTS "Admins can manage all push notifications" ON push_notifications;

-- Create new granular policies for push_notifications
CREATE POLICY "Users with notifications.view can view notifications"
  ON push_notifications FOR SELECT
  TO authenticated
  USING (
    is_super_admin() OR
    has_permission('notifications.view') OR
    has_permission('notifications.history')
  );

CREATE POLICY "Users with notifications.create can insert notifications"
  ON push_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin() OR
    has_permission('notifications.create') OR
    has_permission('notifications.send')
  );

CREATE POLICY "Users with notifications.send can update notifications"
  ON push_notifications FOR UPDATE
  TO authenticated
  USING (
    is_super_admin() OR
    has_permission('notifications.send') OR
    has_permission('notifications.create')
  )
  WITH CHECK (
    is_super_admin() OR
    has_permission('notifications.send') OR
    has_permission('notifications.create')
  );

CREATE POLICY "Super admins can delete notifications"
  ON push_notifications FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- Drop old policies on push_notification_segments
DROP POLICY IF EXISTS "Admins can manage all push segments" ON push_notification_segments;

-- Create new granular policies for push_notification_segments
CREATE POLICY "Users with notifications.view can view segments"
  ON push_notification_segments FOR SELECT
  TO authenticated
  USING (
    is_super_admin() OR
    has_permission('notifications.view') OR
    has_permission('notifications.segments')
  );

CREATE POLICY "Users with notifications.segments can manage segments"
  ON push_notification_segments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin() OR
    has_permission('notifications.segments')
  );

CREATE POLICY "Users with notifications.segments can update segments"
  ON push_notification_segments FOR UPDATE
  TO authenticated
  USING (
    is_super_admin() OR
    has_permission('notifications.segments')
  )
  WITH CHECK (
    is_super_admin() OR
    has_permission('notifications.segments')
  );

CREATE POLICY "Super admins can delete segments"
  ON push_notification_segments FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- Drop old admin policy on user_push_tokens (keep user policies)
DROP POLICY IF EXISTS "Admins can manage all push tokens" ON user_push_tokens;

-- Create new granular policy for admins to view all tokens (needed for sending)
CREATE POLICY "Users with notifications.send can view all tokens"
  ON user_push_tokens FOR SELECT
  TO authenticated
  USING (
    is_super_admin() OR
    has_permission('notifications.send') OR
    has_permission('notifications.view') OR
    auth.uid() = user_id  -- Users can still see their own
  );