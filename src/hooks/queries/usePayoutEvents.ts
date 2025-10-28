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

export function usePayoutEvents(searchQuery?: string, statusFilter?: string, page: number = 1, pageSize: number = 50) {
  return useQuery({
    queryKey: ['payout-events', searchQuery, statusFilter, page, pageSize],
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

      if (statsResult.error) throw statsResult.error;
      if (plansResult.error) throw plansResult.error;
      if (upcomingUsersResult.error) throw upcomingUsersResult.error;

      const statsData = statsResult.data as any;
      const stats: PayoutEventStats = {
        total: Number(statsData?.total || 0),
        processing: Number(statsData?.processing || 0),
        completed: Number(statsData?.completed || 0),
        failed: Number(statsData?.failed || 0),
        usersWithUpcomingPayouts: new Set(
          (upcomingUsersResult.data || []).map((plan: any) => plan.user_id)
        ).size,
      };

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
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (statusFilter && statusFilter !== 'all') {
        payoutsQuery = payoutsQuery.eq('status', statusFilter);
      }

      if (searchQuery) {
        payoutsQuery = payoutsQuery.or(
          `transfer_reference.ilike.%${searchQuery}%,` +
          `amount.eq.${searchQuery}`
        );
      }

      const payoutsResult = await payoutsQuery;

      if (payoutsResult.error) throw payoutsResult.error;

      const plansMap = new Map(
        (plansResult.data || []).map((plan: any) => [plan.id, plan])
      );

      const events = (payoutsResult.data || []).map((payout: any) => ({
        ...payout,
        user: payout.profiles,
        payout_plan: payout.payout_plan_id ? plansMap.get(payout.payout_plan_id) : null
      }));

      return {
        events,
        stats,
        totalCount: payoutsResult.count || 0,
        totalPages: Math.ceil((payoutsResult.count || 0) / pageSize)
      };
    },
    staleTime: 30 * 1000,
  });
}
