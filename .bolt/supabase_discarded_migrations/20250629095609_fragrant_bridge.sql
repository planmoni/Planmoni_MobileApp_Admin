/*
  # Create banners table
  
  1. New Tables
    - banners
      - id (uuid)
      - title (text)
      - description (text, nullable)
      - image_url (text)
      - cta_text (text, nullable)
      - link_url (text, nullable)
      - order_index (integer)
      - is_active (boolean)
      - created_at (timestamptz)
      - updated_at (timestamptz)
  
  2. Security
    - Enable RLS
    - Add policies for admins to manage banners
    - Add policies for public to read active banners
*/

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

-- Create trigger to update updated_at column
DROP TRIGGER IF EXISTS update_banners_updated_at ON banners;
CREATE TRIGGER update_banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

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