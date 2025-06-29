/*
  # Create banners table for admin banner management
  
  1. New Tables
    - `banners`
      - `id` (uuid, primary key)
      - `title` (text, required - will use filename)
      - `description` (text, nullable)
      - `image_url` (text, required)
      - `cta_text` (text, nullable)
      - `link_url` (text, nullable)
      - `order_index` (integer, default 0)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on banners table
    - Add policies for admin management and public read access
  
  3. Indexes
    - Add index for order_index and is_active for better performance
*/

-- Create banners table
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

-- Enable RLS
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Create policies for banner management
CREATE POLICY "Admins can manage banners"
  ON banners
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Public can read active banners"
  ON banners
  FOR SELECT
  TO public
  USING (is_active = true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_banners_order_active ON banners(order_index, is_active);

-- Create trigger to update updated_at column
CREATE TRIGGER update_banners_updated_at
  BEFORE UPDATE ON banners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();