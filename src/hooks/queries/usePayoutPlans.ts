import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface PayoutPlan {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  total_amount: number;
  payout_amount: number;
  frequency: string;
  duration: number;
  start_date: string;
  status: string;
  completed_payouts: number;
  next_payout_date?: string;
  is_ai_generated: boolean;
  created_at: string;
  user?: {
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface PayoutPlansStats {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  daily: number;
  specificDays: number;
  weekly: number;
  biWeekly: number;
  monthly: number;
  monthEnd: number;
  quarterly: number;
  biAnnually: number;
  annually: number;
  custom: number;
  totalAmount: number;
  totalPayoutAmount: number;
  dailyAmount: number;
  specificDaysAmount: number;
  weeklyAmount: number;
  biWeeklyAmount: number;
  monthlyAmount: number;
  monthEndAmount: number;
  quarterlyAmount: number;
  biAnnuallyAmount: number;
  annuallyAmount: number;
  customAmount: number;
  totalLockedBalance: number;
  totalEmergencyWithdrawals: number;
}

export function usePayoutPlans(searchQuery?: string, statusFilter?: string, frequencyFilter?: string, page: number = 1, pageSize: number = 50) {
  return useQuery({
    queryKey: ['payout-plans', searchQuery, statusFilter, frequencyFilter, page, pageSize],
    queryFn: async () => {
      const [statsResult, plansResult] = await Promise.all([
        supabase.rpc('get_payout_plans_stats'),
        (async () => {
          let query = supabase
            .from('payout_plans')
            .select(`
              *,
              profiles!payout_plans_user_id_fkey (
                email,
                first_name,
                last_name
              )
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * pageSize, page * pageSize - 1);

          if (statusFilter && statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
          }

          if (frequencyFilter && frequencyFilter !== 'all') {
            query = query.eq('frequency', frequencyFilter);
          }

          if (searchQuery) {
            query = query.or(
              `name.ilike.%${searchQuery}%,` +
              `description.ilike.%${searchQuery}%`
            );
          }

          return query;
        })()
      ]);

      if (statsResult.error) throw statsResult.error;
      if (plansResult.error) throw plansResult.error;

      const statsData = Array.isArray(statsResult.data) && statsResult.data.length > 0
        ? statsResult.data[0]
        : null;

      const stats: PayoutPlansStats = {
        total: Number(statsData?.total || 0),
        active: Number(statsData?.active || 0),
        completed: Number(statsData?.completed || 0),
        cancelled: Number(statsData?.cancelled || 0),
        daily: Number(statsData?.daily || 0),
        specificDays: Number(statsData?.specific_days || 0),
        weekly: Number(statsData?.weekly || 0),
        biWeekly: Number(statsData?.bi_weekly || 0),
        monthly: Number(statsData?.monthly || 0),
        monthEnd: Number(statsData?.month_end || 0),
        quarterly: Number(statsData?.quarterly || 0),
        biAnnually: Number(statsData?.bi_annually || 0),
        annually: Number(statsData?.annually || 0),
        custom: Number(statsData?.custom || 0),
        totalAmount: Number(statsData?.total_amount || 0),
        totalPayoutAmount: Number(statsData?.total_payout_amount || 0),
        dailyAmount: Number(statsData?.daily_amount || 0),
        specificDaysAmount: Number(statsData?.specific_days_amount || 0),
        weeklyAmount: Number(statsData?.weekly_amount || 0),
        biWeeklyAmount: Number(statsData?.bi_weekly_amount || 0),
        monthlyAmount: Number(statsData?.monthly_amount || 0),
        monthEndAmount: Number(statsData?.month_end_amount || 0),
        quarterlyAmount: Number(statsData?.quarterly_amount || 0),
        biAnnuallyAmount: Number(statsData?.bi_annually_amount || 0),
        annuallyAmount: Number(statsData?.annually_amount || 0),
        customAmount: Number(statsData?.custom_amount || 0),
        totalLockedBalance: Number(statsData?.total_locked_balance || 0),
        totalEmergencyWithdrawals: Number(statsData?.total_emergency_withdrawals || 0),
      };

      const plans = (plansResult.data || []).map((plan: any) => ({
        ...plan,
        user: plan.profiles
      }));

      return {
        plans,
        stats,
        totalCount: plansResult.count || 0,
        totalPages: Math.ceil((plansResult.count || 0) / pageSize)
      };
    },
    staleTime: 30 * 1000,
  });
}
