import { RefreshCw } from 'lucide-react';
import Card from '../../components/Card';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { format, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { useDashboardData } from '@/hooks/queries/useDashboardData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import StatCard from '@/components/StatCard';
import BannerCarousel from '@/components/BannerCarousel';
import { Users, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function Dashboard() {
  const { data: dashboardData, isLoading, error } = useDashboardData();
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['dashboard']);
  };

  // Generate labels for the last 7 days
  const labels = Array.from({ length: 7 }, (_, i) => {
    return format(subDays(new Date(), 6 - i), 'dd/MM');
  });

  // Chart data from transaction trends
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Daily Transactions',
        data: dashboardData?.transactionTrends.map(trend => trend.total_transactions || 0) || [],
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load dashboard data</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text">Dashboard</h1>
          <p className="text-text-secondary dark:text-text-secondary">Overview of Planmoni platform</p>
        </div>
        <button 
          onClick={handleRefresh}
          className="p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-primary dark:text-primary ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Banner Carousel */}
      <div className="mb-6">
        <BannerCarousel />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toString()}
          icon={<Users className="h-5 w-5 text-primary dark:text-primary" />}
          trend={stats.userGrowthTrend}
        />

        <StatCard
          title="Total Deposits"
          value={`₦${stats.totalDeposits.toLocaleString()}`}
          icon={<ArrowUpRight className="h-5 w-5 text-success dark:text-success" />}
          trend={stats.depositsTrend}
        />

        <StatCard
          title="Total Payouts"
          value={`₦${stats.totalPayouts.toLocaleString()}`}
          icon={<ArrowDownRight className="h-5 w-5 text-error dark:text-error" />}
          trend={stats.payoutsTrend}
        />

        <StatCard
          title="Total Plans"
          value={stats.totalPlans.toString()}
          icon={<Calendar className="h-5 w-5 text-warning dark:text-warning" />}
          trend={stats.plansTrend}
        />
      </div>

      <div className="mb-8">
        <Card title="Transaction Trends (Last 7 Days)" className="p-4">
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-text dark:text-text mb-4">Recent Transactions</h2>
          <Card className="overflow-hidden">
            {stats.recentTransactions.length > 0 ? (
              <div className="divide-y divide-border dark:divide-border">
                {stats.recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex justify-between items-center p-4">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        transaction.type === 'deposit' ? 'bg-success-light dark:bg-success-light/20' : 'bg-error-light dark:bg-error-light/20'
                      }`}>
                        {transaction.type === 'deposit' ? (
                          <ArrowUpRight className="h-5 w-5 text-success dark:text-success" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5 text-error dark:text-error" />
                        )}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-semibold text-text dark:text-text">
                          {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                        </p>
                        <p className="text-xs text-text-secondary dark:text-text-secondary">
                          {transaction.profiles?.first_name} {transaction.profiles?.last_name}
                        </p>
                        <p className="text-xs text-text-tertiary dark:text-text-tertiary">
                          {new Date(transaction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${
                      transaction.type === 'deposit' ? 'text-success dark:text-success' : 'text-error dark:text-error'
                    }`}>
                      {transaction.type === 'deposit' ? '+' : '-'}₦{transaction.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-text-secondary dark:text-text-secondary">No recent transactions</p>
            )}
            <div className="border-t border-border dark:border-border p-4 text-center">
              <Link 
                to="/transactions" 
                className="text-primary dark:text-primary-light hover:underline text-sm font-medium transition-colors"
              >
                View All Transactions
              </Link>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-text dark:text-text mb-4">Recent Users</h2>
          <Card className="overflow-hidden">
            {stats.recentUsers.length > 0 ? (
              <div className="divide-y divide-border dark:divide-border">
                {stats.recentUsers.map((user) => (
                  <div key={user.id} className="flex justify-between items-center p-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
                        <span className="text-sm font-medium">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </span>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-semibold text-text dark:text-text">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-text-secondary dark:text-text-secondary">{user.email}</p>
                        <p className="text-xs text-text-tertiary dark:text-text-tertiary">
                          Joined: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Link 
                      to={`/users/${user.id}`}
                      className="px-3 py-1 text-xs font-medium text-primary dark:text-primary-light bg-background-tertiary dark:bg-background-tertiary rounded hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
                    >
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-text-secondary dark:text-text-secondary">No recent users</p>
            )}
            <div className="border-t border-border dark:border-border p-4 text-center">
              <Link 
                to="/users" 
                className="text-primary dark:text-primary-light hover:underline text-sm font-medium transition-colors"
              >
                View All Users
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}