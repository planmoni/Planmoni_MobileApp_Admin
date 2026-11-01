/**
 * Types and wording helpers for the admin Calendar.
 *
 * The database stores things loosely ("Paystack Checkout", "mono_directpay", frequency
 * "weekly_specific", duration as a bare number), so the mapping to what an admin should read
 * lives here, in plain functions that are easy to test.
 */

export type CalendarEventType =
  | 'deposit'
  | 'withdrawal'
  | 'payout_completed'
  | 'payout_failed'
  | 'payout_scheduled'
  | 'plan_created';

/** A bank / payout account shown as a destination. */
export type AccountRef = {
  bankName: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
};

/** One end of a money movement: a provider, the wallet, a vault, ... */
export type Party = {
  kind: 'provider' | 'wallet' | 'vault' | 'manual' | 'plan';
  label: string;
  /** small second line, e.g. "Bank transfer" or the vault name */
  sublabel?: string | null;
  vault?: { name: string | null; categories?: unknown; subcategories?: unknown };
};

export type PlanInfo = {
  id: string | null;
  name: string;
  purpose?: string | null;
  frequency?: string | null;
  duration?: number | null;
  payoutAmount?: number | null;
  totalAmount?: number | null;
  startDate?: string | null;
  /** 1-based position of this payout within the plan, when known */
  installment?: { index: number; total: number | null } | null;
};

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  /** the day the event belongs to on the calendar */
  date: Date;
  /** exact time to show, when the data has one (scheduled payouts only have a day) */
  time: Date | null;
  amount: number | null;
  userId: string | null;
  userName: string;
  from?: Party | null;
  to?: Party | null;
  account?: AccountRef | null;
  plan?: PlanInfo | null;
  /** e.g. sender name for a transfer, or a failure reason */
  note?: string | null;
  /** extra status text such as "Processing" */
  statusLabel?: string | null;
}

// ---------------------------------------------------------------------------------------------
// Plan wording

const FREQUENCY: Record<string, { label: string; unit: string | null }> = {
  daily: { label: 'Daily', unit: 'day' },
  weekly: { label: 'Weekly', unit: 'week' },
  weekly_specific: { label: 'Weekly', unit: 'week' },
  biweekly: { label: 'Bi-weekly', unit: 'payout' },
  monthly: { label: 'Monthly', unit: 'month' },
  end_of_month: { label: 'End-of-month', unit: 'month' },
  annually: { label: 'Yearly', unit: 'year' },
  yearly: { label: 'Yearly', unit: 'year' },
  custom: { label: 'Custom', unit: 'payout' },
};

const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

/**
 * "Daily" + "30 days", "Weekly" + "4 weeks", "Custom" + "7 payouts".
 * `duration` in the database is the number of payouts, and the frequency decides the unit.
 */
export function describePlanSchedule(
  frequency: string | null | undefined,
  duration: number | null | undefined
): { frequencyLabel: string; durationText: string | null } {
  const key = (frequency || '').trim().toLowerCase();
  const known = FREQUENCY[key];
  const frequencyLabel = known ? known.label : key ? titleCase(key) : 'Payout';

  const n = typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null;
  if (n === null) return { frequencyLabel, durationText: null };

  const unit = known?.unit ?? 'payout';
  return { frequencyLabel, durationText: `${n} ${unit}${n === 1 ? '' : 's'}` };
}

// ---------------------------------------------------------------------------------------------
// Deposit sources

const channelLabel = (channel?: string | null): string | null => {
  const c = (channel || '').trim().toLowerCase();
  if (!c) return null;
  if (c === 'bank_transfer' || c === 'bank') return 'Bank transfer';
  if (c === 'card') return 'Card';
  if (c === 'ussd') return 'USSD';
  return titleCase(c);
};

/** Who the money came from, for a deposit. `channel` is the payment channel when the provider reports one. */
export function describeDepositSource(source?: string | null, channel?: string | null): Party {
  const raw = (source || '').trim();
  const s = raw.toLowerCase();

  if (s.includes('safehaven') || s.includes('safe haven')) {
    return { kind: 'provider', label: 'Safe Haven', sublabel: 'Bank transfer' };
  }
  if (s.includes('paystack')) {
    const sub = s.includes('virtual')
      ? 'Virtual account'
      : s.includes('checkout')
        ? channelLabel(channel) || 'Checkout'
        : channelLabel(channel);
    return { kind: 'provider', label: 'Paystack', sublabel: sub };
  }
  if (s.includes('mono')) return { kind: 'provider', label: 'Mono DirectPay', sublabel: 'Bank debit' };
  if (s.includes('stripe')) return { kind: 'provider', label: 'Stripe', sublabel: channelLabel(channel) };
  if (s.startsWith('manual')) return { kind: 'manual', label: 'Manual credit', sublabel: 'Added by an admin' };
  if (s === 'expense_plan') return { kind: 'plan', label: 'Expense plan', sublabel: null };
  if (s === 'wallet') return { kind: 'wallet', label: 'Wallet', sublabel: null };

  return { kind: 'provider', label: raw ? titleCase(raw) : 'Unknown source', sublabel: channelLabel(channel) };
}

/** Where a deposit landed. Transactions only ever record "wallet" today, but handle the rest. */
export function describeDepositDestination(destination?: string | null): Party {
  const d = (destination || '').trim().toLowerCase();
  if (d.includes('vault') || d.includes('budget')) return { kind: 'vault', label: 'Vault' };
  if (d.includes('plan')) return { kind: 'plan', label: 'Payout plan' };
  return { kind: 'wallet', label: 'Wallet' };
}

/** Funding of a vault: "manual_topup" is the user's wallet, anything else is the named provider. */
export function describeVaultFundingSource(source?: string | null): Party {
  const s = (source || '').trim().toLowerCase();
  if (!s || s === 'manual_topup' || s === 'wallet') return { kind: 'wallet', label: 'Wallet' };
  return describeDepositSource(source);
}

/** Pulls a sender name out of descriptions like "Transfer from JANE DOE - From JANE DOE". */
export function senderFromDescription(description?: string | null): string | null {
  if (!description) return null;
  const match = description.match(/^(?:manual payment received from|payment received from|transfer from)\s+(.+?)(?:\s+-\s+from\s+.*)?$/i);
  const sender = match?.[1]?.trim();
  if (!sender || /^expense plan\b/i.test(sender)) return null;
  return sender;
}

// ---------------------------------------------------------------------------------------------
// Formatting

export function formatNaira(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '-';
  const hasKobo = Math.abs(amount % 1) > 0.000001;
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: hasKobo ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** ₦1.2M / ₦45.5K / ₦900 for tight spaces. */
export function formatNairaCompact(amount: number): string {
  const abs = Math.abs(amount);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (abs >= 1_000_000_000) return `₦${trim(amount / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `₦${trim(amount / 1_000_000)}M`;
  if (abs >= 10_000) return `₦${trim(amount / 1_000)}K`;
  return formatNaira(amount);
}

export const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
};

export const fullName = (profile?: { first_name?: string | null; last_name?: string | null } | null): string => {
  const name = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
  return name || 'Unknown user';
};
