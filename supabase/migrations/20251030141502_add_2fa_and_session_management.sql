/*
  # Add Two-Factor Authentication and Session Management

  1. New Tables
    - `admin_2fa_settings`
      - `user_id` (uuid, primary key, references profiles)
      - `secret` (text, encrypted secret for TOTP)
      - `is_enabled` (boolean, whether 2FA is active)
      - `backup_codes` (text[], encrypted backup codes)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `admin_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `session_token` (text, unique session identifier)
      - `ip_address` (text, user's IP address)
      - `user_agent` (text, browser/device info)
      - `last_active` (timestamp, last activity time)
      - `created_at` (timestamp, login time)
      - `expires_at` (timestamp, session expiration)
      - `is_active` (boolean, session status)

  2. Security
    - Enable RLS on both tables
    - Add policies for super admin access only
    - Add indexes for performance

  3. Functions
    - Function to clean up expired sessions automatically
*/

-- Create admin_2fa_settings table
CREATE TABLE IF NOT EXISTS admin_2fa_settings (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  secret text NOT NULL,
  is_enabled boolean DEFAULT false NOT NULL,
  backup_codes text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create admin_sessions table
CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  ip_address text,
  user_agent text,
  last_active timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true NOT NULL
);

-- Enable RLS
ALTER TABLE admin_2fa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_2fa_settings (only super admin or self can access)
CREATE POLICY "Super admin can view all 2FA settings"
  ON admin_2fa_settings
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin() OR auth.uid() = user_id
  );

CREATE POLICY "Users can insert own 2FA settings"
  ON admin_2fa_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own 2FA settings"
  ON admin_2fa_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admin can delete 2FA settings"
  ON admin_2fa_settings
  FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- RLS Policies for admin_sessions (only super admin can manage all sessions)
CREATE POLICY "Super admin can view all admin sessions"
  ON admin_sessions
  FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Users can view own sessions"
  ON admin_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert sessions"
  ON admin_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update sessions"
  ON admin_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR is_super_admin())
  WITH CHECK (auth.uid() = user_id OR is_super_admin());

CREATE POLICY "Super admin can delete any session"
  ON admin_sessions
  FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_2fa_settings_user_id ON admin_2fa_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_last_active ON admin_sessions(last_active);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE admin_sessions
  SET is_active = false
  WHERE expires_at < now() AND is_active = true;
END;
$$;

-- Function to update last_active timestamp
CREATE OR REPLACE FUNCTION update_session_activity(p_session_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE admin_sessions
  SET last_active = now()
  WHERE session_token = p_session_token AND is_active = true;
END;
$$;

-- Function to invalidate a session
CREATE OR REPLACE FUNCTION invalidate_session(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only super admin can invalidate sessions
  IF NOT is_super_admin() THEN
    RETURN false;
  END IF;

  UPDATE admin_sessions
  SET is_active = false
  WHERE id = p_session_id;
  
  RETURN true;
END;
$$;
