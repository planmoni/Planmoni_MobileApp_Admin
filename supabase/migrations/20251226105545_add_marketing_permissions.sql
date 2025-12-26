/*
  # Add Marketing Permissions

  1. New Permission Category
    - Creates "Marketing" category for marketing campaign permissions

  2. New Permissions
    - `marketing.view` - View marketing campaigns page
    - `marketing.campaigns.list` - View campaigns list
    - `marketing.campaigns.create` - Create new campaigns
    - `marketing.campaigns.edit` - Edit existing campaigns
    - `marketing.campaigns.delete` - Delete campaigns
    - `marketing.campaigns.send` - Send campaigns to users
    - `marketing.segments.manage` - Manage campaign segments
    - `marketing.stats` - View marketing statistics

  3. Notes
    - All permissions are system permissions
    - Permissions follow existing naming conventions
*/

-- Create Marketing permission category
INSERT INTO permission_categories (id, name, description, sort_order)
VALUES (
  'a3c8e12f-9d4b-4e1a-b5f2-8c7d3a1e9b6f',
  'Marketing',
  'Marketing campaigns and email management',
  0
) ON CONFLICT (id) DO NOTHING;

-- Create Marketing permissions
INSERT INTO permissions (id, name, description, category_id, resource, action, is_system)
VALUES
  (
    'b1f4a7e9-2c5d-4b8a-9f3e-6d1c8b4e7a2f',
    'marketing.view',
    'View marketing campaigns page',
    'a3c8e12f-9d4b-4e1a-b5f2-8c7d3a1e9b6f',
    'marketing',
    'view',
    true
  ),
  (
    'c2e5b8f1-3d6a-4c9b-8e4f-7a2d9c5e8b3f',
    'marketing.campaigns.list',
    'View campaigns list',
    'a3c8e12f-9d4b-4e1a-b5f2-8c7d3a1e9b6f',
    'marketing',
    'campaigns.list',
    true
  ),
  (
    'd3f6c9e2-4a7b-4d8c-9f5e-8b3a1d6c9e4f',
    'marketing.campaigns.create',
    'Create new campaigns',
    'a3c8e12f-9d4b-4e1a-b5f2-8c7d3a1e9b6f',
    'marketing',
    'campaigns.create',
    true
  ),
  (
    'e4a7d1f3-5b8c-4e9d-8f6a-9c4b2e7d1f5a',
    'marketing.campaigns.edit',
    'Edit existing campaigns',
    'a3c8e12f-9d4b-4e1a-b5f2-8c7d3a1e9b6f',
    'marketing',
    'campaigns.edit',
    true
  ),
  (
    'f5b8e2a4-6c9d-4f1e-9a7b-1d5c3e8a2f6b',
    'marketing.campaigns.delete',
    'Delete campaigns',
    'a3c8e12f-9d4b-4e1a-b5f2-8c7d3a1e9b6f',
    'marketing',
    'campaigns.delete',
    true
  ),
  (
    'a6c9f3b5-7d1e-4a2f-8b8c-2e6d4f9b3a7c',
    'marketing.campaigns.send',
    'Send campaigns to users',
    'a3c8e12f-9d4b-4e1a-b5f2-8c7d3a1e9b6f',
    'marketing',
    'campaigns.send',
    true
  ),
  (
    'b7d1a4c6-8e2f-4b3a-9c9d-3f7e5a1c4b8d',
    'marketing.segments.manage',
    'Manage campaign segments',
    'a3c8e12f-9d4b-4e1a-b5f2-8c7d3a1e9b6f',
    'marketing',
    'segments.manage',
    true
  ),
  (
    'c8e2b5d7-9f3a-4c4b-8d1e-4a8f6b2d5c9e',
    'marketing.stats',
    'View marketing statistics',
    'a3c8e12f-9d4b-4e1a-b5f2-8c7d3a1e9b6f',
    'marketing',
    'stats',
    true
  )
ON CONFLICT (id) DO NOTHING;