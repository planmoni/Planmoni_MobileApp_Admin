/*
  # Combined Migration: Sender Email Addresses
  Run this in your Supabase SQL Editor to create the sender_email_addresses table
  and add from_email_id to marketing_campaigns
*/

-- ============================================
-- Migration 1: Create Sender Email Addresses Table
-- ============================================

-- Create sender_email_addresses table
CREATE TABLE IF NOT EXISTS sender_email_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  description text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sender_emails_active ON sender_email_addresses(is_active);
CREATE INDEX IF NOT EXISTS idx_sender_emails_default ON sender_email_addresses(is_default);
CREATE INDEX IF NOT EXISTS idx_sender_emails_created_by ON sender_email_addresses(created_by);

-- Enable RLS
ALTER TABLE sender_email_addresses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can view all sender emails" ON sender_email_addresses;
DROP POLICY IF EXISTS "Admins can insert sender emails" ON sender_email_addresses;
DROP POLICY IF EXISTS "Admins can update sender emails" ON sender_email_addresses;
DROP POLICY IF EXISTS "Admins can delete sender emails" ON sender_email_addresses;
DROP POLICY IF EXISTS "Service role has full sender emails access" ON sender_email_addresses;

-- RLS Policies for sender_email_addresses
CREATE POLICY "Admins can view all sender emails"
  ON sender_email_addresses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert sender emails"
  ON sender_email_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update sender emails"
  ON sender_email_addresses
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

CREATE POLICY "Admins can delete sender emails"
  ON sender_email_addresses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Service role policy
CREATE POLICY "Service role has full sender emails access"
  ON sender_email_addresses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to ensure only one default email at a time
CREATE OR REPLACE FUNCTION ensure_single_default_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset all other default emails
    UPDATE sender_email_addresses
    SET is_default = false
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_ensure_single_default_email ON sender_email_addresses;

-- Trigger to enforce single default email
CREATE TRIGGER trigger_ensure_single_default_email
  BEFORE INSERT OR UPDATE ON sender_email_addresses
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_email();

-- Insert default email address
INSERT INTO sender_email_addresses (email, display_name, is_default, is_active, description)
VALUES (
  'hello@planmoni.com',
  'Martins Osodi - Planmoni CEO',
  true,
  true,
  'Default sender email for marketing campaigns'
)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- Migration 2: Add From Email ID to Marketing Campaigns
-- ============================================

-- Add from_email_id column
ALTER TABLE marketing_campaigns
ADD COLUMN IF NOT EXISTS from_email_id uuid REFERENCES sender_email_addresses(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_from_email_id ON marketing_campaigns(from_email_id);

-- Set default from_email_id for existing campaigns
UPDATE marketing_campaigns
SET from_email_id = (
  SELECT id FROM sender_email_addresses WHERE is_default = true LIMIT 1
)
WHERE from_email_id IS NULL;
