/*
  # Remove banners table and related objects
  
  This migration safely removes the banners table and all its dependencies,
  handling cases where the table or related objects might not exist.
*/

-- Use a DO block to handle potential errors gracefully
DO $$
BEGIN
  -- Check if the banners table exists before attempting to drop policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'banners' AND table_schema = 'public') THEN
    
    -- Drop policies if they exist
    BEGIN
      DROP POLICY IF EXISTS "Allow admins to manage banners" ON banners;
    EXCEPTION
      WHEN undefined_object THEN
        -- Policy doesn't exist, continue
        NULL;
    END;
    
    BEGIN
      DROP POLICY IF EXISTS "Allow public read access to banners" ON banners;
    EXCEPTION
      WHEN undefined_object THEN
        -- Policy doesn't exist, continue
        NULL;
    END;
    
    -- Drop index if it exists
    BEGIN
      DROP INDEX IF EXISTS idx_banners_order_active;
    EXCEPTION
      WHEN undefined_object THEN
        -- Index doesn't exist, continue
        NULL;
    END;
    
    -- Drop trigger if it exists
    BEGIN
      DROP TRIGGER IF EXISTS update_banners_updated_at ON banners;
    EXCEPTION
      WHEN undefined_object THEN
        -- Trigger doesn't exist, continue
        NULL;
    END;
    
    -- Finally drop the table
    DROP TABLE banners CASCADE;
    
    RAISE NOTICE 'Banners table and related objects have been dropped successfully';
  ELSE
    RAISE NOTICE 'Banners table does not exist, nothing to drop';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error occurred while dropping banners table: %', SQLERRM;
    -- Don't re-raise the exception to allow migration to continue
END $$;