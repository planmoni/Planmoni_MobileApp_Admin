import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Shield, 
  Users, 
  Key, 
  UserCheck, 
  UserX, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Award,
  Lock,
  Eye,
  X,
  User
} from 'lucide-react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { useToast } from '../../contexts/ToastContext';

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

type Permission = {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  category: string;
};

type RoleDetails = {
  role: Role;
  assignedUsers: User[];
  permissions: Permission[];
};

export default function SuperAdmin() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'roles' | 'permissions' | 'audit'>('overview');
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleDetails, setRoleDetails] = useState<RoleDetails | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showUserRoleModal, setShowUserRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    level: 1,
    color: '#6B7280'
  });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    fetchSuperAdminData();
  }, []);

  const fetchSuperAdminData = async () => {
    try {
      setRefreshing(true);
      
      // Check if user is super admin
      const { data: isSuperAdmin, error: superAdminError } = await supabase.rpc('is_super_admin');
      
      if (superAdminError || !isSuperAdmin) {
        showToast('Access denied. Super Admin privileges required.', 'error');
        return;
      }
      
      // Fetch system statistics
      const { data: statsData, error: statsError } = await supabase.rpc('get_super_admin_stats');
      
      if (statsError) {
        console.error('Error fetching stats:', statsError);
        // Set fallback stats
        setStats({
          total_users: 0,
          total_admins: 0,
          total_roles: 0,
          total_permissions: 0,
          recent_role_assignments: 0,
          failed_login_attempts: 0,
          system_health_score: 85,
          pending_user_verifications: 0
        });
      } else {
        setStats(statsData?.[0] || null);
      }
      
      // Fetch all roles with permissions
      const { data: rolesData, error: rolesError } = await supabase.rpc('get_all_roles_with_permissions');
      
      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        setRoles([]);
      } else {
        setRoles(rolesData || []);
      }
      
      // Fetch users with their roles
      await fetchUsersWithRoles();
      
    } catch (error) {
      console.error('Error fetching super admin data:', error);
      showToast('Failed to load super admin data', 'error');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUsersWithRoles = async () => {
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, is_admin, created_at')
        .order('created_at', { ascending: false });
      
      if (usersError) throw usersError;
      
      // Fetch roles for each user
      const usersWithRoles = await Promise.all(
        (usersData || []).map(async (user) => {
          const { data: userRoles, error: rolesError } = await supabase.rpc('get_user_roles', {
            target_user_id: user.id
          });
          
          return {
            ...user,
            roles: rolesError ? [] : (userRoles || [])
          };
        })
      );
      
      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users with roles:', error);
    }
  };

  const fetchRoleDetails = async (roleId: string) => {
    try {
      // Find the role in our existing data
      const role = roles.find(r => r.role_id === roleId);
      if (!role) {
        showToast('Role not found', 'error');
        return;
      }

      // Get users assigned to this role
      const assignedUsers = users.filter(user => 
        user.roles.some(userRole => userRole.role_id === roleId && userRole.is_active)
      );

      // Get detailed permissions for this role
      const permissions = role.permissions.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        resource: p.resource,
        action: p.action,
        category: p.category || 'Uncategorized'
      }));

      setRoleDetails({
        role,
        assignedUsers,
        permissions
      });

      setShowRoleModal(true);
    } catch (error) {
      console.error('Error fetching role details:', error);
      showToast('Failed to load role details', 'error');
    }
  };

  const assignRoleToUser = async (userId: string, roleId: string, expiresAt?: string) => {
    try {
      const { error } = await supabase.rpc('assign_user_role', {
        target_user_id: userId,
        target_role_id: roleId,
        expires_at: expiresAt || null
      });
      
      if (error) throw error;
      
      showToast('Role assigned successfully', 'success');
      setShowUserRoleModal(false);
      await fetchUsersWithRoles();
    } catch (error) {
      console.error('Error assigning role:', error);
      showToast('Failed to assign role', 'error');
    }
  };

  const revokeRoleFromUser = async (userId: string, roleId: string) => {
    try {
      const { error } = await supabase.rpc('revoke_user_role', {
        target_user_id: userId,
        target_role_id: roleId
      });
      
      if (error) throw error;
      
      showToast('Role revoked successfully', 'success');
      await fetchUsersWithRoles();
      
      // Update role details if modal is open
      if (roleDetails && roleDetails.role.role_id === roleId) {
        await fetchRoleDetails(roleId);
      }
    } catch (error) {
      console.error('Error revoking role:', error);
      showToast('Failed to revoke role', 'error');
    }
  };

  const createNewRole = async () => {
    try {
      if (!newRole.name || !newRole.description) {
        showToast('Please fill in all required fields', 'error');
        return;
      }
      
      // Insert new role
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .insert({
          name: newRole.name,
          description: newRole.description,
          level: newRole.level,
          color: newRole.color,
          is_system: false
        })
        .select()
        .single();
      
      if (roleError) throw roleError;
      
      // Assign selected permissions to the role
      if (selectedPermissions.length > 0) {
        // Get current user ID first
        const { data: currentUser } = await supabase.auth.getUser();
        const currentUserId = currentUser.user?.id;
        
        const rolePermissions = selectedPermissions.map(permissionId => ({
          role_id: roleData.id,
          permission_id: permissionId,
          granted_by: currentUserId
        }));
        
        const { error: permissionsError } = await supabase
          .from('role_permissions')
          .insert(rolePermissions);
        
        if (permissionsError) throw permissionsError;
      }
      
      showToast('Role created successfully', 'success');
      setShowCreateRoleModal(false);
      setNewRole({ name: '', description: '', level: 1, color: '#6B7280' });
      setSelectedPermissions([]);
      await fetchSuperAdminData();
    } catch (error) {
      console.error('Error creating role:', error);
      showToast('Failed to create role', 'error');
    }
  };

  const filteredUsers = users.filter(user =>
    user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (score >= 70) return <Clock className="h-5 w-5 text-yellow-600" />;
    return <AlertTriangle className="h-5 w-5 text-red-600" />;
  };

  const groupPermissionsByCategory = (permissions: Permission[]) => {
    return permissions.reduce((acc, permission) => {
      const category = permission.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text flex items-center gap-2">
            <Shield className="h-6 w-6 text-red-600" />
            Super Admin Dashboard
          </h1>
          <p className="text-text-secondary dark:text-text-secondary">
            Manage system roles, permissions, and user access
          </p>
        </div>
        <button 
          onClick={fetchSuperAdminData}
          className="p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
          disabled={refreshing}
        >
          <RefreshCw className={`h-5 w-5 text-primary dark:text-primary ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 border-b border-border dark:border-border">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'users', label: 'User Management', icon: Users },
            { id: 'roles', label: 'Roles & Permissions', icon: Key },
            { id: 'audit', label: 'Audit Logs', icon: Shield },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-text hover:border-border'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* System Health */}
          <Card title="System Health" className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getHealthScoreIcon(stats.system_health_score)}
                <div>
                  <h3 className="text-lg font-semibold text-text dark:text-text">
                    System Health Score
                  </h3>
                  <p className="text-text-secondary dark:text-text-secondary">
                    Overall system performance and security
                  </p>
                </div>
              </div>
              <div className={`text-3xl font-bold ${getHealthScoreColor(stats.system_health_score)}`}>
                {stats.system_health_score}%
              </div>
            </div>
          </Card>

          {/* Statistics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary dark:text-text-secondary text-sm">Total Users</p>
                  <p className="text-2xl font-bold text-text dark:text-text">{stats.total_users}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary dark:text-text-secondary text-sm">Admin Users</p>
                  <p className="text-2xl font-bold text-text dark:text-text">{stats.total_admins}</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary dark:text-text-secondary text-sm">System Roles</p>
                  <p className="text-2xl font-bold text-text dark:text-text">{stats.total_roles}</p>
                </div>
                <Key className="h-8 w-8 text-purple-500" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-secondary dark:text-text-secondary text-sm">Permissions</p>
                  <p className="text-2xl font-bold text-text dark:text-text">{stats.total_permissions}</p>
                </div>
                <Shield className="h-8 w-8 text-red-500" />
              </div>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Recent Role Assignments" className="p-4">
              <div className="text-center py-8">
                <Award className="h-12 w-12 text-text-tertiary dark:text-text-tertiary mx-auto mb-4" />
                <p className="text-text-secondary dark:text-text-secondary">
                  {stats.recent_role_assignments} role assignments in the last 7 days
                </p>
              </div>
            </Card>

            <Card title="Security Alerts" className="p-4">
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <p className="text-text-secondary dark:text-text-secondary">
                  {stats.failed_login_attempts} failed login attempts today
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-text-secondary" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-white dark:bg-background-tertiary text-text dark:text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <Button
              onClick={() => setShowUserRoleModal(true)}
              icon={<Plus className="h-4 w-4" />}
            >
              Assign Role
            </Button>
          </div>

          {/* Users Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border dark:divide-border">
                <thead className="bg-background-tertiary dark:bg-background-tertiary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Roles
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-surface divide-y divide-border dark:divide-border">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-background-tertiary dark:hover:bg-background-tertiary/20">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-text dark:text-text">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role: any) => (
                            <span
                              key={role.role_id}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: `${role.role_color}20`,
                                color: role.role_color
                              }}
                            >
                              {role.role_name}
                              <button
                                onClick={() => revokeRoleFromUser(user.id, role.role_id)}
                                className="ml-1 hover:text-red-600"
                              >
                                <UserX className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                          {user.roles.length === 0 && (
                            <span className="text-text-tertiary dark:text-text-tertiary text-sm">No roles</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          user.is_admin
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                        }`}>
                          {user.is_admin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary dark:text-text-secondary">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserRoleModal(true);
                          }}
                          className="text-primary hover:text-primary-dark mr-3"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-text dark:text-text">System Roles</h2>
            <Button
              onClick={() => setShowCreateRoleModal(true)}
              icon={<Plus className="h-4 w-4" />}
            >
              Create Role
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => (
              <Card key={role.role_id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: role.role_color }}
                    />
                    <div>
                      <h3 className="font-semibold text-text dark:text-text">{role.role_name}</h3>
                      <p className="text-sm text-text-secondary dark:text-text-secondary">
                        Level {role.role_level}
                      </p>
                    </div>
                  </div>
                  {role.is_system && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 text-xs rounded-full">
                      System
                    </span>
                  )}
                </div>
                
                <p className="text-text-secondary dark:text-text-secondary text-sm mb-4">
                  {role.role_description}
                </p>
                
                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-text-secondary dark:text-text-secondary">
                    {role.user_count} users
                  </span>
                  <span className="text-text-secondary dark:text-text-secondary">
                    {role.permissions.length} permissions
                  </span>
                </div>

                {/* Permissions Preview */}
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-text-secondary dark:text-text-secondary mb-2">
                    Permissions:
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.slice(0, 3).map((permission: any) => (
                      <span
                        key={permission.id}
                        className="px-2 py-1 bg-background-tertiary dark:bg-background-tertiary text-xs rounded"
                      >
                        {permission.action}
                      </span>
                    ))}
                    {role.permissions.length > 3 && (
                      <span className="px-2 py-1 bg-background-tertiary dark:bg-background-tertiary text-xs rounded">
                        +{role.permissions.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchRoleDetails(role.role_id)}
                    icon={<Eye className="h-3 w-3" />}
                  >
                    View
                  </Button>
                  {!role.is_system && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-600 hover:bg-red-50"
                      icon={<Trash2 className="h-3 w-3" />}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <Card title="Audit Logs" className="p-6">
            <div className="text-center py-12">
              <Shield className="h-16 w-16 text-text-tertiary dark:text-text-tertiary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text dark:text-text mb-2">
                Audit Logs
              </h3>
              <p className="text-text-secondary dark:text-text-secondary">
                Comprehensive audit logging system tracks all administrative actions and security events.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Role Details Modal */}
      {showRoleModal && roleDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-surface rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border dark:border-border">
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: roleDetails.role.role_color }}
                />
                <div>
                  <h3 className="text-xl font-semibold text-text dark:text-text">
                    {roleDetails.role.role_name}
                  </h3>
                  <p className="text-sm text-text-secondary dark:text-text-secondary">
                    Level {roleDetails.role.role_level} • {roleDetails.assignedUsers.length} users • {roleDetails.permissions.length} permissions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="p-2 hover:bg-background-tertiary dark:hover:bg-background-tertiary rounded-full"
              >
                <X className="h-5 w-5 text-text-secondary" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="p-6 space-y-6">
                {/* Role Description */}
                <div>
                  <h4 className="text-lg font-medium text-text dark:text-text mb-2">Description</h4>
                  <p className="text-text-secondary dark:text-text-secondary">
                    {roleDetails.role.role_description}
                  </p>
                </div>

                {/* Assigned Users */}
                <div>
                  <h4 className="text-lg font-medium text-text dark:text-text mb-4">
                    Assigned Users ({roleDetails.assignedUsers.length})
                  </h4>
                  {roleDetails.assignedUsers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {roleDetails.assignedUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 bg-background-tertiary dark:bg-background-tertiary rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-sm">
                              {user.first_name?.[0]}{user.last_name?.[0]}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-text dark:text-text">
                                {user.first_name} {user.last_name}
                              </p>
                              <p className="text-xs text-text-secondary dark:text-text-secondary">
                                {user.email}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => revokeRoleFromUser(user.id, roleDetails.role.role_id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600"
                            title="Revoke role"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-background-tertiary dark:bg-background-tertiary rounded-lg">
                      <User className="h-12 w-12 text-text-tertiary dark:text-text-tertiary mx-auto mb-2" />
                      <p className="text-text-secondary dark:text-text-secondary">
                        No users assigned to this role
                      </p>
                    </div>
                  )}
                </div>

                {/* Permissions */}
                <div>
                  <h4 className="text-lg font-medium text-text dark:text-text mb-4">
                    Permissions ({roleDetails.permissions.length})
                  </h4>
                  {roleDetails.permissions.length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(groupPermissionsByCategory(roleDetails.permissions)).map(([category, permissions]) => (
                        <div key={category}>
                          <h5 className="text-sm font-medium text-text dark:text-text mb-2 flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            {category}
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-6">
                            {permissions.map((permission) => (
                              <div
                                key={permission.id}
                                className="p-3 bg-background-tertiary dark:bg-background-tertiary rounded-lg"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-text dark:text-text">
                                    {permission.resource}.{permission.action}
                                  </span>
                                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                                    {permission.action}
                                  </span>
                                </div>
                                <p className="text-xs text-text-secondary dark:text-text-secondary">
                                  {permission.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-background-tertiary dark:bg-background-tertiary rounded-lg">
                      <Lock className="h-12 w-12 text-text-tertiary dark:text-text-tertiary mx-auto mb-2" />
                      <p className="text-text-secondary dark:text-text-secondary">
                        No permissions assigned to this role
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 p-6 border-t border-border dark:border-border">
              <Button
                variant="outline"
                onClick={() => setShowRoleModal(false)}
              >
                Close
              </Button>
              {!roleDetails.role.is_system && (
                <Button
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                  icon={<Edit className="h-4 w-4" />}
                >
                  Edit Role
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Role Assignment Modal */}
      {showUserRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-surface rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-text dark:text-text mb-4">
              {selectedUser ? `Assign Role to ${selectedUser.first_name} ${selectedUser.last_name}` : 'Assign Role'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-text mb-2">
                  Select Role
                </label>
                <select className="w-full p-2 border border-border rounded-md bg-white dark:bg-background-tertiary text-text dark:text-text">
                  <option value="">Choose a role...</option>
                  {roles.map((role) => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name} (Level {role.role_level})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowUserRoleModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    // Implementation would go here
                    setShowUserRoleModal(false);
                  }}
                  className="flex-1"
                >
                  Assign Role
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-surface rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-text dark:text-text mb-4">
              Create New Role
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text dark:text-text mb-2">
                  Role Name *
                </label>
                <input
                  type="text"
                  value={newRole.name}
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-white dark:bg-background-tertiary text-text dark:text-text"
                  placeholder="Enter role name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text dark:text-text mb-2">
                  Description *
                </label>
                <textarea
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                  className="w-full p-2 border border-border rounded-md bg-white dark:bg-background-tertiary text-text dark:text-text"
                  placeholder="Enter role description"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text dark:text-text mb-2">
                    Level
                  </label>
                  <input
                    type="number"
                    value={newRole.level}
                    onChange={(e) => setNewRole({ ...newRole, level: parseInt(e.target.value) })}
                    className="w-full p-2 border border-border rounded-md bg-white dark:bg-background-tertiary text-text dark:text-text"
                    min="0"
                    max="99"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text dark:text-text mb-2">
                    Color
                  </label>
                  <input
                    type="color"
                    value={newRole.color}
                    onChange={(e) => setNewRole({ ...newRole, color: e.target.value })}
                    className="w-full p-1 border border-border rounded-md bg-white dark:bg-background-tertiary"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowCreateRoleModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={createNewRole}
                  className="flex-1"
                >
                  Create Role
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}