import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, CircleCheck as CheckCircle, Circle as XCircle, Clock, Calendar, User, ChevronLeft, ChevronRight, Wallet, DollarSign, CirclePause as PauseCircle } from 'lucide-react';
import { useVaults } from '@/hooks/queries/useVaults';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { format } from 'date-fns';
import { Pie, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function Vaults() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed' | 'cancelled'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const { data, isLoading, error } = useVaults(searchQuery, statusFilter, currentPage, pageSize);
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['vaults']);
  };

  const handleCardClick = (status: string) => {
    setStatusFilter(status as any);
    setCurrentPage(1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700';
      case 'paused':
        return 'bg-yellow-50 text-yellow-700';
      case 'completed':
        return 'bg-blue-50 text-blue-700';
      case 'cancelled':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Clock className="h-4 w-4" />;
      case 'paused':
        return <PauseCircle className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load vaults</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  const { vaults = [], stats, totalCount = 0, totalPages = 0 } = data || {};

  const statusPieData = {
    labels: ['Active', 'Paused', 'Completed', 'Cancelled'],
    datasets: [
      {
        data: [
          stats?.active || 0,
          stats?.paused || 0,
          stats?.completed || 0,
          stats?.cancelled || 0
        ],
        backgroundColor: [
          '#10b981',
          '#f59e0b',
          '#3b82f6',
          '#ef4444'
        ],
        borderWidth: 0,
      },
    ],
  };

  const balanceBarData = {
    labels: ['Total Funded', 'Current Balance', 'Total Spent'],
    datasets: [
      {
        label: 'Amount (NGN)',
        data: [stats?.totalFunded || 0, stats?.totalBalance || 0, stats?.totalSpent || 0],
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          font: {
            size: 12
          }
        }
      },
    },
  };

  const barChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return new Intl.NumberFormat('en-NG', {
              style: 'currency',
              currency: 'NGN',
              notation: 'compact'
            }).format(value);
          }
        }
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Vaults</h1>
          <p className="text-gray-500">Manage and monitor all user budget vaults</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <button
          onClick={() => handleCardClick('all')}
          className={`bg-white rounded-2xl p-6 shadow-soft border transition-all hover:shadow-md ${
            statusFilter === 'all' ? 'border-gray-900 ring-2 ring-gray-900' : 'border-gray-100'
          }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Vaults</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">All budget vaults</span>
          </div>
        </button>

        <button
          onClick={() => handleCardClick('active')}
          className={`bg-white rounded-2xl p-6 shadow-soft border transition-all hover:shadow-md ${
            statusFilter === 'active' ? 'border-green-600 ring-2 ring-green-600' : 'border-gray-100'
          }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-500 mb-1">Active</p>
              <p className="text-3xl font-bold text-green-600">{stats?.active || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Currently active</span>
          </div>
        </button>

        <button
          onClick={() => handleCardClick('paused')}
          className={`bg-white rounded-2xl p-6 shadow-soft border transition-all hover:shadow-md ${
            statusFilter === 'paused' ? 'border-yellow-600 ring-2 ring-yellow-600' : 'border-gray-100'
          }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-500 mb-1">Paused</p>
              <p className="text-3xl font-bold text-yellow-600">{stats?.paused || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center">
              <PauseCircle className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Temporarily paused</span>
          </div>
        </button>

        <button
          onClick={() => handleCardClick('completed')}
          className={`bg-white rounded-2xl p-6 shadow-soft border transition-all hover:shadow-md ${
            statusFilter === 'completed' ? 'border-blue-600 ring-2 ring-blue-600' : 'border-gray-100'
          }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-500 mb-1">Completed</p>
              <p className="text-3xl font-bold text-blue-600">{stats?.completed || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Successfully finished</span>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Vaults by Status</h3>
          <div className="h-64 md:h-80">
            <Pie data={statusPieData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Vault Finances</h3>
          <div className="h-64 md:h-80">
            <Bar data={balanceBarData} options={barChartOptions} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Funded</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Intl.NumberFormat('en-NG', {
                  style: 'currency',
                  currency: 'NGN'
                }).format(stats?.totalFunded || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Current Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Intl.NumberFormat('en-NG', {
                  style: 'currency',
                  currency: 'NGN'
                }).format(stats?.totalBalance || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Remaining Funds</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Intl.NumberFormat('en-NG', {
                  style: 'currency',
                  currency: 'NGN'
                }).format(stats?.totalSpent || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100 mb-6">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by vault name or user email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all appearance-none bg-white cursor-pointer text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {(searchQuery || statusFilter !== 'all') && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-gray-900">×</button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('all')} className="hover:text-gray-900">×</button>
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        {vaults && vaults.length > 0 ? (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Vault Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Total Budget
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Current Balance
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Total Spent
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Dates
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vaults.map((vault: any) => (
                    <tr
                      key={vault.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/vaults/${vault.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                            {vault.user?.first_name && vault.user?.last_name ? (
                              <span className="text-sm font-semibold">
                                {vault.user.first_name[0]}{vault.user.last_name[0]}
                              </span>
                            ) : (
                              <User className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            {vault.user?.first_name && vault.user?.last_name ? (
                              <div className="font-medium text-gray-900">
                                {vault.user.first_name} {vault.user.last_name}
                              </div>
                            ) : null}
                            <div className="text-sm text-gray-500">{vault.user?.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900">{vault.name}</div>
                          {vault.plan_name && vault.plan_name !== vault.name && (
                            <div className="text-xs text-gray-500 max-w-xs truncate">{vault.plan_name}</div>
                          )}
                          {vault.auto_topup_enabled && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                              Auto Top-up
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {new Intl.NumberFormat('en-NG', {
                            style: 'currency',
                            currency: 'NGN'
                          }).format(vault.total_budget || 0)}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-green-600">
                          {new Intl.NumberFormat('en-NG', {
                            style: 'currency',
                            currency: 'NGN'
                          }).format(vault.current_balance || 0)}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-orange-600">
                          {new Intl.NumberFormat('en-NG', {
                            style: 'currency',
                            currency: 'NGN'
                          }).format(vault.total_spent || 0)}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${getStatusColor(vault.status)}`}>
                          {getStatusIcon(vault.status)}
                          <span className="ml-1 capitalize">{vault.status}</span>
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {vault.start_date ? format(new Date(vault.start_date), 'MMM d, yyyy') : 'N/A'}
                        </div>
                        {vault.end_date && (
                          <div className="text-xs text-gray-400">
                            End: {format(new Date(vault.end_date), 'MMM d, yyyy')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-100">
              {vaults.map((vault: any) => (
                <div
                  key={vault.id}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/vaults/${vault.id}`)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                      {vault.user?.first_name && vault.user?.last_name ? (
                        <span className="text-sm font-semibold">
                          {vault.user.first_name[0]}{vault.user.last_name[0]}
                        </span>
                      ) : (
                        <User className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {vault.user?.first_name && vault.user?.last_name && (
                        <div className="font-semibold text-gray-900 mb-0.5">
                          {vault.user.first_name} {vault.user.last_name}
                        </div>
                      )}
                      <div className="text-sm text-gray-500 truncate">{vault.user?.email}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(vault.status)} flex-shrink-0`}>
                      {getStatusIcon(vault.status)}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 mb-0.5">{vault.name}</div>
                      {vault.plan_name && vault.plan_name !== vault.name && (
                        <div className="text-xs text-gray-500 line-clamp-2">{vault.plan_name}</div>
                      )}
                      {vault.auto_topup_enabled && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 mt-1">
                          Auto Top-up
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-0.5">Total Budget</div>
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {new Intl.NumberFormat('en-NG', {
                            style: 'currency',
                            currency: 'NGN',
                            notation: 'compact'
                          }).format(vault.total_budget || 0)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-0.5">Current Balance</div>
                        <div className="text-sm font-semibold text-green-600 truncate">
                          {new Intl.NumberFormat('en-NG', {
                            style: 'currency',
                            currency: 'NGN',
                            notation: 'compact'
                          }).format(vault.current_balance || 0)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-0.5">Total Spent</div>
                        <div className="text-sm font-semibold text-orange-600 truncate">
                          {new Intl.NumberFormat('en-NG', {
                            style: 'currency',
                            currency: 'NGN',
                            notation: 'compact'
                          }).format(vault.total_spent || 0)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 mb-0.5">Start Date</div>
                        <div className="text-sm text-gray-900 truncate">
                          {vault.start_date ? format(new Date(vault.start_date), 'MMM d, yy') : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">
              {searchQuery || statusFilter !== 'all'
                ? 'No vaults match your filters'
                : 'No vaults available'}
            </p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 md:px-6 py-4 border-t border-gray-100">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="text-sm text-gray-500 text-center md:text-left">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} results
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                          currentPage === pageNum
                            ? 'bg-gray-900 text-white'
                            : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
