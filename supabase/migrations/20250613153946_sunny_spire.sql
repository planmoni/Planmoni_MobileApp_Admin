/*
  # Assign Super Admin Role to Default Admin User
  
  This migration assigns the Super Admin role to the default admin user
  so they can access the Super Admin dashboard immediately.
*/

-- First, ensure the admin user exists and has is_admin flag set
DO $$
DECLARE
  admin_user_id uuid;
  super_admin_role_id uuid;
BEGIN
  -- Get the admin user ID
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@planmoni.com';
  
  -- Get the Super Admin role ID
  SELECT id INTO super_admin_role_id 
  FROM roles 
  WHERE name = 'Super Admin';
  
  -- If both exist, assign the role
  IF admin_user_id IS NOT NULL AND super_admin_role_id IS NOT NULL THEN
    -- Insert the user role assignment
    INSERT INTO user_roles (user_id, role_id, assigned_by, is_active)
    VALUES (admin_user_id, super_admin_role_id, admin_user_id, true)
    ON CONFLICT (user_id, role_id) 
    DO UPDATE SET 
      is_active = true,
      assigned_at = now();
    
    -- Ensure the profile has is_admin flag set
    UPDATE profiles 
    SET is_admin = true 
    WHERE id = admin_user_id;
    
    -- Log the action
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
    VALUES (
      admin_user_id,
      'assign_super_admin_role',
      'user_roles',
      admin_user_id::text,
      jsonb_build_object('role_id', super_admin_role_id, 'auto_assigned', true)
    );
    
    RAISE NOTICE 'Super Admin role assigned to admin@planmoni.com';
  ELSE
    RAISE NOTICE 'Admin user or Super Admin role not found';
  END IF;
END $$;