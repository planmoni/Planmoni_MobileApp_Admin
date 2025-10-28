import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  old_values: any;
  new_values: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
  user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface Event {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface ActivityData {
  auditLogs: ActivityLog[];
  events: Event[];
  recentTransactions: any[];
  stats: {
    totalActions: number;
    totalEvents: number;
    activeUsers: number;
    todayActions: number;
  };
}

export function useActivityData(dateRange?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ['activity', dateRange],
    queryFn: async (): Promise<ActivityData> => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let auditQuery = supabase
        .from('audit_logs')
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

      let eventsQuery = supabase
        .from('events')
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

      let transactionsQuery = supabase
        .from('transactions')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (dateRange) {
        auditQuery = auditQuery
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString());

        eventsQuery = eventsQuery
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString());

        transactionsQuery = transactionsQuery
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString());
      }

      const [auditResult, eventsResult, transactionsResult, todayAuditResult] = await Promise.all([
        auditQuery,
        eventsQuery,
        transactionsQuery,
        supabase
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfDay.toISOString())
      ]);

      if (auditResult.error) throw auditResult.error;
      if (eventsResult.error) throw eventsResult.error;
      if (transactionsResult.error) throw transactionsResult.error;

      const auditLogs = (auditResult.data || []).map((log: any) => ({
        ...log,
        user: log.profiles
      }));

      const events = (eventsResult.data || []).map((event: any) => ({
        ...event,
        user: event.profiles
      }));

      const recentTransactions = (transactionsResult.data || []).map((tx: any) => ({
        ...tx,
        user: tx.profiles
      }));

      const uniqueUserIds = new Set([
        ...auditLogs.map((log: any) => log.user_id),
        ...events.map((event: any) => event.user_id)
      ]);

      return {
        auditLogs,
        events,
        recentTransactions,
        stats: {
          totalActions: auditLogs.length,
          totalEvents: events.length,
          activeUsers: uniqueUserIds.size,
          todayActions: todayAuditResult.count || 0
        }
      };
    },
    staleTime: 30 * 1000,
  });
}
