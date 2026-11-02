/**
 * Types and wording for the admin Process Due Payouts page.
 *
 * admin_list_due_payouts lists every plan whose payout is due and not finished; the admin-process-payouts
 * edge function inspects and processes one plan. The database and the function decide what is safe; what an
 * admin reads is here.
 */
import { addDays, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

// ---------------------------------------------------------------------------------------------
// Shapes

export type DueState = 'ready' | 'in_flight' | 'stuck' | 'failed_held' | 'failed_retrying' | 'anomaly';

export type DuePayoutRow = {
  plan_id: string;
  state: DueState;
  amount: number;
  /** 1-based */
  installment: number;
  duration: number;
  next_payout_date: string;
  days_overdue: number;
  attempts: number;
  /** what the admin reviewed; the server refuses to act if it changed */
  fingerprint: string;
  user: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  plan: {
    id: string;
    name: string;
    purpose: string | null;
    frequency: string | null;
    duration: number;
    completed_payouts: number;
    payout_amount: number;
    total_amount: number | null;
  };
  account: { bank_name: string | null; bank_code: string | null; account_number: string | null; account_name: string | null } | null;
  attempt: {
    id: string;
    status: string;
    reference: string | null;
    error: string | null;
    retry_count: number | null;
    updated_at: string;
    created_at: string;
    wallet_debited: boolean;
    wallet_refund_applied: boolean;
    safehaven_initiated: boolean;
    manual_hold: boolean;
    manual_resend: boolean;
  } | null;
};

export type DueFacet = { state: DueState; count: number; amount: number };
export type DuePayoutsPage = { rows: DuePayoutRow[]; total: number; facets: DueFacet[] };

export type DecisionKind =
  | 'already_paid'
  | 'job_ready'
  | 'mark_paid'
  | 'wait_pending'
  | 'resend'
  | 'redebit_resend'
  | 'needs_dashboard_check'
  | 'retry_later'
  | 'manual_review';

export type InspectResult = {
  success: true;
  plan: { id: string; name: string; status: string; installment: number; duration: number; next_payout_date: string | null };
  amount: number;
  account: { bank_name: string | null; account_name: string | null; account_number: string | null } | null;
  attempt: {
    id: string;
    status: string;
    reference: string | null;
    error: string | null;
    updated_at: string;
    wallet_debited: boolean;
    wallet_refund_applied: boolean;
    safehaven_initiated: boolean;
    manual_hold: boolean;
    manual_resend: boolean;
  } | null;
  provider: { status: string; message: string | null } | null;
  ledger: { verdict: string; debit_rows: number; refund_rows: number } | null;
  decision: { kind: DecisionKind; reason: string };
  actionable: boolean;
  /** the exact text the admin has to type */
  confirm_text: string | null;
  effects: string[];
  fingerprint: string | null;
};

export type ProcessOutcome =
  | 'paid'
  | 'already_paid_marked'
  | 'job_started'
  | 'resent_pending'
  | 'failed_refunded'
  | 'needs_dashboard_check'
  | 'skipped'
  | 'error';

export type ProcessResult = {
  success: boolean;
  outcome: ProcessOutcome;
  message: string;
  details?: Record<string, unknown>;
  run_id?: string;
};

// ---------------------------------------------------------------------------------------------
// Filters

export type DuePeriodKey = 'today' | 'this_week' | 'this_month' | 'older' | 'all';

export const DUE_PERIODS: { key: DuePeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'older', label: 'Older' },
  { key: 'all', label: 'All' },
];

/** Window on the plan's due date, in the admin's own time zone. Weeks start on Monday. */
export function resolveDuePeriod(key: DuePeriodKey, now: Date = new Date()): { from: Date | null; to: Date | null; label: string } {
  const today = startOfDay(now);
  switch (key) {
    case 'today':
      return { from: today, to: addDays(today, 1), label: 'Due today' };
    case 'this_week':
      return { from: startOfWeek(today, { weekStartsOn: 1 }), to: null, label: 'Due since Monday' };
    case 'this_month':
      return { from: startOfMonth(today), to: null, label: 'Due since the start of this month' };
    case 'older':
      return { from: null, to: startOfMonth(today), label: 'Due before this month' };
    default:
      return { from: null, to: null, label: 'Every due payout' };
  }
}

export type StateFilter = 'all' | DueState;

export const DUE_STATES: Record<DueState, { label: string; tone: 'normal' | 'warn' | 'error'; hint: string }> = {
  ready: { label: 'Not started', tone: 'warn', hint: 'The payout job has not started it yet' },
  in_flight: { label: 'In flight', tone: 'normal', hint: 'A transfer started in the last 30 minutes' },
  stuck: { label: 'Stuck', tone: 'warn', hint: 'Pending for more than 30 minutes; money may be held' },
  failed_held: { label: 'Failed, money held', tone: 'error', hint: 'Failed and the wallet debit was not refunded' },
  failed_retrying: { label: 'Failed, will retry', tone: 'error', hint: 'Failed and refunded; the hourly retry picks it up' },
  anomaly: { label: 'Needs a look', tone: 'error', hint: 'Paid, but the plan did not move on' },
};

