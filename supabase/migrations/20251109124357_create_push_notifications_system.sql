/*
  # Create Push Notifications System
  
  ## Purpose
  This migration creates the complete infrastructure for Admin to Users Push Notifications system.
  The existing 'notifications' table is for in-app notifications, so we create new tables for push notifications.
  
  ## 1. New Tables
  
  ### user_push_tokens
  Stores Expo push tokens for mobile app users
  - id (uuid, primary key)
  - user_id (uuid, references profiles)
  - expo_push_token (text, unique) - The Expo push token from mobile device
  - device_info (jsonb) - Device information (platform, model, OS version)
  - is_active (boolean) - Whether this token is currently valid
  - last_used (timestamptz) - Last time this token was used successfully
  - created_at (timestamptz)
  - updated_at (timestamptz)
  
  ### push_notification_segments
  Defines user groups for targeted push notifications
  - id (uuid, primary key)
  - name (text) - Segment name
  - description (text) - Description of the segment
  - filter_criteria (jsonb) - JSON object defining the filter criteria
  - user_count (integer) - Cached count of users in this segment
  - created_by (uuid, references profiles)
  - created_at (timestamptz)
  - updated_at (timestamptz)
  
  ### push_notifications
  Stores push notification campaign records
  - id (uuid, primary key)
  - title (text) - Notification title
  - body (text) - Notification message body
  - data (jsonb) - Additional data payload
  - target_type (text) - Type of targeting: 'all', 'individual', 'segment'
  - target_user_ids (uuid[]) - Array of specific user IDs
  - target_segment_id (uuid, references push_notification_segments)
  - status (text) - Status: 'draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'
  - scheduled_for (timestamptz) - When to send
  - sent_at (timestamptz) - When sent
  - total_recipients (integer) - Total recipients
  - delivered_count (integer) - Successfully delivered
  - failed_count (integer) - Failed deliveries
  - created_by (uuid, references profiles)
  - created_at (timestamptz)
  - updated_at (timestamptz)
  
  ### push_notification_logs
  Tracks individual push notification delivery attempts
  - id (uuid, primary key)
  - push_notification_id (uuid, references push_notifications)
  - user_id (uuid, references profiles)
  - push_token (text)
  - status (text) - Delivery status
  - error_message (text)
  - expo_receipt_id (text)
  - sent_at (timestamptz)
  - delivered_at (timestamptz)
  - read_at (timestamptz)
  - created_at (timestamptz)
  
  ## 2. Security
  - Enable RLS on all tables
  - Admins can manage all push notifications
  - Users can only view their own push tokens and logs
  
  ## 3. Indexes
  - Performance indexes on frequently queried columns
*/

-- Create user_push_tokens table
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  expo_push_token text UNIQUE NOT NULL,
  device_info jsonb DEFAULT '{}',
  is_active boolean DEFAULT true NOT NULL,
  last_used timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create push_notification_segments table
CREATE TABLE IF NOT EXISTS push_notification_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  filter_criteria jsonb DEFAULT '{}',
  user_count integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create push_notifications table
CREATE TABLE IF NOT EXISTS push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}',
  target_type text NOT NULL CHECK (target_type IN ('all', 'individual', 'segment')),
  target_user_ids uuid[] DEFAULT '{}',
  target_segment_id uuid REFERENCES push_notification_segments(id) ON DELETE SET NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  total_recipients integer DEFAULT 0,
  delivered_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create push_notification_logs table
CREATE TABLE IF NOT EXISTS push_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  push_notification_id uuid REFERENCES push_notifications(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  push_token text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
  error_message text,
  expo_receipt_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_push_tokens
CREATE POLICY "Admins can manage all push tokens"
  ON user_push_tokens
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

CREATE POLICY "Users can view own push tokens"
  ON user_push_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens"
  ON user_push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens"
  ON user_push_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for push_notification_segments
CREATE POLICY "Admins can manage all push segments"
  ON push_notification_segments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- RLS Policies for push_notifications
CREATE POLICY "Admins can manage all push notifications"
  ON push_notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- RLS Policies for push_notification_logs
CREATE POLICY "Admins can view all push notification logs"
  ON push_notification_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

CREATE POLICY "Users can view own push notification logs"
  ON push_notification_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert push notification logs"
  ON push_notification_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

CREATE POLICY "Admins can update push notification logs"
  ON push_notification_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = true
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_is_active ON user_push_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_push_notifications_status ON push_notifications(status);
CREATE INDEX IF NOT EXISTS idx_push_notifications_created_by ON push_notifications(created_by);
CREATE INDEX IF NOT EXISTS idx_push_notifications_scheduled_for ON push_notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_push_notification_id ON push_notification_logs(push_notification_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_user_id ON push_notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_logs_status ON push_notification_logs(status);

-- Insert default segments
INSERT INTO push_notification_segments (name, description, filter_criteria, user_count) VALUES
  ('All Users', 'All registered users', '{"type": "all"}', 0),
  ('Active Users', 'Users with active payout plans', '{"type": "has_active_plans"}', 0),
  ('KYC Completed', 'Users who have completed KYC verification', '{"type": "kyc_approved"}', 0),
  ('New Users', 'Users who joined in the last 30 days', '{"type": "joined_recently", "days": 30}', 0),
  ('High Value Users', 'Users with total deposits over 10000', '{"type": "deposit_amount", "operator": ">=", "value": 10000}', 0)
ON CONFLICT DO NOTHING;