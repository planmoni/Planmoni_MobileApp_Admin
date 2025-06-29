/*
  # Drop Banners Table
  
  1. Changes
    - Drop the banners table and all associated objects
    - Remove all policies related to the banners table
    - Remove any indexes on the banners table
  
  2. Security
    - Clean up all RLS policies before dropping the table
*/

-- Drop policies first to avoid dependency issues
DO $$
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Allow admins to manage banners" ON banners;
  DROP POLICY IF EXISTS "Allow public read access to banners" ON banners;
EXCEPTION
  WHEN undefined_object THEN
    -- Policy doesn't exist, continue
    NULL;
END $$;

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_banners_order_active;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS update_banners_updated_at ON banners;

-- Finally drop the table
DROP TABLE IF EXISTS banners;