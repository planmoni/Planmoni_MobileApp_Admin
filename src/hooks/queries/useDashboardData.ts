import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { subDays, startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

type DashboardStats = {
  // Today's stats
  todayUsers: number;
  todayDeposits: number;
  todayPayouts: number;
  todayPlans: number;
  todayKyc: number;
  todayLockedBalance: number;
  todayCancelledPlans: number;
  todayWithdrawals: number;
  todayPayoutsDueCount: number;
  todayPayoutsDueAmount: number;

  // Yesterday's stats (for comparison)
  yesterdayUsers: number;
  yesterdayDeposits: number;
  yesterdayPayouts: number;
  yesterdayPlans: number;
  yesterdayKyc: number;
  yesterdayLockedBalance: number;
  yesterdayCancelledPlans: number;
  yesterdayWithdrawals: number;
  yesterdayPayoutsDueCount: number;
  yesterdayPayoutsDueAmount: number;

  // Totals
  totalUsers: number;
  totalDeposits: number;
  totalPayouts: number;
  totalPlans: number;
  activeUsers: number;

  // Today's data
  todayTransactions: any[];
  todayUsersJoined: any[];
  todayPayoutEvents: any[];
  todayKycSubmissions: any[];
  todayActivities: any[];

  // Plan distribution (today)
  planDistribution: {
    weekly: number;
    biweekly: number;
    monthly: number;
    custom: number;
  };

  // Transaction volume (last 7 days)
  transactionVolumeTrends: any[];

  // Old properties for backward compatibility
  recentTransactions: any[];
  recentUsers: any[];
  transactionTrends: any[];
  userGrowthTrend: number;
  depositsTrend: number;
  payoutsTrend: number;
  plansTrend: number;
};

// Helper to get today's date range
const getTodayRange = () => {
  const today = new Date();
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  return { startOfToday, endOfToday };
};

// Helper to get yesterday's date range
const getYesterdayRange = () => {
  const yesterday = subDays(new Date(), 1);
  const startOfYesterday = new Date(yesterday);
  startOfYesterday.setHours(0, 0, 0, 0);

  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999);

  return { startOfYesterday, endOfYesterday };
};

// Fetch today's stats
const fetchTodayStats = async () => {
  const { startOfToday, endOfToday } = getTodayRange();

  // Today's users
  const { count: todayUsersCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfToday.toISOString())
    .lte('created_at', endOfToday.toISOString());

  // Today's deposits
  const { data: todayDepositsData } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'deposit')
    .gte('created_at', startOfToday.toISOString())
    .lte('created_at', endOfToday.toISOString());

  // Today's payouts
  const { data: todayPayoutsData } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'payout')
    .gte('created_at', startOfToday.toISOString())
    .lte('created_at', endOfToday.toISOString());

  // Today's withdrawals
  const { data: todayWithdrawalsData } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'withdrawal')
    .gte('created_at', startOfToday.toISOString())
    .lte('created_at', endOfToday.toISOString());

  // Today's plans
  const { count: todayPlansCount } = await supabase
    .from('payout_plans')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfToday.toISOString())
    .lte('created_at', endOfToday.toISOString());

  // Today's cancelled plans
  const { count: todayCancelledPlansCount } = await supabase
    .from('payout_plans')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'cancelled')
    .gte('updated_at', startOfToday.toISOString())
    .lte('updated_at', endOfToday.toISOString());

  // Today's KYC submissions
  const { count: todayKycCount } = await supabase
    .from('kyc_data')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfToday.toISOString())
    .lte('created_at', endOfToday.toISOString());

  // Today's locked balance (sum of total_amount from plans created today)
  const { data: todayLockedBalanceData } = await supabase
    .from('payout_plans')
    .select('total_amount')
    .gte('created_at', startOfToday.toISOString())
    .lte('created_at', endOfToday.toISOString());

  // Payouts due today (from payout_events scheduled for today)
  const { data: todayPayoutsDueData, count: todayPayoutsDueCount } = await supabase
    .from('payout_events')
    .select('amount', { count: 'exact' })
    .gte('scheduled_date', startOfToday.toISOString())
    .lte('scheduled_date', endOfToday.toISOString())
    .in('status', ['pending', 'processing']);

  return {
    todayUsers: todayUsersCount || 0,
    todayDeposits: todayDepositsData?.reduce((sum, t) => sum + t.amount, 0) || 0,
    todayPayouts: todayPayoutsData?.reduce((sum, t) => sum + t.amount, 0) || 0,
    todayWithdrawals: todayWithdrawalsData?.reduce((sum, t) => sum + t.amount, 0) || 0,
    todayPlans: todayPlansCount || 0,
    todayCancelledPlans: todayCancelledPlansCount || 0,
    todayKyc: todayKycCount || 0,
    todayLockedBalance: todayLockedBalanceData?.reduce((sum, p) => sum + Number(p.total_amount), 0) || 0,
    todayPayoutsDueCount: todayPayoutsDueCount || 0,
    todayPayoutsDueAmount: todayPayoutsDueData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
  };
};

