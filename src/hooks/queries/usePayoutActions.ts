import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Admin payout controls: pause / resume / cancel a plan, mark a payout transaction
 * Completed or Refunded, and retry a failed payout.
 *
 * The database decides what is allowed (admin_user_payout_actions) and re-checks it
 * when an action runs, so the UI only has to show what comes back.
 */

export type PayoutState =
  | 'completed'
  | 'in_flight' // a transfer started in the last 30 minutes
  | 'stuck' // pending/processing for longer, money may be held
  | 'failed_held' // failed but the wallet debit was not refunded, or a manual hold
  | 'failed' // failed, nothing held (the engine retries these on its own)
  | 'unlinked';

export type PayoutInstallmentActions = {
  ap_id: string | null;
  tx_id: string | null;
  plan_id: string | null;
  plan_name: string | null;
  plan_status: string | null;
  installment_index: number | null;
  ap_status: string | null;
  tx_status: string | null;
  amount: number | null;
  reference: string | null;
  error: string | null;
  state: PayoutState;
  is_current: boolean;
  manual_hold: boolean;
  can_complete: boolean;
  can_refund: boolean;
  can_retry: boolean;
  /** the bank transfer may have happened: the admin has to confirm it did not */
  retry_needs_confirm: boolean;
  /** completing this will debit the user's wallet (it was never debited, or was refunded) */
  complete_debits_wallet: boolean;
  /** refunding this will credit the user's wallet */
  refund_credits_wallet: boolean;
  complete_blocker: string | null;
  refund_blocker: string | null;
  retry_blocker: string | null;
};

export type PlanPayoutActions = {
  plan_id: string;
  status: 'active' | 'paused';
  can_pause: boolean;
  can_resume: boolean;
  can_cancel: boolean;
  cancel_blocker: string | null;
  /** the next payout date has passed */
  due_now: boolean;
  /** the plan's current installment, when it has a failed or unfinished attempt */
  current: PayoutInstallmentActions | null;
};

export type UserPayoutActions = {
  plans: PlanPayoutActions[];
  /** keyed by transaction id: payout transactions that are pending, failed or refunded */
  transactions: Record<string, PayoutInstallmentActions>;
};

const payoutActionsKey = (userId: string) => ['payout-actions', userId] as const;

export const useUserPayoutActions = (userId: string | null | undefined, enabled = true) => {
  return useQuery({
    queryKey: payoutActionsKey(userId || ''),
    queryFn: async (): Promise<UserPayoutActions> => {
      const { data, error } = await supabase.rpc('admin_user_payout_actions', { p_user_id: userId });
      if (error) throw error;
      return {
        plans: data?.plans || [],
        transactions: data?.transactions || {},
      };
    },
    enabled: !!userId && enabled,
    staleTime: 15 * 1000,
  });
};

/** Everything that shows payout data for this user (or everyone) has to be refetched after an action. */
function useRefreshAfterAction(userId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: payoutActionsKey(userId) }),
      queryClient.invalidateQueries({ queryKey: ['user', userId] }),
      queryClient.invalidateQueries({ queryKey: ['user-activity', userId] }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['payout-plans'] }),
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
}

export const usePausePayoutPlan = (userId: string) => {
  const refresh = useRefreshAfterAction(userId);
  return useMutation({
    mutationFn: async ({ planId, reason }: { planId: string; reason?: string }) => {
      const { error } = await supabase.rpc('admin_pause_payout_plan', {
        p_plan_id: planId,
        p_reason: reason?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
};

export const useResumePayoutPlan = (userId: string) => {
  const refresh = useRefreshAfterAction(userId);
  return useMutation({
    mutationFn: async ({ planId }: { planId: string }) => {
      const { data, error } = await supabase.rpc('admin_resume_payout_plan', { p_plan_id: planId });
      if (error) throw error;
      return { dueNow: !!data?.due_now };
    },
    onSuccess: refresh,
  });
};

export const useCancelPayoutPlan = (userId: string) => {
  const refresh = useRefreshAfterAction(userId);
  return useMutation({
    mutationFn: async ({ planId, reason }: { planId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('admin_cancel_payout_plan', {
        p_plan_id: planId,
        p_reason: reason?.trim() || null,
      });
      if (error) throw error;
      return { feeRefund: Number(data?.fee_refund || 0) };
    },
    onSuccess: refresh,
  });
};

export const useCompletePayoutTransaction = (userId: string) => {
  const refresh = useRefreshAfterAction(userId);
  return useMutation({
    mutationFn: async ({ transactionId, reference, notes }: { transactionId: string; reference: string; notes?: string }) => {
      const { error } = await supabase.rpc('admin_complete_payout_transaction', {
        p_transaction_id: transactionId,
        p_reference: reference.trim(),
        p_notes: notes?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
};

export const useRefundPayoutTransaction = (userId: string) => {
  const refresh = useRefreshAfterAction(userId);
  return useMutation({
    mutationFn: async ({ transactionId, reason, pausePlan }: { transactionId: string; reason: string; pausePlan: boolean }) => {
      const { data, error } = await supabase.rpc('admin_refund_payout_transaction', {
        p_transaction_id: transactionId,
        p_reason: reason.trim(),
        p_pause_plan: pausePlan,
      });
      if (error) throw error;
      return { walletCredited: !!data?.wallet_credited, planPaused: !!data?.plan_paused };
    },
    onSuccess: refresh,
  });
};

export type RetryOutcome =
  | { kind: 'completed' }
  | { kind: 'processing' }
  | { kind: 'failed'; error: string | null }
  | { kind: 'queued'; reason: string };

/**
 * Release the failed installment, then run the payout job right away so it is retried now
 * instead of at the next 5-minute run. If the job cannot be started the installment stays
 * released and the scheduled run picks it up.
 */
export const useRetryPayout = (userId: string) => {
  const refresh = useRefreshAfterAction(userId);
  return useMutation({
    mutationFn: async ({
      automatedPayoutId,
      planId,
      confirmNotPaid,
    }: {
      automatedPayoutId: string;
      planId: string;
      confirmNotPaid: boolean;
    }): Promise<RetryOutcome> => {
      const { error } = await supabase.rpc('admin_prepare_payout_retry', {
        p_automated_payout_id: automatedPayoutId,
        p_confirm_not_paid: confirmNotPaid,
      });
      if (error) throw error;

      const { error: runError } = await supabase.functions.invoke('process-due-payouts', { method: 'POST' });
      if (runError) {
        return { kind: 'queued', reason: 'The payout run could not be started from here.' };
      }

      // report what actually happened to this plan's installment
      const { data } = await supabase.rpc('admin_user_payout_actions', { p_user_id: userId });
      const plan: PlanPayoutActions | undefined = (data?.plans || []).find((p: PlanPayoutActions) => p.plan_id === planId);
      const current = plan?.current;
      if (!plan || !current) return { kind: 'completed' };
      if (current.state === 'in_flight') return { kind: 'processing' };
      if (current.ap_status === 'failed') return { kind: 'failed', error: current.error };
      return { kind: 'queued', reason: 'The payout has not been picked up yet.' };
    },
    onSettled: refresh,
  });
};
