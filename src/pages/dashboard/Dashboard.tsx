import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Calendar, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import Card from '../../components/Card';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { format, subDays } from 'date-fns';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

type DashboardStats = {
  totalUsers: number;
  totalDeposits: number;
  totalPayouts: number;
  totalPlans: number;
  activeUsers: number;
  recentTransactions: any[];
  recentUsers: any[];
  transactionTrends: any[];
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalDeposits: 0,
    totalPayouts: 0,
    totalPlans: 0,
    activeUsers: 0,
    recentTransactions: [],
    recentUsers: [],
    transactionTrends: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      
      // Use the optimized SQL query for main dashboard stats
      const { data: dashboardData, error: dashboardError } = await supabase.rpc('get_dashboard_stats');
      
      if (dashboardError) {
        console.error('Dashboard RPC error:', dashboardError);
        // Fallback to individual queries if RPC doesn't exist
        await fetchDashboardDataFallback();
        return;
      }
      
      const mainStats = dashboardData?.[0] || {};
      
      // Fetch recent transactions separately
      const { data: recentTransactions, error: recentTransactionsError } = await supabase
        .from('transactions')
        .select(`
          id,
          type,
          amount,
          status,
          created_at,
          profiles (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recentTransactionsError) throw recentTransactionsError;
      
      // Fetch recent users separately
      const { data: recentUsers, error: recentUsersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recentUsersError) throw recentUsersError;
      
      // Calculate active users (users with transactions in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: activeUserData, error: activeUserError } = await supabase
        .from('transactions')
        .select('user_id')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('user_id', 'is', null);
      
      if (activeUserError) throw activeUserError;
      
      // Count unique active users
      const uniqueActiveUsers = new Set(activeUserData?.map(t => t.user_id) || []).size;
      
      setStats({
        totalUsers: mainStats.total_users || 0,
        totalDeposits: mainStats.total_deposits || 0,
        totalPayouts: mainStats.total_payouts || 0,
        totalPlans: mainStats.total_plans || 0,
        activeUsers: uniqueActiveUsers,
        recentTransactions: recentTransactions || [],
        recentUsers: recentUsers || [],
        transactionTrends: mainStats.transaction_trends || [],
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Fallback to individual queries
      await fetchDashboardDataFallback();
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDashboardDataFallback = async () => {
    try {
      // Fetch total users
      const { count: userCount, error: userError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      if (userError) throw userError;
      
      // Fetch total deposits
      const { data: deposits, error: depositError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'deposit');
      
      if (depositError) throw depositError;
      
      const totalDeposits = deposits?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;
      
      // Fetch total payouts
      const { data: payouts, error: payoutError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('type', 'payout');
      
      if (payoutError) throw payoutError;
      
      const totalPayouts = payouts?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;
      
      // Fetch total plans
      const { count: planCount, error: planError } = await supabase
        .from('payout_plans')
        .select('*', { count: 'exact', head: true });
      
      if (planError) throw planError;
      
      // Fetch recent transactions
      const { data: recentTransactions, error: recentTransactionsError } = await supabase
        .from('transactions')
        .select(`
          id,
          type,
          amount,
          status,
          created_at,
          profiles (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recentTransactionsError) throw recentTransactionsError;
      
      // Fetch recent users
      const { data: recentUsers, error: recentUsersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (recentUsersError) throw recentUsersError;
      
      // Generate transaction trends for last 7 days
      const transactionTrends = await generateTrendData();
      
      setStats({
        totalUsers: userCount || 0,
        totalDeposits,
        totalPayouts,
        totalPlans: planCount || 0,
        activeUsers: 0, // Will be calculated separately
        recentTransactions: recentTransactions || [],
        recentUsers: recentUsers || [],
        transactionTrends,
      });
    } catch (error) {
      console.error('Error in fallback dashboard data fetch:', error);
    }
  };

  const generateTrendData = async () => {
    const trends = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(date.setHours(23, 59, 59, 999)).toISOString();
      
      try {
        const { count, error } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay);
        
        if (error) {
          console.error('Error fetching trend data:', error);
          trends.push({ day: date.toISOString(), total_transactions: 0 });
        } else {
          trends.push({ day: date.toISOString(), total_transactions: count || 0 });
        }
      } catch (err) {
        console.error('Error in trend data:', err);
        trends.push({ day: date.toISOString(), total_transactions: 0 });
      }
    }
    
    return trends;
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
        data: stats.transactionTrends.map(trend => trend.total_transactions || 0),
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-text">Dashboard</h1>
          <p className="text-text-secondary dark:text-text-secondary">Overview of Planmoni platform</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="p-2 rounded-full bg-background-tertiary dark:bg-background-tertiary hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
          disabled={refreshing}
        >
          <RefreshCw className={`h-5 w-5 text-primary dark:text-primary ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="flex flex-col items-center p-4">
          <div className="flex justify-between items-center w-full mb-2">
            <span className="text-text-secondary dark:text-text-secondary text-sm">Total Users</span>
            <div className="w-10 h-10 rounded-full bg-background-tertiary dark:bg-background-tertiary flex items-center justify-center">
              <Users className="h-5 w-5 text-primary dark:text-primary" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text dark:text-text self-start">{stats.totalUsers}</div>
          <div className="flex items-center text-xs text-success dark:text-success mt-2 self-start">
            <ArrowUpRight className="h-3 w-3 mr-1" />
            <span>+5% vs last month</span>
          </div>
        </Card>

        <Card className="flex flex-col items-center p-4">
          <div className="flex justify-between items-center w-full mb-2">
            <span className="text-text-secondary dark:text-text-secondary text-sm">Total Deposits</span>
            <div className="w-10 h-10 rounded-full bg-success-light dark:bg-success-light/20 flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5 text-success dark:text-success" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text dark:text-text self-start">₦{stats.totalDeposits.toLocaleString()}</div>
          <div className="flex items-center text-xs text-success dark:text-success mt-2 self-start">
            <ArrowUpRight className="h-3 w-3 mr-1" />
            <span>+12% vs last month</span>
          </div>
        </Card>

        <Card className="flex flex-col items-center p-4">
          <div className="flex justify-between items-center w-full mb-2">
            <span className="text-text-secondary dark:text-text-secondary text-sm">Total Payouts</span>
            <div className="w-10 h-10 rounded-full bg-error-light dark:bg-error-light/20 flex items-center justify-center">
              <ArrowDownRight className="h-5 w-5 text-error dark:text-error" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text dark:text-text self-start">₦{stats.totalPayouts.toLocaleString()}</div>
          <div className="flex items-center text-xs text-success dark:text-success mt-2 self-start">
            <ArrowUpRight className="h-3 w-3 mr-1" />
            <span>+8% vs last month</span>
          </div>
        </Card>

        <Card className="flex flex-col items-center p-4">
          <div className="flex justify-between items-center w-full mb-2">
            <span className="text-text-secondary dark:text-text-secondary text-sm">Total Plans</span>
            <div className="w-10 h-10 rounded-full bg-warning-light dark:bg-warning-light/20 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-warning dark:text-warning" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text dark:text-text self-start">{stats.totalPlans}</div>
          <div className="flex items-center text-xs text-success dark:text-success mt-2 self-start">
            <ArrowUpRight className="h-3 w-3 mr-1" />
            <span>+15% vs last month</span>
          </div>
        </Card>
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
              <a href="/transactions" className="text-primary dark:text-primary-light hover:underline text-sm font-medium">
                View All Transactions
              </a>
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
                    <a 
                      href={`/users/${user.id}`}
                      className="px-3 py-1 text-xs font-medium text-primary dark:text-primary-light bg-background-tertiary dark:bg-background-tertiary rounded hover:bg-background-secondary dark:hover:bg-background-secondary transition-colors"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-text-secondary dark:text-text-secondary">No recent users</p>
            )}
            <div className="border-t border-border dark:border-border p-4 text-center">
              <a href="/users" className="text-primary dark:text-primary-light hover:underline text-sm font-medium">
                View All Users
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}