// Fetch yesterday's stats
const fetchYesterdayStats = async () => {
  const { startOfYesterday, endOfYesterday } = getYesterdayRange();

  // Yesterday's users
  const { count: yesterdayUsersCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfYesterday.toISOString())
    .lte('created_at', endOfYesterday.toISOString());

  // Yesterday's deposits
  const { data: yesterdayDepositsData } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'deposit')
    .gte('created_at', startOfYesterday.toISOString())
    .lte('created_at', endOfYesterday.toISOString());

  // Yesterday's payouts
  const { data: yesterdayPayoutsData } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'payout')
    .gte('created_at', startOfYesterday.toISOString())
    .lte('created_at', endOfYesterday.toISOString());

  // Yesterday's withdrawals
  const { data: yesterdayWithdrawalsData } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'withdrawal')
    .gte('created_at', startOfYesterday.toISOString())
    .lte('created_at', endOfYesterday.toISOString());

  // Yesterday's plans
  const { count: yesterdayPlansCount } = await supabase
    .from('payout_plans')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfYesterday.toISOString())
    .lte('created_at', endOfYesterday.toISOString());

  // Yesterday's cancelled plans
  const { count: yesterdayCancelledPlansCount } = await supabase
    .from('payout_plans')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'cancelled')
    .gte('updated_at', startOfYesterday.toISOString())
    .lte('updated_at', endOfYesterday.toISOString());

  // Yesterday's KYC submissions
  const { count: yesterdayKycCount } = await supabase
    .from('kyc_data')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfYesterday.toISOString())
    .lte('created_at', endOfYesterday.toISOString());

  // Yesterday's locked balance (sum of total_amount from plans created yesterday)
  const { data: yesterdayLockedBalanceData } = await supabase
    .from('payout_plans')
    .select('total_amount')
    .gte('created_at', startOfYesterday.toISOString())
    .lte('created_at', endOfYesterday.toISOString());

  // Payouts due yesterday (from payout_events scheduled for yesterday)
  const { data: yesterdayPayoutsDueData, count: yesterdayPayoutsDueCount } = await supabase
    .from('payout_events')
    .select('amount', { count: 'exact' })
    .gte('scheduled_date', startOfYesterday.toISOString())
    .lte('scheduled_date', endOfYesterday.toISOString())
    .in('status', ['pending', 'processing', 'completed']);

  return {
    yesterdayUsers: yesterdayUsersCount || 0,
    yesterdayDeposits: yesterdayDepositsData?.reduce((sum, t) => sum + t.amount, 0) || 0,
    yesterdayPayouts: yesterdayPayoutsData?.reduce((sum, t) => sum + t.amount, 0) || 0,
    yesterdayWithdrawals: yesterdayWithdrawalsData?.reduce((sum, t) => sum + t.amount, 0) || 0,
    yesterdayPlans: yesterdayPlansCount || 0,
    yesterdayCancelledPlans: yesterdayCancelledPlansCount || 0,
    yesterdayKyc: yesterdayKycCount || 0,
    yesterdayLockedBalance: yesterdayLockedBalanceData?.reduce((sum, p) => sum + Number(p.total_amount), 0) || 0,
    yesterdayPayoutsDueCount: yesterdayPayoutsDueCount || 0,
    yesterdayPayoutsDueAmount: yesterdayPayoutsDueData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
  };
};

