/*
  # Admin System Setup
  
  1. New Features
    - Add is_admin column to profiles table
    - Create admin tables for additional settings
    - Create is_admin function for permission checks
  
  2. Security
    - Enable RLS on new tables
*/

-- Add is_admin column to profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Update the admin user's profile to set is_admin flag
UPDATE profiles
SET is_admin = true
WHERE email = 'admin@planmoni.com';

-- Create admin table for additional admin settings with SERIAL instead of IDENTITY
CREATE TABLE IF NOT EXISTS admin (
  id SERIAL PRIMARY KEY,
  is_admin boolean NOT NULL
);

-- Create is_admin table for record-level admin permissions with SERIAL instead of IDENTITY
CREATE TABLE IF NOT EXISTS is_admin (
  id SERIAL PRIMARY KEY,
  table_name text NOT NULL,
  record_id bigint NOT NULL,
  is_admin boolean DEFAULT false NOT NULL
);

-- Enable RLS on new tables
ALTER TABLE admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE is_admin ENABLE ROW LEVEL SECURITY;

-- Update the is_admin() function to check the profiles table
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  );
$$;

-- Insert sample data into admin table without specifying id (let SERIAL handle it)
INSERT INTO admin (is_admin)
VALUES (true);

-- Insert sample data into is_admin table without specifying id (let SERIAL handle it)
INSERT INTO is_admin (table_name, record_id, is_admin)
VALUES 
  ('profiles', 1, true),
  ('transactions', 1, true);