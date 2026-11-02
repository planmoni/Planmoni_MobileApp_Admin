import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type SuperAdminStats = {
  total_users: number;
  total_admins: number;
  total_roles: number;
  total_permissions: number;
  recent_role_assignments: number;
  failed_login_attempts: number;
  system_health_score: number;
  pending_user_verifications: number;
};

type Role = {
  role_id: string;
  role_name: string;
  role_description: string;
  role_level: number;
  role_color: string;
  is_system: boolean;
  user_count: number;
  permissions: any[];
  created_at: string;
};

type User = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  roles: any[];
};

const fetchSuperAdminData = async () => {
  // Check if user is super admin
  const { data: isSuperAdmin, error: superAdminError } = await supabase.rpc('is_super_admin');
  
  if (superAdminError || !isSuperAdmin) {
    throw new Error('Access denied. Super Admin privileges required.');
  }
  
  // Fetch system statistics
  const { data: statsData, error: statsError } = await supabase.rpc('get_super_admin_stats');
  
  let stats: SuperAdminStats;
  if (statsError) {
    console.error('Error fetching stats:', statsError);
    // Set fallback stats
    stats = {
      total_users: 0,
      total_admins: 0,
      total_roles: 0,
      total_permissions: 0,
      recent_role_assignments: 0,
      failed_login_attempts: 0,
      system_health_score: 85,
      pending_user_verifications: 0
    };
  } else {
    stats = statsData?.[0] || stats!;
  }
  
  // Fetch all roles with permissions
  const { data: rolesData, error: rolesError } = await supabase.rpc('get_all_roles_with_permissions');
  
  let roles: Role[] = [];
  if (rolesError) {
    console.error('Error fetching roles:', rolesError);
  } else {
    roles = rolesData || [];
  }
  
  // Fetch all permissions
  const { data: permissionsData, error: permissionsError } = await supabase
    .from('permissions')
    .select('*')
    .order('resource', { ascending: true });

  let permissions = [];
  if (permissionsError) {
    console.error('Error fetching permissions:', permissionsError);
  } else {
    permissions = permissionsData || [];
  }

  // Staff only (admins and anyone holding a role). The Users tab and Assign Roles search the full user base
  // on the server (useAdminUserSearch); loading every profile here hit the 1,000 row limit and cost one call per user.
  const { data: staffData, error: staffError } = await supabase.rpc('admin_search_users', {
    p_query: null,
    p_only_staff: true,
    p_limit: 50,
  });

  let users: User[] = [];
  if (staffError) {
    console.error('Error fetching staff:', staffError);
  } else {
    users = ((staffData as any)?.users ?? []) as User[];
  }

  return {
    stats,
    roles,
    users,
    permissions
  };
};

export const useSuperAdminData = () => {
  return useQuery({
    queryKey: ['super-admin'],
    queryFn: fetchSuperAdminData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false, // Don't retry on access denied
  });
};