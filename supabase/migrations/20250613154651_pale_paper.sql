/*
  # Super Admin Role-Based Access Control System
  
  1. New Tables
    - permission_categories - Organize permissions by category
    - permissions - Individual system permissions
    - roles - User roles with hierarchical levels
    - role_permissions - Role-permission assignments
    - user_roles - User-role assignments
    - audit_logs - Track all administrative actions
  
  2. Security Functions
    - is_super_admin() - Check super admin privileges
    - has_permission() - Check specific permissions
    - assign_user_role() - Assign roles with validation
    - revoke_user_role() - Remove roles from users
    - get_user_roles() - Get all user roles
    - get_user_permissions() - Get all user permissions
  
  3. Security
    - Enable RLS on all tables
    - Add comprehensive policies for super admin access
    - Hierarchical permission validation
*/

-- Create permission categories table
CREATE TABLE IF NOT EXISTS permission_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  category_id uuid REFERENCES permission_categories(id),
  resource text NOT NULL, -- e.g., 'users', 'transactions', 'settings'
  action text NOT NULL, -- e.g., 'read', 'write', 'delete', 'manage'
  is_system boolean DEFAULT false, -- System permissions cannot be deleted
  created_at timestamptz DEFAULT now()
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  level integer NOT NULL DEFAULT 0, -- Higher number = more privileged
  is_system boolean DEFAULT false, -- System roles cannot be deleted
  color text DEFAULT '#6B7280',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Create user_roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  UNIQUE(user_id, role_id)
);

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE permission_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is super admin
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

-- Create function to check user permissions
CREATE OR REPLACE FUNCTION has_permission(
  permission_name text,
  user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = COALESCE(user_id, auth.uid())
    AND p.name = permission_name
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ) OR is_super_admin(user_id);
$$;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION get_user_roles(target_user_id uuid)
RETURNS TABLE (
  role_id uuid,
  role_name text,
  role_description text,
  role_level integer,
  role_color text,
  assigned_by_name text,
  assigned_at timestamptz,
  expires_at timestamptz,
  is_active boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    r.id as role_id,
    r.name as role_name,
    r.description as role_description,
    r.level as role_level,
    r.color as role_color,
    COALESCE(p.first_name || ' ' || p.last_name, 'System') as assigned_by_name,
    ur.assigned_at,
    ur.expires_at,
    ur.is_active
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  LEFT JOIN profiles p ON ur.assigned_by = p.id
  WHERE ur.user_id = target_user_id
  ORDER BY r.level DESC, ur.assigned_at DESC;
$$;

-- Create function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(target_user_id uuid)
RETURNS TABLE (
  permission_name text,
  permission_description text,
  resource text,
  action text,
  category_name text,
  role_name text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT
    p.name as permission_name,
    p.description as permission_description,
    p.resource,
    p.action,
    pc.name as category_name,
    r.name as role_name
  FROM user_roles ur
  JOIN role_permissions rp ON ur.role_id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  JOIN roles r ON ur.role_id = r.id
  LEFT JOIN permission_categories pc ON p.category_id = pc.id
  WHERE ur.user_id = target_user_id
  AND ur.is_active = true
  AND (ur.expires_at IS NULL OR ur.expires_at > now())
  ORDER BY pc.name, p.resource, p.action;
$$;

-- Create function to assign role to user
CREATE OR REPLACE FUNCTION assign_user_role(
  target_user_id uuid,
  target_role_id uuid,
  expires_at timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  assigner_id uuid := auth.uid();
  target_role_level integer;
  assigner_max_level integer;
BEGIN
  -- Check if assigner is super admin or has sufficient privileges
  IF NOT is_super_admin(assigner_id) THEN
    -- Get the maximum role level the assigner can assign
    SELECT COALESCE(MAX(r.level), 0) INTO assigner_max_level
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = assigner_id
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > now());
    
    -- Get the level of the role being assigned
    SELECT level INTO target_role_level
    FROM roles
    WHERE id = target_role_id;
    
    -- Check if assigner can assign this role level
    IF target_role_level >= assigner_max_level THEN
      RAISE EXCEPTION 'Insufficient privileges to assign this role';
    END IF;
  END IF;
  
  -- Insert or update user role
  INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
  VALUES (target_user_id, target_role_id, assigner_id, expires_at)
  ON CONFLICT (user_id, role_id)
  DO UPDATE SET
    assigned_by = assigner_id,
    assigned_at = now(),
    expires_at = EXCLUDED.expires_at,
    is_active = true;
  
  -- Log the action
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
  VALUES (
    assigner_id,
    'assign_role',
    'user_roles',
    target_user_id::text,
    jsonb_build_object('role_id', target_role_id, 'expires_at', expires_at)
  );
  
  RETURN true;
END;
$$;

-- Create function to revoke role from user
CREATE OR REPLACE FUNCTION revoke_user_role(
  target_user_id uuid,
  target_role_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  revoker_id uuid := auth.uid();
BEGIN
  -- Check if revoker is super admin
  IF NOT is_super_admin(revoker_id) THEN
    RAISE EXCEPTION 'Only super admins can revoke roles';
  END IF;
  
  -- Deactivate the user role
  UPDATE user_roles
  SET is_active = false
  WHERE user_id = target_user_id
  AND role_id = target_role_id;
  
  -- Log the action
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values)
  VALUES (
    revoker_id,
    'revoke_role',
    'user_roles',
    target_user_id::text,
    jsonb_build_object('role_id', target_role_id)
  );
  
  RETURN true;
END;
$$;

-- Create function to get all roles with permissions
CREATE OR REPLACE FUNCTION get_all_roles_with_permissions()
RETURNS TABLE (
  role_id uuid,
  role_name text,
  role_description text,
  role_level integer,
  role_color text,
  is_system boolean,
  user_count bigint,
  permissions jsonb,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    r.id as role_id,
    r.name as role_name,
    r.description as role_description,
    r.level as role_level,
    r.color as role_color,
    r.is_system,
    (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id AND ur.is_active = true) as user_count,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'description', p.description,
          'resource', p.resource,
          'action', p.action,
          'category', pc.name
        )
      )
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      LEFT JOIN permission_categories pc ON p.category_id = pc.id
      WHERE rp.role_id = r.id),
      '[]'::jsonb
    ) as permissions,
    r.created_at
  FROM roles r
  ORDER BY r.level DESC, r.name;
