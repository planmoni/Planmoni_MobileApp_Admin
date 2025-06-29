/*
  # Create banners table with proper error handling
  
  1. New Tables
    - `banners` - Stores banner information for the application
      - `id` (uuid, primary key)
      - `title` (text, required)
      - `description` (text, optional)
      - `image_url` (text, required)
      - `cta_text` (text, optional)
      - `link_url` (text, optional)
      - `order_index` (integer, for ordering)
      - `is_active` (boolean, for visibility)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on banners table
    - Add policies for public read access and admin management
  
  3. Indexes and Triggers
    - Add index for efficient querying
    - Add trigger for automatic updated_at updates
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

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Public can read active banners" ON public.banners;
  DROP POLICY IF EXISTS "Admins can manage banners" ON public.banners;
  DROP POLICY IF EXISTS "Allow public read access to banners" ON public.banners;
  DROP POLICY IF EXISTS "Allow admins to manage banners" ON public.banners;
END $$;

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

-- Create trigger for updated_at (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'update_banners_updated_at' 
    AND event_object_table = 'banners'
  ) THEN
    CREATE TRIGGER update_banners_updated_at
      BEFORE UPDATE ON public.banners
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;