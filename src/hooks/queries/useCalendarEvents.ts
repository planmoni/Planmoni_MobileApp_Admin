import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { startOfMonth, endOfMonth } from 'date-fns';

interface CalendarEvent {
  id: string;
  type: 'payout_received' | 'payout_created' | 'scheduled_payout' | 'payout_failed' | 'deposit' | 'withdrawal';
  date: Date;
  title: string;
  description: string;
  amount?: number;
  user_name?: string;
  plan_name?: string;
}

export function useCalendarEvents(currentDate: Date) {
  return useQuery({
    queryKey: ['calendar-events', currentDate.toISOString()],
    queryFn: async () => {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);

      const events: CalendarEvent[] = [];

      const [automatedPayoutsResult, payoutPlansResult, scheduledPlansResult, transactionsResult] = await Promise.all([
        supabase
          .from('automated_payouts')
          .select(`
            id,
            scheduled_date,
            execution_date,
            status,
            amount,
            user_id,
            payout_plan_id,
            profiles!automated_payouts_user_id_fkey (
              first_name,
              last_name
            ),
            payout_plans (
              name
            )
          `)
          .gte('scheduled_date', monthStart.toISOString().split('T')[0])
          .lte('scheduled_date', monthEnd.toISOString().split('T')[0])
          .order('scheduled_date', { ascending: true }),

        supabase
          .from('payout_plans')
          .select(`
            id,
            name,
            total_amount,
            created_at,
            user_id,
            profiles!payout_plans_user_id_fkey (
              first_name,
              last_name
            )
          `)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString())
          .order('created_at', { ascending: true }),

        supabase
          .from('payout_plans')
          .select(`
            id,
            name,
            payout_amount,
            next_payout_date,
            user_id,
            profiles!payout_plans_user_id_fkey (
              first_name,
              last_name
            )
          `)
          .gte('next_payout_date', monthStart.toISOString())
          .lte('next_payout_date', monthEnd.toISOString())
          .eq('status', 'active')
          .order('next_payout_date', { ascending: true }),

        supabase
          .from('transactions')
          .select(`
            id,
            type,
            amount,
            status,
            created_at,
            user_id,
            payout_plan_id,
            profiles!transactions_user_id_fkey (
              first_name,
              last_name
            ),
            payout_plans (
              name
            )
          `)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString())
          .in('type', ['deposit', 'withdrawal', 'payout'])
          .order('created_at', { ascending: true })
      ]);

      if (automatedPayoutsResult.error) {
        console.error('Error fetching automated payouts:', automatedPayoutsResult.error);
      } else {
        automatedPayoutsResult.data?.forEach((payout: any) => {
          const userName = payout.profiles
            ? `${payout.profiles.first_name || ''} ${payout.profiles.last_name || ''}`.trim()
            : 'Unknown User';
          const planName = payout.payout_plans?.name || 'Payout Plan';

          let eventType: CalendarEvent['type'];
          let title: string;
          let description: string;

          if (payout.status === 'completed') {
            eventType = 'payout_received';
            title = 'Payout Completed';
            description = `${userName} - ${planName}`;
          } else if (payout.status === 'failed') {
            eventType = 'payout_failed';
            title = 'Payout Failed';
            description = `${userName} - ${planName}`;
          } else if (payout.status === 'pending') {
            eventType = 'scheduled_payout';
            title = 'Scheduled Payout';
            description = `${userName} - ${planName}`;
          } else {
            eventType = 'payout_created';
            title = 'Payout Created';
            description = `${userName} - ${planName}`;
          }

          events.push({
            id: payout.id,
            type: eventType,
            date: new Date(payout.scheduled_date),
            title,
            description,
            amount: parseFloat(payout.amount),
            user_name: userName,
            plan_name: planName,
          });
        });
      }

      if (payoutPlansResult.error) {
        console.error('Error fetching payout plans:', payoutPlansResult.error);
      } else {
        payoutPlansResult.data?.forEach((plan: any) => {
          const userName = plan.profiles
            ? `${plan.profiles.first_name || ''} ${plan.profiles.last_name || ''}`.trim()
            : 'Unknown User';

          events.push({
            id: `plan-${plan.id}`,
            type: 'payout_created',
            date: new Date(plan.created_at),
            title: 'Payout Created',
            description: `${userName} created "${plan.name}"`,
            amount: parseFloat(plan.total_amount),
            user_name: userName,
            plan_name: plan.name,
          });
        });
      }

      if (scheduledPlansResult.error) {
        console.error('Error fetching scheduled plans:', scheduledPlansResult.error);
      } else {
        scheduledPlansResult.data?.forEach((plan: any) => {
          const userName = plan.profiles
            ? `${plan.profiles.first_name || ''} ${plan.profiles.last_name || ''}`.trim()
            : 'Unknown User';

          events.push({
            id: `scheduled-${plan.id}`,
            type: 'scheduled_payout',
            date: new Date(plan.next_payout_date),
            title: 'Scheduled Payout',
            description: `${userName} - ${plan.name}`,
            amount: parseFloat(plan.payout_amount),
            user_name: userName,
            plan_name: plan.name,
          });
        });
      }

      if (transactionsResult.error) {
        console.error('Error fetching transactions:', transactionsResult.error);
      } else {
        transactionsResult.data?.forEach((transaction: any) => {
          const userName = transaction.profiles
            ? `${transaction.profiles.first_name || ''} ${transaction.profiles.last_name || ''}`.trim()
            : 'Unknown User';

          if (transaction.type === 'deposit' && transaction.status === 'completed') {
            events.push({
              id: `tx-${transaction.id}`,
              type: 'deposit',
              date: new Date(transaction.created_at),
              title: 'Deposit Received',
              description: `${userName} deposited funds`,
              amount: parseFloat(transaction.amount),
              user_name: userName,
            });
          } else if (transaction.type === 'withdrawal' && transaction.status === 'completed') {
            events.push({
              id: `tx-${transaction.id}`,
              type: 'withdrawal',
              date: new Date(transaction.created_at),
              title: 'Withdrawal Completed',
              description: `${userName} withdrew funds`,
              amount: parseFloat(transaction.amount),
              user_name: userName,
            });
          } else if (transaction.type === 'payout') {
            const planName = transaction.payout_plans?.name || 'Payout Plan';
            const isCompleted = transaction.status === 'completed';

            events.push({
              id: `tx-${transaction.id}`,
              type: isCompleted ? 'payout_received' : 'payout_failed',
              date: new Date(transaction.created_at),
              title: isCompleted ? 'Payout Completed' : 'Payout Failed',
              description: `${userName} - ${planName}`,
              amount: parseFloat(transaction.amount),
              user_name: userName,
              plan_name: planName,
            });
          }
        });
      }

      return events.sort((a, b) => a.date.getTime() - b.date.getTime());
    },
    staleTime: 30000,
  });
}
