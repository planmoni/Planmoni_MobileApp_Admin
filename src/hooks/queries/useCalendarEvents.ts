import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { startOfMonth, endOfMonth } from 'date-fns';

interface CalendarEvent {
  id: string;
  type: 'payout_received' | 'payout_created' | 'scheduled_payout' | 'payout_failed';
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

      const { data: automatedPayouts, error: payoutsError } = await supabase
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
        .order('scheduled_date', { ascending: true });

      if (payoutsError) {
        console.error('Error fetching automated payouts:', payoutsError);
        throw payoutsError;
      }

      const events: CalendarEvent[] = [];

      automatedPayouts?.forEach((payout: any) => {
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
          description = `Payout from "${planName}" completed`;
        } else if (payout.status === 'failed') {
          eventType = 'payout_failed';
          title = 'Payout Failed';
          description = `Payout from "${planName}" failed`;
        } else if (payout.status === 'pending') {
          eventType = 'scheduled_payout';
          title = 'Scheduled Payout';
          description = `Next payout from "${planName}"`;
        } else {
          eventType = 'payout_created';
          title = 'Payout Created';
          description = `Payout from "${planName}" created`;
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

      return events;
    },
    staleTime: 30000,
  });
}
