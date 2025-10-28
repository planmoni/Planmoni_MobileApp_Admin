import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface PayoutEvent {
  id: string;
  user_id: string;
  payout_plan_id?: string;
  scheduled_date: string;
  execution_date?: string;
  status: string;
  amount: number;
  transfer_reference?: string;
  error_message?: string;
  completed_at?: string;
  created_at: string;
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
  processing: number;
  completed: number;
  failed: number;
  usersWithUpcomingPayouts: number;
}

export function usePayoutEvents(searchQuery?: string, statusFilter?: string) {
  return useQuery({
    queryKey: ['payout-events', searchQuery, statusFilter],
    queryFn: async () => {
      const [statsResult, plansResult, upcomingUsersResult] = await Promise.all([
        supabase.rpc('get_payout_stats'),
        supabase
          .from('payout_plans')
          .select('id, name, payout_amount, frequency, status'),
        supabase
          .from('payout_plans')
          .select('user_id')
          .eq('status', 'active')
          .not('next_payout_date', 'is', null)
          .gt('next_payout_date', new Date().toISOString())
      ]);

      let payoutsQuery = supabase
        .from('automated_payouts')
        .select(`
          *,
          profiles!automated_payouts_user_id_fkey (
            email,
            first_name,
            last_name
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(5000);

      if (statusFilter && statusFilter !== 'all') {
        payoutsQuery = payoutsQuery.eq('status', statusFilter);
      }

      const allPayoutsResult = await payoutsQuery;

      if (allPayoutsResult.error) throw allPayoutsResult.error;
      if (plansResult.error) throw plansResult.error;
      if (upcomingUsersResult.error) throw upcomingUsersResult.error;

      const plansMap = new Map(
        (plansResult.data || []).map((plan: any) => [plan.id, plan])
      );

      const uniqueUsersWithUpcomingPayouts = new Set(
        (upcomingUsersResult.data || []).map((plan: any) => plan.user_id)
      ).size;

      const allEvents = (allPayoutsResult.data || []).map((payout: any) => ({
        ...payout,
        user: payout.profiles,
        payout_plan: payout.payout_plan_id ? plansMap.get(payout.payout_plan_id) : null
      }));

      const stats: PayoutEventStats = statsResult.error
        ? {
            total: allPayoutsResult.count || allEvents.length,
            processing: allEvents.filter((e: any) => e.status === 'processing').length,
            completed: allEvents.filter((e: any) => e.status === 'completed').length,
            failed: allEvents.filter((e: any) => e.status === 'failed').length,
            usersWithUpcomingPayouts: uniqueUsersWithUpcomingPayouts,
          }
        : {
            total: statsResult.data?.total || 0,
            processing: statsResult.data?.processing || 0,
            completed: statsResult.data?.completed || 0,
            failed: statsResult.data?.failed || 0,
            usersWithUpcomingPayouts: uniqueUsersWithUpcomingPayouts,
          };

      let filteredEvents = allEvents;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredEvents = filteredEvents.filter((event: any) =>
          event.status?.toLowerCase().includes(query) ||
          event.transfer_reference?.toLowerCase().includes(query) ||
          event.amount?.toString().includes(query) ||
          event.user?.email?.toLowerCase().includes(query) ||
          event.user?.first_name?.toLowerCase().includes(query) ||
          event.user?.last_name?.toLowerCase().includes(query) ||
          event.payout_plan?.name?.toLowerCase().includes(query)
        );
      }

      return { events: filteredEvents, stats };
    },
    staleTime: 30 * 1000,
  });
}
