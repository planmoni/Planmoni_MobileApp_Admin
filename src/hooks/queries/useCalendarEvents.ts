import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { addDays, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { supabase } from '@/lib/supabase';
import {
  describeDepositDestination,
  describeDepositSource,
  describeVaultFundingSource,
  fullName,
  senderFromDescription,
  toNumber,
  type AccountRef,
  type CalendarEvent,
  type PlanInfo,
} from '@/lib/calendarEvents';

export type { CalendarEvent } from '@/lib/calendarEvents';

export type CalendarData = {
  events: CalendarEvent[];
  /** a table had more rows than we are willing to page through */
  truncated: boolean;
  /** sources that could not be loaded, in plain words */
  warnings: string[];
};

const PAGE_SIZE = 1000; // PostgREST returns at most this many rows per request
const MAX_PAGES = 10;

type Page = { data: any[] | null; error: any };

/** Reads every page of a query. Without this, busy months silently lose events past row 1,000. */
async function fetchAll(build: (from: number, to: number) => PromiseLike<Page>) {
  const rows: any[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await build(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/** "2026-10-20" -> noon local, so a calendar day never slips across midnight in another timezone. */
const parseDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);

const dayKey = (date: Date) => format(date, 'yyyy-MM-dd');

// --- row shapes ---------------------------------------------------------------------------------

const ACCOUNT_COLS = 'bank_name, bank_code, account_number, account_name';
const PROFILE = 'first_name, last_name';

/** A payout plan, with the account it pays out to (current accounts first, legacy bank_accounts as fallback). */
const PLAN_COLS = `
  name, purpose, frequency, duration, payout_amount, total_amount, start_date,
  payout_accounts!payout_plans_payout_account_id_fkey(${ACCOUNT_COLS}),
  bank_accounts!payout_plans_bank_account_id_fkey(${ACCOUNT_COLS})
`;

const toAccount = (row: any): AccountRef | null =>
  row?.account_number
    ? {
        bankName: row.bank_name ?? null,
        bankCode: row.bank_code ?? null,
        accountNumber: row.account_number,
        accountName: row.account_name ?? null,
      }
    : null;

/** The first account that has a number. */
const pickAccount = (...rows: any[]): AccountRef | null => {
  for (const row of rows) {
    const account = toAccount(row);
    if (account) return account;
  }
  return null;
};

/** The plan's raw account row: a current payout account, else the legacy bank account. */
const planAccountRow = (plan: any) => (plan?.payout_accounts?.account_number ? plan.payout_accounts : plan?.bank_accounts);

const planAccount = (plan: any) => toAccount(planAccountRow(plan));

const shortReason = (message?: string | null): string | null => {
  const text = (message || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
};

const planInfo = (id: string | null, plan: any, extra: Partial<PlanInfo> = {}): PlanInfo => ({
  id,
  name: plan?.name || 'Payout plan',
  purpose: plan?.purpose ?? null,
  frequency: plan?.frequency ?? null,
  duration: toNumber(plan?.duration),
  payoutAmount: toNumber(plan?.payout_amount),
  totalAmount: toNumber(plan?.total_amount),
  startDate: plan?.start_date ?? null,
  ...extra,
});

// --- mappers ------------------------------------------------------------------------------------

function payoutStatus(status: string | null | undefined) {
  if (status === 'completed') return { type: 'payout_completed' as const, statusLabel: null };
  if (status === 'failed') return { type: 'payout_failed' as const, statusLabel: null };
  if (status === 'refunded') return { type: 'payout_failed' as const, statusLabel: 'Refunded' };
  if (status === 'processing') return { type: 'payout_scheduled' as const, statusLabel: 'Processing' };
  return { type: 'payout_scheduled' as const, statusLabel: null };
}

function fromAutomatedPayout(row: any): CalendarEvent {
  const { type, statusLabel } = payoutStatus(row.status);
  const done = type === 'payout_completed';
  const completedAt = row.completed_at || row.transferred_at || row.execution_date;
  const index = typeof row.installment_index === 'number' ? row.installment_index + 1 : null;

  return {
    id: `ap-${row.id}`,
    type,
    date: parseDay(row.scheduled_date),
    time: done && completedAt ? new Date(completedAt) : null,
    amount: toNumber(row.amount),
    userId: row.user_id ?? null,
    userName: fullName(row.profiles),
    account: pickAccount(row.payout_accounts, planAccountRow(row.payout_plans)),
    plan: planInfo(row.payout_plan_id ?? null, row.payout_plans, {
      installment: index ? { index, total: toNumber(row.payout_plans?.duration) } : null,
    }),
    note: type === 'payout_failed' ? shortReason(row.error_message) : null,
    statusLabel,
  };
}

function fromPayoutTransaction(row: any): CalendarEvent {
  const { type, statusLabel } = payoutStatus(row.status);
  const created = new Date(row.created_at);

  return {
    id: `tx-${row.id}`,
    type,
    date: created,
    time: type === 'payout_completed' ? created : null,
    amount: toNumber(row.amount),
    userId: row.user_id ?? null,
    userName: fullName(row.profiles),
    account: planAccount(row.payout_plans),
    plan: planInfo(row.payout_plan_id ?? null, row.payout_plans),
    statusLabel,
  };
}

function fromDepositTransaction(row: any): CalendarEvent {
  const created = new Date(row.created_at);
  const sender = senderFromDescription(row.description);

  return {
    id: `tx-${row.id}`,
    type: 'deposit',
    date: created,
    time: created,
    amount: toNumber(row.amount),
    userId: row.user_id ?? null,
    userName: fullName(row.profiles),
    from: describeDepositSource(row.source || row.payment_gateway, row.channel),
    to: describeDepositDestination(row.destination),
    note: sender ? `Sent by ${sender}` : null,
  };
}

function fromWithdrawalTransaction(row: any): CalendarEvent {
  const created = new Date(row.created_at);

  return {
    id: `tx-${row.id}`,
    type: 'withdrawal',
    date: created,
    time: created,
    amount: toNumber(row.amount),
    userId: row.user_id ?? null,
    userName: fullName(row.profiles),
    from: { kind: 'plan', label: row.payout_plans?.name || 'Payout plan', sublabel: 'Emergency withdrawal' },
    account: planAccount(row.payout_plans),
    plan: planInfo(row.payout_plan_id ?? null, row.payout_plans),
  };
}

function fromCreatedPlan(row: any): CalendarEvent {
  const created = new Date(row.created_at);

  return {
    id: `plan-${row.id}`,
    type: 'plan_created',
    date: created,
    time: created,
    amount: toNumber(row.total_amount),
    userId: row.user_id ?? null,
    userName: fullName(row.profiles),
    account: planAccount(row),
    plan: planInfo(row.id, row),
  };
}

function fromScheduledPlan(row: any): CalendarEvent {
  return {
    id: `scheduled-${row.id}`,
    type: 'payout_scheduled',
    date: new Date(row.next_payout_date),
    time: null,
    amount: toNumber(row.payout_amount),
    userId: row.user_id ?? null,
    userName: fullName(row.profiles),
    account: planAccount(row),
    plan: planInfo(row.id, row),
  };
}

function fromVaultDeposit(row: any): CalendarEvent {
  const created = new Date(row.created_at);

  return {
    id: `vault-${row.id}`,
    type: 'deposit',
    date: created,
    time: created,
    amount: toNumber(row.amount),
    userId: row.user_id ?? null,
    userName: fullName({ first_name: row.first_name, last_name: row.last_name }),
    from: describeVaultFundingSource(row.source),
    to: {
      kind: 'vault',
      label: 'Vault',
      sublabel: row.vault_name || null,
      vault: { name: row.vault_name ?? null, categories: row.categories, subcategories: row.subcategories },
    },
  };
}

// --- the hook -----------------------------------------------------------------------------------

/**
 * Everything that happens in the month shown, plus the days of the neighbouring months that
 * fill the first and last week of the grid.
 */
export function useCalendarEvents(currentDate: Date) {
  const monthKey = format(currentDate, 'yyyy-MM');

  return useQuery({
    queryKey: ['calendar-events', monthKey],
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    queryFn: () => loadCalendarData(currentDate),
  });
}

export async function loadCalendarData(currentDate: Date): Promise<CalendarData> {
  const first = startOfWeek(startOfMonth(currentDate));
  const lastExclusive = addDays(startOfDay(endOfWeek(endOfMonth(currentDate))), 1);
  // date columns compare as plain local days, timestamp columns as instants
  const fromDay = dayKey(first);
  const toDay = dayKey(lastExclusive);
  const fromTs = first.toISOString();
  const toTs = lastExclusive.toISOString();

  const sources = {
    'payouts': fetchAll((from, to) =>
      supabase
        .from('automated_payouts')
        .select(
          `id, scheduled_date, status, amount, completed_at, transferred_at, execution_date,
           installment_index, error_message, user_id, payout_plan_id,
           profiles!automated_payouts_user_id_fkey(${PROFILE}),
           payout_accounts!automated_payouts_payout_account_id_fkey(${ACCOUNT_COLS}),
           payout_plans!automated_payouts_payout_plan_id_fkey(${PLAN_COLS})`
        )
        .gte('scheduled_date', fromDay)
        .lt('scheduled_date', toDay)
        .order('scheduled_date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),
    'payout transactions': fetchAll((from, to) =>
      supabase
        .from('transactions')
        .select(
          `id, status, amount, reference, created_at, user_id, payout_plan_id,
           profiles!transactions_user_id_fkey(${PROFILE}),
           payout_plans!transactions_payout_plan_id_fkey(${PLAN_COLS})`
        )
        .eq('type', 'payout')
        // automated payouts already come from automated_payouts; only the rest are needed here
        .or('reference.is.null,reference.not.ilike.auto_*')
        .gte('created_at', fromTs)
        .lt('created_at', toTs)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),
    'deposits and withdrawals': fetchAll((from, to) =>
      supabase
        .from('transactions')
        .select(
          `id, type, amount, status, source, destination, description, payment_gateway, created_at,
           user_id, payout_plan_id, channel:metadata->>channel,
           profiles!transactions_user_id_fkey(${PROFILE}),
           payout_plans!transactions_payout_plan_id_fkey(${PLAN_COLS})`
        )
        .in('type', ['deposit', 'withdrawal'])
        .eq('status', 'completed')
        .gte('created_at', fromTs)
        .lt('created_at', toTs)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),
    'new plans': fetchAll((from, to) =>
      supabase
        .from('payout_plans')
        .select(
          `id, created_at, user_id, ${PLAN_COLS},
           profiles!payout_plans_user_id_fkey(${PROFILE})`
        )
        .gte('created_at', fromTs)
        .lt('created_at', toTs)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),
    'upcoming payouts': fetchAll((from, to) =>
      supabase
        .from('payout_plans')
        .select(
          `id, next_payout_date, user_id, ${PLAN_COLS},
           profiles!payout_plans_user_id_fkey(${PROFILE})`
        )
        .eq('status', 'active')
        .gte('next_payout_date', fromTs)
        .lt('next_payout_date', toTs)
        .order('next_payout_date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),
    // vault funding is hidden from admins by RLS, so it comes through a database function
    'vault deposits': Promise.resolve(
      supabase.rpc('admin_calendar_vault_deposits', { p_from: fromTs, p_to: toTs })
    ).then(({ data, error }) => {
      if (error) throw error;
      return { rows: (data as any[]) || [], truncated: false };
    }),
  };

  const names = Object.keys(sources) as (keyof typeof sources)[];
  const settled = await Promise.allSettled(Object.values(sources));

  const result = {} as Record<keyof typeof sources, { rows: any[]; truncated: boolean }>;
  const warnings: string[] = [];
  let truncated = false;

  settled.forEach((outcome, i) => {
    const name = names[i];
    if (outcome.status === 'fulfilled') {
      result[name] = outcome.value;
      truncated = truncated || outcome.value.truncated;
    } else {
      result[name] = { rows: [], truncated: false };
      console.error(`Calendar: could not load ${name}`, outcome.reason);
      warnings.push(
        name === 'vault deposits' && outcome.reason?.code === 'PGRST202'
          ? 'Vault deposits are not shown yet: the admin_calendar_vault_deposits database function is missing.'
          : `Could not load ${name}.`
      );
    }
  });

  const events: CalendarEvent[] = [];

  const payoutEvents = result['payouts'].rows.map(fromAutomatedPayout);
  events.push(...payoutEvents);

  // an upcoming payout already represented by an automated_payouts row must not appear twice
  const scheduledKeys = new Set(
    result['payouts'].rows.map((row) => `${row.payout_plan_id}|${row.scheduled_date}`)
  );

  // manually triggered payouts have their own reference but still match an automated row on
  // the same plan, day and amount
  const automatedPayoutKeys = new Set(
    result['payouts'].rows.map(
      (row) => `${row.payout_plan_id}|${row.scheduled_date}|${toNumber(row.amount)}`
    )
  );

  for (const row of result['payout transactions'].rows) {
    const key = `${row.payout_plan_id}|${dayKey(new Date(row.created_at))}|${toNumber(row.amount)}`;
    if (!automatedPayoutKeys.has(key)) events.push(fromPayoutTransaction(row));
  }

  for (const row of result['deposits and withdrawals'].rows) {
    events.push(row.type === 'withdrawal' ? fromWithdrawalTransaction(row) : fromDepositTransaction(row));
  }

  events.push(...result['new plans'].rows.map(fromCreatedPlan));

  for (const row of result['upcoming payouts'].rows) {
    if (!scheduledKeys.has(`${row.id}|${dayKey(new Date(row.next_payout_date))}`)) {
      events.push(fromScheduledPlan(row));
    }
  }

  events.push(...result['vault deposits'].rows.map(fromVaultDeposit));

  events.sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() || (a.time?.getTime() ?? 0) - (b.time?.getTime() ?? 0)
  );

  return { events, truncated, warnings };
}
