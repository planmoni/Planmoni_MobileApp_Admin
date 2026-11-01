import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PayoutEventsPage } from '@/lib/payoutEventsView';
import type { PayoutInstallmentActions } from '@/hooks/queries/usePayoutActions';

export const PAYOUT_EVENTS_PAGE_SIZE = 25;

export type PayoutEventsListParams = {
  from: Date | null;
  /** exclusive */
  to: Date | null;
  status: string;
  search: string;
  userId: string | null;
  page: number; // 1-based
  pageSize?: number;
};

export const fetchPayoutEvents = async (p: PayoutEventsListParams): Promise<PayoutEventsPage> => {
  const pageSize = p.pageSize ?? PAYOUT_EVENTS_PAGE_SIZE;
  const { data, error } = await supabase.rpc('admin_list_payout_events', {
    p_from: p.from ? p.from.toISOString() : null,
    p_to: p.to ? p.to.toISOString() : null,
    p_status: p.status === 'all' ? null : p.status,
    p_search: p.search.trim() || null,
    p_user_id: p.userId,
    p_limit: pageSize,
    p_offset: (Math.max(p.page, 1) - 1) * pageSize,
  });

  if (error) throw new Error(error.message);

  const result = (data || {}) as Partial<PayoutEventsPage>;
  return {
    rows: result.rows || [],
    total: Number(result.total) || 0,
    facets: result.facets || [],
  };
};

/** One page of payout events, plus per status counts and amounts for the whole filtered period. */
export const usePayoutEventsList = (params: PayoutEventsListParams) =>
  useQuery({
    // starts with 'payout-events' so the page's refresh button and payout actions reload it
    queryKey: [
      'payout-events',
      'list',
      {
        ...params,
        from: params.from?.toISOString() ?? null,
        to: params.to?.toISOString() ?? null,
      },
    ],
    queryFn: () => fetchPayoutEvents(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

/** How many events are stuck or have money held, across all time (they do not go away with the date filter). */
export const usePayoutAttentionCount = () =>
  useQuery({
    queryKey: ['payout-events', 'attention-count'],
    queryFn: async () => {
      const page = await fetchPayoutEvents({ from: null, to: null, status: 'attention', search: '', userId: null, page: 1, pageSize: 1 });
      return page.total;
    },
    staleTime: 30 * 1000,
  });

/** What happened to each payout today (newest first, the most recent `limit`), for the dashboard. */
export const useTodayPayoutEvents = (limit = 40) =>
  useQuery({
    // starts with 'dashboard' so the dashboard's refresh button reloads it
    queryKey: ['dashboard', 'today-payout-events', limit],
    queryFn: () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return fetchPayoutEvents({ from: start, to: null, status: 'all', search: '', userId: null, page: 1, pageSize: limit });
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

/** What can be done with one payout event (retry / mark completed / refund), straight from the database. */
export const usePayoutEventState = (id: string | null | undefined, enabled = true) =>
  useQuery({
    queryKey: ['payout-events', 'state', id],
    enabled: enabled && !!id,
    queryFn: async (): Promise<PayoutInstallmentActions | null> => {
      const { data, error } = await supabase.rpc('admin_payout_event_state', { p_automated_payout_id: id });
      if (error) throw new Error(error.message);
      return (data as PayoutInstallmentActions | null) ?? null;
    },
    staleTime: 15 * 1000,
  });
