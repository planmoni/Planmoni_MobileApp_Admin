/**
 * Types and wording for the admin Payout Events page (admin_list_payout_events).
 *
 * A payout event is one installment of a payout plan being paid out. The database says what happened
 * (status, whether the wallet was debited or refunded, manual changes); what an admin should read is here.
 */
import { format } from 'date-fns';
import { describePlanSchedule, toNumber, type AccountRef, type PlanInfo } from '@/lib/calendarEvents';
import { titleCase, userLabel, type PeriodKey } from '@/lib/transactionsView';

// ---------------------------------------------------------------------------------------------
// Shapes

/** completed | in_flight | stuck | failed_held | failed (same rules as _admin_payout_state) */
export type PayoutEventState = 'completed' | 'in_flight' | 'stuck' | 'failed_held' | 'failed';

export type PayoutEventMeta = Partial<{
  wallet_debited: boolean | string;
  wallet_debited_at: string;
  wallet_refund_applied: boolean | string;
  wallet_refunded_at: string;
  wallet_refund_reason: string;
  manual_hold: boolean | string;
  completed_via: string;
  manual_notes: string;
  manual_external_reference: string;
  manual_payment_at: string;
  ops_unblock_reason: string;
  ops_unblocked_at: string;
}>;

export type PayoutEventItem = {
  id: string;
  status: string;
  state: PayoutEventState;
  amount: number;
  scheduled_date: string | null;
  /** 1-based position within the plan */
  installment: number | null;
  created_at: string;
  executed_at: string | null;
  retry_count: number | null;
  retry_after: string | null;
  error: string | null;
  provider: string | null;
  reference: string | null;
  transfer_code: string | null;
  session_id: string | null;
  transaction_id: string | null;
  transaction_status: string | null;
  user: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  plan: {
    id: string;
    name: string;
    purpose: string | null;
    frequency: string | null;
    duration: number | null;
    status: string | null;
    payout_amount: number | null;
    total_amount: number | null;
    completed_payouts: number | null;
  } | null;
  account: {
    bank_name: string | null;
    bank_code: string | null;
    account_number: string | null;
    account_name: string | null;
  } | null;
  meta: PayoutEventMeta;
};

export type PayoutEventFacet = { status: string; state: string; count: number; amount: number };

export type PayoutEventsPage = { rows: PayoutEventItem[]; total: number; facets: PayoutEventFacet[] };

// ---------------------------------------------------------------------------------------------
// Filters

export type StatusFilter = 'all' | 'completed' | 'in_progress' | 'failed' | 'attention';

export const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'failed', label: 'Failed' },
  { key: 'attention', label: 'Needs attention' },
];

export const EVENT_PERIODS: { key: Exclude<PeriodKey, 'custom' | 'last_month'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This week' },
  { key: 'last_7', label: 'Last 7 days' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_30', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

// ---------------------------------------------------------------------------------------------
// Summary

export type EventSummary = {
  total: number;
  completed: { count: number; amount: number };
  inProgress: { count: number; amount: number };
  failed: { count: number; amount: number };
  /** stuck, or failed with money still held: needs a person */
  attention: { count: number; amount: number };
};

const ATTENTION_STATES = ['stuck', 'failed_held'];

export function summarizeEvents(facets: PayoutEventFacet[]): EventSummary {
  const sum = (match: (f: PayoutEventFacet) => boolean) =>
    facets.filter(match).reduce(
      (acc, f) => ({ count: acc.count + (Number(f.count) || 0), amount: acc.amount + (Number(f.amount) || 0) }),
      { count: 0, amount: 0 }
    );
  const all = sum(() => true);
  return {
    total: all.count,
    completed: sum((f) => f.status === 'completed'),
    inProgress: sum((f) => f.status === 'in_progress'),
    failed: sum((f) => f.status === 'failed'),
    attention: sum((f) => ATTENTION_STATES.includes(f.state)),
  };
}

// ---------------------------------------------------------------------------------------------
// What an event says

const isTrue = (value: unknown) => value === true || value === 'true';

export const needsAttention = (item: Pick<PayoutEventItem, 'state'>) => ATTENTION_STATES.includes(item.state);

const day = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(d.getTime()) ? null : format(d, 'MMM d, yyyy');
};

const stamp = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : format(d, 'MMM d, yyyy · h:mm a');
};

/** "Processing", "Pending", "Failed", "Completed": the status as the database has it. */
export const eventStatusLabel = (status: string) => titleCase(status || 'unknown');

export type EventTone = 'normal' | 'warn' | 'error';

