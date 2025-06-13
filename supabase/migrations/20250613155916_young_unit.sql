/*
  # Fix is_super_admin function conflict
  
  1. Drop dependent policies that reference the conflicting function
  2. Drop the conflicting functions
  3. Create a single, unambiguous is_super_admin function
  4. Recreate the policies with the new function
*/

-- First, drop all policies that depend on the is_super_admin function
DROP POLICY IF EXISTS "Super admins can manage permission categories" ON permission_categories;
DROP POLICY IF EXISTS "Super admins can manage permissions" ON permissions;
DROP POLICY IF EXISTS "Super admins can manage roles" ON roles;
DROP POLICY IF EXISTS "Super admins can manage role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Super admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can view audit logs" ON audit_logs;

-- Now we can safely drop the conflicting functions
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
  
  -- Check if user has super admin role (if tables exist)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
    SELECT EXISTS (
      SELECT 1 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = current_user_id
        AND r.name = 'Super Admin'
        AND ur.is_active = true
        AND (ur.expires_at IS NULL OR ur.expires_at > now())
    ) INTO user_is_super_admin;
  END IF;
  
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

-- Recreate the policies using the new function
CREATE POLICY "Super admins can manage permission categories"
  ON permission_categories
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can manage permissions"
  ON permissions
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can manage roles"
  ON roles
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can manage role permissions"
  ON role_permissions
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can manage user roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

-- Add helpful comment
COMMENT ON FUNCTION public.is_super_admin() IS 'Checks if the current authenticated user has super admin privileges';