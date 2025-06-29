/*
  # Create Banners Table with Proper Error Handling
  
  1. New Tables
    - banners - Stores promotional banner information
      - id (uuid, primary key)
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
    - Add policies for public read access and admin management
    - Create index for better performance
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
  -- Try to drop policies with different possible names to handle all cases
  DROP POLICY IF EXISTS "Public can read active banners" ON public.banners;
  DROP POLICY IF EXISTS "Admins can manage banners" ON public.banners;
EXCEPTION
  WHEN undefined_object THEN
    -- Policy doesn't exist, continue
    NULL;
END $$;

-- Create RLS policies with proper error handling
DO $$
BEGIN
  -- Create public read policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'banners' 
    AND policyname = 'Public can read active banners'
  ) THEN
    CREATE POLICY "Public can read active banners"
      ON public.banners
      FOR SELECT
      TO public
      USING (is_active = true);
  END IF;
  
  -- Create admin management policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'banners' 
    AND policyname = 'Admins can manage banners'
  ) THEN
    CREATE POLICY "Admins can manage banners"
      ON public.banners
      FOR ALL
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END $$;

-- Create trigger for updated_at if it doesn't exist
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