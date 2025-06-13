/*
  # Assign Super Admin Role to Existing User
  
  1. Updates
    - Find the existing superadmin@planmoni.com user
    - Assign Super Admin role and permissions
    - Update profile with admin flag
    - Create audit log entry
  
  2. Security
    - Ensures proper role assignment
    - Maintains audit trail
*/

-- Assign Super Admin role to the existing superadmin@planmoni.com user
DO $$
DECLARE
  super_admin_user_id uuid;
  super_admin_role_id uuid;
  admin_email text := 'superadmin@planmoni.com';
BEGIN
  -- Get the existing super admin user ID
  SELECT id INTO super_admin_user_id 
  FROM auth.users 
  WHERE email = admin_email;
  
  -- Get the Super Admin role ID
  SELECT id INTO super_admin_role_id 
  FROM roles 
  WHERE name = 'Super Admin';
  
  -- If both exist, assign the role
  IF super_admin_user_id IS NOT NULL AND super_admin_role_id IS NOT NULL THEN
    -- Ensure profile exists for super admin user
    INSERT INTO profiles (id, first_name, last_name, email, is_admin, created_at, updated_at)
    VALUES (
      super_admin_user_id,
      'Super',
      'Admin',
      admin_email,
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
    
    -- Insert the user role assignment
    INSERT INTO user_roles (user_id, role_id, assigned_by, is_active, assigned_at)
    VALUES (super_admin_user_id, super_admin_role_id, super_admin_user_id, true, now())
    ON CONFLICT (user_id, role_id) 
    DO UPDATE SET 
      is_active = true,
      assigned_at = now(),
      assigned_by = super_admin_user_id;
    
    -- Update auth.users metadata to ensure is_admin flag is set
    UPDATE auth.users
    SET 
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{is_admin}',
        'true'::jsonb
      ),
      updated_at = now()
    WHERE id = super_admin_user_id;
    
    -- Log the action
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, created_at)
    VALUES (
      super_admin_user_id,
      'assign_super_admin_role',
      'user_roles',
      super_admin_user_id::text,
      jsonb_build_object('role_id', super_admin_role_id, 'auto_assigned', true),
      now()
    );
    
    RAISE NOTICE 'Super Admin role assigned to superadmin@planmoni.com';
  ELSE
    IF super_admin_user_id IS NULL THEN
      RAISE NOTICE 'Super admin user not found: %', admin_email;
    END IF;
    IF super_admin_role_id IS NULL THEN
      RAISE NOTICE 'Super Admin role not found';
    END IF;
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error assigning super admin role: %', SQLERRM;
END $$;

-- Verify the assignment
DO $$
DECLARE
  super_admin_user_id uuid;
  is_super_admin_result boolean;
  profile_is_admin boolean;
  role_count integer;
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
    
    -- Count assigned roles
    SELECT COUNT(*) INTO role_count
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = super_admin_user_id
    AND ur.is_active = true;
    
    -- Test the is_super_admin function
    SELECT is_super_admin(super_admin_user_id) INTO is_super_admin_result;
    
    RAISE NOTICE 'Super Admin Setup Complete:';
    RAISE NOTICE '  User ID: %', super_admin_user_id;
    RAISE NOTICE '  Profile is_admin: %', profile_is_admin;
    RAISE NOTICE '  Active roles: %', role_count;
    RAISE NOTICE '  is_super_admin(): %', is_super_admin_result;
  ELSE
    RAISE NOTICE 'Super admin user not found: superadmin@planmoni.com';
  END IF;
END $$;