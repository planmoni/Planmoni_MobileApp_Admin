-- First, ensure the is_super_admin function exists with both signatures
CREATE OR REPLACE FUNCTION is_super_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = COALESCE(user_id, auth.uid())
    AND r.name = 'Super Admin'
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) OR EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = COALESCE(user_id, auth.uid())
    AND p.is_admin = true
  );
$$;

-- Create overloaded function without parameters
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT is_super_admin(auth.uid());
$$;

-- Grant execute permissions on both function signatures
GRANT EXECUTE ON FUNCTION is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

-- Now create the admin user
DO $$
DECLARE
  admin_user_id uuid;
  super_admin_role_id uuid;
  admin_email text := 'admin@planmoni.com';
  admin_password text := '@Osdi20mart@@@';
  hashed_password text;
BEGIN
  -- Check if admin user already exists
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = admin_email;
  
  -- If admin user doesn't exist, create it
  IF admin_user_id IS NULL THEN
    -- Generate a new UUID for the admin user
    admin_user_id := gen_random_uuid();
    
    -- Hash the password using crypt
    hashed_password := crypt(admin_password, gen_salt('bf'));
    
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
      admin_user_id,
      '00000000-0000-0000-0000-000000000000',
      admin_email,
      hashed_password,
      now(),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"first_name": "Admin", "last_name": "User", "is_admin": true}'::jsonb,
      false,
      'authenticated'
    );
    
    RAISE NOTICE 'Created admin user with ID: %', admin_user_id;
  ELSE
    RAISE NOTICE 'Admin user already exists with ID: %', admin_user_id;
    
    -- Update existing user's metadata
    UPDATE auth.users
    SET 
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{is_admin}',
        'true'::jsonb
      ),
      updated_at = now()
    WHERE id = admin_user_id;
  END IF;
  
  -- Ensure profile exists for admin user
  INSERT INTO profiles (id, first_name, last_name, email, is_admin, created_at, updated_at)
  VALUES (
    admin_user_id,
    'Admin',
    'User',
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
  
  -- Ensure wallet exists for admin user
  INSERT INTO wallets (user_id, balance, locked_balance, created_at, updated_at)
  VALUES (
    admin_user_id,
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
    
    -- If Super Admin role exists, assign it to the admin user
    IF super_admin_role_id IS NOT NULL THEN
      -- Insert the user role assignment
      INSERT INTO user_roles (user_id, role_id, assigned_by, is_active, assigned_at)
      VALUES (admin_user_id, super_admin_role_id, admin_user_id, true, now())
      ON CONFLICT (user_id, role_id) 
      DO UPDATE SET 
        is_active = true,
        assigned_at = now(),
        assigned_by = admin_user_id;
      
      -- Log the action (only if audit_logs table exists)
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, created_at)
        VALUES (
          admin_user_id,
          'assign_super_admin_role',
          'user_roles',
          admin_user_id::text,
          jsonb_build_object('role_id', super_admin_role_id, 'auto_assigned', true),
          now()
        );
      END IF;
      
      RAISE NOTICE 'Super Admin role assigned to admin user';
    ELSE
      RAISE NOTICE 'Super Admin role not found';
    END IF;
  ELSE
    RAISE NOTICE 'Roles table does not exist yet';
  END IF;
  
  RAISE NOTICE 'Admin user setup completed successfully';
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error setting up admin user: %', SQLERRM;
    -- Don't re-raise the exception to allow migration to continue
END $$;

-- Verify the setup
DO $$
DECLARE
  admin_user_id uuid;
  is_super_admin_result boolean;
  profile_is_admin boolean;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@planmoni.com';
  
  IF admin_user_id IS NOT NULL THEN
    -- Check profile is_admin flag
    SELECT is_admin INTO profile_is_admin
    FROM profiles
    WHERE id = admin_user_id;
    
    -- Test the is_super_admin function
    SELECT is_super_admin(admin_user_id) INTO is_super_admin_result;
    
    RAISE NOTICE 'Admin user ID: %, profile is_admin: %, is_super_admin: %', 
      admin_user_id, profile_is_admin, is_super_admin_result;
  ELSE
    RAISE NOTICE 'Admin user not found after setup';
  END IF;
END $$;