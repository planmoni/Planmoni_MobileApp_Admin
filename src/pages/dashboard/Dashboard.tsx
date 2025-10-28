import { RefreshCw } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { format, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { useDashboardData } from '@/hooks/queries/useDashboardData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import StatCard from '@/components/StatCard';
import { Users, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function Dashboard() {
  const { data: dashboardData, isLoading, error } = useDashboardData();
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['dashboard']);
  };

  const labels = Array.from({ length: 7 }, (_, i) => {
    return format(subDays(new Date(), 6 - i), 'dd/MM');
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Daily Transactions',
        data: dashboardData?.transactionTrends.map(trend => trend.total_transactions || 0) || [],
        borderColor: '#86EFAC',
        backgroundColor: 'rgba(134, 239, 172, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#86EFAC',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0F172A',
        padding: 12,
        borderRadius: 8,
        titleFont: {
          size: 13,
          weight: 600,
        },
        bodyFont: {
          size: 14,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#F3F4F6',
          drawBorder: false,
        },
        ticks: {
          color: '#94A3B8',
          font: {
            size: 11,
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#94A3B8',
          font: {
            size: 11,
          },
        },
      },
    },
  };

  if (isLoading) {
    return (
      <LoadingScreen />
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load dashboard data</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const stats = dashboardData || {
    totalUsers: 0,
    totalDeposits: 0,
    totalPayouts: 0,
    totalPlans: 0,
    activeUsers: 0,
    recentTransactions: [],
    recentUsers: [],
    transactionTrends: [],
    userGrowthTrend: 0,
    depositsTrend: 0,
    payoutsTrend: 0,
    plansTrend: 0,
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Dashboard</h1>
          <p className="text-gray-500">Overview of Planmoni platform</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toString()}
          icon={<Users className="h-5 w-5 text-primary" />}
          trend={stats.userGrowthTrend}
        />

        <StatCard
          title="Total Deposits"
          value={`₦${stats.totalDeposits.toLocaleString()}`}
          icon={<ArrowUpRight className="h-5 w-5 text-success" />}
          trend={stats.depositsTrend}
        />

        <StatCard
          title="Total Payouts"
          value={`₦${stats.totalPayouts.toLocaleString()}`}
          icon={<ArrowDownRight className="h-5 w-5 text-error" />}
          trend={stats.payoutsTrend}
        />

        <StatCard
          title="Total Plans"
          value={stats.totalPlans.toString()}
          icon={<Calendar className="h-5 w-5 text-warning" />}
          trend={stats.plansTrend}
        />
      </div>

      <div className="mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Transaction Trends</h3>
              <p className="text-sm text-gray-500">Last 7 days</p>
            </div>
          </div>
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            {stats.recentTransactions.length > 0 ? (
              <div>
                {stats.recentTransactions.map((transaction, index) => (
                  <div
                    key={transaction.id}
                    className={`flex justify-between items-center p-5 hover:bg-gray-50 transition-colors ${
                      index !== stats.recentTransactions.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                        transaction.type === 'deposit' ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        {transaction.type === 'deposit' ? (
                          <ArrowUpRight className="h-5 w-5 text-green-600" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {transaction.profiles?.first_name} {transaction.profiles?.last_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${
                      transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {transaction.type === 'deposit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">No recent transactions</p>
            )}
            <div className="border-t border-gray-100 p-4 text-center bg-gray-50">
              <Link
                to="/transactions"
                className="text-primary hover:text-primary-light text-sm font-medium transition-colors"
              >
                View All Transactions
              </Link>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Users</h2>
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            {stats.recentUsers.length > 0 ? (
              <div>
                {stats.recentUsers.map((user, index) => (
                  <div
                    key={user.id}
                    className={`flex justify-between items-center p-5 hover:bg-gray-50 transition-colors ${
                      index !== stats.recentUsers.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                        <span className="text-sm font-semibold">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </span>
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                        <p className="text-xs text-gray-400">
                          Joined: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/users/${user.id}`}
                      className="px-4 py-2 text-xs font-medium text-primary bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">No recent users</p>
            )}
            <div className="border-t border-gray-100 p-4 text-center bg-gray-50">
              <Link
                to="/users"
                className="text-primary hover:text-primary-light text-sm font-medium transition-colors"
              >
                View All Users
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
