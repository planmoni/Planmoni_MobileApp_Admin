/*
  # Create banners table

  1. New Tables
    - `banners`
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `description` (text, optional)
      - `image_url` (text, required)
      - `cta_text` (text, optional)
      - `link_url` (text, optional)
      - `order_index` (integer, default 0)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `banners` table
    - Add policy for public read access to active banners
    - Add policy for admins to manage all banners

  3. Indexes
    - Create index on order_index and is_active for efficient querying

  4. Triggers
    - Add trigger to automatically update updated_at timestamp
*/

-- Create the banners table
CREATE TABLE IF NOT EXISTS public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  cta_text text,
  link_url text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_banners_order_active 
ON public.banners USING btree (order_index, is_active);

-- Create RLS policies
CREATE POLICY "Public can read active banners"
  ON public.banners
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage banners"
  ON public.banners
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create trigger for updated_at
CREATE TRIGGER update_banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();