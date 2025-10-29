import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface KycAuditTrailSummary {
  user_id: string;
  operation_type: string;
  verification_type: string | null;
  verification_provider: string | null;
  total_operations: number;
  successful_operations: number;
  failed_operations: number;
  integrity_violations: number;
  first_operation: string | null;
  last_operation: string | null;
  avg_response_time_ms: number | null;
  total_cost: number | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

export interface AuditTrailFilters {
  userId?: string;
  operationType?: string;
  verificationType?: string;
}

export function useAuditTrailSummary(filters: AuditTrailFilters = {}) {
  return useQuery({
    queryKey: ['audit-trail-summary', filters],
    queryFn: async () => {
      let query = supabase
        .from('kyc_audit_trail_summary')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name,
            email
          )
        `)
        .order('total_operations', { ascending: false });

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.operationType) {
        query = query.eq('operation_type', filters.operationType);
      }
      if (filters.verificationType) {
        query = query.eq('verification_type', filters.verificationType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching audit trail summary:', error);
        throw error;
      }

      return data as KycAuditTrailSummary[];
    },
    staleTime: 60000,
  });
}
