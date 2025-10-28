import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, Users as UsersIcon, TrendingUp, Wallet } from 'lucide-react';
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

    if (searchQuery) {
      filtered = filtered.filter(user =>
        user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

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
    const baseClass = "px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0";
    const activeClass = "bg-gray-900 text-white shadow-sm";
    const inactiveClass = "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200";

    return `${baseClass} ${filterType === type ? activeClass : inactiveClass}`;
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load users data</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Users</h1>
          <p className="text-sm md:text-base text-gray-500">Manage all users on the platform</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2.5 md:p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {userStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6 md:mb-8">
          <div className="bg-white rounded-2xl p-5 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Total Users</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900">{userStats.total_users}</p>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <UsersIcon className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 md:pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50">
                <TrendingUp size={14} className="text-green-600" />
                <span className="text-xs font-semibold text-green-600">+{userStats.new_users_this_month}</span>
              </div>
              <span className="text-xs text-gray-400">this month</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Active Users</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900">{userStats.active_users_this_month}</p>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 md:pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">This month</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Users with Balance</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900">{userStats.users_with_balance}</p>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-yellow-50 flex items-center justify-center flex-shrink-0">
                <Wallet className="h-4 w-4 md:h-5 md:w-5 text-yellow-600" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 md:pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">{formatCurrency(userStats.total_wallet_balance)} total</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 md:p-6 shadow-soft border border-gray-100">
            <div className="flex justify-between items-start mb-3 md:mb-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 mb-1">Users with Plans</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900">{userStats.users_with_plans}</p>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                <UsersIcon className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 md:pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Active payout plans</span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 md:gap-4">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 md:pl-11 pr-3 md:pr-4 py-2.5 md:py-3 text-sm md:text-base border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
          />
        </div>
        <div className="flex overflow-x-auto pb-2 -mx-1 px-1 space-x-2 scrollbar-hide">
          <button
            onClick={() => setFilterType('all')}
            className={getFilterButtonClass('all')}
          >
            All
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
            Balance ({userStats?.users_with_balance || 0})
          </button>
          <button
            onClick={() => setFilterType('with_plans')}
            className={getFilterButtonClass('with_plans')}
          >
            Plans ({userStats?.users_with_plans || 0})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 mb-6 overflow-hidden">
        <div className="grid grid-cols-3 gap-3 md:gap-4 p-4 md:p-6">
          <div className="text-center">
            <p className="text-xl md:text-2xl font-bold text-gray-900">{filteredUsers.length}</p>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {filterType === 'all' ? 'Total Users' : 'Filtered'}
            </p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-xl md:text-2xl font-bold text-gray-900">
              {userStats?.new_users_this_month || 0}
            </p>
            <p className="text-xs md:text-sm text-gray-500 mt-1">New (30d)</p>
          </div>
          <div className="text-center">
            <p className="text-xl md:text-2xl font-bold text-gray-900">
              {userStats?.active_users_this_month || 0}
            </p>
            <p className="text-xs md:text-sm text-gray-500 mt-1">Active (30d)</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
          </div>
        ) : filteredUsers.length > 0 ? (
          <>
            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <Link
                  key={user.id}
                  to={`/users/${user.id}`}
                  className="block p-4 hover:bg-gray-50 transition-colors w-full"
                >
                  <div className="flex items-start gap-3 mb-3 w-full">
                    <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                      <span className="font-semibold text-sm">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1 flex-wrap">
                        <h3 className="text-md font-semibold text-gray-900">
                          {user.first_name} {user.last_name}
                        </h3>
                        {user.is_admin && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 flex-shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 break-all">{user.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs w-full">
                    <div className="min-w-0">
                      <p className="text-gray-400 mb-0.5">Balance</p>
                      <p className="font-semibold text-gray-900 break-words">{formatCurrency(user.balance)}</p>
                      {user.locked_balance > 0 && (
                        <p className="text-gray-400 text-[10px] mt-0.5 break-words">{formatCurrency(user.locked_balance)} locked</p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-400 mb-0.5">Activity</p>
                      {user.total_deposits > 0 && (
                        <p className="text-gray-600 break-words">{formatCurrency(user.total_deposits)} in</p>
                      )}
                      {user.active_plans > 0 && (
                        <p className="text-gray-600">{user.active_plans} plans</p>
                      )}
                      {user.total_deposits === 0 && user.active_plans === 0 && (
                        <p className="text-gray-400">No activity</p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-400 mb-0.5">Joined</p>
                      <p className="text-gray-600">{new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-400 mb-0.5">Role</p>
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                        user.is_admin
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-50 text-gray-600'
                      }`}>
                        {user.is_admin ? 'Admin' : 'User'}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Joined
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Balance
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Activity
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Role
                    </th>
                    <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                            <span className="font-semibold text-sm">
                              {user.first_name?.[0]}{user.last_name?.[0]}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900">
                              {user.first_name} {user.last_name}
                            </div>
                            {user.is_admin && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 mt-1">
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(user.balance)}
                        </div>
                        {user.locked_balance > 0 && (
                          <div className="text-xs text-gray-400">
                            {formatCurrency(user.locked_balance)} locked
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center space-x-4">
                            <span className="text-xs text-gray-500">
                              {user.total_deposits > 0 && `${formatCurrency(user.total_deposits)} in`}
                            </span>
                            <span className="text-xs text-gray-500">
                              {user.active_plans > 0 && `${user.active_plans} plans`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-lg ${
                          user.is_admin
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-50 text-gray-600'
                        }`}>
                          {user.is_admin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={`/users/${user.id}`}
                          className="text-primary hover:text-primary-light transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <UsersIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500">
              {searchQuery || filterType !== 'all' ? 'No users match your filters' : 'No users found'}
            </p>
            {(searchQuery || filterType !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                }}
                className="mt-4 px-4 py-2 text-sm font-medium text-primary bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
