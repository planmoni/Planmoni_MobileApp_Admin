import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type VaultData = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  status: string;
  start_date: string;
  end_date: string;
  total_budget: number;
  current_balance: number;
  spending_limit: number;
  auto_topup_enabled: boolean;
  auto_topup_amount: number;
  auto_topup_trigger: number;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  wallet_balance: number;
  total_spent: number;
};

type VaultStats = {
  total: number;
  active: number;
  paused: number;
  completed: number;
  cancelled: number;
  totalFunded: number;
  totalBalance: number;
  totalSpent: number;
  averageBalance: number;
  vaultsWithBalance: number;
};

export const useVaults = (
  searchQuery: string = '',
  statusFilter: string = 'all',
  currentPage: number = 1,
  pageSize: number = 50
) => {
  return useQuery({
    queryKey: ['vaults', searchQuery, statusFilter, currentPage, pageSize],
    queryFn: async () => {
      const { data: vaultsData, error: vaultsError } = await supabase.rpc('get_all_vaults', {
        search_query: searchQuery,
        status_filter: statusFilter,
        page_number: currentPage,
        page_size: pageSize
      });

      if (vaultsError) {
        console.error('Error fetching vaults:', vaultsError);
        throw vaultsError;
      }

      const { data: statsData, error: statsError } = await supabase.rpc('get_vaults_stats');

      if (statsError) {
        console.error('Error fetching vault stats:', statsError);
      }

      return {
        vaults: (vaultsData?.vaults || []) as VaultData[],
        totalCount: vaultsData?.totalCount || 0,
        totalPages: vaultsData?.totalPages || 0,
        stats: statsData as VaultStats | null
      };
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

export const useVaultDetails = (vaultId: string | undefined) => {
  return useQuery({
    queryKey: ['vault', vaultId],
    queryFn: async () => {
      if (!vaultId) {
        throw new Error('Vault ID is required');
      }

      const { data, error } = await supabase.rpc('get_vault_details', {
        vault_id: vaultId
      });

      if (error) {
        console.error('Error fetching vault details:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Vault not found');
      }

      return data;
    },
    enabled: !!vaultId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};
