/**
 * Types and wording helpers for the admin Transactions page.
 *
 * Kept as plain functions (no React) so the date windows, summary maths and the "what does this row
 * say" decisions can be tested on their own.
 */
import {
  addDays,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import {
  describeDepositSource,
  fullName,
  senderFromDescription,
  toNumber,
  type AccountRef,
  type Party,
  type PlanInfo,
} from '@/lib/calendarEvents';

// ---------------------------------------------------------------------------------------------
// Data shapes (what admin_list_transactions / admin_get_transaction return)

export type TransactionItem = {
  id: string;
  type: string;
  status: string;
  amount: number;
  fee: number | null;
  source: string | null;
  destination: string | null;
  reference: string | null;
  description: string | null;
  created_at: string;
  completed_at: string | null;
  payment_gateway: string | null;
  payment_method: string | null;
  channel: string | null;
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
  installment: number | null;
  account: {
    bank_name: string | null;
    bank_code: string | null;
    account_number: string | null;
    account_name: string | null;
  } | null;
  error: string | null;
  provider: string | null;
  automated_payout_id: string | null;
  transfer: {
    reference: string | null;
    code: string | null;
    session_id: string | null;
    scheduled_date: string | null;
    transferred_at: string | null;
  } | null;
  manual: { via: string | null; reference: string | null; notes: string | null } | null;
  vault: { name: string | null; categories?: unknown; subcategories?: unknown } | null;
};

export type TransactionFacet = { type: string; status: string; count: number; amount: number };

export type TransactionsPage = {
  rows: TransactionItem[];
  total: number;
  facets: TransactionFacet[];
};

// ---------------------------------------------------------------------------------------------
// Periods

export type PeriodKey =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'last_7'
  | 'last_30'
  | 'all'
  | 'custom';

export const PERIODS: { key: Exclude<PeriodKey, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This week' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_30', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

export type ResolvedPeriod = {
  /** inclusive start, null = no lower bound */
  from: Date | null;
  /** exclusive end, null = no upper bound */
  to: Date | null;
  /** "Oct 26 – Nov 1, 2026" */
  label: string;
};

const rangeLabel = (start: Date, endInclusive: Date): string => {
  if (format(start, 'yyyy-MM-dd') === format(endInclusive, 'yyyy-MM-dd')) return format(start, 'EEEE, MMM d, yyyy');
  if (start.getFullYear() === endInclusive.getFullYear()) {
    return `${format(start, 'MMM d')} – ${format(endInclusive, 'MMM d, yyyy')}`;
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(endInclusive, 'MMM d, yyyy')}`;
};

/**
 * Turns "This week" etc. into a [from, to) window in the admin's own time zone. Weeks start on Monday.
 * `custom` dates are whole days, both ends included.
 */
export function resolvePeriod(
  key: PeriodKey,
  custom: { start: Date | null; end: Date | null } = { start: null, end: null },
  now: Date = new Date()
): ResolvedPeriod {
  const today = startOfDay(now);
  const window = (start: Date, endInclusive: Date): ResolvedPeriod => ({
    from: start,
    to: startOfDay(addDays(endInclusive, 1)),
    label: rangeLabel(start, endInclusive),
  });

  switch (key) {
    case 'today':
      return window(today, today);
    case 'yesterday':
      return window(subDays(today, 1), subDays(today, 1));
    case 'this_week': {
      const start = startOfWeek(today, { weekStartsOn: 1 });
      return window(start, addDays(start, 6));
    }
    case 'this_month':
      return window(startOfMonth(today), endOfMonth(today));
    case 'last_month': {
      const first = startOfMonth(subMonths(today, 1));
      return window(first, endOfMonth(first));
    }
    case 'last_7':
      return window(subDays(today, 6), today);
    case 'last_30':
      return window(subDays(today, 29), today);
    case 'custom':
      if (custom.start && custom.end) {
        const a = startOfDay(custom.start);
        const b = startOfDay(custom.end);
        return a <= b ? window(a, b) : window(b, a);
      }
      return { from: null, to: null, label: 'All time' };
    case 'all':
    default:
      return { from: null, to: null, label: 'All time' };
  }
}

// ---------------------------------------------------------------------------------------------
// Filters

export type TypeFilter = 'all' | 'deposit' | 'payout' | 'withdrawal' | 'expense_plan_topup';
export type StatusFilter = 'all' | 'completed' | 'pending' | 'failed' | 'refunded';

export const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'deposit', label: 'Deposits' },
  { key: 'payout', label: 'Payouts' },
  { key: 'withdrawal', label: 'Withdrawals' },
  { key: 'expense_plan_topup', label: 'Vault top-ups' },
];

export const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Any status' },
  { key: 'completed', label: 'Completed' },
  { key: 'pending', label: 'Pending' },
  { key: 'failed', label: 'Failed' },
  { key: 'refunded', label: 'Refunded' },
];

export const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

export const statusLabel = (status: string | null | undefined) => (status ? titleCase(status) : 'Unknown');

// ---------------------------------------------------------------------------------------------
// Summary

export type TransactionSummary = {
  moneyIn: { amount: number; count: number };
  moneyOut: { amount: number; count: number };
  net: number;
  attention: { count: number; amount: number };
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
};

/**
 * Summary of the period. Only completed deposits count as money in, and only completed payouts and
 * withdrawals as money out: pending, failed and refunded transactions never moved money.
 * `typeFilter` narrows the per-status counts so the status chips match what the list will show.
 */
export function summarize(facets: TransactionFacet[], typeFilter: TypeFilter = 'all'): TransactionSummary {
  const out: TransactionSummary = {
    moneyIn: { amount: 0, count: 0 },
    moneyOut: { amount: 0, count: 0 },
    net: 0,
    attention: { count: 0, amount: 0 },
    total: 0,
    byType: {},
    byStatus: {},
  };

  for (const f of facets) {
    const count = Number(f.count) || 0;
    const amount = Number(f.amount) || 0;
    out.total += count;
    out.byType[f.type] = (out.byType[f.type] || 0) + count;

    if (typeFilter === 'all' || f.type === typeFilter) {
      out.byStatus[f.status] = (out.byStatus[f.status] || 0) + count;
    }

    if (f.status === 'completed' && f.type === 'deposit') {
      out.moneyIn.amount += amount;
      out.moneyIn.count += count;
    } else if (f.status === 'completed' && (f.type === 'payout' || f.type === 'withdrawal')) {
      out.moneyOut.amount += amount;
      out.moneyOut.count += count;
    }

    // a deposit that is pending or failed also needs a look
    if ((f.status === 'pending' || f.status === 'failed') && f.type !== 'expense_plan_topup') {
      out.attention.count += count;
      out.attention.amount += amount;
    }
  }

  out.net = out.moneyIn.amount - out.moneyOut.amount;
  return out;
}

// ---------------------------------------------------------------------------------------------
// What a row says

export type TxKind = 'deposit' | 'payout' | 'withdrawal' | 'vault_topup' | 'other';

export type TxView = {
  kind: TxKind;
  title: string;
  /** which way the money moved relative to the user's wallet */
  direction: 'in' | 'out' | 'internal';
  from: Party | null;
  to: Party | null;
  /** destination bank account of a payout or withdrawal */
  account: AccountRef | null;
  plan: PlanInfo | null;
  /** short second line: sender, failure reason, manual completion */
  note: string | null;
  noteTone: 'error' | 'muted' | null;
};

export const toAccountRef = (a: TransactionItem['account']): AccountRef | null =>
  a && a.account_number
    ? { bankName: a.bank_name, bankCode: a.bank_code, accountNumber: a.account_number, accountName: a.account_name }
    : null;

const toPlanInfo = (item: TransactionItem): PlanInfo | null => {
  if (!item.plan) return null;
  const total = toNumber(item.plan.duration);
  return {
    id: item.plan.id,
    name: item.plan.name,
    purpose: item.plan.purpose,
    frequency: item.plan.frequency,
    duration: total,
    payoutAmount: toNumber(item.plan.payout_amount),
    totalAmount: toNumber(item.plan.total_amount),
    installment: item.installment ? { index: item.installment, total } : null,
  };
};

const WALLET: Party = { kind: 'wallet', label: 'Wallet' };

export function describeTransaction(item: TransactionItem): TxView {
  const type = (item.type || '').toLowerCase();
  const failed = item.status === 'failed';

  if (type === 'deposit') {
    // "expense_plan" is a vault paying back into the wallet
    const source: Party =
      (item.source || '').toLowerCase() === 'expense_plan'
        ? { kind: 'vault', label: 'Vault', sublabel: 'Returned to wallet' }
        : describeDepositSource(item.source, item.channel);
    const sender = senderFromDescription(item.description);
    return {
      kind: 'deposit',
      title: 'Deposit received',
      direction: 'in',
      from: source,
      to: WALLET,
      account: null,
      plan: null,
      note: sender ? `Sent by ${sender}` : null,
      noteTone: sender ? 'muted' : null,
    };
  }

  if (type === 'payout') {
    let note: string | null = null;
    let tone: TxView['noteTone'] = null;
    if (item.status !== 'completed') {
      if (item.error) {
        note = item.error;
        tone = failed ? 'error' : 'muted';
      } else if (failed) {
        note = 'No failure reason was recorded';
        tone = 'error';
      }
    } else if (item.manual?.via || item.manual?.reference) {
      note = `Marked completed by an admin${item.manual.reference ? ` · Ref ${item.manual.reference}` : ''}`;
      tone = 'muted';
    }
    return {
      kind: 'payout',
      title: 'Payout to bank',
      direction: 'out',
      from: WALLET,
      to: null,
      account: toAccountRef(item.account),
      plan: toPlanInfo(item),
      note,
      noteTone: tone,
    };
  }

  if (type === 'withdrawal') {
    return {
      kind: 'withdrawal',
      title: 'Withdrawal from plan',
      direction: 'out',
      from: {
        kind: 'plan',
        label: item.plan?.name || 'Payout plan',
        sublabel: 'Early withdrawal',
      },
      to: null,
      account: toAccountRef(item.account),
      plan: null,
      note: failed && item.error ? item.error : null,
      noteTone: failed && item.error ? 'error' : null,
    };
  }

  if (type === 'expense_plan_topup') {
    return {
      kind: 'vault_topup',
      title: 'Vault top-up',
      direction: 'internal',
      from: (item.source || '').toLowerCase() === 'wallet' || !item.source ? WALLET : describeDepositSource(item.source, item.channel),
      to: {
        kind: 'vault',
        label: item.vault?.name || 'Vault',
        vault: item.vault ? { name: item.vault.name, categories: item.vault.categories, subcategories: item.vault.subcategories } : undefined,
      },
      account: null,
      plan: null,
      note: null,
      noteTone: null,
    };
  }

  return {
    kind: 'other',
    title: titleCase(type || 'Transaction'),
    direction: 'internal',
    from: item.source ? { kind: 'provider', label: titleCase(item.source) } : null,
    to: item.destination ? { kind: 'provider', label: titleCase(item.destination) } : null,
    account: toAccountRef(item.account),
    plan: toPlanInfo(item),
    note: null,
    noteTone: null,
  };
}

/** Name to show for the user, falling back to email. */
export const userLabel = (user: TransactionItem['user']): string => {
  if (!user) return 'Unknown user';
  const name = fullName(user);
  return name === 'Unknown user' && user.email ? user.email : name;
};

/** "+" for money in, "−" for money out, nothing for internal moves or things that never happened. */
export function amountSign(view: TxView, status: string): string {
  if (status !== 'completed') return '';
  if (view.direction === 'in') return '+';
  if (view.direction === 'out') return '−';
  return '';
}

// ---------------------------------------------------------------------------------------------
// Older callers (dashboard, user page) hand the modal a bare transaction; shape it like an item.

export type LegacyTransaction = {
  id: string;
  user_id?: string | null;
  type: string;
  amount: number;
  status: string;
  source?: string | null;
  destination?: string | null;
  reference?: string | null;
  description?: string | null;
  created_at: string;
  metadata?: Record<string, any> | null;
  destination_bank_name?: string | null;
  destination_account_number?: string | null;
  destination_account_name?: string | null;
  profiles?:
    | { first_name?: string | null; last_name?: string | null; email?: string | null }
    | Array<{ first_name?: string | null; last_name?: string | null; email?: string | null }>
    | null;
};

export function legacyToItem(t: LegacyTransaction): TransactionItem {
  const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
  const data = t.metadata?.response?.data || t.metadata?.data;
  const accountNumber = t.destination_account_number || data?.creditAccountNumber || null;
  return {
    id: t.id,
    type: t.type,
    status: t.status,
    amount: Number(t.amount) || 0,
    fee: null,
    source: t.source ?? null,
    destination: t.destination ?? null,
    reference: t.reference ?? null,
    description: t.description ?? null,
    created_at: t.created_at,
    completed_at: null,
    payment_gateway: null,
    payment_method: null,
    channel: t.metadata?.channel ?? null,
    user: t.user_id || profile
      ? {
          id: t.user_id || '',
          first_name: profile?.first_name ?? null,
          last_name: profile?.last_name ?? null,
          email: profile?.email ?? null,
        }
      : null,
    plan: null,
    installment: null,
    account: accountNumber
      ? {
          bank_name: t.destination_bank_name ?? null,
          bank_code: null,
          account_number: accountNumber,
          account_name: t.destination_account_name || data?.creditAccountName || null,
        }
      : null,
    error: null,
    provider: null,
    automated_payout_id: null,
    transfer: null,
    manual: null,
    vault: null,
  };
}
