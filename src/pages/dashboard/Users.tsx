import { useState, useEffect, useMemo, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, RefreshCw, Users as UsersIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUsersData, useUserTiers } from '@/hooks/queries/useUsersData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { TierBadge } from '@/components/KycBadges';
import type { KycTier } from '@/hooks/queries/useKycData';

type FilterType = 'all' | 'admin' | 'with_balance' | 'with_plans';
type TierFilter = 'all' | KycTier;

const PAGE_SIZE = 25;

const TIER_FILTERS: Array<{ id: TierFilter; label: string }> = [
  { id: 'all', label: 'All tiers' },
  { id: 0, label: 'Unverified' },
  { id: 1, label: 'Tier 1' },
  { id: 2, label: 'Tier 2' },
  { id: 3, label: 'Tier 3' },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
  }).format(amount || 0);

export default function Users() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('search') || '');
  const { data: usersData, isLoading, isFetching, error } = useUsersData(debouncedSearch);
  const { data: tierMap, isLoading: tiersLoading } = useUserTiers();
  const refreshData = useRefreshData();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [page, setPage] = useState(1);

  const users = usersData?.users || [];
  const userStats = usersData?.stats;

  const tierOf = (userId: string): KycTier => tierMap?.[userId] ?? 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch && urlSearch !== searchInput) {
      setSearchInput(urlSearch);
      setDebouncedSearch(urlSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Back to the first page whenever the result set changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterType, tierFilter]);

  const handleRefresh = () => {
    refreshData.mutate(['users']);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (filterType === 'admin' && !user.is_admin) return false;
      if (filterType === 'with_balance' && !(user.balance > 0)) return false;
      if (filterType === 'with_plans' && !(user.active_plans > 0)) return false;
      if (tierFilter !== 'all' && (tierMap?.[user.id] ?? 0) !== tierFilter) return false;
      return true;
    });
  }, [users, filterType, tierFilter, tierMap]);

  const tierCounts = useMemo(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const user of users) counts[tierMap?.[user.id] ?? 0] += 1;
    return counts;
  }, [users, tierMap]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageUsers = filteredUsers.slice(pageStart, pageStart + PAGE_SIZE);

  const openUser = (userId: string) => navigate(`/users/${userId}`);
  const onRowKeyDown = (e: KeyboardEvent, userId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openUser(userId);
    }
  };

  const chipClass = (active: boolean) =>
    `px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
      active
        ? 'bg-gray-900 text-white shadow-sm'
        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
    }`;

  const clearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setFilterType('all');
    setTierFilter('all');
  };

  const hasFilters = Boolean(debouncedSearch) || filterType !== 'all' || tierFilter !== 'all';

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

  const statCards = userStats
    ? [
        {
          label: 'Total Users',
          value: userStats.total_users.toLocaleString(),
          hint: `+${userStats.new_users_this_month} this month`,
        },
        {
          label: 'Active Users',
          value: userStats.active_users_all_time.toLocaleString(),
          hint: 'All time',
        },
        {
          label: 'Users with Balance',
          value: userStats.users_with_balance.toLocaleString(),
          hint: `${formatCurrency(userStats.total_wallet_balance)} total`,
        },
        {
          label: 'Users with Plans',
          value: userStats.users_with_plans.toLocaleString(),
          hint: `${formatCurrency(userStats.total_plans_amount || 0)} locked`,
        },
      ]
    : [];

  return (
    <div className="w-full min-w-0">
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Users</h1>
          <p className="text-sm md:text-base text-gray-500">Manage all users on the platform</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2.5 md:p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
          aria-label="Refresh users"
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {statCards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
              <p className="text-xs md:text-sm font-medium text-gray-500 mb-1">{card.label}</p>
              <p className="text-lg font-semibold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100 break-words">{card.hint}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 md:h-5 md:w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="block w-full pl-10 md:pl-11 pr-10 md:pr-12 py-2.5 md:py-3 text-sm md:text-base border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
          />
          {isFetching && (
            <div className="absolute inset-y-0 right-0 pr-3 md:pr-4 flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-400"></div>
            </div>
          )}
        </div>

        <div className="flex overflow-x-auto pb-1 -mx-1 px-1 gap-2 scrollbar-hide">
          {TIER_FILTERS.map((t) => (
            <button
              key={String(t.id)}
              onClick={() => setTierFilter(t.id)}
              className={chipClass(tierFilter === t.id)}
            >
              {t.label}
              {t.id !== 'all' && !tiersLoading && (
                <span className={`ml-1.5 ${tierFilter === t.id ? 'text-gray-300' : 'text-gray-400'}`}>
                  {tierCounts[t.id].toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex overflow-x-auto pb-1 -mx-1 px-1 gap-2 scrollbar-hide">
          <button onClick={() => setFilterType('all')} className={chipClass(filterType === 'all')}>
            All
          </button>
          <button onClick={() => setFilterType('admin')} className={chipClass(filterType === 'admin')}>
            Admins ({userStats?.admin_users || 0})
          </button>
          <button onClick={() => setFilterType('with_balance')} className={chipClass(filterType === 'with_balance')}>
            Balance ({userStats?.users_with_balance || 0})
          </button>
          <button onClick={() => setFilterType('with_plans')} className={chipClass(filterType === 'with_plans')}>
            Plans ({userStats?.users_with_plans || 0})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
          </div>
        ) : filteredUsers.length > 0 ? (
          <>
            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {pageUsers.map((user) => (
                <div
                  key={user.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openUser(user.id)}
                  onKeyDown={(e) => onRowKeyDown(e, user.id)}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none focus:bg-gray-50"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                      <span className="font-semibold text-sm">
                        {user.first_name?.[0]}
                        {user.last_name?.[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">
                          {user.first_name} {user.last_name}
                        </h3>
                        {user.is_admin && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-900 text-white">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 break-all">{user.email}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0 mt-3.5" />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-gray-400 mb-0.5">Tier</p>
                      {tiersLoading ? (
                        <span className="text-gray-300">...</span>
                      ) : (
                        <TierBadge tier={tierOf(user.id)} size="sm" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-400 mb-0.5">Balance</p>
                      <p className="font-semibold text-gray-900 break-words">{formatCurrency(user.balance)}</p>
                      {user.locked_balance > 0 && (
                        <p className="text-gray-400 text-[10px] mt-0.5 break-words">
                          {formatCurrency(user.locked_balance)} locked
                        </p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-400 mb-0.5">Activity</p>
                      {user.total_deposits > 0 && (
                        <p className="text-gray-600 break-words">{formatCurrency(user.total_deposits)} in</p>
                      )}
                      {user.active_plans > 0 && <p className="text-gray-600">{user.active_plans} plans</p>}
                      {user.total_deposits === 0 && user.active_plans === 0 && (
                        <p className="text-gray-400">No activity</p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-400 mb-0.5">Joined</p>
                      <p className="text-gray-600">{new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className={`hidden lg:block overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['User', 'Tier', 'Balance', 'Activity', 'Joined', ''].map((h) => (
                      <th
                        key={h || 'chevron'}
                        scope="col"
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageUsers.map((user) => (
                    <tr
                      key={user.id}
                      tabIndex={0}
                      onClick={() => openUser(user.id)}
                      onKeyDown={(e) => onRowKeyDown(e, user.id)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none focus:bg-gray-50"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                            <span className="font-semibold text-sm">
                              {user.first_name?.[0]}
                              {user.last_name?.[0]}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                                {user.first_name} {user.last_name}
                              </span>
                              {user.is_admin && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-900 text-white">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 truncate max-w-[260px]">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {tiersLoading ? (
                          <span className="text-gray-300">...</span>
                        ) : (
                          <TierBadge tier={tierOf(user.id)} />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{formatCurrency(user.balance)}</div>
                        {user.locked_balance > 0 && (
                          <div className="text-xs text-gray-400">{formatCurrency(user.locked_balance)} locked</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-gray-500 space-y-0.5">
                          {user.total_deposits > 0 && <div>{formatCurrency(user.total_deposits)} in</div>}
                          {user.active_plans > 0 && <div>{user.active_plans} plans</div>}
                          {user.total_deposits === 0 && user.active_plans === 0 && (
                            <div className="text-gray-400">No activity</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ChevronRight className="h-5 w-5 text-gray-300 inline-block" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredUsers.length)} of{' '}
                {filteredUsers.length.toLocaleString()}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <UsersIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500">{hasFilters ? 'No users match your filters' : 'No users found'}</p>
            {hasFilters && (
              <button
                onClick={clearFilters}
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
