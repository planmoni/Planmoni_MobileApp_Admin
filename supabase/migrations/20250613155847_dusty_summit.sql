/*
  # Fix is_super_admin function conflict

  1. Problem
    - Multiple `is_super_admin` functions exist causing ambiguity
    - Database cannot choose between `public.is_super_admin()` and `public.is_super_admin(user_id => uuid)`
    - Frontend calls fail with PGRST203 error

  2. Solution
    - Drop all existing `is_super_admin` functions
    - Create a single, unambiguous `is_super_admin()` function that uses `auth.uid()`
    - Ensure the function works for the current authenticated user

  3. Security
    - Function checks if current user has super admin privileges
    - Uses proper authentication context
*/

-- Drop any existing is_super_admin functions to resolve conflicts
DROP FUNCTION IF EXISTS public.is_super_admin();
DROP FUNCTION IF EXISTS public.is_super_admin(uuid);
DROP FUNCTION IF EXISTS public.is_super_admin(user_id uuid);

-- Create a single, unambiguous is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_is_super_admin boolean := false;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Return false if no authenticated user
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has super admin role
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = current_user_id
      AND r.name = 'Super Admin'
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) INTO user_is_super_admin;
  
  -- Also check the legacy is_admin column as fallback
  IF NOT user_is_super_admin THEN
    SELECT COALESCE(p.is_admin, false)
    FROM profiles p
    WHERE p.id = current_user_id
    INTO user_is_super_admin;
  END IF;
  
  RETURN user_is_super_admin;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.is_super_admin() IS 'Checks if the current authenticated user has super admin privileges';