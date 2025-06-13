import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import Card from '../../components/Card';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { format, subMonths } from 'date-fns';
import { useAnalyticsData } from '@/hooks/queries/useAnalyticsData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

export default function Analytics() {
  const { data: analyticsData, isLoading, error } = useAnalyticsData();
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['analytics']);
  };

  // Generate labels for the last 6 months
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    return format(subMonths(new Date(), 5 - i), 'MMM');
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load analytics data</p>
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

  const data = analyticsData || {
    userGrowth: {
      this_month: 0,
      last_month: 0,
      percent_change: 0,
      monthly_data: [],
    },
    transactionVolume: {
      this_month: 0,
      last_month: 0,
      percent_change: 0,
      monthly_data: [],
    },
    payoutDistribution: {
      weekly: 0,
      biweekly: 0,
      monthly: 0,
      custom: 0,
    },
    retentionRate: {
      value: 0,
      trend: 'up',
      percent_change: 0,
    },
    dailyTransactions: [],
  };

  // Chart data for user growth
  const userGrowthData = {
    labels: monthLabels,
    datasets: [
      {
        label: 'New Users',
        data: data.userGrowth.monthly_data.map((item: any) => 
          typeof item === 'number' ? item : item.users || 0
        ),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.4,
      },
    ],
  };

  // Chart data for transaction volume
  const transactionVolumeData = {
    labels: monthLabels,
    datasets: [
      {
        label: 'Transaction Volume (₦)',
        data: data.transactionVolume.monthly_data.map((item: any) => {
          const volume = typeof item === 'number' ? item : item.volume || 0;
          return volume / 1000000; // Convert to millions
        }),
        backgroundColor: '#3B82F6',
        borderRadius: 4,
      },
    ],
  };

  // Chart data for daily transactions
  const dailyTransactionsData = {
    labels: data.dailyTransactions.map((item: any) => 
      typeof item === 'string' ? item : item.date || ''
    ),
    datasets: [
      {
        label: 'Deposits',
        data: data.dailyTransactions.map((item: any) => 
          typeof item === 'object' ? item.deposits_amount || 0 : 0
        ),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.4,
      },
      {
        label: 'Payouts',
        data: data.dailyTransactions.map((item: any) => 
          typeof item === 'object' ? item.payouts_amount || 0 : 0
        ),
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        tension: 0.4,
      },
    ],
  };

  // Chart data for payout distribution
  const payoutDistributionData = {
    labels: ['Weekly', 'Biweekly', 'Monthly', 'Custom'],
    datasets: [
      {
        data: [
          data.payoutDistribution.weekly,
          data.payoutDistribution.biweekly,
          data.payoutDistribution.monthly,
          data.payoutDistribution.custom,
        ],
        backgroundColor: [
          '#3B82F6', // Blue
          '#22C55E', // Green
          '#F59E0B', // Yellow
          '#EF4444', // Red
        ],
        borderWidth: 0,
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text">Analytics</h1>
          <p className="text-text-secondary dark:text-text-secondary">Platform performance metrics</p>
        </div>
        <button 
          onClick={handleRefresh}
          className="p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-primary dark:text-primary ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card title="User Growth" className="p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm text-text-secondary dark:text-text-secondary mb-1">New Users This Month</h3>
              <p className="text-2xl font-bold text-text dark:text-text">{data.userGrowth.this_month}</p>
            </div>
            <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              data.userGrowth.percent_change >= 0 
                ? 'bg-success-light dark:bg-success-light/20 text-success dark:text-success' 
                : 'bg-error-light dark:bg-error-light/20 text-error dark:text-error'
            }`}>
              {data.userGrowth.percent_change >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {Math.abs(data.userGrowth.percent_change).toFixed(1)}%
            </div>
          </div>
          <p className="text-xs text-text-secondary dark:text-text-secondary mb-4">
            vs {data.userGrowth.last_month} last month
          </p>
          <div className="h-64">
            <Line data={userGrowthData} options={chartOptions} />
          </div>
        </Card>

        <Card title="Transaction Volume" className="p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm text-text-secondary dark:text-text-secondary mb-1">Volume This Month</h3>
              <p className="text-2xl font-bold text-text dark:text-text">₦{data.transactionVolume.this_month.toLocaleString()}</p>
            </div>
            <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              data.transactionVolume.percent_change >= 0 
                ? 'bg-success-light dark:bg-success-light/20 text-success dark:text-success' 
                : 'bg-error-light dark:bg-error-light/20 text-error dark:text-error'
            }`}>
              {data.transactionVolume.percent_change >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {Math.abs(data.transactionVolume.percent_change).toFixed(1)}%
            </div>
          </div>
          <p className="text-xs text-text-secondary dark:text-text-secondary mb-4">
            vs ₦{data.transactionVolume.last_month.toLocaleString()} last month
          </p>
          <div className="h-64">
            <Bar 
              data={transactionVolumeData} 
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'Millions (₦)',
                    },
                  },
                },
              }} 
            />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card title="Daily Transaction Activity (Last 7 Days)" className="p-4">
          <div className="flex justify-center gap-6 mb-4">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
              <span className="text-sm text-text-secondary dark:text-text-secondary">Deposits</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
              <span className="text-sm text-text-secondary dark:text-text-secondary">Payouts</span>
            </div>
          </div>
          <div className="h-64">
            <Line data={dailyTransactionsData} options={chartOptions} />
          </div>
        </Card>

        <Card title="Payout Plan Distribution" className="p-4">
          <div className="h-64 flex items-center justify-center">
            <Pie 
              data={payoutDistributionData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                  },
                },
              }} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-sm text-text-secondary dark:text-text-secondary">Weekly</p>
              <p className="text-lg font-semibold text-text dark:text-text">{data.payoutDistribution.weekly}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary dark:text-text-secondary">Biweekly</p>
              <p className="text-lg font-semibold text-text dark:text-text">{data.payoutDistribution.biweekly}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary dark:text-text-secondary">Monthly</p>
              <p className="text-lg font-semibold text-text dark:text-text">{data.payoutDistribution.monthly}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary dark:text-text-secondary">Custom</p>
              <p className="text-lg font-semibold text-text dark:text-text">{data.payoutDistribution.custom}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="User Retention" className="p-4 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-sm text-text-secondary dark:text-text-secondary mb-1">30-Day Retention Rate</h3>
            <p className="text-2xl font-bold text-text dark:text-text">{data.retentionRate.value.toFixed(1)}%</p>
          </div>
          <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            data.retentionRate.trend === 'up' 
              ? 'bg-success-light dark:bg-success-light/20 text-success dark:text-success' 
              : 'bg-error-light dark:bg-error-light/20 text-error dark:text-error'
          }`}>
            {data.retentionRate.trend === 'up' ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {Math.abs(data.retentionRate.percent_change).toFixed(1)}%
          </div>
        </div>
        <p className="text-sm text-text-secondary dark:text-text-secondary">
          Percentage of users who made multiple transactions in the last 30 days
        </p>
      </Card>
    </div>
  );
}