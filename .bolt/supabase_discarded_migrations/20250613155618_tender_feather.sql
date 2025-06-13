/*
  # Create Super Admin System
  
  1. Create superadmin@planmoni.com user with Super Admin privileges
  2. Set up comprehensive role and permission system
  3. Grant rights to create roles and assign privileges to others
  
  This migration creates:
  - Super Admin user account
  - Role-based permission system
  - Audit logging
  - Functions for role management
*/

-- First, ensure the admin user exists and create superadmin@planmoni.com
DO $$
DECLARE
  super_admin_user_id uuid;
  super_admin_role_id uuid;
  super_admin_email text := 'superadmin@planmoni.com';
  super_admin_password text := '@SuperAdmin2024@@@';
  hashed_password text;
BEGIN
  -- Check if super admin user already exists
  SELECT id INTO super_admin_user_id 
  FROM auth.users 
  WHERE email = super_admin_email;
  
  -- If super admin user doesn't exist, create it
  IF super_admin_user_id IS NULL THEN
    -- Generate a new UUID for the super admin user
    super_admin_user_id := gen_random_uuid();
    
    -- Hash the password using crypt
    hashed_password := crypt(super_admin_password, gen_salt('bf'));
    
    -- Insert into auth.users
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role
    ) VALUES (
      super_admin_user_id,
      '00000000-0000-0000-0000-000000000000',
      super_admin_email,
      hashed_password,
      now(),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"first_name": "Super", "last_name": "Admin", "is_admin": true}'::jsonb,
      false,
      'authenticated'
    );
    
    RAISE NOTICE 'Created super admin user with ID: %', super_admin_user_id;
  ELSE
    RAISE NOTICE 'Super admin user already exists with ID: %', super_admin_user_id;
    
    -- Update existing user's metadata
    UPDATE auth.users
    SET 
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{is_admin}',
        'true'::jsonb
      ),
      updated_at = now()
    WHERE id = super_admin_user_id;
  END IF;
  
  -- Ensure profile exists for super admin user
  INSERT INTO profiles (id, first_name, last_name, email, is_admin, created_at, updated_at)
  VALUES (
    super_admin_user_id,
    'Super',
    'Admin',
    super_admin_email,
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    is_admin = true,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    updated_at = now();
  
  -- Ensure wallet exists for super admin user
  INSERT INTO wallets (user_id, balance, locked_balance, created_at, updated_at)
  VALUES (
    super_admin_user_id,
    0,
    0,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Get the Super Admin role ID (only if roles table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'roles') THEN
    SELECT id INTO super_admin_role_id 
    FROM roles 
    WHERE name = 'Super Admin';
    
    -- If Super Admin role exists, assign it to the super admin user
    IF super_admin_role_id IS NOT NULL THEN
      -- Insert the user role assignment
      INSERT INTO user_roles (user_id, role_id, assigned_by, is_active, assigned_at)
      VALUES (super_admin_user_id, super_admin_role_id, super_admin_user_id, true, now())
      ON CONFLICT (user_id, role_id) 
      DO UPDATE SET 
        is_active = true,
        assigned_at = now(),
        assigned_by = super_admin_user_id;
      
      -- Log the action (only if audit_logs table exists)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, created_at)
        VALUES (
          super_admin_user_id,
          'assign_super_admin_role',
          'user_roles',
          super_admin_user_id::text,
          jsonb_build_object('role_id', super_admin_role_id, 'auto_assigned', true),
          now()
        );
      END IF;
      
      RAISE NOTICE 'Super Admin role assigned to super admin user';
    ELSE
      RAISE NOTICE 'Super Admin role not found';
    END IF;
  ELSE
    RAISE NOTICE 'Roles table does not exist yet';
  END IF;
  
  RAISE NOTICE 'Super admin user setup completed successfully';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error setting up super admin user: %', SQLERRM;
    -- Don't re-raise the exception to allow migration to continue
END $$;

-- Create additional role management functions for super admin
CREATE OR REPLACE FUNCTION create_role_with_permissions(
  role_name text,
  role_description text,
  role_level integer,
  role_color text DEFAULT '#6B7280',
  permission_names text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  creator_id uuid := auth.uid();
  new_role_id uuid;
  permission_id uuid;
  permission_name text;
BEGIN
  -- Check if creator is super admin
  IF NOT is_super_admin(creator_id) THEN
    RAISE EXCEPTION 'Only super admins can create roles';
  END IF;
  
  -- Create the role
  INSERT INTO roles (name, description, level, color, is_system)
  VALUES (role_name, role_description, role_level, role_color, false)
  RETURNING id INTO new_role_id;
  
  -- Assign permissions to the role
  FOREACH permission_name IN ARRAY permission_names
  LOOP
    SELECT id INTO permission_id
    FROM permissions
    WHERE name = permission_name;
    
    IF permission_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id, granted_by)
      VALUES (new_role_id, permission_id, creator_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;
  
  -- Log the action
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    creator_id,
    'create_role',
    'roles',
    new_role_id::text,
    jsonb_build_object(
      'name', role_name,
      'description', role_description,
      'level', role_level,
      'permissions', permission_names
    )
  );
  
  RETURN new_role_id;
END;
$$;

-- Create function to modify role permissions
CREATE OR REPLACE FUNCTION modify_role_permissions(
  target_role_id uuid,
  add_permissions text[] DEFAULT '{}',
  remove_permissions text[] DEFAULT '{}'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  modifier_id uuid := auth.uid();
  permission_id uuid;
  permission_name text;
BEGIN
  -- Check if modifier is super admin
  IF NOT is_super_admin(modifier_id) THEN
    RAISE EXCEPTION 'Only super admins can modify role permissions';
  END IF;
  
  -- Add permissions
  FOREACH permission_name IN ARRAY add_permissions
  LOOP
    SELECT id INTO permission_id
    FROM permissions
    WHERE name = permission_name;
    
    IF permission_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id, granted_by)
      VALUES (target_role_id, permission_id, modifier_id)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END IF;
  END LOOP;
  
  -- Remove permissions
  FOREACH permission_name IN ARRAY remove_permissions
  LOOP
    SELECT id INTO permission_id
    FROM permissions
    WHERE name = permission_name;
    
    IF permission_id IS NOT NULL THEN
      DELETE FROM role_permissions
      WHERE role_id = target_role_id AND permission_id = permission_id;
    END IF;
  END LOOP;
  
  -- Log the action
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    modifier_id,
    'modify_role_permissions',
    'role_permissions',
    target_role_id::text,
    jsonb_build_object(
      'added_permissions', add_permissions,
      'removed_permissions', remove_permissions
    )
  );
  
  RETURN true;
