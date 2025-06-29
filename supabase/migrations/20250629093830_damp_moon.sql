/*
  # Fix Super Admin Function and Role Assignment
  
  1. Problem Analysis
    - The is_super_admin() function is returning false even though profile.is_admin is true
    - Need to check if the user has the Super Admin role assigned
    - Need to ensure the function works correctly
  
  2. Solution
    - Fix the is_super_admin() function
    - Ensure Super Admin role is properly assigned to superadmin@planmoni.com
    - Add debugging to understand what's happening
*/

-- First, let's check what's in the user_roles table for our user
DO $$
DECLARE
  super_admin_user_id uuid;
  super_admin_role_id uuid;
  role_assignment_count integer;
BEGIN
  -- Get the super admin user ID
  SELECT id INTO super_admin_user_id 
  FROM auth.users 
  WHERE email = 'superadmin@planmoni.com';
  
  -- Get the Super Admin role ID
  SELECT id INTO super_admin_role_id 
  FROM roles 
  WHERE name = 'Super Admin';
  
  RAISE NOTICE 'Super Admin User ID: %', super_admin_user_id;
  RAISE NOTICE 'Super Admin Role ID: %', super_admin_role_id;
  
  -- Check if role assignment exists
  SELECT COUNT(*) INTO role_assignment_count
  FROM user_roles
  WHERE user_id = super_admin_user_id
  AND role_id = super_admin_role_id
  AND is_active = true;
  
  RAISE NOTICE 'Active role assignments: %', role_assignment_count;
  
  -- If both exist but no assignment, create it
  IF super_admin_user_id IS NOT NULL AND super_admin_role_id IS NOT NULL AND role_assignment_count = 0 THEN
    INSERT INTO user_roles (user_id, role_id, assigned_by, is_active, assigned_at)
    VALUES (super_admin_user_id, super_admin_role_id, super_admin_user_id, true, now())
    ON CONFLICT (user_id, role_id) 
    DO UPDATE SET 
      is_active = true,
      assigned_at = now();
    
    RAISE NOTICE 'Super Admin role assigned successfully';
  ELSIF role_assignment_count > 0 THEN
    RAISE NOTICE 'Role assignment already exists';
  END IF;
END $$;

-- Now let's create a more robust is_super_admin function
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  user_is_super_admin boolean := false;
  role_check boolean := false;
  profile_check boolean := false;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Return false if no authenticated user
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has super admin role in user_roles table
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = current_user_id
      AND r.name = 'Super Admin'
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) INTO role_check;
  
  -- Check the legacy is_admin column in profiles
  SELECT COALESCE(p.is_admin, false)
  FROM profiles p
  WHERE p.id = current_user_id
  INTO profile_check;
  
  -- User is super admin if either check passes
  user_is_super_admin := role_check OR profile_check;
  
  -- Log for debugging (remove in production)
  RAISE NOTICE 'is_super_admin debug - user_id: %, role_check: %, profile_check: %, result: %', 
    current_user_id, role_check, profile_check, user_is_super_admin;
  
  RETURN user_is_super_admin;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Test the function for our super admin user
DO $$
DECLARE
  super_admin_user_id uuid;
  test_result boolean;
BEGIN
  -- Get the super admin user ID
  SELECT id INTO super_admin_user_id 
  FROM auth.users 
  WHERE email = 'superadmin@planmoni.com';
  
  IF super_admin_user_id IS NOT NULL THEN
    -- We can't directly test with auth.uid() in a migration, but we can check the logic
    RAISE NOTICE 'Super admin user found: %', super_admin_user_id;
    
    -- Check if they have the role
    SELECT EXISTS (
      SELECT 1 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = super_admin_user_id
        AND r.name = 'Super Admin'
        AND ur.is_active = true
    ) INTO test_result;
    
    RAISE NOTICE 'Has Super Admin role: %', test_result;
    
    -- Check profile is_admin
    SELECT COALESCE(p.is_admin, false)
    FROM profiles p
    WHERE p.id = super_admin_user_id
    INTO test_result;
    
    RAISE NOTICE 'Profile is_admin: %', test_result;
  END IF;
END $$;