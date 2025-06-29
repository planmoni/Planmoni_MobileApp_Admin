-- Drop policies first to avoid dependency issues
DROP POLICY IF EXISTS "Allow admins to manage banners" ON banners;
DROP POLICY IF EXISTS "Allow public read access to banners" ON banners;

-- Drop index
DROP INDEX IF EXISTS idx_banners_order_active;

-- Drop trigger
DROP TRIGGER IF EXISTS update_banners_updated_at ON banners;

-- Drop the table
DROP TABLE IF EXISTS banners CASCADE;