$$;

-- Create function to get system statistics for super admin
CREATE OR REPLACE FUNCTION get_super_admin_stats()
RETURNS TABLE (
  total_users bigint,
  total_admins bigint,
  total_roles bigint,
  total_permissions bigint,
  recent_role_assignments bigint,
  failed_login_attempts bigint,
  system_health_score integer,
  pending_user_verifications bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    (SELECT COUNT(*) FROM profiles) as total_users,
    (SELECT COUNT(DISTINCT ur.user_id) FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE r.level > 0 AND ur.is_active = true) as total_admins,
    (SELECT COUNT(*) FROM roles) as total_roles,
    (SELECT COUNT(*) FROM permissions) as total_permissions,
    (SELECT COUNT(*) FROM user_roles WHERE assigned_at >= CURRENT_DATE - interval '7 days') as recent_role_assignments,
    0::bigint as failed_login_attempts, -- Placeholder
    95 as system_health_score, -- Placeholder
    0::bigint as pending_user_verifications; -- Placeholder
$$;

-- Drop existing policies if they exist to avoid conflicts
DO $$
BEGIN
  -- Drop permission_categories policies
  DROP POLICY IF EXISTS "Super admins can manage permission categories" ON permission_categories;
  
  -- Drop permissions policies
  DROP POLICY IF EXISTS "Super admins can manage permissions" ON permissions;
  
  -- Drop roles policies
  DROP POLICY IF EXISTS "Super admins can manage roles" ON roles;
  
  -- Drop role_permissions policies
  DROP POLICY IF EXISTS "Super admins can manage role permissions" ON role_permissions;
  
  -- Drop user_roles policies
  DROP POLICY IF EXISTS "Super admins can manage user roles" ON user_roles;
  DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
  
  -- Drop audit_logs policies
  DROP POLICY IF EXISTS "Super admins can view audit logs" ON audit_logs;
END $$;

-- RLS Policies for Super Admin access
CREATE POLICY "Super admins can manage permission categories"
  ON permission_categories FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage permissions"
  ON permissions FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage roles"
  ON roles FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage role permissions"
  ON role_permissions FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can manage user roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Allow users to view their own roles
CREATE POLICY "Users can view own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Insert default permission categories
INSERT INTO permission_categories (name, description, icon, sort_order) VALUES
('User Management', 'Permissions related to user account management', 'Users', 1),
('Financial Operations', 'Permissions for transaction and wallet management', 'DollarSign', 2),
('System Administration', 'Core system administration permissions', 'Settings', 3),
('Analytics & Reporting', 'Access to analytics and reporting features', 'BarChart3', 4),
('Security & Audit', 'Security and audit-related permissions', 'Shield', 5)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (name, description, category_id, resource, action, is_system) VALUES
-- User Management
('users.read', 'View user profiles and information', (SELECT id FROM permission_categories WHERE name = 'User Management'), 'users', 'read', true),
('users.write', 'Create and update user profiles', (SELECT id FROM permission_categories WHERE name = 'User Management'), 'users', 'write', true),
('users.delete', 'Delete user accounts', (SELECT id FROM permission_categories WHERE name = 'User Management'), 'users', 'delete', true),
('users.manage_roles', 'Assign and revoke user roles', (SELECT id FROM permission_categories WHERE name = 'User Management'), 'users', 'manage_roles', true),

-- Financial Operations
('transactions.read', 'View transaction history and details', (SELECT id FROM permission_categories WHERE name = 'Financial Operations'), 'transactions', 'read', true),
('transactions.write', 'Create and modify transactions', (SELECT id FROM permission_categories WHERE name = 'Financial Operations'), 'transactions', 'write', true),
('wallets.read', 'View wallet balances and information', (SELECT id FROM permission_categories WHERE name = 'Financial Operations'), 'wallets', 'read', true),
('wallets.write', 'Modify wallet balances and settings', (SELECT id FROM permission_categories WHERE name = 'Financial Operations'), 'wallets', 'write', true),
('payouts.manage', 'Manage payout plans and schedules', (SELECT id FROM permission_categories WHERE name = 'Financial Operations'), 'payouts', 'manage', true),

-- System Administration
('system.settings', 'Access and modify system settings', (SELECT id FROM permission_categories WHERE name = 'System Administration'), 'system', 'settings', true),
('system.maintenance', 'Perform system maintenance tasks', (SELECT id FROM permission_categories WHERE name = 'System Administration'), 'system', 'maintenance', true),
('roles.manage', 'Create, modify, and delete roles', (SELECT id FROM permission_categories WHERE name = 'System Administration'), 'roles', 'manage', true),
('permissions.manage', 'Manage system permissions', (SELECT id FROM permission_categories WHERE name = 'System Administration'), 'permissions', 'manage', true),

-- Analytics & Reporting
('analytics.read', 'View analytics and reports', (SELECT id FROM permission_categories WHERE name = 'Analytics & Reporting'), 'analytics', 'read', true),
('reports.generate', 'Generate and export reports', (SELECT id FROM permission_categories WHERE name = 'Analytics & Reporting'), 'reports', 'generate', true),

-- Security & Audit
('audit.read', 'View audit logs and security events', (SELECT id FROM permission_categories WHERE name = 'Security & Audit'), 'audit', 'read', true),
('security.manage', 'Manage security settings and policies', (SELECT id FROM permission_categories WHERE name = 'Security & Audit'), 'security', 'manage', true)
ON CONFLICT (name) DO NOTHING;

-- Insert default roles
INSERT INTO roles (name, description, level, is_system, color) VALUES
('Super Admin', 'Full system access with all permissions', 100, true, '#DC2626'),
('Admin', 'Administrative access with most permissions', 50, true, '#EA580C'),
('Moderator', 'Limited administrative access', 25, true, '#D97706'),
('User', 'Standard user with basic permissions', 0, true, '#6B7280')
ON CONFLICT (name) DO NOTHING;

-- Assign all permissions to Super Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'Super Admin'),
  p.id
FROM permissions p
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign basic permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'Admin'),
  p.id
FROM permissions p
WHERE p.name IN (
  'users.read', 'users.write',
  'transactions.read', 'transactions.write',
  'wallets.read', 'wallets.write',
  'payouts.manage',
  'analytics.read', 'reports.generate',
  'audit.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign limited permissions to Moderator role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'Moderator'),
  p.id
FROM permissions p
WHERE p.name IN (
  'users.read',
  'transactions.read',
  'wallets.read',
  'analytics.read'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION has_permission(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_user_role(uuid, uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_user_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_roles_with_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION get_super_admin_stats() TO authenticated;

-- Assign Super Admin role to the admin user
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