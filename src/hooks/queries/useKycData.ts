import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface KycData {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth: string;
  phone_number: string;
  address: string;
  address_no?: string;
  lga: string;
  state: string;
  bvn?: string;
  nin?: string;
  document_type?: string;
  document_number?: string;
  document_front_url?: string;
  document_back_url?: string;
  selfie_url?: string;
  utility_bill_url?: string;
  house_url?: string;
  bank_name?: string;
  account_number?: string;
  bank_code?: string;
  approved: boolean;
  utility_bill_verified: boolean;
  utility_bill_validated: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    email: string;
  };
  kyc_progress?: {
    current_step: string;
    personal_info_completed: boolean;
    bvn_verified: boolean;
    documents_verified: boolean;
    address_completed: boolean;
    overall_completed: boolean;
  };
}

export interface KycStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  completed: number;
}

export function useKycData(searchQuery?: string, statusFilter?: string) {
  return useQuery({
    queryKey: ['kyc-data', searchQuery, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('kyc_data')
        .select(`
          *,
          profiles:user_id (
            email
          ),
          kyc_progress:user_id (
            current_step,
            personal_info_completed,
            bvn_verified,
            documents_verified,
            address_completed,
            overall_completed
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'approved') {
          query = query.eq('approved', true);
        } else if (statusFilter === 'pending') {
          query = query.eq('approved', false);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      let kycData = (data || []).map((item: any) => ({
        ...item,
        user: item.profiles,
        kyc_progress: Array.isArray(item.kyc_progress) ? item.kyc_progress[0] : item.kyc_progress
      }));

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        kycData = kycData.filter((item: any) =>
          item.first_name?.toLowerCase().includes(query) ||
          item.last_name?.toLowerCase().includes(query) ||
          item.email?.toLowerCase().includes(query) ||
          item.phone_number?.toLowerCase().includes(query) ||
          item.bvn?.toLowerCase().includes(query) ||
          item.nin?.toLowerCase().includes(query) ||
          item.user?.email?.toLowerCase().includes(query)
        );
      }

      const stats: KycStats = {
        total: kycData.length,
        approved: kycData.filter((item: any) => item.approved === true).length,
        pending: kycData.filter((item: any) => item.approved === false).length,
        rejected: 0,
        completed: kycData.filter((item: any) => item.kyc_progress?.overall_completed === true).length,
      };

      return { kycData, stats };
    },
    staleTime: 30 * 1000,
  });
}
