import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import Card from '../../components/Card';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

type AnalyticsData = {
  userGrowth: {
    this_month: number;
    last_month: number;
    percent_change: number;
    monthly_data: any[];
  };
  transactionVolume: {
    this_month: number;
    last_month: number;
    percent_change: number;
    monthly_data: any[];
  };
  payoutDistribution: {
    weekly: number;
    biweekly: number;
    monthly: number;
    custom: number;
  };
  retentionRate: {
    value: number;
    trend: string;
    percent_change: number;
  };
  dailyTransactions: any[];
};

export default function Analytics() {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
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
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setRefreshing(true);
      
      // Use the optimized RPC function for analytics data
      const { data: analyticsResult, error: analyticsError } = await supabase.rpc('get_analytics_data');
      
      if (analyticsError) {
        console.error('Analytics RPC error:', analyticsError);
        // Fallback to individual queries if RPC doesn't exist
        await fetchAnalyticsDataFallback();
        return;
      }
      
      if (analyticsResult && analyticsResult.length > 0) {
        const data = analyticsResult[0];
        
        setAnalyticsData({
          userGrowth: data.user_growth || {
            this_month: 0,
            last_month: 0,
            percent_change: 0,
            monthly_data: [],
          },
          transactionVolume: data.transaction_volume || {
            this_month: 0,
            last_month: 0,
            percent_change: 0,
            monthly_data: [],
          },
          payoutDistribution: data.payout_distribution || {
            weekly: 0,
            biweekly: 0,
            monthly: 0,
            custom: 0,
          },
          retentionRate: data.retention_rate || {
            value: 0,
            trend: 'up',
            percent_change: 0,
          },
          dailyTransactions: data.daily_transactions || [],
        });
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      await fetchAnalyticsDataFallback();
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAnalyticsDataFallback = async () => {
    try {
      // Fallback to original analytics calculation
      const today = new Date();
      const thisMonthStart = startOfMonth(today);
      const thisMonthEnd = endOfMonth(today);
      const lastMonthStart = startOfMonth(subMonths(today, 1));
      const lastMonthEnd = endOfMonth(subMonths(today, 1));
      
      // Fetch user growth data
      const { data: thisMonthUsers, error: thisMonthUsersError } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', thisMonthStart.toISOString())
        .lte('created_at', thisMonthEnd.toISOString());
      
      if (thisMonthUsersError) throw thisMonthUsersError;
      
      const { data: lastMonthUsers, error: lastMonthUsersError } = await supabase
        .from('profiles')
        .select('created_at')
        .gte('created_at', lastMonthStart.toISOString())
        .lte('created_at', lastMonthEnd.toISOString());
      
      if (lastMonthUsersError) throw lastMonthUsersError;
      
      const thisMonthUserCount = thisMonthUsers?.length || 0;
      const lastMonthUserCount = lastMonthUsers?.length || 0;
      const userPercentChange = lastMonthUserCount === 0 
        ? 100 
        : ((thisMonthUserCount - lastMonthUserCount) / lastMonthUserCount) * 100;
      
      // Fetch monthly user growth for the last 6 months
      const monthlyUserData = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(today, i));
        const monthEnd = endOfMonth(subMonths(today, i));
        
        const { data: monthUsers, error: monthUsersError } = await supabase
          .from('profiles')
          .select('created_at')
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString());
        
        if (monthUsersError) throw monthUsersError;
        
        monthlyUserData.push(monthUsers?.length || 0);
      }
      
      // Fetch transaction volume data
      const { data: thisMonthTransactions, error: thisMonthTransactionsError } = await supabase
        .from('transactions')
        .select('amount')
        .gte('created_at', thisMonthStart.toISOString())
        .lte('created_at', thisMonthEnd.toISOString());
      
      if (thisMonthTransactionsError) throw thisMonthTransactionsError;
      
      const { data: lastMonthTransactions, error: lastMonthTransactionsError } = await supabase
        .from('transactions')
        .select('amount')
        .gte('created_at', lastMonthStart.toISOString())
        .lte('created_at', lastMonthEnd.toISOString());
      
      if (lastMonthTransactionsError) throw lastMonthTransactionsError;
      
      const thisMonthVolume = thisMonthTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const lastMonthVolume = lastMonthTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const volumePercentChange = lastMonthVolume === 0 
        ? 100 
        : ((thisMonthVolume - lastMonthVolume) / lastMonthVolume) * 100;
      
      // Fetch monthly transaction volume for the last 6 months
      const monthlyVolumeData = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(today, i));
        const monthEnd = endOfMonth(subMonths(today, i));
        
        const { data: monthTransactions, error: monthTransactionsError } = await supabase
          .from('transactions')
          .select('amount')
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString());
        
        if (monthTransactionsError) throw monthTransactionsError;
        
        monthlyVolumeData.push(monthTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0);
      }
      
      // Fetch payout plan distribution
      const { data: payoutPlans, error: payoutPlansError } = await supabase
        .from('payout_plans')
        .select('frequency');
      
      if (payoutPlansError) throw payoutPlansError;
      
      const weeklyPlans = payoutPlans?.filter(p => p.frequency === 'weekly').length || 0;
      const biweeklyPlans = payoutPlans?.filter(p => p.frequency === 'biweekly').length || 0;
      const monthlyPlans = payoutPlans?.filter(p => p.frequency === 'monthly').length || 0;
      const customPlans = payoutPlans?.filter(p => p.frequency === 'custom').length || 0;
      
      // Calculate retention rate (users who have made at least 2 transactions)
      const { data: activeUsers, error: activeUsersError } = await supabase
        .from('transactions')
        .select('user_id')
        .eq('status', 'completed')
        .gte('created_at', subMonths(today, 1).toISOString());
      
      if (activeUsersError) throw activeUsersError;
      
      // Count transactions per user
      const userTransactionCounts = activeUsers?.reduce((acc: Record<string, number>, transaction) => {
        acc[transaction.user_id] = (acc[transaction.user_id] || 0) + 1;
        return acc;
      }, {}) || {};
      
      const usersWithMultipleTransactions = Object.values(userTransactionCounts).filter((count: number) => count >= 2).length;
      const totalUsersWithTransactions = Object.keys(userTransactionCounts).length;
      
      const retentionRate = totalUsersWithTransactions === 0 
        ? 0 
        : (usersWithMultipleTransactions / totalUsersWithTransactions) * 100;
      
      // Generate daily transactions data for the last 7 days
      const dailyLabels = [];
      const dailyDeposits = [];
      const dailyPayouts = [];
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dailyLabels.push(format(date, 'dd/MM'));
        
        // Random data for demo purposes
        dailyDeposits.push(Math.floor(Math.random() * 500000) + 100000);
        dailyPayouts.push(Math.floor(Math.random() * 300000) + 50000);
      }
      
      setAnalyticsData({
        userGrowth: {
          this_month: thisMonthUserCount,
          last_month: lastMonthUserCount,
          percent_change: userPercentChange,
          monthly_data: monthlyUserData,
        },
        transactionVolume: {
          this_month: thisMonthVolume,
          last_month: lastMonthVolume,
          percent_change: volumePercentChange,
          monthly_data: monthlyVolumeData,
        },
        payoutDistribution: {
          weekly: weeklyPlans,
          biweekly: biweeklyPlans,
          monthly: monthlyPlans,
          custom: customPlans,
        },
        retentionRate: {
          value: retentionRate,
          trend: retentionRate >= 0 ? 'up' : 'down',
          percent_change: 0, // Would need historical data to calculate
        },
        dailyTransactions: dailyLabels.map((label, index) => ({
          date: label,
          deposits_amount: dailyDeposits[index],
          payouts_amount: dailyPayouts[index],
        })),
      });
    } catch (error) {
      console.error('Error in fallback analytics fetch:', error);
    }
  };

  // Generate labels for the last 6 months
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    return format(subMonths(new Date(), 5 - i), 'MMM');
  });

  // Chart data for user growth
  const userGrowthData = {
    labels: monthLabels,
    datasets: [
      {
        label: 'New Users',
        data: analyticsData.userGrowth.monthly_data.map((item: any) => 
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
        data: analyticsData.transactionVolume.monthly_data.map((item: any) => {
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
    labels: analyticsData.dailyTransactions.map((item: any) => 
      typeof item === 'string' ? item : item.date || ''
    ),
    datasets: [
      {
        label: 'Deposits',
        data: analyticsData.dailyTransactions.map((item: any) => 
          typeof item === 'object' ? item.deposits_amount || 0 : 0
        ),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.4,
      },
      {
        label: 'Payouts',
        data: analyticsData.dailyTransactions.map((item: any) => 
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
          analyticsData.payoutDistribution.weekly,
          analyticsData.payoutDistribution.biweekly,
          analyticsData.payoutDistribution.monthly,
          analyticsData.payoutDistribution.custom,
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text">Analytics</h1>
          <p className="text-text-secondary dark:text-text-secondary">Platform performance metrics</p>
        </div>
        <button 
          onClick={fetchAnalyticsData}
          className="p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
          disabled={refreshing}
        >
          <RefreshCw className={`h-5 w-5 text-primary dark:text-primary ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card title="User Growth" className="p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm text-text-secondary dark:text-text-secondary mb-1">New Users This Month</h3>
              <p className="text-2xl font-bold text-text dark:text-text">{analyticsData.userGrowth.this_month}</p>
            </div>
            <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              analyticsData.userGrowth.percent_change >= 0 
                ? 'bg-success-light dark:bg-success-light/20 text-success dark:text-success' 
                : 'bg-error-light dark:bg-error-light/20 text-error dark:text-error'
            }`}>
              {analyticsData.userGrowth.percent_change >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {Math.abs(analyticsData.userGrowth.percent_change).toFixed(1)}%
            </div>
          </div>
          <p className="text-xs text-text-secondary dark:text-text-secondary mb-4">
            vs {analyticsData.userGrowth.last_month} last month
          </p>
          <div className="h-64">
            <Line data={userGrowthData} options={chartOptions} />
          </div>
        </Card>

        <Card title="Transaction Volume" className="p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm text-text-secondary dark:text-text-secondary mb-1">Volume This Month</h3>
              <p className="text-2xl font-bold text-text dark:text-text">₦{analyticsData.transactionVolume.this_month.toLocaleString()}</p>
            </div>
            <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              analyticsData.transactionVolume.percent_change >= 0 
                ? 'bg-success-light dark:bg-success-light/20 text-success dark:text-success' 
                : 'bg-error-light dark:bg-error-light/20 text-error dark:text-error'
            }`}>
              {analyticsData.transactionVolume.percent_change >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {Math.abs(analyticsData.transactionVolume.percent_change).toFixed(1)}%
            </div>
          </div>
          <p className="text-xs text-text-secondary dark:text-text-secondary mb-4">
            vs ₦{analyticsData.transactionVolume.last_month.toLocaleString()} last month
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
              <p className="text-lg font-semibold text-text dark:text-text">{analyticsData.payoutDistribution.weekly}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary dark:text-text-secondary">Biweekly</p>
              <p className="text-lg font-semibold text-text dark:text-text">{analyticsData.payoutDistribution.biweekly}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary dark:text-text-secondary">Monthly</p>
              <p className="text-lg font-semibold text-text dark:text-text">{analyticsData.payoutDistribution.monthly}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary dark:text-text-secondary">Custom</p>
              <p className="text-lg font-semibold text-text dark:text-text">{analyticsData.payoutDistribution.custom}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="User Retention" className="p-4 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-sm text-text-secondary dark:text-text-secondary mb-1">30-Day Retention Rate</h3>
            <p className="text-2xl font-bold text-text dark:text-text">{analyticsData.retentionRate.value.toFixed(1)}%</p>
          </div>
          <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            analyticsData.retentionRate.trend === 'up' 
              ? 'bg-success-light dark:bg-success-light/20 text-success dark:text-success' 
              : 'bg-error-light dark:bg-error-light/20 text-error dark:text-error'
          }`}>
            {analyticsData.retentionRate.trend === 'up' ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {Math.abs(analyticsData.retentionRate.percent_change).toFixed(1)}%
          </div>
        </div>
        <p className="text-sm text-text-secondary dark:text-text-secondary">
          Percentage of users who made multiple transactions in the last 30 days
        </p>
      </Card>
    </div>
  );
}