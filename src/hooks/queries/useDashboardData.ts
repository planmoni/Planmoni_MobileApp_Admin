import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

type DashboardStats = {
  totalUsers: number;
  totalDeposits: number;
  totalPayouts: number;
  totalPlans: number;
  activeUsers: number;
  recentTransactions: any[];
  recentUsers: any[];
  transactionTrends: any[];
  // New trend properties
  userGrowthTrend: number;
  depositsTrend: number;
  payoutsTrend: number;
  plansTrend: number;
};

const fetchDashboardData = async (): Promise<DashboardStats> => {
  try {
    // Use the optimized SQL query for main dashboard stats
    const { data: dashboardData, error: dashboardError } = await supabase.rpc('get_dashboard_stats');
    
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
    
    return {
      totalUsers: mainStats.total_users || 0,
      totalDeposits: mainStats.total_deposits || 0,
      totalPayouts: mainStats.total_payouts || 0,
      totalPlans: mainStats.total_plans || 0,
      activeUsers: uniqueActiveUsers,
      recentTransactions: recentTransactions || [],
      recentUsers: recentUsers || [],
      transactionTrends: mainStats.transaction_trends || [],
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

  // Calculate user growth trend
  const { data: thisMonthUsers, error: thisMonthUsersError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString());

  const { data: lastMonthUsers, error: lastMonthUsersError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString());

  const thisMonthUserCount = thisMonthUsers || 0;
  const lastMonthUserCount = lastMonthUsers || 0;
  const userGrowthTrend = lastMonthUserCount === 0 
    ? (thisMonthUserCount > 0 ? 100 : 0)
    : Math.round(((thisMonthUserCount - lastMonthUserCount) / lastMonthUserCount) * 100);

  // Calculate deposits trend
  const { data: thisMonthDeposits, error: thisMonthDepositsError } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'deposit')
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString());

  const { data: lastMonthDeposits, error: lastMonthDepositsError } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'deposit')
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString());

  const thisMonthDepositsTotal = thisMonthDeposits?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const lastMonthDepositsTotal = lastMonthDeposits?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const depositsTrend = lastMonthDepositsTotal === 0 
    ? (thisMonthDepositsTotal > 0 ? 100 : 0)
    : Math.round(((thisMonthDepositsTotal - lastMonthDepositsTotal) / lastMonthDepositsTotal) * 100);

  // Calculate payouts trend
  const { data: thisMonthPayouts, error: thisMonthPayoutsError } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'payout')
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString());

  const { data: lastMonthPayouts, error: lastMonthPayoutsError } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'payout')
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString());

  const thisMonthPayoutsTotal = thisMonthPayouts?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const lastMonthPayoutsTotal = lastMonthPayouts?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const payoutsTrend = lastMonthPayoutsTotal === 0 
    ? (thisMonthPayoutsTotal > 0 ? 100 : 0)
    : Math.round(((thisMonthPayoutsTotal - lastMonthPayoutsTotal) / lastMonthPayoutsTotal) * 100);

  // Calculate plans trend
  const { data: thisMonthPlans, error: thisMonthPlansError } = await supabase
    .from('payout_plans')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString());

  const { data: lastMonthPlans, error: lastMonthPlansError } = await supabase
    .from('payout_plans')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString());

  const thisMonthPlansCount = thisMonthPlans || 0;
  const lastMonthPlansCount = lastMonthPlans || 0;
  const plansTrend = lastMonthPlansCount === 0 
    ? (thisMonthPlansCount > 0 ? 100 : 0)
    : Math.round(((thisMonthPlansCount - lastMonthPlansCount) / lastMonthPlansCount) * 100);

  return {
    userGrowthTrend,
    depositsTrend,
    payoutsTrend,
    plansTrend,
  };
};

const fetchDashboardDataFallback = async (): Promise<DashboardStats> => {
  // Calculate trends first
  const trends = await calculateTrends();

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
  
  return {
    totalUsers: userCount || 0,
    totalDeposits,
    totalPayouts,
    totalPlans: planCount || 0,
    activeUsers: 0, // Will be calculated separately
    recentTransactions: recentTransactions || [],
    recentUsers: recentUsers || [],
    transactionTrends,
    userGrowthTrend: trends.userGrowthTrend,
    depositsTrend: trends.depositsTrend,
    payoutsTrend: trends.payoutsTrend,
    plansTrend: trends.plansTrend,
  };
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

export const useDashboardData = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};