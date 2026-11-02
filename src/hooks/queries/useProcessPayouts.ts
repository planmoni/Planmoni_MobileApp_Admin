import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DuePayoutsPage, InspectResult, ProcessResult } from '@/lib/processPayoutsView';

export const DUE_PAYOUTS_PAGE_SIZE = 25;

export type DuePayoutsParams = {
  from: Date | null;
  /** exclusive */
  to: Date | null;
  state: string;
  search: string;
  page: number; // 1-based
};

export const fetchDuePayouts = async (p: DuePayoutsParams): Promise<DuePayoutsPage> => {
  const { data, error } = await supabase.rpc('admin_list_due_payouts', {
    p_from: p.from ? p.from.toISOString() : null,
    p_to: p.to ? p.to.toISOString() : null,
    p_state: p.state === 'all' ? null : p.state,
    p_search: p.search.trim() || null,
    p_limit: DUE_PAYOUTS_PAGE_SIZE,
    p_offset: (Math.max(p.page, 1) - 1) * DUE_PAYOUTS_PAGE_SIZE,
  });
  if (error) throw new Error(error.message);

  const result = (data || {}) as Partial<DuePayoutsPage>;
  return { rows: result.rows || [], total: Number(result.total) || 0, facets: result.facets || [] };
};

/** One page of due payouts plus counts and amounts per state for the whole filtered window. */
export const useDuePayouts = (params: DuePayoutsParams) =>
  useQuery({
    // starts with 'due-payouts' so the page's refresh button and every payout action reload it
    queryKey: ['due-payouts', 'list', { ...params, from: params.from?.toISOString() ?? null, to: params.to?.toISOString() ?? null }],
    queryFn: () => fetchDuePayouts(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });

/** How many due payouts are not finished (all time). For links and badges. */
export const useDuePayoutCount = (enabled = true) =>
  useQuery({
    queryKey: ['due-payouts', 'count'],
    enabled,
    queryFn: async () => (await fetchDuePayouts({ from: null, to: null, state: 'all', search: '', page: 1 })).total,
    staleTime: 60 * 1000,
  });

/** Count and amount of every due payout that is not finished yet (all time). For the dashboard card. */
export const useDuePayoutSummary = (enabled = true) =>
  useQuery({
    queryKey: ['due-payouts', 'summary'],
    enabled,
    queryFn: async () => {
      const page = await fetchDuePayouts({ from: null, to: null, state: 'all', search: '', page: 1 });
      return {
        count: page.total,
        amount: page.facets.reduce((sum, f) => sum + (Number(f.amount) || 0), 0),
      };
    },
    staleTime: 60 * 1000,
  });

export class ProcessPayoutError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

async function callProcessFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-process-payouts', { body });
  if (error) {
    let message = error.message;
    let code: string | undefined;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        const payload = await context.json();
        message = payload?.error || payload?.message || message;
        code = payload?.code;
      } catch {
        // keep the generic message
      }
    }
    throw new ProcessPayoutError(message, code);
  }
  return data as T;
}

/** Reads everything about one plan live (SafeHaven, wallet ledger) without changing anything. */
export const useInspectDuePayout = (planId: string | null) =>
  useQuery({
    // not under 'due-payouts': reloading the list after an action must not re-run this live check
    queryKey: ['due-payout-inspect', planId],
    enabled: !!planId,
    queryFn: async (): Promise<InspectResult> => {
      const result = await callProcessFunction<InspectResult | { success: false; error: string }>({ action: 'inspect', plan_id: planId });
      if (!result || (result as { success?: boolean }).success !== true) {
        throw new ProcessPayoutError((result as { error?: string })?.error || 'Could not inspect this payout');
      }
      return result as InspectResult;
    },
    // a live read of real money: never reuse an old answer, never retry on its own
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

/** Processes ONE plan. The server re-checks everything and refuses if it changed since the review. */
export const useProcessDuePayout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planId: string; fingerprint: string; expectedKind: string; confirm: string }): Promise<ProcessResult> =>
      callProcessFunction<ProcessResult>({
        action: 'process',
        plan_id: input.planId,
        fingerprint: input.fingerprint,
        expected_kind: input.expectedKind,
        confirm: input.confirm,
      }),
    // whatever the outcome, anything that shows payouts has to be read again
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['due-payouts'] }),
        queryClient.invalidateQueries({ queryKey: ['payout-events'] }),
        queryClient.invalidateQueries({ queryKey: ['payout-actions'] }),
        queryClient.invalidateQueries({ queryKey: ['payout-plans'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
};
