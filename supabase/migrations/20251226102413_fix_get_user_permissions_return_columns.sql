/*
  # Fix get_user_permissions Function Return Columns
  
  ## Problem
  The get_user_permissions function returns columns with names that don't match
  what the frontend PermissionsContext expects:
  - Returns: permission_name, permission_description, resource, action, category_name, role_name
  - Expected: id, name, resource, action, description
  
  This mismatch causes permission checks to fail, allowing users to access
  pages and menus even when they don't have the required permissions.
  
  ## Solution
  Update the get_user_permissions function to return the correct column names
  that match the Permission interface in the frontend.
  
  ## Changes
  - Add 'id' column (permission ID)
  - Rename 'permission_name' to 'name'
  - Rename 'permission_description' to 'description'
  - Keep resource and action as-is
  - Remove category_name and role_name (not needed by frontend)
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS get_user_permissions(uuid);

-- Recreate the function with correct column names
CREATE OR REPLACE FUNCTION get_user_permissions(target_user_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  resource text,
  action text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT
    p.id,
    p.name,
    p.description,
    p.resource,
    p.action
  FROM user_roles ur
  JOIN role_permissions rp ON ur.role_id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE ur.user_id = target_user_id
  AND ur.is_active = true
  AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ORDER BY p.resource, p.action;
$$;

-- Re-grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_permissions(uuid) TO authenticated;