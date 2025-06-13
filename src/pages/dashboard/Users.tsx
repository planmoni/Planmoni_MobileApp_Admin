import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, Users as UsersIcon, TrendingUp, Wallet } from 'lucide-react';
import Card from '../../components/Card';
import { useUsersData } from '@/hooks/queries/useUsersData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';

type FilterType = 'all' | 'admin' | 'with_balance' | 'with_plans';

export default function Users() {
  const { data: usersData, isLoading, error } = useUsersData();
  const refreshData = useRefreshData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);

  const users = usersData?.users || [];
  const userStats = usersData?.stats;

  useEffect(() => {
    filterUsers();
  }, [searchQuery, users, filterType]);

  const handleRefresh = () => {
    refreshData.mutate(['users']);
  };

  const filterUsers = () => {
    let filtered = [...users];
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(user => 
        user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply type filter
    switch (filterType) {
      case 'admin':
        filtered = filtered.filter(user => user.is_admin);
        break;
      case 'with_balance':
        filtered = filtered.filter(user => user.balance > 0);
        break;
      case 'with_plans':
        filtered = filtered.filter(user => user.active_plans > 0);
        break;
      default:
        // 'all' - no additional filtering
        break;
    }
    
    setFilteredUsers(filtered);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getFilterButtonClass = (type: string) => {
    const baseClass = "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors";
    const activeClass = "bg-primary text-white";
    const inactiveClass = "bg-background-tertiary dark:bg-background-tertiary text-text-secondary dark:text-text-secondary hover:bg-background-secondary dark:hover:bg-background-secondary";
    
    return `${baseClass} ${filterType === type ? activeClass : inactiveClass}`;
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load users data</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text">Users</h1>
          <p className="text-text-secondary dark:text-text-secondary">Manage all users on the platform</p>
        </div>
        <button 
          onClick={handleRefresh}
          className="p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-primary dark:text-primary ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* User Statistics Cards */}
      {userStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="flex flex-col items-center p-4">
            <div className="flex justify-between items-center w-full mb-2">
              <span className="text-text-secondary dark:text-text-secondary text-sm">Total Users</span>
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <UsersIcon className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text dark:text-text self-start">{userStats.total_users}</div>
            <div className="flex items-center text-xs text-success dark:text-success mt-2 self-start">
              <TrendingUp className="h-3 w-3 mr-1" />
              <span>+{userStats.new_users_this_month} this month</span>
            </div>
          </Card>

          <Card className="flex flex-col items-center p-4">
            <div className="flex justify-between items-center w-full mb-2">
              <span className="text-text-secondary dark:text-text-secondary text-sm">Active Users</span>
              <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text dark:text-text self-start">{userStats.active_users_this_month}</div>
            <div className="flex items-center text-xs text-text-secondary dark:text-text-secondary mt-2 self-start">
              <span>This month</span>
            </div>
          </Card>

          <Card className="flex flex-col items-center p-4">
            <div className="flex justify-between items-center w-full mb-2">
              <span className="text-text-secondary dark:text-text-secondary text-sm">Users with Balance</span>
              <div className="w-10 h-10 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text dark:text-text self-start">{userStats.users_with_balance}</div>
            <div className="flex items-center text-xs text-text-secondary dark:text-text-secondary mt-2 self-start">
              <span>{formatCurrency(userStats.total_wallet_balance)} total</span>
            </div>
          </Card>

          <Card className="flex flex-col items-center p-4">
            <div className="flex justify-between items-center w-full mb-2">
              <span className="text-text-secondary dark:text-text-secondary text-sm">Users with Plans</span>
              <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                <UsersIcon className="h-5 w-5 text-purple-500" />
              </div>
            </div>
            <div className="text-2xl font-bold text-text dark:text-text self-start">{userStats.users_with_plans}</div>
            <div className="flex items-center text-xs text-text-secondary dark:text-text-secondary mt-2 self-start">
              <span>Active payout plans</span>
            </div>
          </Card>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-text-secondary dark:text-text-secondary" />
          </div>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-border dark:border-border rounded-md bg-white dark:bg-background-tertiary text-text dark:text-text focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light"
          />
        </div>
        <div className="flex overflow-x-auto pb-2 space-x-2">
          <button
            onClick={() => setFilterType('all')}
            className={getFilterButtonClass('all')}
          >
            All Users
          </button>
          <button
            onClick={() => setFilterType('admin')}
            className={getFilterButtonClass('admin')}
          >
            Admins ({userStats?.admin_users || 0})
          </button>
          <button
            onClick={() => setFilterType('with_balance')}
            className={getFilterButtonClass('with_balance')}
          >
            With Balance ({userStats?.users_with_balance || 0})
          </button>
          <button
            onClick={() => setFilterType('with_plans')}
            className={getFilterButtonClass('with_plans')}
          >
            With Plans ({userStats?.users_with_plans || 0})
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white dark:bg-surface rounded-lg shadow mb-6 overflow-hidden">
        <div className="grid grid-cols-3 gap-4 p-4 border-b border-border dark:border-border">
          <div className="text-center">
            <p className="text-xl font-bold text-text dark:text-text">{filteredUsers.length}</p>
            <p className="text-sm text-text-secondary dark:text-text-secondary">
              {filterType === 'all' ? 'Total Users' : 'Filtered Results'}
            </p>
          </div>
          <div className="text-center border-x border-border dark:border-border">
            <p className="text-xl font-bold text-text dark:text-text">
              {userStats?.new_users_this_month || 0}
            </p>
            <p className="text-sm text-text-secondary dark:text-text-secondary">New (30d)</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-text dark:text-text">
              {userStats?.active_users_this_month || 0}
            </p>
            <p className="text-sm text-text-secondary dark:text-text-secondary">Active (30d)</p>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border dark:divide-border">
              <thead className="bg-background-tertiary dark:bg-background-tertiary">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary dark:text-text-secondary uppercase tracking-wider">
                    User
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary dark:text-text-secondary uppercase tracking-wider">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary dark:text-text-secondary uppercase tracking-wider">
                    Joined
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary dark:text-text-secondary uppercase tracking-wider">
                    Balance
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary dark:text-text-secondary uppercase tracking-wider">
                    Activity
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-secondary dark:text-text-secondary uppercase tracking-wider">
                    Role
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-text-secondary dark:text-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-surface divide-y divide-border dark:divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-background-tertiary dark:hover:bg-background-tertiary/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white">
                          <span className="font-medium">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-text dark:text-text">
                            {user.first_name} {user.last_name}
                          </div>
                          {user.is_admin && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-secondary dark:text-text-secondary">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text-secondary dark:text-text-secondary">
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-text dark:text-text">
                        {formatCurrency(user.balance)}
                      </div>
                      {user.locked_balance > 0 && (
                        <div className="text-xs text-text-tertiary dark:text-text-tertiary">
                          {formatCurrency(user.locked_balance)} locked
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-text dark:text-text">
                        <div className="flex items-center space-x-4">
                          <span className="text-xs text-text-secondary dark:text-text-secondary">
                            {user.total_deposits > 0 && `${formatCurrency(user.total_deposits)} in`}
                          </span>
                          <span className="text-xs text-text-secondary dark:text-text-secondary">
                            {user.active_plans > 0 && `${user.active_plans} plans`}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.is_admin 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                      }`}>
                        {user.is_admin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link 
                        to={`/users/${user.id}`}
                        className="text-primary dark:text-primary-light hover:text-primary-dark dark:hover:text-primary-light/80"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <UsersIcon className="mx-auto h-12 w-12 text-text-tertiary dark:text-text-tertiary mb-4" />
            <p className="text-text-secondary dark:text-text-secondary">
              {searchQuery || filterType !== 'all' ? 'No users match your filters' : 'No users found'}
            </p>
            {(searchQuery || filterType !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                }}
                className="mt-2 text-primary dark:text-primary-light hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}