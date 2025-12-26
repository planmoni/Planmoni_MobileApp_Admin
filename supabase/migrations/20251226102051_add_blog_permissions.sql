/*
  # Add Blog Permissions
  
  ## Purpose
  Add permissions for the Blog Management feature to allow admins to manage blog posts, categories, and authors.
  
  ## New Permissions
  
  **Blog Permissions:**
  - blog.view - View blog management page
  - blog.create - Create new blog posts
  - blog.update - Edit existing blog posts
  - blog.delete - Delete blog posts
  - blog.publish - Publish and unpublish blog posts
  - blog.categories - Manage blog categories
  - blog.authors - Manage blog authors
  - blog.featured - Manage featured posts
  
  ## Implementation
  - Create Blog permission category
  - Insert blog permissions with descriptions
*/

-- Create Blog permission category
INSERT INTO permission_categories (id, name, description) VALUES
  (gen_random_uuid(), 'Blog', 'Blog content management')
ON CONFLICT DO NOTHING;

-- Insert blog permissions
INSERT INTO permissions (name, description, category_id, resource, action, is_system) 
SELECT 
  perm.name,
  perm.description,
  (SELECT id FROM permission_categories WHERE name = 'Blog'),
  perm.resource,
  perm.action,
  true
FROM (VALUES
  ('blog.view', 'View blog management page', 'blog', 'view'),
  ('blog.create', 'Create new blog posts', 'blog', 'create'),
  ('blog.update', 'Edit existing blog posts', 'blog', 'update'),
  ('blog.delete', 'Delete blog posts', 'blog', 'delete'),
  ('blog.publish', 'Publish and unpublish blog posts', 'blog', 'publish'),
  ('blog.categories', 'Manage blog categories', 'blog', 'categories'),
  ('blog.authors', 'Manage blog authors', 'blog', 'authors'),
  ('blog.featured', 'Manage featured posts', 'blog', 'featured')
) AS perm(name, description, resource, action)
ON CONFLICT (name) DO NOTHING;