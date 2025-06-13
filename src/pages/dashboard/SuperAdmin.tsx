import { useState } from 'react';
import { 
  Shield, 
  Users, 
  Key, 
  UserCheck, 
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
  Eye
} from 'lucide-react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { useSuperAdminData } from '@/hooks/queries/useSuperAdminData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';

export default function SuperAdmin() {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'roles' | 'permissions' | 'audit'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: superAdminData, isLoading, error } = useSuperAdminData();
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['super-admin']);
  };

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

  if (error) {
    return (
      <div className="text-center py-12">
        <Shield className="h-16 w-16 text-red-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-error mb-4">Access Denied</h2>
        <p className="text-text-secondary mb-6">
          {error.message || 'You do not have permission to access this page.'}
        </p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { stats, roles, users } = superAdminData || { stats: null, roles: [], users: [] };

  const filteredUsers = users.filter(user =>
    user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          onClick={handleRefresh}
          className="p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-primary dark:text-primary ${refreshData.isPending ? 'animate-spin' : ''}`} />
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
            <Button icon={<Plus className="h-4 w-4" />}>
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
                        <button className="text-primary hover:text-primary-dark mr-3">
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
            <Button icon={<Plus className="h-4 w-4" />}>
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
    </div>
  );
}