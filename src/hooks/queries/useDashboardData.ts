import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { subDays, startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

type DashboardStats = {
  totalUsers: number;
  totalDeposits: number;
  totalPayouts: number;
  totalPlans: number;
  activeUsers: number;
  recentTransactions: any[];
  recentUsers: any[];
  transactionTrends: any[];
  // New trend properties - now absolute differences
  userGrowthTrend: number;
  depositsTrend: number;
  payoutsTrend: number;
  plansTrend: number;
};

const fetchDashboardData = async (): Promise<DashboardStats> => {
  try {
    // Use the optimized SQL query for main dashboard stats
    const { data: dashboardData, error: dashboardError } = await supabase.rpc('get_dashboard_stats');
    
    console.log('🔍 Dashboard RPC Response:', dashboardData);
    
    if (dashboardError) {
      console.error('Dashboard RPC error:', dashboardError);
      // Fallback to individual queries if RPC doesn't exist
      return await fetchDashboardDataFallback();
    }
    
    const mainStats = dashboardData?.[0] || {};
    
    // Calculate trends for current vs previous month
    const trends = await calculateTrends();
    
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
    
    // Fetch transaction trends for the last 7 days
    const transactionTrends = await fetchTransactionTrends();
    
    return {
      totalUsers: mainStats.total_users || 0,
      totalDeposits: mainStats.total_deposits || 0,
      totalPayouts: mainStats.total_payouts || 0,
      totalPlans: mainStats.total_plans || 0,
      activeUsers: uniqueActiveUsers,
      recentTransactions: recentTransactions || [],
      recentUsers: recentUsers || [],
      transactionTrends: transactionTrends,
      userGrowthTrend: trends.userGrowthTrend,
      depositsTrend: trends.depositsTrend,
      payoutsTrend: trends.payoutsTrend,
      plansTrend: trends.plansTrend,
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return await fetchDashboardDataFallback();
  }
};

const calculateTrends = async () => {
  const today = new Date();
  const thisMonthStart = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);
  const lastMonthStart = startOfMonth(subMonths(today, 1));
  const lastMonthEnd = endOfMonth(subMonths(today, 1));

  console.log('📅 Date ranges for trend calculation:');
  console.log('This month:', thisMonthStart.toISOString(), 'to', thisMonthEnd.toISOString());
  console.log('Last month:', lastMonthStart.toISOString(), 'to', lastMonthEnd.toISOString());

  // Calculate user growth trend - absolute difference
  const { count: thisMonthUsersCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString());

  const { count: lastMonthUsersCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString());

  const thisMonthUserCount = thisMonthUsersCount || 0;
  const lastMonthUserCount = lastMonthUsersCount || 0;
  
  console.log('👥 User counts:');
  console.log('This month users:', thisMonthUserCount);
  console.log('Last month users:', lastMonthUserCount);
  
  // Calculate absolute difference instead of percentage
  const userGrowthTrend = thisMonthUserCount - lastMonthUserCount;

  console.log('📈 User growth trend calculated (absolute):', userGrowthTrend);

  // Calculate deposits trend - absolute difference
  const { data: thisMonthDeposits } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'deposit')
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString());

  const { data: lastMonthDeposits } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'deposit')
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString());

  const thisMonthDepositsTotal = thisMonthDeposits?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const lastMonthDepositsTotal = lastMonthDeposits?.reduce((sum, t) => sum + t.amount, 0) || 0;
  
  console.log('💰 Deposit totals:');
  console.log('This month deposits:', thisMonthDepositsTotal);
  console.log('Last month deposits:', lastMonthDepositsTotal);
  
  // Calculate absolute difference instead of percentage
  const depositsTrend = thisMonthDepositsTotal - lastMonthDepositsTotal;

  console.log('📈 Deposits trend calculated (absolute):', depositsTrend);

  // Calculate payouts trend - absolute difference
  const { data: thisMonthPayouts } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'payout')
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString());

  const { data: lastMonthPayouts } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'payout')
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString());

  const thisMonthPayoutsTotal = thisMonthPayouts?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const lastMonthPayoutsTotal = lastMonthPayouts?.reduce((sum, t) => sum + t.amount, 0) || 0;
  
  console.log('💸 Payout totals:');
  console.log('This month payouts:', thisMonthPayoutsTotal);
  console.log('Last month payouts:', lastMonthPayoutsTotal);
  
  // Calculate absolute difference instead of percentage
  const payoutsTrend = thisMonthPayoutsTotal - lastMonthPayoutsTotal;

  console.log('📈 Payouts trend calculated (absolute):', payoutsTrend);

  // Calculate plans trend - absolute difference
  const { count: rawThisMonthPlansCount } = await supabase
    .from('payout_plans')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString());

  const { count: rawLastMonthPlansCount } = await supabase
    .from('payout_plans')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString());

  const thisMonthPlansCount = rawThisMonthPlansCount || 0;
  const lastMonthPlansCount = rawLastMonthPlansCount || 0;
  
  console.log('📋 Plan counts:');
  console.log('This month plans:', thisMonthPlansCount);
  console.log('Last month plans:', lastMonthPlansCount);
  
  // Calculate absolute difference instead of percentage
  const plansTrend = thisMonthPlansCount - lastMonthPlansCount;

  console.log('📈 Plans trend calculated (absolute):', plansTrend);

  const finalTrends = {
    userGrowthTrend,
    depositsTrend,
    payoutsTrend,
    plansTrend,
  };

  console.log('🎯 Final calculated trends (absolute differences):', finalTrends);

  return finalTrends;
};

