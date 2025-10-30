import { RefreshCw, TrendingUp, TrendingDown, Users, DollarSign, Repeat, Target } from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { format, subMonths } from 'date-fns';
import { useAnalyticsData } from '@/hooks/queries/useAnalyticsData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function Analytics() {
  const { data: analyticsData, isLoading, error } = useAnalyticsData();
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['analytics']);
  };

  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    return format(subMonths(new Date(), 5 - i), 'MMM');
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load analytics data</p>
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
      daily: 0,
      weekly: 0,
      biweekly: 0,
      specificDays: 0,
      monthEnd: 0,
      monthly: 0,
      quarterly: 0,
      biAnnually: 0,
      annually: 0,
      custom: 0,
    },
    retentionRate: {
      value: 0,
      trend: 'up',
      percent_change: 0,
    },
    dailyTransactions: [],
  };

  const userGrowthData = {
    labels: monthLabels,
    datasets: [
      {
        label: 'New Users',
        data: data.userGrowth.monthly_data.map((item: any) =>
          typeof item === 'number' ? item : item.users || 0
        ),
        borderColor: '#86EFAC',
        backgroundColor: 'rgba(134, 239, 172, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#86EFAC',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        borderWidth: 3,
      },
    ],
  };

  const transactionVolumeData = {
    labels: monthLabels,
    datasets: [
      {
        label: 'Transaction Volume',
        data: data.transactionVolume.monthly_data.map((item: any) => {
          const volume = typeof item === 'number' ? item : item.volume || 0;
          return volume / 1000000;
        }),
        backgroundColor: 'rgba(134, 239, 172, 0.8)',
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

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
        borderColor: '#86EFAC',
        backgroundColor: 'rgba(134, 239, 172, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#86EFAC',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        borderWidth: 2,
      },
      {
        label: 'Payouts',
        data: data.dailyTransactions.map((item: any) =>
          typeof item === 'object' ? item.payouts_amount || 0 : 0
        ),
        borderColor: '#F87171',
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#F87171',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        borderWidth: 2,
      },
    ],
  };

  const payoutDistributionData = {
    labels: ['Daily', 'Weekly', 'Biweekly', 'Specific Days', 'Month-End', 'Monthly', 'Quarterly', 'Bi-Annually', 'Annually', 'Custom'],
    datasets: [
      {
        data: [
          data.payoutDistribution.daily,
          data.payoutDistribution.weekly,
          data.payoutDistribution.biweekly,
          data.payoutDistribution.specificDays,
          data.payoutDistribution.monthEnd,
          data.payoutDistribution.monthly,
          data.payoutDistribution.quarterly,
          data.payoutDistribution.biAnnually,
          data.payoutDistribution.annually,
          data.payoutDistribution.custom,
        ],
        backgroundColor: [
          '#EF4444',
          '#86EFAC',
          '#60A5FA',
          '#FBBF24',
          '#A78BFA',
          '#F472B6',
          '#34D399',
          '#2DD4BF',
          '#84CC16',
          '#F87171',
        ],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  const commonChartOptions = {
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
        displayColors: true,
        boxPadding: 6,
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
          padding: 8,
        },
        border: {
          display: false,
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
          padding: 8,
        },
        border: {
          display: false,
        },
      },
    },
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Analytics</h1>
          <p className="text-gray-500">Platform performance metrics and insights</p>
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
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">User Growth</p>
              <p className="text-3xl font-bold text-gray-900">{data.userGrowth.this_month}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
              data.userGrowth.percent_change >= 0 ? 'bg-green-50' : 'bg-red-50'
            }`}>
              {data.userGrowth.percent_change >= 0 ? (
                <TrendingUp size={14} className="text-green-600" />
              ) : (
                <TrendingDown size={14} className="text-red-600" />
              )}
              <span className={`text-xs font-semibold ${
                data.userGrowth.percent_change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {Math.abs(data.userGrowth.percent_change).toFixed(1)}%
              </span>
            </div>
            <span className="text-xs text-gray-400">vs last month</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Transaction Volume</p>
              <p className="text-3xl font-bold text-gray-900">₦{(data.transactionVolume.this_month / 1000000).toFixed(1)}M</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
              data.transactionVolume.percent_change >= 0 ? 'bg-green-50' : 'bg-red-50'
            }`}>
              {data.transactionVolume.percent_change >= 0 ? (
                <TrendingUp size={14} className="text-green-600" />
              ) : (
                <TrendingDown size={14} className="text-red-600" />
              )}
              <span className={`text-xs font-semibold ${
                data.transactionVolume.percent_change >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {Math.abs(data.transactionVolume.percent_change).toFixed(1)}%
              </span>
            </div>
            <span className="text-xs text-gray-400">vs last month</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Retention Rate</p>
              <p className="text-3xl font-bold text-gray-900">{data.retentionRate.value.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center">
              <Repeat className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
              data.retentionRate.trend === 'up' ? 'bg-green-50' : 'bg-red-50'
            }`}>
              {data.retentionRate.trend === 'up' ? (
                <TrendingUp size={14} className="text-green-600" />
              ) : (
                <TrendingDown size={14} className="text-red-600" />
              )}
              <span className={`text-xs font-semibold ${
                data.retentionRate.trend === 'up' ? 'text-green-600' : 'text-red-600'
              }`}>
                {Math.abs(data.retentionRate.percent_change).toFixed(1)}%
              </span>
            </div>
            <span className="text-xs text-gray-400">30-day</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Active Plans</p>
              <p className="text-3xl font-bold text-gray-900">
                {(data.payoutDistribution.daily || 0) + (data.payoutDistribution.weekly || 0) + (data.payoutDistribution.biweekly || 0) +
                 (data.payoutDistribution.specificDays || 0) + (data.payoutDistribution.monthEnd || 0) + (data.payoutDistribution.monthly || 0) +
                 (data.payoutDistribution.quarterly || 0) + (data.payoutDistribution.biAnnually || 0) + (data.payoutDistribution.annually || 0) +
                 (data.payoutDistribution.custom || 0)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
              <Target className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Total payout plans</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">User Growth</h3>
            <p className="text-sm text-gray-500">Last 6 months</p>
          </div>
          <div className="h-80">
            <Line data={userGrowthData} options={commonChartOptions} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Transaction Volume</h3>
            <p className="text-sm text-gray-500">Monthly volumes (₦M)</p>
          </div>
          <div className="h-80">
            <Bar data={transactionVolumeData} options={commonChartOptions} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Daily Transaction Activity</h3>
            <p className="text-sm text-gray-500">Last 7 days comparison</p>
          </div>
          <div className="flex gap-6 mb-6">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-400 mr-2"></div>
              <span className="text-sm text-gray-600">Deposits</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-400 mr-2"></div>
              <span className="text-sm text-gray-600">Payouts</span>
            </div>
          </div>
          <div className="h-80">
            <Line data={dailyTransactionsData} options={commonChartOptions} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Payout Plans</h3>
            <p className="text-sm text-gray-500">Distribution by type</p>
          </div>
          <div className="h-64 flex items-center justify-center mb-6">
            <Doughnut
              data={payoutDistributionData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                  tooltip: {
                    backgroundColor: '#0F172A',
                    padding: 12,
                    titleFont: {
                      size: 13,
                      weight: 600,
                    },
                    bodyFont: {
                      size: 14,
                    },
                  },
                },
                cutout: '70%',
              }}
            />
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                <span className="text-sm text-gray-600">Daily</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{data.payoutDistribution.daily}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-400 mr-2"></div>
                <span className="text-sm text-gray-600">Weekly</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{data.payoutDistribution.weekly}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-blue-400 mr-2"></div>
                <span className="text-sm text-gray-600">Biweekly</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{data.payoutDistribution.biweekly}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-yellow-400 mr-2"></div>
                <span className="text-sm text-gray-600">Specific Days</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{data.payoutDistribution.specificDays}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-purple-400 mr-2"></div>
                <span className="text-sm text-gray-600">Month-End</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{data.payoutDistribution.monthEnd}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-pink-400 mr-2"></div>
                <span className="text-sm text-gray-600">Monthly</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{data.payoutDistribution.monthly}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-emerald-400 mr-2"></div>
                <span className="text-sm text-gray-600">Quarterly</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{data.payoutDistribution.quarterly}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-teal-400 mr-2"></div>
                <span className="text-sm text-gray-600">Bi-Annually</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{data.payoutDistribution.biAnnually}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-lime-400 mr-2"></div>
                <span className="text-sm text-gray-600">Annually</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{data.payoutDistribution.annually}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-400 mr-2"></div>
                <span className="text-sm text-gray-600">Custom</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{data.payoutDistribution.custom}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
