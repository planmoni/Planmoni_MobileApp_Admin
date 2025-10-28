import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface PayoutEvent {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  payout_plan_id?: string;
  transaction_id?: string;
  created_at: string;
  metadata?: any;
  user?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
  payout_plan?: {
    name: string;
    payout_amount: number;
    frequency: string;
    status: string;
  };
}

export interface PayoutEventStats {
  total: number;
  pending: number;
  completed: number;
  failed: number;
  scheduled: number;
}

export function usePayoutEvents(searchQuery?: string, statusFilter?: string, typeFilter?: string) {
  return useQuery({
    queryKey: ['payout-events', searchQuery, statusFilter, typeFilter],
    queryFn: async () => {
      let eventsQuery = supabase
        .from('events')
        .select(`
          *,
          profiles!events_user_id_fkey (
            email,
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        eventsQuery = eventsQuery.eq('status', statusFilter);
      }

      if (typeFilter && typeFilter !== 'all') {
        eventsQuery = eventsQuery.eq('type', typeFilter);
      }

      const [eventsResult, plansResult] = await Promise.all([
        eventsQuery,
        supabase
          .from('payout_plans')
          .select('id, name, payout_amount, frequency, status')
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (plansResult.error) throw plansResult.error;

      const plansMap = new Map(
        (plansResult.data || []).map((plan: any) => [plan.id, plan])
      );

      let events = (eventsResult.data || []).map((event: any) => ({
        ...event,
        user: event.profiles,
        payout_plan: event.payout_plan_id ? plansMap.get(event.payout_plan_id) : null
      }));

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        events = events.filter((event: any) =>
          event.title?.toLowerCase().includes(query) ||
          event.description?.toLowerCase().includes(query) ||
          event.type?.toLowerCase().includes(query) ||
          event.status?.toLowerCase().includes(query) ||
          event.user?.email?.toLowerCase().includes(query) ||
          event.user?.first_name?.toLowerCase().includes(query) ||
          event.user?.last_name?.toLowerCase().includes(query)
        );
      }

      const stats: PayoutEventStats = {
        total: events.length,
        pending: events.filter((e: any) => e.status === 'pending').length,
        completed: events.filter((e: any) => e.status === 'completed').length,
        failed: events.filter((e: any) => e.status === 'failed').length,
        scheduled: events.filter((e: any) => e.status === 'scheduled').length,
      };

      return { events, stats };
    },
    staleTime: 30 * 1000,
  });
}
