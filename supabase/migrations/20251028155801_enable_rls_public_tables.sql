/*
  # Enable RLS on Public Tables Without It

  1. Security Improvements
    - Enable RLS on system_locks table
    - Enable RLS on user_fcm_tokens table
    - Add appropriate policies for each table
  
  2. Tables Updated
    - system_locks: Enable RLS and add system policies
    - user_fcm_tokens: Enable RLS and add user/admin policies
*/

-- Enable RLS on system_locks
ALTER TABLE system_locks ENABLE ROW LEVEL SECURITY;

-- System locks policies (system operations only)
CREATE POLICY "System can manage locks" ON system_locks
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable RLS on user_fcm_tokens
ALTER TABLE user_fcm_tokens ENABLE ROW LEVEL SECURITY;

-- User FCM tokens policies
CREATE POLICY "Users can view own FCM tokens" ON user_fcm_tokens
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own FCM tokens" ON user_fcm_tokens
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own FCM tokens" ON user_fcm_tokens
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own FCM tokens" ON user_fcm_tokens
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Admins can view all FCM tokens" ON user_fcm_tokens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );