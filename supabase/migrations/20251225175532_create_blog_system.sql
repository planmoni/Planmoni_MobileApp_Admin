/*
  # Create Blog System

  1. New Tables
    - `blog_posts`
      - `id` (uuid, primary key) - Auto-generated unique identifier
      - `title` (text) - Blog post title
      - `slug` (text, unique) - URL-friendly identifier
      - `excerpt` (text) - Short description for previews
      - `content` (text, nullable) - Full article content
      - `author` (text) - Author name
      - `category` (text) - Category name
      - `read_time` (text) - Estimated reading time
      - `featured` (boolean) - Whether post is featured
      - `tags` (text[]) - Array of tags
      - `image_path` (text, nullable) - Path to image in storage
      - `published` (boolean) - Publication status
      - `published_at` (timestamptz, nullable) - Publication timestamp
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Auto-updated timestamp
      - `created_by` (uuid, nullable) - Reference to auth.users

  2. Storage
    - Create `blog-images` bucket for blog post images
    - Public access enabled for reading
    - Authenticated users can upload/update/delete

  3. Security
    - Enable RLS on `blog_posts` table
    - Public can view published posts
    - Authenticated users (admins) can manage all posts
    - Storage policies for image management

  4. Indexes
    - Slug lookups
    - Published posts queries
    - Category filtering
    - Featured posts
    - Chronological ordering
    - Tag searches (GIN index)

  5. Functions
    - `get_blog_image_url()` - Generate full image URLs
    - Auto-update `updated_at` timestamp trigger

  6. Views
    - `blog_posts_with_images` - Automatically includes image URLs
*/

-- Create blog_posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT,
  author TEXT NOT NULL,
  category TEXT NOT NULL,
  read_time TEXT DEFAULT '5 min read',
  featured BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  image_path TEXT,
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON blog_posts(featured);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON blog_posts USING GIN(tags);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_update_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER trigger_update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_posts_updated_at();

-- Create function to generate blog image URLs
CREATE OR REPLACE FUNCTION get_blog_image_url(image_path TEXT)
RETURNS TEXT AS $$
BEGIN
  IF image_path IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN 'https://rqmpnoaavyizlwzfngpr.supabase.co/storage/v1/object/public/blog-images/' || image_path;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop and recreate view with image URLs
DROP VIEW IF EXISTS blog_posts_with_images;
CREATE VIEW blog_posts_with_images AS
SELECT
  *,
  get_blog_image_url(image_path) AS image_url
FROM blog_posts;

-- Enable RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view published blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Authenticated users can view all blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Authenticated users can create blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Authenticated users can update blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Authenticated users can delete blog posts" ON blog_posts;

-- RLS Policies for blog_posts

-- Public can view published posts
CREATE POLICY "Public can view published blog posts"
  ON blog_posts
  FOR SELECT
  USING (published = true);

-- Authenticated users can view all posts (for admin panel)
CREATE POLICY "Authenticated users can view all blog posts"
  ON blog_posts
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert posts
CREATE POLICY "Authenticated users can create blog posts"
  ON blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update posts
CREATE POLICY "Authenticated users can update blog posts"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Authenticated users can delete posts
CREATE POLICY "Authenticated users can delete blog posts"
  ON blog_posts
  FOR DELETE
  TO authenticated
  USING (true);

-- Create storage bucket for blog images
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Public can view blog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload blog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update blog images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete blog images" ON storage.objects;

-- Storage policies for blog-images bucket

-- Public can view images
CREATE POLICY "Public can view blog images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'blog-images');

-- Authenticated users can upload images
CREATE POLICY "Authenticated users can upload blog images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'blog-images');

-- Authenticated users can update images
CREATE POLICY "Authenticated users can update blog images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'blog-images')
  WITH CHECK (bucket_id = 'blog-images');

-- Authenticated users can delete images
CREATE POLICY "Authenticated users can delete blog images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'blog-images');
