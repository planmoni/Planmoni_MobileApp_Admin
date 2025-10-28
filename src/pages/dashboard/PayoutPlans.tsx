import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, CheckCircle, XCircle, Clock, Calendar, User, ChevronLeft, ChevronRight, TrendingUp, DollarSign } from 'lucide-react';
import { usePayoutPlans } from '@/hooks/queries/usePayoutPlans';
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

export default function PayoutPlans() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const { data, isLoading, error } = usePayoutPlans(searchQuery, statusFilter, frequencyFilter, currentPage, pageSize);
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['payout-plans']);
  };

  const handleCardClick = (status: string) => {
    setStatusFilter(status as any);
    setCurrentPage(1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 text-green-700';
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
        <p className="text-error mb-4">Failed to load payout plans</p>
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

  const { plans = [], stats, totalCount = 0, totalPages = 0 } = data || {};

  const frequencyPieData = {
    labels: ['Daily', 'Specific Days', 'Weekly', 'Bi-Weekly', 'Monthly', 'Month End', 'Quarterly', 'Bi-Annually', 'Annually', 'Custom'],
    datasets: [
      {
        data: [
          stats?.daily || 0,
          stats?.specificDays || 0,
          stats?.weekly || 0,
          stats?.biWeekly || 0,
          stats?.monthly || 0,
          stats?.monthEnd || 0,
          stats?.quarterly || 0,
          stats?.biAnnually || 0,
          stats?.annually || 0,
          stats?.custom || 0
        ],
        backgroundColor: [
          '#3b82f6',
          '#8b5cf6',
          '#ec4899',
          '#f59e0b',
          '#10b981',
          '#06b6d4',
          '#6366f1',
          '#f97316',
          '#14b8a6',
          '#64748b'
        ],
        borderWidth: 0,
      },
    ],
  };

  const statusBarData = {
    labels: ['Active', 'Completed', 'Cancelled'],
    datasets: [
      {
        label: 'Payout Plans',
        data: [stats?.active || 0, stats?.completed || 0, stats?.cancelled || 0],
        backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
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
          precision: 0
        }
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Payout Plans</h1>
          <p className="text-gray-500">Manage and monitor all user payout plans</p>
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
              <p className="text-sm font-medium text-gray-500 mb-1">Total Plans</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">All payout plans</span>
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
            <span className="text-xs text-gray-500">Currently running</span>
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

        <button
          onClick={() => handleCardClick('cancelled')}
          className={`bg-white rounded-2xl p-6 shadow-soft border transition-all hover:shadow-md ${
            statusFilter === 'cancelled' ? 'border-red-600 ring-2 ring-red-600' : 'border-gray-100'
          }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-500 mb-1">Cancelled</p>
              <p className="text-3xl font-bold text-red-600">{stats?.cancelled || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">User cancelled</span>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Plans by Frequency</h3>
          <div className="h-80">
            <Pie data={frequencyPieData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Plans by Status</h3>
          <div className="h-80">
            <Bar data={statusBarData} options={barChartOptions} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Plan Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Intl.NumberFormat('en-NG', {
                  style: 'currency',
                  currency: 'NGN'
                }).format(stats?.totalAmount || 0)}
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
              <p className="text-sm text-gray-500">Total Payout Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Intl.NumberFormat('en-NG', {
                  style: 'currency',
                  currency: 'NGN'
                }).format(stats?.totalPayoutAmount || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Plans by Frequency Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 bg-blue-50 rounded-xl">
            <p className="text-xs text-blue-600 font-medium mb-1">Daily</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats?.daily || 0}</p>
            <p className="text-xs text-gray-600">
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                notation: 'compact'
              }).format(stats?.dailyAmount || 0)}
            </p>
          </div>

          <div className="p-4 bg-purple-50 rounded-xl">
            <p className="text-xs text-purple-600 font-medium mb-1">Specific Days</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats?.specificDays || 0}</p>
            <p className="text-xs text-gray-600">
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                notation: 'compact'
              }).format(stats?.specificDaysAmount || 0)}
            </p>
          </div>

          <div className="p-4 bg-pink-50 rounded-xl">
            <p className="text-xs text-pink-600 font-medium mb-1">Weekly</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats?.weekly || 0}</p>
            <p className="text-xs text-gray-600">
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                notation: 'compact'
              }).format(stats?.weeklyAmount || 0)}
            </p>
          </div>

          <div className="p-4 bg-orange-50 rounded-xl">
            <p className="text-xs text-orange-600 font-medium mb-1">Bi-Weekly</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats?.biWeekly || 0}</p>
            <p className="text-xs text-gray-600">
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                notation: 'compact'
              }).format(stats?.biWeeklyAmount || 0)}
            </p>
          </div>

          <div className="p-4 bg-green-50 rounded-xl">
            <p className="text-xs text-green-600 font-medium mb-1">Monthly</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats?.monthly || 0}</p>
            <p className="text-xs text-gray-600">
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                notation: 'compact'
              }).format(stats?.monthlyAmount || 0)}
            </p>
          </div>

          <div className="p-4 bg-cyan-50 rounded-xl">
            <p className="text-xs text-cyan-600 font-medium mb-1">Month End</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats?.monthEnd || 0}</p>
            <p className="text-xs text-gray-600">
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                notation: 'compact'
              }).format(stats?.monthEndAmount || 0)}
            </p>
          </div>

          <div className="p-4 bg-indigo-50 rounded-xl">
            <p className="text-xs text-indigo-600 font-medium mb-1">Quarterly</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats?.quarterly || 0}</p>
            <p className="text-xs text-gray-600">
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                notation: 'compact'
              }).format(stats?.quarterlyAmount || 0)}
            </p>
          </div>

          <div className="p-4 bg-orange-50 rounded-xl">
            <p className="text-xs text-orange-600 font-medium mb-1">Bi-Annually</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats?.biAnnually || 0}</p>
            <p className="text-xs text-gray-600">
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                notation: 'compact'
              }).format(stats?.biAnnuallyAmount || 0)}
            </p>
          </div>

          <div className="p-4 bg-teal-50 rounded-xl">
            <p className="text-xs text-teal-600 font-medium mb-1">Annually</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats?.annually || 0}</p>
            <p className="text-xs text-gray-600">
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                notation: 'compact'
              }).format(stats?.annuallyAmount || 0)}
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-600 font-medium mb-1">Custom</p>
            <p className="text-2xl font-bold text-gray-900 mb-1">{stats?.custom || 0}</p>
            <p className="text-xs text-gray-600">
              {new Intl.NumberFormat('en-NG', {
                style: 'currency',
                currency: 'NGN',
                notation: 'compact'
              }).format(stats?.customAmount || 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or description..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-8 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all appearance-none bg-white cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={frequencyFilter}
                onChange={(e) => {
                  setFrequencyFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-8 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all appearance-none bg-white cursor-pointer"
              >
                <option value="all">All Frequencies</option>
                <option value="daily">Daily</option>
                <option value="specific_days">Specific Days</option>
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="month_end">Month End</option>
                <option value="quarterly">Quarterly</option>
                <option value="bi-annually">Bi-Annually</option>
                <option value="annually">Annually</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
        </div>

        {(searchQuery || statusFilter !== 'all' || frequencyFilter !== 'all') && (
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
            {frequencyFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                Frequency: {frequencyFilter}
                <button onClick={() => setFrequencyFilter('all')} className="hover:text-gray-900">×</button>
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setFrequencyFilter('all');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        {plans && plans.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Plan Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Payout Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plans.map((plan: any) => (
                  <tr
                    key={plan.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/users/${plan.user_id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                          {plan.user?.first_name && plan.user?.last_name ? (
                            <span className="text-sm font-semibold">
                              {plan.user.first_name[0]}{plan.user.last_name[0]}
                            </span>
                          ) : (
                            <User className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          {plan.user?.first_name && plan.user?.last_name ? (
                            <div className="font-medium text-gray-900">
                              {plan.user.first_name} {plan.user.last_name}
                            </div>
                          ) : null}
                          <div className="text-sm text-gray-500">{plan.user?.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-gray-900">{plan.name}</div>
                        {plan.description && (
                          <div className="text-xs text-gray-500 max-w-xs truncate">{plan.description}</div>
                        )}
                        {plan.is_ai_generated && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                            AI Generated
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 capitalize">
                        {plan.frequency.replace('_', ' ').replace('-', ' ')}
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {new Intl.NumberFormat('en-NG', {
                          style: 'currency',
                          currency: 'NGN'
                        }).format(plan.total_amount || 0)}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600">
                        {new Intl.NumberFormat('en-NG', {
                          style: 'currency',
                          currency: 'NGN'
                        }).format(plan.payout_amount || 0)}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${getStatusColor(plan.status)}`}>
                        {getStatusIcon(plan.status)}
                        <span className="ml-1 capitalize">{plan.status}</span>
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-3 w-3" />
                        {plan.start_date ? format(new Date(plan.start_date), 'MMM d, yyyy') : 'N/A'}
                      </div>
                      {plan.next_payout_date && (
                        <div className="text-xs text-gray-400">
                          Next: {format(new Date(plan.next_payout_date), 'MMM d')}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="text-sm text-gray-900">
                          {plan.completed_payouts || 0} / {plan.duration}
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, ((plan.completed_payouts || 0) / plan.duration) * 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">
              {searchQuery || statusFilter !== 'all' || frequencyFilter !== 'all'
                ? 'No payout plans match your filters'
                : 'No payout plans available'}
            </p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-500">
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
                      className={`px-3 py-2 rounded-lg transition-colors ${
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
        )}
      </div>
    </div>
  );
}