// New function to fetch accurate transaction trends for the last 7 days
const fetchTransactionTrends = async () => {
  const trends = [];
  
  // Fetch transaction counts for the last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { count, error } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());
    
    if (error) {
      console.error('Error fetching transaction trend data:', error);
      trends.push({ 
        day: format(date, 'yyyy-MM-dd'),
        total_transactions: 0 
      });
    } else {
      trends.push({ 
        day: format(date, 'yyyy-MM-dd'),
        total_transactions: count || 0 
      });
    }
  }
  
  console.log('📊 Transaction trends data:', trends);
  return trends;
};

const fetchDashboardDataFallback = async (): Promise<DashboardStats> => {
  console.log('🔄 Using fallback dashboard data fetch');
  
  const today = new Date();
  const thisMonthStart = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);
  const lastMonthStart = startOfMonth(subMonths(today, 1));
  const lastMonthEnd = endOfMonth(subMonths(today, 1));
  
  console.log('📅 Analytics date ranges:');
  console.log('This month:', thisMonthStart.toISOString(), 'to', thisMonthEnd.toISOString());
  console.log('Last month:', lastMonthStart.toISOString(), 'to', lastMonthEnd.toISOString());
  
  // Calculate trends using the dedicated function
  const trends = await calculateTrends();
  
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
  
  console.log('👥 Analytics user counts:');
  console.log('This month users:', thisMonthUserCount);
  console.log('Last month users:', lastMonthUserCount);
  
  // Fixed trend calculation logic
  const userPercentChange = lastMonthUserCount === 0 
    ? (thisMonthUserCount > 0 ? 100 : 0)
    : Math.round(((thisMonthUserCount - lastMonthUserCount) / lastMonthUserCount) * 100);
  
  console.log('📈 Analytics user percent change calculated:', userPercentChange + '%');
  
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
  
  console.log('💰 Analytics transaction volumes:');
  console.log('This month volume:', thisMonthVolume);
  console.log('Last month volume:', lastMonthVolume);
  
  // Fixed trend calculation logic
  const volumePercentChange = lastMonthVolume === 0 
    ? (thisMonthVolume > 0 ? 100 : 0)
    : Math.round(((thisMonthVolume - lastMonthVolume) / lastMonthVolume) * 100);
  
  console.log('📈 Analytics volume percent change calculated:', volumePercentChange + '%');
  
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
  
  // Fetch accurate transaction trends for the last 7 days
  const transactionTrends = await fetchTransactionTrends();
  
  const finalAnalyticsData = {
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
    dailyTransactions: [],
    totalUsers: await getTotalUsers(),
    totalDeposits: await getTotalDeposits(),
    totalPayouts: await getTotalPayouts(),
    totalPlans: await getTotalPlans(),
    activeUsers: totalUsersWithTransactions,
    recentTransactions: await getRecentTransactions(),
    recentUsers: await getRecentUsers(),
    transactionTrends: transactionTrends,
    userGrowthTrend: trends.userGrowthTrend,
    depositsTrend: trends.depositsTrend,
    payoutsTrend: trends.payoutsTrend,
    plansTrend: trends.plansTrend,
  };

  console.log('🎯 Final analytics data:', finalAnalyticsData);
  
  return finalAnalyticsData;
};

// Helper functions for the fallback method
const getTotalUsers = async () => {
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error fetching total users:', error);
    return 0;
  }
  
  return count || 0;
};

const getTotalDeposits = async () => {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'deposit');
  
  if (error) {
    console.error('Error fetching total deposits:', error);
    return 0;
  }
  
  return data?.reduce((sum, t) => sum + t.amount, 0) || 0;
};

const getTotalPayouts = async () => {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'payout');
  
  if (error) {
    console.error('Error fetching total payouts:', error);
    return 0;
  }
  
  return data?.reduce((sum, t) => sum + t.amount, 0) || 0;
};

const getTotalPlans = async () => {
  const { count, error } = await supabase
    .from('payout_plans')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error fetching total plans:', error);
    return 0;
  }
  
  return count || 0;
};

const getRecentTransactions = async () => {
  const { data, error } = await supabase
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
  
  if (error) {
    console.error('Error fetching recent transactions:', error);
    return [];
  }
  
  return data || [];
};

const getRecentUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error('Error fetching recent users:', error);
    return [];
  }
  
  return data || [];
};

export const useDashboardData = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};