export const STATE_FILTERS: { key: StateFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: DUE_STATES.ready.label },
  { key: 'in_flight', label: DUE_STATES.in_flight.label },
  { key: 'stuck', label: DUE_STATES.stuck.label },
  { key: 'failed_held', label: DUE_STATES.failed_held.label },
  { key: 'failed_retrying', label: DUE_STATES.failed_retrying.label },
  { key: 'anomaly', label: DUE_STATES.anomaly.label },
];

export function summarizeDue(facets: DueFacet[]) {
  const by = (state: DueState) => {
    const f = facets.find((x) => x.state === state);
    return { count: Number(f?.count) || 0, amount: Number(f?.amount) || 0 };
  };
  const all = facets.reduce(
    (acc, f) => ({ count: acc.count + (Number(f.count) || 0), amount: acc.amount + (Number(f.amount) || 0) }),
    { count: 0, amount: 0 }
  );
  return {
    total: all,
    byState: {
      ready: by('ready'),
      in_flight: by('in_flight'),
      stuck: by('stuck'),
      failed_held: by('failed_held'),
      failed_retrying: by('failed_retrying'),
      anomaly: by('anomaly'),
    } as Record<DueState, { count: number; amount: number }>,
  };
}

// ---------------------------------------------------------------------------------------------
// Wording

export const overdueLabel = (days: number): string => {
  if (!days || days < 1) return 'Due today';
  return `${days.toLocaleString()} day${days === 1 ? '' : 's'} overdue`;
};

/** What SafeHaven's answer means, in plain words. */
export const providerLabel = (status: string | null | undefined): string => {
  switch (status) {
    case 'Completed':
      return 'Completed: the money reached the bank';
    case 'NotFound':
      return 'No record of this transfer';
    case 'Failed':
      return 'Failed';
    case 'Reversed':
      return 'Reversed';
    case 'Pending':
    case 'Processing':
      return `${status}: still moving`;
    case 'lookup_failed':
      return 'Could not be checked right now';
    case 'missing_reference':
      return 'No reference to check';
    default:
      return status || 'Unknown';
  }
};

/** What the wallet ledger proves, in plain words. */
export const ledgerLabel = (verdict: string | null | undefined): string => {
  switch (verdict) {
    case 'DEBITED_NOT_REFUNDED':
      return 'Wallet was debited and the money is still held';
    case 'DEBITED_THEN_REFUNDED':
      return 'Wallet was debited, then refunded';
    case 'NO_DEBIT_FOUND':
      return 'No wallet debit found';
    case 'FLAG_ONLY':
      return 'Marked as debited, but the ledger shows no debit';
    case 'AMBIGUOUS':
      return 'The ledger is unclear (more than one debit, or it could not be read)';
    default:
      return verdict || 'Unknown';
  }
};

export type GuidanceTone = 'info' | 'warn' | 'error';

/** What an admin should do when the page cannot process the plan itself. */
export function guidanceFor(kind: DecisionKind): { title: string; body: string; tone: GuidanceTone } | null {
  switch (kind) {
    case 'wait_pending':
      return {
        title: 'Wait for SafeHaven',
        body: 'SafeHaven has this transfer and it is still moving. Nothing should be sent again. The webhook finishes it; check back shortly.',
        tone: 'info',
      };
    case 'retry_later':
      return {
        title: 'SafeHaven could not be checked',
        body: 'Without SafeHaven’s answer nothing is sent. Refresh in a minute and review again.',
        tone: 'warn',
      };
    case 'needs_dashboard_check':
      return {
        title: 'Check the SafeHaven dashboard first',
        body: 'The money may already have left. Search the dashboard for the reference and the amount. If it is there, mark the payout completed from Payout Events. If it is not, it is safe to refund it from there.',
        tone: 'error',
      };
    case 'manual_review':
      return {
        title: 'A person has to decide',
        body: 'The records do not prove it is safe to send money. Nothing was changed. Use Payout Events or the user’s profile to mark it completed, refund it, or retry it after checking SafeHaven.',
        tone: 'error',
      };
    case 'already_paid':
      return { title: 'Already paid', body: 'This installment is completed. Refresh the list.', tone: 'info' };
    default:
      return null;
  }
}

export const processButtonLabel = (kind: DecisionKind): string => {
  switch (kind) {
    case 'mark_paid':
      return 'Mark as paid';
    case 'job_ready':
      return 'Run the payout job';
    case 'redebit_resend':
      return 'Debit wallet and send payout';
    default:
      return 'Send payout';
  }
};

export const outcomeTone = (outcome: ProcessOutcome): 'success' | 'info' | 'warn' | 'error' => {
  switch (outcome) {
    case 'paid':
    case 'already_paid_marked':
      return 'success';
    case 'job_started':
    case 'resent_pending':
      return 'info';
    case 'failed_refunded':
    case 'skipped':
      return 'warn';
    default:
      return 'error';
  }
};

export const outcomeTitle = (outcome: ProcessOutcome): string => {
  switch (outcome) {
    case 'paid':
      return 'Paid';
    case 'already_paid_marked':
      return 'Recorded as paid';
    case 'job_started':
      return 'Transfer started';
    case 'resent_pending':
      return 'Transfer sent, waiting for the bank';
    case 'failed_refunded':
      return 'Transfer failed, wallet refunded';
    case 'needs_dashboard_check':
      return 'Check the SafeHaven dashboard';
    case 'skipped':
      return 'Nothing was sent';
    default:
      return 'Something went wrong';
  }
};