END;
$$;

-- Create function to delete role (only non-system roles)
CREATE OR REPLACE FUNCTION delete_role(target_role_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleter_id uuid := auth.uid();
  role_is_system boolean;
  role_name text;
BEGIN
  -- Check if deleter is super admin
  IF NOT is_super_admin(deleter_id) THEN
    RAISE EXCEPTION 'Only super admins can delete roles';
  END IF;
  
  -- Check if role is system role
  SELECT is_system, name INTO role_is_system, role_name
  FROM roles
  WHERE id = target_role_id;
  
  IF role_is_system THEN
    RAISE EXCEPTION 'Cannot delete system role: %', role_name;
  END IF;
  
  -- Remove all user assignments for this role
  UPDATE user_roles
  SET is_active = false
  WHERE role_id = target_role_id;
  
  -- Remove all permissions for this role
  DELETE FROM role_permissions
  WHERE role_id = target_role_id;
  
  -- Delete the role
  DELETE FROM roles
  WHERE id = target_role_id;
  
  -- Log the action
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values)
  VALUES (
    deleter_id,
    'delete_role',
    'roles',
    target_role_id::text,
    jsonb_build_object('role_name', role_name)
  );
  
  RETURN true;
END;
$$;

-- Create function to bulk assign roles to users
CREATE OR REPLACE FUNCTION bulk_assign_roles(
  user_role_assignments jsonb -- Array of {user_id, role_id, expires_at}
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  assigner_id uuid := auth.uid();
  assignment jsonb;
  assignments_count integer := 0;
BEGIN
  -- Check if assigner is super admin
  IF NOT is_super_admin(assigner_id) THEN
    RAISE EXCEPTION 'Only super admins can bulk assign roles';
  END IF;
  
  -- Process each assignment
  FOR assignment IN SELECT * FROM jsonb_array_elements(user_role_assignments)
  LOOP
    -- Call the existing assign_user_role function
    PERFORM assign_user_role(
      (assignment->>'user_id')::uuid,
      (assignment->>'role_id')::uuid,
      CASE 
        WHEN assignment->>'expires_at' IS NOT NULL 
        THEN (assignment->>'expires_at')::timestamptz 
        ELSE NULL 
      END
    );
    
    assignments_count := assignments_count + 1;
  END LOOP;
  
  -- Log the bulk action
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    assigner_id,
    'bulk_assign_roles',
    'user_roles',
    'bulk_operation',
    jsonb_build_object(
      'assignments_count', assignments_count,
      'assignments', user_role_assignments
    )
  );
  
  RETURN assignments_count;
END;
$$;

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION create_role_with_permissions(text, text, integer, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION modify_role_permissions(uuid, text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_assign_roles(jsonb) TO authenticated;

-- Verify the super admin setup
DO $$
DECLARE
  super_admin_user_id uuid;
  is_super_admin_result boolean;
  profile_is_admin boolean;
BEGIN
  -- Get super admin user ID
  SELECT id INTO super_admin_user_id 
  FROM auth.users 
  WHERE email = 'superadmin@planmoni.com';
  
  IF super_admin_user_id IS NOT NULL THEN
    -- Check profile is_admin flag
    SELECT is_admin INTO profile_is_admin
    FROM profiles
    WHERE id = super_admin_user_id;
    
    -- Test the is_super_admin function
    SELECT is_super_admin(super_admin_user_id) INTO is_super_admin_result;
    
    RAISE NOTICE 'Super Admin user ID: %, profile is_admin: %, is_super_admin: %', 
      super_admin_user_id, profile_is_admin, is_super_admin_result;
  ELSE
    RAISE NOTICE 'Super Admin user not found after setup';
  END IF;
END $$;