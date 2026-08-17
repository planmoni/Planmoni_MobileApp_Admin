import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type UserData = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  is_admin: boolean;
  balance: number;
  locked_balance: number;
  total_deposits: number;
  total_payouts: number;
  active_plans: number;
};

type UserStats = {
  total_users: number;
  new_users_today: number;
  new_users_this_week: number;
  new_users_this_month: number;
  active_users_today: number;
  active_users_this_week: number;
  active_users_this_month: number;
  active_users_all_time: number;
  users_with_balance: number;
  users_with_plans: number;
  admin_users: number;
  verified_users: number;
  total_wallet_balance: number;
  total_locked_balance: number;
  total_plans_amount: number;
  user_growth_trend: any[];
};

const fetchUsersData = async (searchQuery?: string): Promise<{ users: UserData[]; stats: UserStats | null }> => {
  try {
    let usersResult: UserData[];

    if (searchQuery && searchQuery.trim()) {
      const { data: searchData, error: searchError } = await supabase
        .rpc('search_users_info', { search_query: searchQuery.trim() });

      if (searchError) throw searchError;
      usersResult = (searchData as UserData[]) || [];
    } else {
      const { data: usersData, error: usersError } = await supabase.rpc('get_all_users_info');
      if (usersError) throw usersError;
      usersResult = (usersData as UserData[]) || [];
    }

    const { data: statsData, error: statsError } = await supabase.rpc('get_user_management_data');
    if (statsError) {
      console.error('Error fetching user stats:', statsError);
    }

    return {
      users: usersResult,
      stats: statsData?.[0] || null
    };
  } catch (error) {
    console.error('Error fetching users data:', error);
    const fallbackData = await fetchUsersDataFallback();
    return { users: fallbackData, stats: null };
  }
};

const fetchUsersDataFallback = async (): Promise<UserData[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      first_name,
      last_name,
      email,
      created_at,
      is_admin,
      wallets (
        balance,
        locked_balance
      )
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  // Transform data to match expected format
  return data?.map(user => ({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    created_at: user.created_at,
    is_admin: user.is_admin,
    balance: user.wallets?.[0]?.balance || 0,
    locked_balance: user.wallets?.[0]?.locked_balance || 0,
    total_deposits: 0, // Would need additional queries
    total_payouts: 0,
    active_plans: 0,
  })) || [];
};

export const useUsersData = (searchQuery?: string) => {
  return useQuery({
    queryKey: ['users', searchQuery || ''],
    queryFn: () => fetchUsersData(searchQuery),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useUserDetails = (userId: string) => {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const { data: userData, error: userError } = await supabase
        .rpc('get_user_info', { target_user_id: userId });
      
      if (userError) {
        console.error('Error fetching user data via RPC:', userError);
        throw userError;
      }
      
      if (!userData || userData.length === 0) {
        throw new Error('User not found');
      }
      
      const userInfo = userData[0];
      
      // Fetch payout accounts separately
      const { data: accountData, error: accountError } = await supabase
        .from('payout_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (accountError) {
        console.error('Error fetching bank accounts:', accountError);
      }

      // Fetch KYC data
      const { data: kycData, error: kycError } = await supabase
        .from('kyc_data')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (kycError) {
        console.error('Error fetching KYC data:', kycError);
      }

      // Fetch KYC progress
      const { data: kycProgress, error: kycProgressError } = await supabase
        .from('kyc_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (kycProgressError) {
        console.error('Error fetching KYC progress:', kycProgressError);
      }

      return {
        user: {
          id: userInfo.id,
          first_name: userInfo.first_name,
          last_name: userInfo.last_name,
          email: userInfo.email,
          created_at: userInfo.date_joined,
          is_admin: userInfo.is_admin,
          last_seen_at: userInfo.last_seen_at,
          wallets: [{
            balance: userInfo.available_balance || 0,
            locked_balance: userInfo.locked_balance || 0
          }]
        },
        totalDeposits: userInfo.total_deposits || 0,
        totalPayouts: userInfo.total_payouts || 0,
        transactions: userInfo.recent_transactions || [],
        payoutPlans: userInfo.payout_plans || [],
        bankAccounts: accountData || [],
        kycData: kycData,
        kycProgress: kycProgress
      };
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};