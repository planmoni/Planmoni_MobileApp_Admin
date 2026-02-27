import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

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
    daily: number;
    weekly: number;
    biweekly: number;
    specificDays: number;
    monthEnd: number;
    monthly: number;
    quarterly: number;
    biAnnually: number;
    annually: number;
    custom: number;
  };
  retentionRate: {
    value: number;
    trend: string;
    percent_change: number;
  };
  dailyTransactions: any[];
  totalUsers: number;
  totalUsersBalance: number;
  totalAmountInPlans: number;
  totalCompletedPayouts: number;
  highestUserBalance: number;
  mostRecentDeposit: {
    amount: number;
    date: string;
    user_name: string;
  } | null;
  mostRecentPayout: {
    amount: number;
    date: string;
    user_name: string;
  } | null;
};

const fetchAnalyticsData = async (): Promise<AnalyticsData> => {
  try {
    // Use the optimized RPC function for analytics data
    const { data: analyticsResult, error: analyticsError } = await supabase.rpc('get_analytics_data');

    console.log('🔍 Analytics RPC Response:', analyticsResult);

    if (analyticsError) {
      console.error('Analytics RPC error:', analyticsError);
      // Fallback to individual queries if RPC doesn't exist
      return await fetchAnalyticsDataFallback();
    }

    if (analyticsResult && analyticsResult.length > 0) {
      const data = analyticsResult[0];

      return {
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
        retentionRate: data.retention_rate || {
          value: 0,
          trend: 'up',
          percent_change: 0,
        },
        dailyTransactions: data.daily_transactions || [],
        totalUsers: parseInt(data.total_users) || 0,
        totalUsersBalance: Math.round(parseFloat(data.total_users_balance) || 0),
        totalAmountInPlans: Math.round(parseFloat(data.total_amount_in_plans) || 0),
        totalCompletedPayouts: parseInt(data.total_completed_payouts) || 0,
        highestUserBalance: Math.round(parseFloat(data.highest_user_balance) || 0),
        mostRecentDeposit: data.most_recent_deposit && data.most_recent_deposit !== 'null' ? {
          amount: parseFloat(data.most_recent_deposit.amount),
          date: data.most_recent_deposit.date,
          user_name: data.most_recent_deposit.user_name,
        } : null,
        mostRecentPayout: data.most_recent_payout && data.most_recent_payout !== 'null' ? {
          amount: parseFloat(data.most_recent_payout.amount),
          date: data.most_recent_payout.date,
          user_name: data.most_recent_payout.user_name,
        } : null,
      };
    }

    return await fetchAnalyticsDataFallback();
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return await fetchAnalyticsDataFallback();
  }
};

