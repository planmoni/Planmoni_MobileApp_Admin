/*
  # Add Notifications Permissions
  
  ## Purpose
  Add permissions for the new Notifications feature to allow admins to manage push notifications.
  
  ## New Permissions
  
  **Notifications Permissions:**
  - notifications.view - View notifications page
  - notifications.create - Create new push notifications
  - notifications.send - Send push notifications
  - notifications.history - View notification history and logs
  - notifications.segments - Manage notification segments
  
  ## Implementation
  - Create Notifications permission category
  - Insert notification permissions
  - Link permissions to relevant admin roles
*/

-- Create Notifications permission category
INSERT INTO permission_categories (id, name, description) VALUES
  (gen_random_uuid(), 'Notifications', 'Push notifications management')
ON CONFLICT DO NOTHING;

-- Insert notification permissions
INSERT INTO permissions (name, description, category_id, resource, action, is_system) 
SELECT 
  perm.name,
  perm.description,
  (SELECT id FROM permission_categories WHERE name = 'Notifications'),
  perm.resource,
  perm.action,
  true
FROM (VALUES
  ('notifications.view', 'View notifications page', 'notifications', 'view'),
  ('notifications.create', 'Create new push notifications', 'notifications', 'create'),
  ('notifications.send', 'Send push notifications to users', 'notifications', 'send'),
  ('notifications.history', 'View notification history and logs', 'notifications', 'history'),
  ('notifications.segments', 'Manage notification segments', 'notifications', 'segments')
) AS perm(name, description, resource, action)
ON CONFLICT (name) DO NOTHING;