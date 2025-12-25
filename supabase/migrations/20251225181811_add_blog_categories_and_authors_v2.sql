/*
  # Add Blog Categories and Authors System

  1. New Tables
    - `blog_categories`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null) - Category name
      - `slug` (text, unique, not null) - URL-friendly slug
      - `description` (text, nullable) - Optional category description
      - `created_at` (timestamptz, default now())
      - `created_by` (uuid, references auth.users)
    
    - `blog_authors`
      - `id` (uuid, primary key)
      - `name` (text, not null) - Author's display name
      - `email` (text, unique, nullable) - Author's email
      - `bio` (text, nullable) - Author biography
      - `avatar_url` (text, nullable) - Author profile picture URL
      - `created_at` (timestamptz, default now())
      - `created_by` (uuid, references auth.users)

  2. Changes
    - Add `author_id` to `blog_posts` table (references blog_authors)
    - Remove `read_time` column from `blog_posts` (will be calculated dynamically)
    - Remove `author` text column from `blog_posts` (replaced by author_id)
    - Drop and recreate view `blog_posts_with_images` without read_time and author

  3. Security
    - Enable RLS on new tables
    - Public read access for published content
    - Admin-only write access
*/

-- Create blog_categories table
CREATE TABLE IF NOT EXISTS blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create blog_authors table
CREATE TABLE IF NOT EXISTS blog_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  bio text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Drop the view that depends on read_time and author columns
DROP VIEW IF EXISTS blog_posts_with_images;

-- Add author_id to blog_posts if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blog_posts' AND column_name = 'author_id'
  ) THEN
    ALTER TABLE blog_posts ADD COLUMN author_id uuid REFERENCES blog_authors(id);
  END IF;
END $$;

-- Drop read_time column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blog_posts' AND column_name = 'read_time'
  ) THEN
    ALTER TABLE blog_posts DROP COLUMN read_time;
  END IF;
END $$;

-- Drop author column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'blog_posts' AND column_name = 'author'
  ) THEN
    ALTER TABLE blog_posts DROP COLUMN author;
  END IF;
END $$;

-- Recreate the view without read_time and author
CREATE OR REPLACE VIEW blog_posts_with_images AS
SELECT 
  id,
  title,
  slug,
  excerpt,
  content,
  author_id,
  category,
  featured,
  tags,
  image_path,
  published,
  published_at,
  created_at,
  updated_at,
  created_by,
  get_blog_image_url(image_path) AS image_url
FROM blog_posts;

-- Enable RLS
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_authors ENABLE ROW LEVEL SECURITY;

-- Blog Categories Policies
CREATE POLICY "Anyone can view categories"
  ON blog_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON blog_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update categories"
  ON blog_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete categories"
  ON blog_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Blog Authors Policies
CREATE POLICY "Anyone can view authors"
  ON blog_authors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert authors"
  ON blog_authors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update authors"
  ON blog_authors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete authors"
  ON blog_authors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_blog_categories_slug ON blog_categories(slug);
CREATE INDEX IF NOT EXISTS idx_blog_authors_email ON blog_authors(email);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id);
