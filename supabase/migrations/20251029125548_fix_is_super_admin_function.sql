/*
  # Fix is_super_admin Function to Use Only Role-Based Permissions

  1. Changes
    - Remove legacy `is_admin` profile column check from `is_super_admin` function
    - Only check if user has "Super Admin" role in user_roles table
    - This ensures the permission system works correctly and admins don't get automatic super admin access

  2. Security
    - Users must explicitly have the "Super Admin" role to be considered super admins
    - The `is_admin` column in profiles is now ignored for permission checks
    - This allows proper role-based access control
*/

-- Drop and recreate the is_super_admin function to remove legacy check
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  role_check boolean := false;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Return false if no authenticated user
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has "Super Admin" role in user_roles table
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = current_user_id
      AND r.name = 'Super Admin'
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) INTO role_check;
  
  RETURN role_check;
END;
$$;
