import { useState } from 'react';
import {
  Shield,
  Users,
  Key,
  UserCheck,
  Plus,
  Trash2,
  Search,
  RefreshCw,
  AlertTriangle,
  Clock,
  BarChart3,
  Award,
  TrendingUp,
  Edit,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useSuperAdminData } from '@/hooks/queries/useSuperAdminData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { useCreateRole, useAssignRoles, useDeleteRole, useUpdateRole } from '@/hooks/mutations/useRoleManagement';
import { CreateRoleModal } from '@/components/CreateRoleModal';
import { AssignRoleModal } from '@/components/AssignRoleModal';
import { EditRoleModal } from '@/components/EditRoleModal';

const formatPermissionName = (name: string): string => {
  return name
    .split('.')
    .map(part => part.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '))
    .join(' - ');
};

export default function SuperAdmin() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'roles'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [isAssignRoleModalOpen, setIsAssignRoleModalOpen] = useState(false);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);

  const { data: superAdminData, isLoading, error } = useSuperAdminData();
  const refreshData = useRefreshData();
  const createRole = useCreateRole();
  const assignRoles = useAssignRoles();
  const deleteRole = useDeleteRole();
  const updateRole = useUpdateRole();

  const handleRefresh = () => {
    refreshData.mutate(['super-admin']);
  };

  const handleCreateRole = (roleData: any) => {
    createRole.mutate(roleData, {
      onSuccess: () => {
        setIsCreateRoleModalOpen(false);
      }
    });
  };

  const handleAssignRoles = (userId: string, roleIds: string[]) => {
    assignRoles.mutate({ userId, roleIds }, {
      onSuccess: () => {
        setIsAssignRoleModalOpen(false);
      }
    });
  };

  const handleDeleteRole = (roleId: string) => {
    if (window.confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      deleteRole.mutate(roleId);
    }
  };

  const handleEditRole = (role: any) => {
    setSelectedRole(role);
    setIsEditRoleModalOpen(true);
  };

  const handleUpdateRole = (roleId: string, roleData: any) => {
    updateRole.mutate({ roleId, data: roleData }, {
      onSuccess: () => {
        setIsEditRoleModalOpen(false);
        setSelectedRole(null);
      }
    });
  };

  const toggleRoleExpand = (roleId: string) => {
    setExpandedRoleId(expandedRoleId === roleId ? null : roleId);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
            <Shield className="h-10 w-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            {error.message || 'You do not have permission to access this page.'}
          </p>
          <button
            onClick={handleRefresh}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Super Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  const { stats, roles, users, permissions } = superAdminData || { stats: null, roles: [], users: [], permissions: [] };

  const filteredUsers = users.filter(user =>
    user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Super Admin</h1>
              <p className="text-gray-500">Manage system roles and permissions</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshData.isPending}
          className="px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-all flex items-center gap-2 font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshData.isPending ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'roles', label: 'Roles', icon: Key },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-1">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total_users}</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                  <UserCheck className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                  {stats.total_admins > 0 ? Math.round((stats.total_admins / stats.total_users) * 100) : 0}%
                </span>
              </div>
              <p className="text-gray-500 text-sm font-medium mb-1">Admin Users</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total_admins}</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Key className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <p className="text-gray-500 text-sm font-medium mb-1">System Roles</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total_roles}</p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <p className="text-gray-500 text-sm font-medium mb-1">Permissions</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total_permissions}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Award className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Recent Role Assignments</h3>
                  <p className="text-sm text-gray-500">Last 7 days</p>
                </div>
              </div>
              <div className="text-center py-8">
                <p className="text-5xl font-bold text-gray-900 mb-2">{stats.recent_role_assignments}</p>
                <p className="text-gray-500">role assignments</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Security Alerts</h3>
                  <p className="text-sm text-gray-500">Today</p>
                </div>
              </div>
              <div className="text-center py-8">
                <p className="text-5xl font-bold text-gray-900 mb-2">{stats.failed_login_attempts}</p>
                <p className="text-gray-500">failed login attempts</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setIsAssignRoleModalOpen(true)}
              className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 font-semibold whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Assign Roles
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Roles
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center text-white font-semibold">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role: any) => (
                            <span
                              key={role.role_id}
                              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold"
                              style={{
                                backgroundColor: `${role.role_color}20`,
                                color: role.role_color
                              }}
                            >
                              {role.role_name}
                            </span>
                          ))}
                          {user.roles.length === 0 && (
                            <span className="text-gray-400 text-sm">No roles assigned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          user.is_admin
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.is_admin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No users found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">System Roles</h2>
            <button
              onClick={() => setIsCreateRoleModalOpen(true)}
              className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center gap-2 font-semibold"
            >
              <Plus className="h-4 w-4" />
              Create Role
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => {
              const isExpanded = expandedRoleId === role.role_id;
              return (
                <div
                  key={role.role_id}
                  className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => toggleRoleExpand(role.role_id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: role.role_color }}
                      />
                      <div>
                        <h3 className="font-bold text-gray-900">{role.role_name}</h3>
                        <p className="text-sm text-gray-500">Level {role.role_level}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {role.is_system && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-lg font-semibold">
                          System
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  <p className={`text-gray-600 text-sm mb-4 ${isExpanded ? '' : 'line-clamp-2'}`}>
                    {role.role_description}
                  </p>

                  <div className="flex items-center justify-between text-sm mb-4 py-3 px-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">
                      <span className="font-semibold text-gray-900">{role.user_count}</span> users
                    </span>
                    <span className="text-gray-600">
                      <span className="font-semibold text-gray-900">{role.permissions.length}</span> permissions
                    </span>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                      Permissions
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {(isExpanded ? role.permissions : role.permissions.slice(0, 3)).map((permission: any) => (
                        <span
                          key={permission.id}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-medium"
                        >
                          {formatPermissionName(permission.name)}
                        </span>
                      ))}
                      {!isExpanded && role.permissions.length > 3 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-medium">
                          +{role.permissions.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-2 mb-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleEditRole(role)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-semibold text-sm"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit Role
                      </button>
                      {!role.is_system && (
                        <button
                          onClick={() => handleDeleteRole(role.role_id)}
                          className="w-full px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center gap-2 font-semibold text-sm"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Role
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {roles.length === 0 && (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <Key className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium mb-2">No roles found</p>
              <p className="text-gray-400 text-sm">Create your first role to get started</p>
            </div>
          )}
        </div>
      )}

      <CreateRoleModal
        isOpen={isCreateRoleModalOpen}
        onClose={() => setIsCreateRoleModalOpen(false)}
        onSubmit={handleCreateRole}
        permissions={permissions}
      />

      <AssignRoleModal
        isOpen={isAssignRoleModalOpen}
        onClose={() => setIsAssignRoleModalOpen(false)}
        onSubmit={handleAssignRoles}
        users={users}
        roles={roles}
      />

      <EditRoleModal
        isOpen={isEditRoleModalOpen}
        onClose={() => {
          setIsEditRoleModalOpen(false);
          setSelectedRole(null);
        }}
        onSubmit={handleUpdateRole}
        role={selectedRole}
        permissions={permissions}
      />
    </div>
  );
}
