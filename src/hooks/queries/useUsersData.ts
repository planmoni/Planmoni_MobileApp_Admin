import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { KycTier } from '@/hooks/queries/useKycData';

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
/**
 * Tier per user id, derived from kyc_progress flags (same rule as the KYC pages:
 * tier_3 -> 3, tier_2 -> 2, tier_1 -> 1). Users absent from the map are Tier 0.
 * Only rows with at least one tier flag are fetched, paged to stay under the
 * PostgREST row limit.
 */
const TIER_PAGE_SIZE = 1000;

const fetchUserTiers = async (): Promise<Record<string, KycTier>> => {
  const tiers: Record<string, KycTier> = {};

  for (let from = 0; ; from += TIER_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('kyc_progress')
      .select('user_id, tier_1_completed, tier_2_completed, tier_3_completed')
      .or('tier_1_completed.eq.true,tier_2_completed.eq.true,tier_3_completed.eq.true')
      .order('user_id', { ascending: true })
      .range(from, from + TIER_PAGE_SIZE - 1);

    if (error) throw error;

    for (const row of data || []) {
      tiers[row.user_id] = row.tier_3_completed ? 3 : row.tier_2_completed ? 2 : 1;
    }

    if (!data || data.length < TIER_PAGE_SIZE) break;
  }

  return tiers;
};

export const useUserTiers = () => {
  return useQuery({
    queryKey: ['users', 'tiers'],
    queryFn: fetchUserTiers,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Post No Debit (PND): profiles.post_no_debit blocks new payout plans and fund
 * locks (enforced server-side in create_payout_plan_atomic / lock_funds).
 */
export type UserRestriction = {
  post_no_debit: boolean;
  post_no_debit_reason: string | null;
  post_no_debit_at: string | null;
  post_no_debit_by: string | null;
};

export const useUserRestriction = (userId: string) => {
  return useQuery({
    queryKey: ['user', userId, 'restriction'],
    queryFn: async (): Promise<UserRestriction> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('post_no_debit, post_no_debit_reason, post_no_debit_at, post_no_debit_by')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      return {
        post_no_debit: data?.post_no_debit ?? false,
        post_no_debit_reason: data?.post_no_debit_reason ?? null,
        post_no_debit_at: data?.post_no_debit_at ?? null,
        post_no_debit_by: data?.post_no_debit_by ?? null,
      };
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
};

type SetPostNoDebitInput =
  | { userId: string; enable: true; reason: string; adminEmail: string }
  | { userId: string; enable: false };

export const useSetPostNoDebit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SetPostNoDebitInput) => {
      const changes = input.enable
        ? {
            post_no_debit: true,
            post_no_debit_reason: input.reason.trim(),
            post_no_debit_at: new Date().toISOString(),
            post_no_debit_by: input.adminEmail,
          }
        : {
            post_no_debit: false,
            post_no_debit_reason: null,
            post_no_debit_at: null,
            post_no_debit_by: null,
          };

      const { data, error } = await supabase
        .from('profiles')
        .update(changes)
        .eq('id', input.userId)
        .select('id');

      if (error) throw error;
      // RLS filters rows silently, so an empty result means nothing was updated
      if (!data || data.length === 0) {
        throw new Error('You do not have permission to change this restriction.');
      }
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['user', input.userId, 'restriction'] });
    },
  });
};

export type UserDeleteCheck = {
  can_delete: boolean;
  reasons: string[];
  email: string | null;
  name: string | null;
  counts: {
    live_plans: number;
    live_vaults: number;
    live_expense_plans: number;
    available_balance: number;
    locked_balance: number;
    plans_total: number;
    transactions: number;
  };
};

/** Whether a user can be deleted, and if not, why. Only callable by admins allowed to delete users. */
export const useUserDeleteCheck = (userId: string, enabled: boolean) => {
  return useQuery({
    queryKey: ['user', userId, 'delete-check'],
    queryFn: async (): Promise<UserDeleteCheck> => {
      const { data, error } = await supabase.rpc('admin_user_delete_check', { p_user_id: userId });
      if (error) throw error;
      return data as UserDeleteCheck;
    },
    enabled: !!userId && enabled,
    staleTime: 0,
    gcTime: 0,
  });
};

/** Folders in storage that hold a user's files. The database delete cannot remove these. */
const USER_FILE_LOCATIONS: { bucket: string; prefix: (userId: string) => string }[] = [
  { bucket: 'documents', prefix: (id) => `kyc-documents/${id}` },
  { bucket: 'documents', prefix: (id) => id },
  { bucket: 'avatars', prefix: (id) => id },
];

/** Best-effort removal of a deleted user's files. Never throws; returns how many failed. */
async function removeUserFiles(userId: string): Promise<{ removed: number; failed: number }> {
  let removed = 0;
  let failed = 0;

  for (const { bucket, prefix } of USER_FILE_LOCATIONS) {
    const folder = prefix(userId);
    try {
      // paginate in case a folder holds more than one page of files
      for (let page = 0; page < 20; page++) {
        const { data: files, error: listError } = await supabase.storage
          .from(bucket)
          .list(folder, { limit: 100 });
        if (listError) {
          failed += 1;
          break;
        }
        const paths = (files || []).filter((f) => f.id).map((f) => `${folder}/${f.name}`);
        if (paths.length === 0) break;

        const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
        if (removeError) {
          failed += paths.length;
          break;
        }
        removed += paths.length;
      }
    } catch {
      failed += 1;
    }
  }

  return { removed, failed };
}

/** Permanently delete a user. The database function re-checks permission and eligibility. */
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, confirmEmail }: { userId: string; confirmEmail: string }) => {
      const { error } = await supabase.rpc('admin_delete_user', {
        p_user_id: userId,
        p_confirm_email: confirmEmail,
      });
      if (error) throw error;

      const files = await removeUserFiles(userId);
      return { files };
    },
    onSuccess: () => {
      // only the list: the open profile page is about to be left, so don't make it refetch a user that no longer exists
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

/** Account numbers generated for the user after KYC (Safe Haven / Paystack). */
export type GeneratedAccount = {
  source: 'safehaven' | 'paystack';
  account_number: string;
  account_name: string | null;
  bank_name: string | null;
  bank_code: string | null;
  status: string | null;
  is_default: boolean;
  created_at: string | null;
};

export const useUserGeneratedAccounts = (userId: string) => {
  return useQuery({
    queryKey: ['user', userId, 'accounts'],
    queryFn: async (): Promise<GeneratedAccount[]> => {
      const { data, error } = await supabase.rpc('admin_get_user_accounts', { p_user_id: userId });
      if (error) throw error;
      return (data as GeneratedAccount[]) || [];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
};
