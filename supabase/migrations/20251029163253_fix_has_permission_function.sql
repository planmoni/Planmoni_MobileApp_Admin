/*
  # Fix has_permission function

  1. Changes
    - Update has_permission function to correctly call is_super_admin() without parameters
    - The is_super_admin() function doesn't accept parameters, so we need to handle it differently
    - When checking for a specific user_id, we need to compare it with auth.uid() first
    
  2. Security
    - Maintains security by properly checking user permissions
    - Super admins still have full access
*/

-- Drop and recreate the has_permission function
CREATE OR REPLACE FUNCTION has_permission(permission_name text, user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user_id uuid;
  has_perm boolean;
BEGIN
  -- Determine the target user ID
  target_user_id := COALESCE(user_id, auth.uid());
  
  -- If no user ID, return false
  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- If checking for current user and they are super admin, return true
  IF (user_id IS NULL OR user_id = auth.uid()) AND is_super_admin() THEN
    RETURN true;
  END IF;
  
  -- If checking for a different user, check if current user is super admin
  IF user_id IS NOT NULL AND user_id != auth.uid() THEN
    IF is_super_admin() THEN
      -- Super admin checking another user's permissions
      SELECT EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = target_user_id
        AND p.name = permission_name
        AND ur.is_active = true
        AND (ur.expires_at IS NULL OR ur.expires_at > now())
      ) INTO has_perm;
      RETURN has_perm;
    ELSE
      -- Non-super admin cannot check other users' permissions
      RETURN false;
    END IF;
  END IF;
  
  -- Check if user has the permission through their roles
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = target_user_id
    AND p.name = permission_name
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) INTO has_perm;
  
  RETURN has_perm;
END;
$$;