// Fetch today's plan distribution
const fetchTodayPlanDistribution = async () => {
  const { startOfToday, endOfToday } = getTodayRange();

  const { data: todayPlans } = await supabase
    .from('payout_plans')
    .select('frequency')
    .gte('created_at', startOfToday.toISOString())
    .lte('created_at', endOfToday.toISOString());

  const weekly = todayPlans?.filter(p => p.frequency === 'weekly').length || 0;
  const biweekly = todayPlans?.filter(p => p.frequency === 'biweekly').length || 0;
  const monthly = todayPlans?.filter(p => p.frequency === 'monthly').length || 0;
  const custom = todayPlans?.filter(p => p.frequency === 'custom').length || 0;

  return { weekly, biweekly, monthly, custom };
};

// Fetch transaction volume for last 7 days
const fetchTransactionVolumeTrends = async () => {
  const trends = [];

  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('transactions')
      .select('amount')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString());

    trends.push({
      day: format(date, 'yyyy-MM-dd'),
      volume: data?.reduce((sum, t) => sum + t.amount, 0) || 0,
      count: data?.length || 0
    });
  }

  return trends;
};

const fetchDashboardData = async (): Promise<DashboardStats> => {
  try {
    const { startOfToday, endOfToday } = getTodayRange();

    // Fetch today's and yesterday's stats
    const todayStats = await fetchTodayStats();
    const yesterdayStats = await fetchYesterdayStats();
    const planDistribution = await fetchTodayPlanDistribution();
    const transactionVolumeTrends = await fetchTransactionVolumeTrends();

    // Use the optimized SQL query for main dashboard stats
    const { data: dashboardData, error: dashboardError } = await supabase.rpc('get_dashboard_stats');

    if (dashboardError) {
      console.error('Dashboard RPC error:', dashboardError);
      return await fetchDashboardDataFallback();
    }

    const mainStats = dashboardData?.[0] || {};

    // Calculate trends for current vs previous month
    const trends = await calculateTrends();

    // Fetch today's transactions
    const { data: todayTransactions } = await supabase
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
      .gte('created_at', startOfToday.toISOString())
      .lte('created_at', endOfToday.toISOString())
      .order('created_at', { ascending: false });

    // Fetch today's users joined
    const { data: todayUsersJoined } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, created_at')
      .gte('created_at', startOfToday.toISOString())
      .lte('created_at', endOfToday.toISOString())
      .order('created_at', { ascending: false });

    // Fetch today's payout events
    const { data: todayPayoutEvents } = await supabase
      .from('payout_events')
      .select(`
        id,
        payout_plan_id,
        scheduled_date,
        status,
        amount,
        created_at,
        payout_plans (
          id,
          user_id,
          profiles (
            first_name,
            last_name
          )
        )
      `)
      .gte('scheduled_date', startOfToday.toISOString())
      .lte('scheduled_date', endOfToday.toISOString())
      .order('scheduled_date', { ascending: false })
      .limit(10);

    // Fetch today's KYC submissions
    const { data: todayKycSubmissions } = await supabase
      .from('kyc_data')
      .select(`
        id,
        user_id,
        status,
        created_at,
        profiles (
          first_name,
          last_name,
          email
        )
      `)
      .gte('created_at', startOfToday.toISOString())
      .lte('created_at', endOfToday.toISOString())
      .order('created_at', { ascending: false });

    // Create activities from today's data
    const todayActivities = [
      ...(todayUsersJoined || []).map((user: any) => ({
        type: 'user_joined',
        description: `${user.first_name} ${user.last_name} joined`,
        timestamp: user.created_at
      })),
      ...(todayTransactions || []).map((tx: any) => ({
        type: tx.type,
        description: `${tx.profiles?.first_name} ${tx.profiles?.last_name} - ${tx.type} of ₦${tx.amount.toLocaleString()}`,
        timestamp: tx.created_at
      })),
      ...(todayKycSubmissions || []).map((kyc: any) => ({
        type: 'kyc_submission',
        description: `${kyc.profiles?.first_name} ${kyc.profiles?.last_name} submitted KYC`,
        timestamp: kyc.created_at
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

    // Fetch recent transactions for backward compatibility
    const { data: recentTransactions } = await supabase
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

    // Fetch recent users for backward compatibility
    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    // Calculate active users (users with transactions in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activeUserData } = await supabase
      .from('transactions')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('user_id', 'is', null);

    const uniqueActiveUsers = new Set(activeUserData?.map(t => t.user_id) || []).size;

    // Fetch transaction trends for the last 7 days
    const transactionTrends = await fetchTransactionTrends();

    return {
      ...todayStats,
      ...yesterdayStats,
      totalUsers: mainStats.total_users || 0,
      totalDeposits: mainStats.total_deposits || 0,
      totalPayouts: mainStats.total_payouts || 0,
      totalPlans: mainStats.total_plans || 0,
      activeUsers: uniqueActiveUsers,
      todayTransactions: todayTransactions || [],
      todayUsersJoined: todayUsersJoined || [],
      todayPayoutEvents: todayPayoutEvents || [],
      todayKycSubmissions: todayKycSubmissions || [],
      todayActivities: todayActivities,
      planDistribution,
      transactionVolumeTrends,
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
  
  // Payout plan distribution already fetched via fetchTodayPlanDistribution
  
  // Calculate active users (users with transactions in last 30 days)
  const { data: activeUsers, error: activeUsersError } = await supabase
    .from('transactions')
    .select('user_id')
    .eq('status', 'completed')
    .gte('created_at', subMonths(today, 1).toISOString());

  if (activeUsersError) throw activeUsersError;

  // Count unique active users
  const totalUsersWithTransactions = new Set(activeUsers?.map(t => t.user_id) || []).size;
  
  // Fetch accurate transaction trends for the last 7 days
  const transactionTrends = await fetchTransactionTrends();

  // Fetch today's and yesterday's stats for fallback
  const todayStats = await fetchTodayStats();
  const yesterdayStats = await fetchYesterdayStats();
  const planDistribution = await fetchTodayPlanDistribution();
  const transactionVolumeTrends = await fetchTransactionVolumeTrends();

  const { startOfToday, endOfToday } = getTodayRange();

  // Fetch today's transactions
  const { data: todayTransactions } = await supabase
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
    .gte('created_at', startOfToday.toISOString())
    .lte('created_at', endOfToday.toISOString())
    .order('created_at', { ascending: false });

  // Fetch today's users joined
  const { data: todayUsersJoined } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, created_at')
    .gte('created_at', startOfToday.toISOString())
    .lte('created_at', endOfToday.toISOString())
    .order('created_at', { ascending: false});

  // Fetch today's payout events
  const { data: todayPayoutEvents } = await supabase
    .from('payout_events')
    .select(`
      id,
      payout_plan_id,
      scheduled_date,
      status,
      amount,
      created_at,
      payout_plans (
        id,
        user_id,
        profiles (
          first_name,
          last_name
        )
      )
    `)
    .gte('scheduled_date', startOfToday.toISOString())
    .lte('scheduled_date', endOfToday.toISOString())
    .order('scheduled_date', { ascending: false })
    .limit(10);

  // Fetch today's KYC submissions
  const { data: todayKycSubmissions } = await supabase
    .from('kyc_data')
    .select(`
      id,
      user_id,
      status,
      created_at,
      profiles (
        first_name,
        last_name,
        email
      )
    `)
    .gte('created_at', startOfToday.toISOString())
    .lte('created_at', endOfToday.toISOString())
    .order('created_at', { ascending: false });

  // Create activities from today's data
  const todayActivities = [
    ...(todayUsersJoined || []).map((user: any) => ({
      type: 'user_joined',
      description: `${user.first_name} ${user.last_name} joined`,
      timestamp: user.created_at
    })),
    ...(todayTransactions || []).map((tx: any) => ({
      type: tx.type,
      description: `${tx.profiles?.first_name} ${tx.profiles?.last_name} - ${tx.type} of ₦${tx.amount.toLocaleString()}`,
      timestamp: tx.created_at
    })),
    ...(todayKycSubmissions || []).map((kyc: any) => ({
      type: 'kyc_submission',
      description: `${kyc.profiles?.first_name} ${kyc.profiles?.last_name} submitted KYC`,
      timestamp: kyc.created_at
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

  const finalAnalyticsData = {
    ...todayStats,
    ...yesterdayStats,
    totalUsers: await getTotalUsers(),
    totalDeposits: await getTotalDeposits(),
    totalPayouts: await getTotalPayouts(),
    totalPlans: await getTotalPlans(),
    activeUsers: totalUsersWithTransactions,
    todayTransactions: todayTransactions || [],
    todayUsersJoined: todayUsersJoined || [],
    todayPayoutEvents: todayPayoutEvents || [],
    todayKycSubmissions: todayKycSubmissions || [],
    todayActivities: todayActivities,
    planDistribution,
    transactionVolumeTrends,
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