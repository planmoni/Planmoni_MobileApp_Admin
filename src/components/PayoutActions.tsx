import { useState, type ReactNode } from 'react';
import { CircleCheck, Pause, Play, RotateCcw, Undo2, TriangleAlert, X, CircleX } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { formatNaira } from '@/lib/calendarEvents';
import {
  useCancelPayoutPlan,
  useCompletePayoutTransaction,
  usePausePayoutPlan,
  useRefundPayoutTransaction,
  useResumePayoutPlan,
  useRetryPayout,
  type PayoutInstallmentActions,
  type PlanPayoutActions,
} from '@/hooks/queries/usePayoutActions';

const errorMessage = (err: unknown, fallback: string) => (err as { message?: string })?.message || fallback;

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent';

const secondaryButton =
  'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white';

/* ------------------------------------------------------------------------------------------ */
/* Dialog shell                                                                                 */
/* ------------------------------------------------------------------------------------------ */

function DialogShell({
  icon,
  title,
  busy,
  onClose,
  children,
}: {
  icon: ReactNode;
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center shadow-lg">{icon}</div>
            <button
              onClick={() => !busy && onClose()}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}

function DialogButtons({
  busy,
  busyLabel,
  confirmLabel,
  canConfirm,
  danger,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  busyLabel: string;
  confirmLabel: string;
  canConfirm: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex gap-3 mt-6">
      <button
        onClick={onCancel}
        disabled={busy}
        className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all font-medium disabled:opacity-50"
      >
        Back
      </button>
      <button
        onClick={onConfirm}
        disabled={!canConfirm || busy}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
          danger ? 'bg-error hover:bg-red-600' : 'bg-gray-900 hover:bg-gray-800'
        }`}
      >
        {busy ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            <span>{busyLabel}</span>
          </>
        ) : (
          <span>{confirmLabel}</span>
        )}
      </button>
    </div>
  );
}

function Note({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warning' }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-2 mb-4">
      {tone === 'warning' && (
        <p className="flex items-start gap-2 font-medium text-gray-900">
          <TriangleAlert className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-900" />
          <span>{children}</span>
        </p>
      )}
      {tone === 'neutral' && <div>{children}</div>}
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-gray-900 mb-1.5">
        {label} {optional && <span className="font-normal text-gray-400">(optional)</span>}
      </span>
      {children}
    </label>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Plan controls: pause / resume / cancel                                                       */
/* ------------------------------------------------------------------------------------------ */

type PlanLike = { id: string; name: string; status: string; duration: number; completed_payouts: number };

export function PlanControls({ userId, plan, actions }: { userId: string; plan: PlanLike; actions?: PlanPayoutActions }) {
  const [dialog, setDialog] = useState<'pause' | 'resume' | 'cancel' | null>(null);
  if (!actions) return null;

  // Renders inline: the parent is a flex-wrap row that also holds the other plan buttons.
  return (
    <>
      {actions.can_pause && (
        <button onClick={() => setDialog('pause')} className={secondaryButton}>
          <Pause className="h-4 w-4" />
          Pause plan
        </button>
      )}
      {actions.can_resume && (
        <button onClick={() => setDialog('resume')} className={secondaryButton}>
          <Play className="h-4 w-4" />
          Resume plan
        </button>
      )}
      <button
        onClick={() => setDialog('cancel')}
        disabled={!actions.can_cancel}
        title={actions.cancel_blocker || undefined}
        className={secondaryButton}
      >
        <CircleX className="h-4 w-4" />
        Cancel plan
      </button>
      {!actions.can_cancel && actions.cancel_blocker && (
        <p className="text-xs text-gray-500 basis-full">{actions.cancel_blocker}</p>
      )}

      {dialog === 'pause' && <PauseDialog userId={userId} plan={plan} onClose={() => setDialog(null)} />}
      {dialog === 'resume' && <ResumeDialog userId={userId} plan={plan} dueNow={actions.due_now} onClose={() => setDialog(null)} />}
      {dialog === 'cancel' && <CancelDialog userId={userId} plan={plan} onClose={() => setDialog(null)} />}
    </>
  );
}

function PauseDialog({ userId, plan, onClose }: { userId: string; plan: PlanLike; onClose: () => void }) {
  const { showToast } = useToast();
  const pause = usePausePayoutPlan(userId);
  const [reason, setReason] = useState('');

  const confirm = async () => {
    try {
      await pause.mutateAsync({ planId: plan.id, reason });
      showToast('Plan paused', 'success');
      onClose();
    } catch (err) {
      showToast(errorMessage(err, 'Could not pause the plan'), 'error');
    }
  };

  return (
    <DialogShell icon={<Pause className="h-6 w-6 text-white" />} title="Pause payout plan" busy={pause.isPending} onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        No payouts will be sent for <span className="font-medium text-gray-900">{plan.name}</span> while it is paused.
        The funds stay locked in the user's wallet and the plan can be resumed at any time.
      </p>
      <Field label="Reason" optional>
        <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this plan being paused?" />
      </Field>
      <DialogButtons busy={pause.isPending} busyLabel="Pausing..." confirmLabel="Pause plan" canConfirm onCancel={onClose} onConfirm={confirm} />
    </DialogShell>
  );
}

function ResumeDialog({ userId, plan, dueNow, onClose }: { userId: string; plan: PlanLike; dueNow: boolean; onClose: () => void }) {
  const { showToast } = useToast();
  const resume = useResumePayoutPlan(userId);

  const confirm = async () => {
    try {
      const { dueNow: due } = await resume.mutateAsync({ planId: plan.id });
      showToast(due ? 'Plan resumed. A payout is due and will go out shortly.' : 'Plan resumed', 'success');
      onClose();
    } catch (err) {
      showToast(errorMessage(err, 'Could not resume the plan'), 'error');
    }
  };

  return (
    <DialogShell icon={<Play className="h-6 w-6 text-white" />} title="Resume payout plan" busy={resume.isPending} onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        Payouts for <span className="font-medium text-gray-900">{plan.name}</span> will start again.
      </p>
      {dueNow && (
        <Note tone="warning">
          The next payout date has already passed, so a payout will be sent within about 5 minutes of resuming.
        </Note>
      )}
      <DialogButtons busy={resume.isPending} busyLabel="Resuming..." confirmLabel="Resume plan" canConfirm onCancel={onClose} onConfirm={confirm} />
    </DialogShell>
  );
}

function CancelDialog({ userId, plan, onClose }: { userId: string; plan: PlanLike; onClose: () => void }) {
  const { showToast } = useToast();
  const cancel = useCancelPayoutPlan(userId);
  const [reason, setReason] = useState('');
  const remaining = Math.max(0, plan.duration - plan.completed_payouts);

  const confirm = async () => {
    try {
      const { feeRefund } = await cancel.mutateAsync({ planId: plan.id, reason });
      showToast(feeRefund > 0 ? `Plan cancelled. ${formatNaira(feeRefund)} in fees returned to the wallet.` : 'Plan cancelled', 'success');
      onClose();
    } catch (err) {
      showToast(errorMessage(err, 'Could not cancel the plan'), 'error');
    }
  };

  return (
    <DialogShell icon={<CircleX className="h-6 w-6 text-white" />} title="Cancel payout plan" busy={cancel.isPending} onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        This permanently cancels <span className="font-medium text-gray-900">{plan.name}</span>. The {remaining} remaining payout
        {remaining === 1 ? '' : 's'} will not be sent.
      </p>
      <Note>
        The locked funds are released back to the user's available balance, and the transaction and stamp duty fees for the
        remaining payouts are returned. Processing fees are not refunded. This cannot be undone.
      </Note>
      <Field label="Reason" optional>
        <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this plan being cancelled?" />
      </Field>
      <DialogButtons busy={cancel.isPending} busyLabel="Cancelling..." confirmLabel="Cancel plan" canConfirm danger onCancel={onClose} onConfirm={confirm} />
    </DialogShell>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Payout attempt actions: retry / mark completed / mark refunded                              */
/* ------------------------------------------------------------------------------------------ */

const STATE_TITLE: Record<string, string> = {
  failed: 'The payout attempt failed',
  failed_held: 'The payout failed and its funds are held',
  stuck: 'The payout is stuck',
  in_flight: 'A transfer is in progress',
  unlinked: 'Payout cannot be changed from here',
};

/**
 * What an admin can do with one failed / unfinished payout. Used under a plan on the profile
 * page and inside the transaction details dialog.
 */
export function InstallmentActions({
  userId,
  state,
  variant = 'plan',
  onDone,
}: {
  userId: string;
  state: PayoutInstallmentActions;
  variant?: 'plan' | 'modal';
  onDone?: () => void;
}) {
  const [dialog, setDialog] = useState<'retry' | 'complete' | 'refund' | null>(null);

  if (state.state === 'completed') return null;

  const nothingToDo = !state.can_retry && !state.can_complete && !state.can_refund;
  const hint = state.can_retry || state.can_complete || state.can_refund ? null : state.complete_blocker || state.refund_blocker;

  const done = () => {
    setDialog(null);
    onDone?.();
  };

  return (
    <>
      <div
        className={
          variant === 'plan'
            ? 'mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4'
            : 'rounded-xl border border-gray-200 bg-gray-50 p-4'
        }
      >
        <div className="flex items-start gap-3">
          <TriangleAlert className={`h-5 w-5 mt-0.5 flex-shrink-0 ${state.state === 'in_flight' ? 'text-gray-500' : 'text-error'}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">{STATE_TITLE[state.state] || 'Payout needs attention'}</p>
            <div className="mt-1 text-sm text-gray-600 space-y-0.5">
              {state.amount != null && (
                <p>
                  {formatNaira(state.amount)}
                  {state.installment_index != null && ` · installment ${state.installment_index + 1}`}
                  {state.plan_name && variant === 'modal' && ` · ${state.plan_name}`}
                </p>
              )}
              {state.error && <p className="text-gray-700">{state.error}</p>}
              {state.reference && <p className="font-mono text-xs text-gray-500 break-all">{state.reference}</p>}
              {state.state === 'failed_held' && (
                <p className="text-gray-700">
                  The user's wallet was charged for this attempt and has not been refunded
                  {state.manual_hold ? ', and it is on a manual hold' : ''}. The plan will not retry on its own.
                </p>
              )}
              {state.state === 'stuck' && (
                <p className="text-gray-700">It has been pending for a long time. Check the transfer with the bank before choosing.</p>
              )}
              {state.state === 'failed' && state.can_retry && !state.retry_needs_confirm && (
                <p className="text-gray-500">The plan retries on its own every 5 minutes. Retry now to skip the wait.</p>
              )}
              {hint && nothingToDo && <p className="text-gray-500">{hint}</p>}
              {!state.can_retry && state.retry_blocker && (state.can_complete || state.can_refund) && (
                <p className="text-gray-500">{state.retry_blocker}</p>
              )}
            </div>

            {!nothingToDo && (
              <div className="mt-3 flex flex-wrap gap-2">
                {state.can_retry && (
                  <button onClick={() => setDialog('retry')} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors">
                    <RotateCcw className="h-4 w-4" />
                    Retry payout
                  </button>
                )}
                {state.can_complete && (
                  <button onClick={() => setDialog('complete')} className={secondaryButton}>
                    <CircleCheck className="h-4 w-4" />
                    Mark completed
                  </button>
                )}
                {state.can_refund && (
                  <button onClick={() => setDialog('refund')} className={secondaryButton}>
                    <Undo2 className="h-4 w-4" />
                    Mark refunded
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {dialog === 'retry' && <RetryDialog userId={userId} state={state} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'complete' && <CompleteDialog userId={userId} state={state} onClose={() => setDialog(null)} onDone={done} />}
      {dialog === 'refund' && <RefundDialog userId={userId} state={state} onClose={() => setDialog(null)} onDone={done} />}
    </>
  );
}

type DialogProps = { userId: string; state: PayoutInstallmentActions; onClose: () => void; onDone: () => void };

function RetryDialog({ userId, state, onClose, onDone }: DialogProps) {
  const { showToast } = useToast();
  const retry = useRetryPayout(userId);
  const [confirmed, setConfirmed] = useState(false);
  const needsConfirm = state.retry_needs_confirm;

  const confirm = async () => {
    if (!state.ap_id || !state.plan_id) return;
    try {
      const outcome = await retry.mutateAsync({
        automatedPayoutId: state.ap_id,
        planId: state.plan_id,
        confirmNotPaid: confirmed,
      });
      switch (outcome.kind) {
        case 'completed':
          showToast('Payout sent. The plan has moved to its next payout.', 'success');
          break;
        case 'processing':
          showToast('Transfer started. Waiting for the bank to confirm.', 'success');
          break;
        case 'failed':
          showToast(outcome.error ? `Retry failed: ${outcome.error}` : 'The retry failed again', 'error');
          break;
        default:
          showToast(`Released for retry. ${outcome.reason} It will be picked up in the next 5-minute run.`, 'success');
      }
      onDone();
    } catch (err) {
      showToast(errorMessage(err, 'Could not retry the payout'), 'error');
    }
  };

  return (
    <DialogShell icon={<RotateCcw className="h-6 w-6 text-white" />} title="Retry payout" busy={retry.isPending} onClose={onClose}>
      {needsConfirm ? (
        <>
          <Note tone="warning">
            This attempt may still hold money. If the first transfer actually reached the bank, retrying would pay the user twice.
          </Note>
          <p className="text-sm text-gray-600 mb-4">
            Retrying refunds the wallet charge for this attempt
            {state.amount != null ? ` (${formatNaira(state.amount)})` : ''}, clears any manual hold, then charges the wallet and sends a new transfer.
          </p>
          <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
            <span>
              I checked with the bank / SafeHaven and no transfer was made
              {state.reference && <span className="block font-mono text-xs text-gray-500 mt-1 break-all">{state.reference}</span>}
            </span>
          </label>
        </>
      ) : (
        <p className="text-sm text-gray-600">
          A new attempt is made now{state.amount != null ? `: ${formatNaira(state.amount)} is charged to the user's wallet` : ''} and sent to
          their payout account. Nothing is held from the failed attempt.
        </p>
      )}
      <DialogButtons
        busy={retry.isPending}
        busyLabel="Retrying..."
        confirmLabel="Retry payout"
        canConfirm={!needsConfirm || confirmed}
        onCancel={onClose}
        onConfirm={confirm}
      />
    </DialogShell>
  );
}

function CompleteDialog({ userId, state, onClose, onDone }: DialogProps) {
  const { showToast } = useToast();
  const complete = useCompletePayoutTransaction(userId);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const confirm = async () => {
    if (!state.tx_id) return;
    try {
      await complete.mutateAsync({ transactionId: state.tx_id, reference, notes });
      showToast('Payout marked completed', 'success');
      onDone();
    } catch (err) {
      showToast(errorMessage(err, 'Could not complete the payout'), 'error');
    }
  };

  return (
    <DialogShell icon={<CircleCheck className="h-6 w-6 text-white" />} title="Mark payout completed" busy={complete.isPending} onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        Use this when the user has already been paid{state.amount != null ? ` ${formatNaira(state.amount)}` : ''} (for example from the SafeHaven dashboard).
      </p>
      <Note>
        {state.complete_debits_wallet
          ? `The wallet was not charged for this payout, so ${state.amount != null ? formatNaira(state.amount) : 'the amount'} is debited from the user's wallet now.`
          : 'The wallet was already charged for this payout, so nothing more is debited.'}
        {state.is_current && ' The plan moves on to its next payout.'}
      </Note>
      <Field label="Bank or SafeHaven reference">
        <input className={inputClass} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference that proves the user was paid" />
      </Field>
      <Field label="Notes" optional>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth recording" />
      </Field>
      <DialogButtons
        busy={complete.isPending}
        busyLabel="Saving..."
        confirmLabel="Mark completed"
        canConfirm={reference.trim().length > 0}
        onCancel={onClose}
        onConfirm={confirm}
      />
    </DialogShell>
  );
}

function RefundDialog({ userId, state, onClose, onDone }: DialogProps) {
  const { showToast } = useToast();
  const refund = useRefundPayoutTransaction(userId);
  const [reason, setReason] = useState('');
  const canPause = state.is_current && state.plan_status === 'active';
  const [pausePlan, setPausePlan] = useState(true);

  const confirm = async () => {
    if (!state.tx_id) return;
    try {
      const result = await refund.mutateAsync({ transactionId: state.tx_id, reason, pausePlan: canPause && pausePlan });
      showToast(
        `Payout marked refunded${result.walletCredited ? ' and the wallet credited' : ''}${result.planPaused ? '. Plan paused.' : ''}`,
        'success',
      );
      onDone();
    } catch (err) {
      showToast(errorMessage(err, 'Could not refund the payout'), 'error');
    }
  };

  return (
    <DialogShell icon={<Undo2 className="h-6 w-6 text-white" />} title="Mark payout refunded" busy={refund.isPending} onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">Use this when the user was not paid and the money should go back to their wallet.</p>
      <Note>
        {state.refund_credits_wallet
          ? `${state.amount != null ? formatNaira(state.amount) : 'The amount'} charged for this attempt is returned to the user's wallet.`
          : 'No money is held for this payout, so it is only marked refunded.'}
      </Note>
      <Field label="Reason">
        <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this payout being refunded?" />
      </Field>
      {canPause && (
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={pausePlan} onChange={(e) => setPausePlan(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900" />
          <span>
            Pause the plan
            <span className="block text-xs text-gray-500 mt-0.5">
              Otherwise the plan charges the wallet again and re-sends this payout on its next run.
            </span>
          </span>
        </label>
      )}
      <DialogButtons
        busy={refund.isPending}
        busyLabel="Refunding..."
        confirmLabel="Mark refunded"
        canConfirm={reason.trim().length > 0}
        onCancel={onClose}
        onConfirm={confirm}
      />
    </DialogShell>
  );
}