/** The stored error with internal ids made readable: "Payout plan 2d27e4e4-… is not active" becomes "The payout plan is not active". */
export const readableError = (message: string | null | undefined): string | null => {
  const text = (message || '').trim();
  if (!text) return null;
  return text.replace(
    /\bpayout plan [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    (_match, offset: number) => (offset === 0 ? 'The payout plan' : 'the payout plan')
  );
};

export type EventView = {
  tone: EventTone;
  /** short badge beside the status when something needs a person, e.g. "Stuck" */
  flag: string | null;
  /** one plain sentence on what is going on, or null when there is nothing to add */
  note: string | null;
  /** why it failed or is stuck, in readable words */
  reason: string | null;
  /** "Payout 4 of 30 · Daily" */
  position: string | null;
  plan: PlanInfo | null;
  account: AccountRef | null;
};

export function describeEvent(item: PayoutEventItem): EventView {
  const m = item.meta || {};
  const plan = item.plan;
  const { frequencyLabel } = describePlanSchedule(plan?.frequency, toNumber(plan?.duration));
  const total = toNumber(plan?.duration);

  let note: string | null = null;
  let tone: EventTone = 'normal';
  let flag: string | null = null;

  switch (item.state) {
    case 'completed':
      note = m.completed_via ? 'Marked completed by an admin' : null;
      break;
    case 'in_flight':
      note = 'The transfer is being processed';
      tone = 'warn';
      break;
    case 'stuck': {
      const since = day(item.created_at);
      note = `Still ${item.status} since ${since ?? 'earlier'}. Money may be held.`;
      tone = 'warn';
      flag = 'Stuck';
      break;
    }
    case 'failed_held':
      note = isTrue(m.manual_hold)
        ? 'Failed and put on hold by an admin'
        : isTrue(m.wallet_debited) && !isTrue(m.wallet_refund_applied)
          ? 'Failed after the wallet was debited, and not refunded yet'
          : 'Failed after the transfer may have started';
      tone = 'error';
      flag = 'Money held';
      break;
    case 'failed':
    default:
      note = null;
      tone = 'error';
      break;
  }

  const account = item.account?.account_number
    ? {
        bankName: item.account.bank_name,
        bankCode: item.account.bank_code,
        accountNumber: item.account.account_number,
        accountName: item.account.account_name,
      }
    : null;

  return {
    tone: item.status === 'failed' ? 'error' : tone,
    flag,
    note,
    reason: item.status === 'failed' || item.state === 'stuck' ? readableError(item.error) : null,
    position: item.installment
      ? `Payout ${item.installment}${total ? ` of ${total}` : ''} · ${frequencyLabel}`
      : plan
        ? frequencyLabel
        : null,
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          purpose: plan.purpose,
          frequency: plan.frequency,
          duration: total,
          payoutAmount: toNumber(plan.payout_amount),
          totalAmount: toNumber(plan.total_amount),
          installment: item.installment ? { index: item.installment, total } : null,
        }
      : null,
    account,
  };
}

export const eventUserName = (item: Pick<PayoutEventItem, 'user'>) => userLabel(item.user);

// ---------------------------------------------------------------------------------------------
// Timeline

export type TimelineStep = { label: string; at: string | null; detail?: string | null; tone?: EventTone };

/** The steps this installment went through, oldest first, from what the database recorded. */
export function eventTimeline(item: PayoutEventItem): TimelineStep[] {
  const m = item.meta || {};
  const steps: TimelineStep[] = [];

  if (item.scheduled_date) steps.push({ label: 'Due', at: item.scheduled_date, detail: 'Scheduled payout date' });
  steps.push({ label: 'Payout started', at: item.created_at });
  if (m.wallet_debited_at && isTrue(m.wallet_debited)) steps.push({ label: 'Wallet debited', at: m.wallet_debited_at });
  if (m.ops_unblocked_at) {
    steps.push({ label: 'Released for retry by an admin', at: m.ops_unblocked_at, detail: m.ops_unblock_reason ?? null });
  }
  if (m.wallet_refunded_at && isTrue(m.wallet_refund_applied)) {
    steps.push({ label: 'Wallet refunded', at: m.wallet_refunded_at, detail: m.wallet_refund_reason ?? null });
  }
  if (m.manual_payment_at) {
    steps.push({
      label: 'Marked completed by an admin',
      at: m.manual_payment_at,
      detail: [m.manual_external_reference ? `Ref ${m.manual_external_reference}` : null, m.manual_notes ?? null]
        .filter(Boolean)
        .join(' · ') || null,
    });
  }
  if (item.status === 'completed' && item.executed_at && !m.manual_payment_at) {
    steps.push({ label: 'Paid out', at: item.executed_at });
  }
  if (item.status === 'failed') {
    steps.push({ label: 'Failed', at: null, detail: readableError(item.error), tone: 'error' });
  }

  // dated steps in time order; a step without a time stays where it is
  const time = (s: TimelineStep) => (s.at ? new Date(s.at.length === 10 ? `${s.at}T00:00:00` : s.at).getTime() : Infinity);
  return steps
    .map((s, i) => ({ s, i }))
    .sort((a, b) => time(a.s) - time(b.s) || a.i - b.i)
    .map(({ s }) => s);
}

export const formatStep = (at: string | null) => (at ? (at.length === 10 ? day(at) : stamp(at)) : null);

// ---------------------------------------------------------------------------------------------
// Highlights

/** A short list for the dashboard: events that need a person first, then the rest, newest first. */
export function pickEventHighlights(rows: PayoutEventItem[], count: number): PayoutEventItem[] {
  const urgent = rows.filter((r) => needsAttention(r) || r.status === 'failed');
  const rest = rows.filter((r) => !(needsAttention(r) || r.status === 'failed'));
  return [...urgent, ...rest]
    .slice(0, Math.max(count, 0))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export const dayKey = (iso: string) => format(new Date(iso), 'yyyy-MM-dd');
