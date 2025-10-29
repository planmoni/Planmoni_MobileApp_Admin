import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface EmergencyWithdrawal {
  id: string;
  user_id: string;
  payout_plan_id: string;
  withdrawal_amount: string;
  fee_amount: string;
  net_amount: string;
  withdrawal_type: string;
  status: string;
  requested_at: string;
  processed_at: string | null;
  bank_account_id: string | null;
  payout_account_id: string | null;
  reference: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  transfer_code: string | null;
  error_message: string | null;
  transferred_at: string | null;
  metadata: any;
  scheduled_processing_time: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
  payout_plans?: {
    plan_name: string | null;
    total_amount: string | null;
  };
  payout_accounts?: {
    account_name: string | null;
    account_number: string | null;
    bank_name: string | null;
  };
}

export interface EmergencyWithdrawalsFilters {
  status?: string;
  withdrawalType?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

export function useEmergencyWithdrawals(filters: EmergencyWithdrawalsFilters = {}) {
  return useQuery({
    queryKey: ['emergency-withdrawals', filters],
    queryFn: async () => {
      let query = supabase
        .from('emergency_withdrawals')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name,
            email
          ),
          payout_plans:payout_plan_id (
            plan_name,
            total_amount
          ),
          payout_accounts:payout_account_id (
            account_name,
            account_number,
            bank_name
          )
        `)
        .order('requested_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.withdrawalType) {
        query = query.eq('withdrawal_type', filters.withdrawalType);
      }
      if (filters.dateFrom) {
        query = query.gte('requested_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('requested_at', filters.dateTo);
      }
      if (filters.searchQuery) {
        query = query.or(`reference.ilike.%${filters.searchQuery}%,transfer_code.ilike.%${filters.searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching emergency withdrawals:', error);
        throw error;
      }

      return data as EmergencyWithdrawal[];
    },
    staleTime: 30000,
  });
}
