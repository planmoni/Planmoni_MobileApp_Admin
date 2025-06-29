/*
  # Create banners table for admin panel
  
  1. New Tables
    - `banners`
      - `id` (uuid, primary key)
      - `title` (text, not null)
      - `description` (text, nullable)
      - `image_url` (text, not null)
      - `cta_text` (text, nullable)
      - `link_url` (text, nullable)
      - `order_index` (integer, default 0)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on banners table
    - Add policies for admin management and public read access
  
  3. Triggers
    - Auto-update updated_at column on changes
*/

-- Create banners table if it doesn't exist
CREATE TABLE IF NOT EXISTS banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  cta_text text,
  link_url text,
  order_index integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create trigger to update updated_at column (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_banners_updated_at' 
    AND event_object_table = 'banners'
  ) THEN
    CREATE TRIGGER update_banners_updated_at
      BEFORE UPDATE ON banners
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow admins to manage banners" ON banners;
  DROP POLICY IF EXISTS "Allow public read access to banners" ON banners;
EXCEPTION
  WHEN undefined_object THEN
    -- Policy doesn't exist, continue
    NULL;
END $$;

-- Create policies
CREATE POLICY "Allow admins to manage banners"
  ON banners
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow public read access to banners"
  ON banners
  FOR SELECT
  TO public
  USING (true);

-- Create index for better performance on order_index and is_active
CREATE INDEX IF NOT EXISTS idx_banners_order_active ON banners(order_index, is_active);