const fetchAnalyticsDataFallback = async (): Promise<AnalyticsData> => {
  console.log('🔄 Using fallback analytics data fetch');
  
  const today = new Date();
  const thisMonthStart = startOfMonth(today);
  const thisMonthEnd = endOfMonth(today);
  const lastMonthStart = startOfMonth(subMonths(today, 1));
  const lastMonthEnd = endOfMonth(subMonths(today, 1));
  
  console.log('📅 Analytics date ranges:');
  console.log('This month:', thisMonthStart.toISOString(), 'to', thisMonthEnd.toISOString());
  console.log('Last month:', lastMonthStart.toISOString(), 'to', lastMonthEnd.toISOString());
  
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
  
  const thisMonthVolume = thisMonthTransactions?.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0) || 0;
  const lastMonthVolume = lastMonthTransactions?.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0) || 0;
  
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
    
    monthlyVolumeData.push(monthTransactions?.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0) || 0);
  }
  
  // Fetch payout plan distribution
  const { data: payoutPlans, error: payoutPlansError } = await supabase
    .from('payout_plans')
    .select('frequency');

  if (payoutPlansError) throw payoutPlansError;

  const dailyPlans = payoutPlans?.filter(p => p.frequency === 'daily').length || 0;
  const weeklyPlans = payoutPlans?.filter(p => p.frequency === 'weekly').length || 0;
  const biweeklyPlans = payoutPlans?.filter(p => p.frequency === 'biweekly').length || 0;
  const specificDaysPlans = payoutPlans?.filter(p => p.frequency === 'weekly_specific').length || 0;
  const monthEndPlans = payoutPlans?.filter(p => p.frequency === 'end_of_month').length || 0;
  const monthlyPlans = payoutPlans?.filter(p => p.frequency === 'monthly').length || 0;
  const quarterlyPlans = payoutPlans?.filter(p => p.frequency === 'quarterly').length || 0;
  const biAnnuallyPlans = payoutPlans?.filter(p => p.frequency === 'biannual').length || 0;
  const annuallyPlans = payoutPlans?.filter(p => p.frequency === 'annually').length || 0;
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
  const dailyLabels: string[] = [];
  const dailyDeposits: number[] = [];
  const dailyPayouts: number[] = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dailyLabels.push(format(date, 'dd/MM'));
    
    // Random data for demo purposes
    dailyDeposits.push(Math.floor(Math.random() * 500000) + 100000);
    dailyPayouts.push(Math.floor(Math.random() * 300000) + 50000);
  }
  
  // Fetch total users count
  const { count: totalUsersCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  console.log('👥 Total users count:', totalUsersCount);

  // Fetch all wallet data to calculate totals
  const { data: walletsData, error: walletsError } = await supabase
    .from('wallets')
    .select('balance, locked_balance');

  if (walletsError) {
    console.error('Wallets fetch error:', walletsError);
  }

  console.log('💰 Wallets data sample:', walletsData?.slice(0, 3));

  const totalUsersBalance = walletsData?.reduce((sum, wallet) => {
    const balance = parseFloat(wallet.balance || '0');
    const lockedBalance = parseFloat(wallet.locked_balance || '0');
    return sum + balance + lockedBalance;
  }, 0) || 0;

  const highestUserBalance = walletsData?.reduce((max, wallet) => {
    const balance = parseFloat(wallet.balance || '0');
    const lockedBalance = parseFloat(wallet.locked_balance || '0');
    const totalBalance = balance + lockedBalance;
    return totalBalance > max ? totalBalance : max;
  }, 0) || 0;

  console.log('💰 Total users balance:', totalUsersBalance);
  console.log('💰 Highest user balance:', highestUserBalance);

  // Fetch payout plans for active/paused
  const { data: activePlans, error: activePlansError } = await supabase
    .from('payout_plans')
    .select('total_amount')
    .in('status', ['active', 'paused']);

  if (activePlansError) {
    console.error('Active plans fetch error:', activePlansError);
  }

  const totalAmountInPlans = activePlans?.reduce((sum, plan) => {
    const amount = parseFloat(plan.total_amount || '0');
    return sum + amount;
  }, 0) || 0;

  console.log('📊 Total amount in plans:', totalAmountInPlans);

  // Fetch completed payouts count
  const { count: completedPayoutsCount } = await supabase
    .from('payout_plans')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed');

  console.log('✅ Completed payouts count:', completedPayoutsCount);

  // Fetch most recent deposit
  const { data: recentDepositData, error: depositError } = await supabase
    .from('transactions')
    .select('amount, created_at, profiles!inner(first_name, last_name)')
    .eq('type', 'deposit')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (depositError) {
    console.error('Recent deposit fetch error:', depositError);
  }

  const mostRecentDeposit = recentDepositData ? {
    amount: parseFloat(recentDepositData.amount || '0'),
    date: recentDepositData.created_at,
    user_name: `${(recentDepositData.profiles as any).first_name} ${(recentDepositData.profiles as any).last_name}`,
  } : null;

  console.log('💳 Most recent deposit:', mostRecentDeposit);

  // Fetch most recent payout
  const { data: recentPayoutData, error: payoutError } = await supabase
    .from('transactions')
    .select('amount, created_at, profiles!inner(first_name, last_name)')
    .eq('type', 'payout')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (payoutError) {
    console.error('Recent payout fetch error:', payoutError);
  }

  const mostRecentPayout = recentPayoutData ? {
    amount: parseFloat(recentPayoutData.amount || '0'),
    date: recentPayoutData.created_at,
    user_name: `${(recentPayoutData.profiles as any).first_name} ${(recentPayoutData.profiles as any).last_name}`,
  } : null;

  console.log('💸 Most recent payout:', mostRecentPayout);

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
      daily: dailyPlans,
      weekly: weeklyPlans,
      biweekly: biweeklyPlans,
      specificDays: specificDaysPlans,
      monthEnd: monthEndPlans,
      monthly: monthlyPlans,
      quarterly: quarterlyPlans,
      biAnnually: biAnnuallyPlans,
      annually: annuallyPlans,
      custom: customPlans,
    },
    retentionRate: {
      value: retentionRate,
      trend: retentionRate >= 0 ? 'up' : 'down',
      percent_change: 0,
    },
    dailyTransactions: dailyLabels.map((label, index) => ({
      date: label,
      deposits_amount: dailyDeposits[index],
      payouts_amount: dailyPayouts[index],
    })),
    totalUsers: totalUsersCount || 0,
    totalUsersBalance: Math.round(totalUsersBalance),
    totalAmountInPlans: Math.round(totalAmountInPlans),
    totalCompletedPayouts: completedPayoutsCount || 0,
    highestUserBalance: Math.round(highestUserBalance),
    mostRecentDeposit,
    mostRecentPayout,
  };

  console.log('🎯 Final analytics data:', finalAnalyticsData);

  return finalAnalyticsData;
};

export const useAnalyticsData = () => {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalyticsData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
};