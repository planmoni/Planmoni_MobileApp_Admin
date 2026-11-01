import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ActivityPage } from '@/lib/activityView';

export const ACTIVITY_PAGE_SIZE = 30;

export type ActivityListParams = {
  from: Date | null;
  /** exclusive */
  to: Date | null;
  category: string;
  kind: string;
  search: string;
  userId: string | null;
  page: number; // 1-based
  pageSize?: number;
};

export const fetchActivity = async (p: ActivityListParams): Promise<ActivityPage> => {
  const pageSize = p.pageSize ?? ACTIVITY_PAGE_SIZE;
  const { data, error } = await supabase.rpc('admin_list_activity', {
    p_from: p.from ? p.from.toISOString() : null,
    p_to: p.to ? p.to.toISOString() : null,
    p_category: p.category === 'all' ? null : p.category,
    p_kind: p.kind === 'all' ? null : p.kind,
    p_search: p.search.trim() || null,
    p_user_id: p.userId,
    p_limit: pageSize,
    p_offset: (Math.max(p.page, 1) - 1) * pageSize,
  });

  if (error) throw new Error(error.message);

  const result = (data || {}) as Partial<ActivityPage>;
  return {
    rows: result.rows || [],
    total: Number(result.total) || 0,
    facets: result.facets || [],
  };
};

/** One page of the activity timeline, plus per category / per kind counts for the whole period. */
export const useActivityList = (params: ActivityListParams) =>
  useQuery({
    // starts with 'activity' so the page's refresh button (useRefreshData(['activity'])) reloads it
    queryKey: [
      'activity',
      'list',
      {
        ...params,
        from: params.from?.toISOString() ?? null,
        to: params.to?.toISOString() ?? null,
      },
    ],
    queryFn: () => fetchActivity(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

/** Everything that happened since midnight, newest first (the most recent `limit` events), for the dashboard. */
export const useTodayActivity = (limit = 40) =>
  useQuery({
    // starts with 'dashboard' so the dashboard's refresh button reloads it
    queryKey: ['dashboard', 'today-activity', limit],
    queryFn: () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return fetchActivity({ from: start, to: null, category: 'all', kind: 'all', search: '', userId: null, page: 1, pageSize: limit });
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
