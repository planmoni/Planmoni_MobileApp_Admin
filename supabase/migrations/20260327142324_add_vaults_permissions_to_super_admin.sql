/*
  # Add Vaults Permissions to Super Admin Role

  1. Purpose
    - Assign existing vault permissions to the Super Admin role
    - Enable Super Admin to access and manage vaults in the admin panel

  2. Permissions Added
    - vaults.list - View list of all vaults
    - vaults.view - View vault details
    - vaults.manage - Manage vaults (update status, settings)

  3. Security
    - Only affects the Super Admin role
    - Uses existing permissions that were created previously
    - Super Admin already has full system access, this just enables the UI access
*/

-- Add vault permissions to Super Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'Super Admin'),
  p.id
FROM permissions p
WHERE p.resource = 'vaults'
  AND p.action IN ('list', 'view', 'manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;
