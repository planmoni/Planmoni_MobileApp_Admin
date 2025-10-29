import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface KycAuditLog {
  id: string;
  user_id: string;
  session_id: string | null;
  request_id: string | null;
  operation_type: string;
  verification_type: string | null;
  verification_provider: string | null;
  request_data: any;
  response_data: any;
  processed_data: any;
  status: string;
  result_code: string | null;
  result_message: string | null;
  confidence_score: number | null;
  ip_address: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  location_data: any;
  provider_request_id: string | null;
  provider_response_time_ms: number | null;
  provider_cost: number | null;
  regulatory_requirements: any;
  compliance_flags: any;
  risk_score: number | null;
  previous_log_id: string | null;
  integrity_hash: string | null;
  signature: string | null;
  metadata: any;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  retention_until: string | null;
  archived_at: string | null;
  archive_reason: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

export interface SafehavenAuditLog {
  id: string;
  user_id: string;
  operation_type: string;
  request_data: any;
  response_data: any;
  error_data: any;
  status: string;
  status_code: number | null;
  response_time_ms: number | null;
  safehaven_endpoint: string | null;
  safehaven_client_id: string | null;
  safehaven_user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  integrity_hash: string | null;
  metadata: any;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

export interface AuditLogsFilters {
  logType: 'all' | 'kyc' | 'safehaven';
  status?: string;
  operationType?: string;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

export function useAuditLogs(filters: AuditLogsFilters) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      const logs: Array<{ type: 'kyc' | 'safehaven'; data: KycAuditLog | SafehavenAuditLog }> = [];

      if (filters.logType === 'all' || filters.logType === 'kyc') {
        let kycQuery = supabase
          .from('kyc_audit_logs')
          .select(`
            *,
            profiles:user_id (
              first_name,
              last_name,
              email
            )
          `)
          .order('created_at', { ascending: false })
          .limit(100);

        if (filters.status) {
          kycQuery = kycQuery.eq('status', filters.status);
        }
        if (filters.operationType) {
          kycQuery = kycQuery.eq('operation_type', filters.operationType);
        }
        if (filters.dateFrom) {
          kycQuery = kycQuery.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          kycQuery = kycQuery.lte('created_at', filters.dateTo);
        }
        if (filters.searchQuery) {
          kycQuery = kycQuery.or(`operation_type.ilike.%${filters.searchQuery}%,verification_type.ilike.%${filters.searchQuery}%,result_message.ilike.%${filters.searchQuery}%`);
        }

        const { data: kycData, error: kycError } = await kycQuery;

        if (kycError) {
          console.error('Error fetching KYC audit logs:', kycError);
        } else if (kycData) {
          logs.push(...kycData.map(log => ({ type: 'kyc' as const, data: log })));
        }
      }

      if (filters.logType === 'all' || filters.logType === 'safehaven') {
        let safehavenQuery = supabase
          .from('safehaven_audit_logs')
          .select(`
            *,
            profiles:user_id (
              first_name,
              last_name,
              email
            )
          `)
          .order('created_at', { ascending: false })
          .limit(100);

        if (filters.status) {
          safehavenQuery = safehavenQuery.eq('status', filters.status);
        }
        if (filters.operationType) {
          safehavenQuery = safehavenQuery.eq('operation_type', filters.operationType);
        }
        if (filters.dateFrom) {
          safehavenQuery = safehavenQuery.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          safehavenQuery = safehavenQuery.lte('created_at', filters.dateTo);
        }
        if (filters.searchQuery) {
          safehavenQuery = safehavenQuery.or(`operation_type.ilike.%${filters.searchQuery}%,safehaven_endpoint.ilike.%${filters.searchQuery}%`);
        }

        const { data: safehavenData, error: safehavenError } = await safehavenQuery;

        if (safehavenError) {
          console.error('Error fetching SafeHaven audit logs:', safehavenError);
        } else if (safehavenData) {
          logs.push(...safehavenData.map(log => ({ type: 'safehaven' as const, data: log })));
        }
      }

      logs.sort((a, b) => {
        const dateA = new Date(a.data.created_at).getTime();
        const dateB = new Date(b.data.created_at).getTime();
        return dateB - dateA;
      });

      return logs;
    },
    staleTime: 30000,
  });
}
