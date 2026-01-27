/*
  # Create Sender Email Addresses Table
  
  1. New Table
    - `sender_email_addresses`
      - `id` (uuid, primary key)
      - `email` (text, unique) - The email address
      - `display_name` (text) - Display name for the sender
      - `is_default` (boolean) - Whether this is the default sender
      - `is_active` (boolean) - Whether this sender can be used
      - `description` (text, optional) - Description/purpose
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Only admins can manage sender emails
    - Add indexes for performance
  
  3. Default Data
    - Insert default email: hello@planmoni.com
*/

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
