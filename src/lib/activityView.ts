/**
 * Types and wording for the admin Activity timeline (admin_list_activity).
 *
 * The database gives us a kind ("kyc_liveness_failed") and a bag of details; what an admin should
 * read lives here, in plain functions that are easy to test.
 */
import { format } from 'date-fns';
import {
  describePlanSchedule,
  describeVaultFundingSource,
  formatNaira,
  fullName,
  toNumber,
  type AccountRef,
} from '@/lib/calendarEvents';
import {
  titleCase,
  toAccountRef,
  userLabel,
  type PeriodKey,
  type TransactionItem,
} from '@/lib/transactionsView';

// ---------------------------------------------------------------------------------------------
// Shapes

export type ActivityCategory = 'account' | 'kyc' | 'plans' | 'money' | 'admin';

export type ActivityPerson = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type ActivityItem = {
  id: string;
  kind: string;
  category: ActivityCategory;
  at: string;
  user: ActivityPerson | null;
  actor: ActivityPerson | null;
  details: Record<string, any> & { tx?: TransactionItem | null };
};

export type ActivityFacet = { category: string; kind: string; count: number };

export type ActivityPage = { rows: ActivityItem[]; total: number; facets: ActivityFacet[] };

// ---------------------------------------------------------------------------------------------
// Filters

export const CATEGORIES: { key: ActivityCategory; label: string }[] = [
  { key: 'account', label: 'Account' },
  { key: 'kyc', label: 'KYC' },
  { key: 'plans', label: 'Plans & vaults' },
  { key: 'money', label: 'Money' },
  { key: 'admin', label: 'Admin' },
];

/** The kinds inside each category, in the order they are offered as filters. */
export const KINDS: Record<ActivityCategory, { key: string; label: string }[]> = {
  account: [
    { key: 'signup', label: 'Sign-ups' },
    { key: 'login', label: 'Logins' },
    { key: 'bank_account_added', label: 'Bank accounts added' },
    { key: 'wallet_created', label: 'Wallet numbers' },
    { key: 'statement_requested', label: 'Statements' },
    { key: 'account_deletion_requested', label: 'Deletion requests' },
  ],
  kyc: [
    { key: 'kyc_submitted', label: 'Submissions' },
    { key: 'kyc_started', label: 'Started' },
    { key: 'kyc_document_uploaded', label: 'Documents uploaded' },
    { key: 'kyc_bvn_verified', label: 'BVN verified' },
    { key: 'kyc_nin_verified', label: 'NIN verified' },
    { key: 'kyc_liveness_passed', label: 'Liveness passed' },
    { key: 'kyc_liveness_failed', label: 'Liveness failed' },
    { key: 'kyc_verified', label: 'Verified' },
  ],
  plans: [
    { key: 'payout_plan_created', label: 'Payout plans' },
    { key: 'vault_created', label: 'Vaults' },
    { key: 'vault_topup', label: 'Vault top-ups' },
  ],
  money: [
    { key: 'deposit', label: 'Deposits' },
    { key: 'payout', label: 'Payouts' },
    { key: 'emergency_withdrawal', label: 'Early withdrawals' },
  ],
  admin: [
    { key: 'admin_action', label: 'Admin actions' },
    { key: 'post_no_debit', label: 'Post no debit' },
  ],
};

export const ACTIVITY_PERIODS: { key: Exclude<PeriodKey, 'custom' | 'last_month'>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This week' },
  { key: 'last_7', label: 'Last 7 days' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_30', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
];

/** Count of one kind (or of everything in a category) from the facets. */
export function countFacets(facets: ActivityFacet[], match: { category?: string; kind?: string } = {}): number {
  return facets
    .filter((f) => (!match.category || f.category === match.category) && (!match.kind || f.kind === match.kind))
    .reduce((sum, f) => sum + (Number(f.count) || 0), 0);
}

export const categoryOfKind = (kind: string): ActivityCategory | null => {
  for (const c of CATEGORIES) if (KINDS[c.key].some((k) => k.key === kind)) return c.key;
  return null;
};

// ---------------------------------------------------------------------------------------------
// What a row says

export type ActivityView = {
  /** who the sentence is about: the user, or the admin who acted */
  lead: 'user' | 'actor';
  /** the rest of the sentence, after the name */
  text: string;
  /** a small second line */
  sub: string | null;
  tone: 'normal' | 'warn' | 'error';
  /** the user an admin action was about, shown on its own line */
  aboutUser: boolean;
  /** show the shared bank account block */
  account: AccountRef | null;
  accountLabel: string;
  status: string | null;
};

const base = (over: Partial<ActivityView>): ActivityView => ({
  lead: 'user',
  text: '',
  sub: null,
  tone: 'normal',
  aboutUser: false,
  account: null,
  accountLabel: 'Account',
  status: null,
  ...over,
});

const DOC_LABEL: Record<string, string> = {
  nin: 'NIN',
  bvn: 'BVN',
  passport: 'passport',
  drivers_license: "driver's licence",
  voters_card: "voter's card",
  document: '',
};

const day = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(d.getTime()) ? null : format(d, 'MMM d, yyyy');
};

const place = (d: Record<string, any>) => [d.city, d.country].filter(Boolean).join(', ');

/** Known admin actions in plain English; anything else is title-cased so it is still readable. */
const ADMIN_ACTIONS: Record<string, string> = {
  'payout_plan.paused': 'paused a payout plan',
  'payout_plan.resumed': 'resumed a payout plan',
  'payout_plan.cancelled': 'cancelled a payout plan',
  'payout.marked_completed': 'marked a payout as completed',
  'payout.marked_refunded': 'marked a payout as refunded',
  'payout.retry_released': 'released a failed payout for retry',
  'kyc.tier3.approved': 'approved a Tier 3 verification',
  'kyc.tier3.rejected': 'rejected a Tier 3 verification',
  'kyc.tier1.bvn_face.approved': 'approved a Tier 1 BVN face review',
  'kyc.tier1.bvn_face.rejected': 'rejected a Tier 1 BVN face review',
  'user.deleted': 'deleted a user account',
  assign_super_admin_role: 'made someone a Super Admin',
};

export function describeAdminAction(action: string, d: Record<string, any>): string {
  const known = ADMIN_ACTIONS[action];
  let text = known ?? titleCase(action.replace(/\./g, ' ')).toLowerCase();
  if (d.plan_name && /payout_plan\./.test(action)) text = text.replace('a payout plan', `the payout plan "${d.plan_name}"`);
  if (action === 'user.deleted' && (d.email || d.name)) {
    const who = typeof d.name === 'string' ? d.name : d.name?.full_name || d.name?.name;
    text = `deleted the account of ${[who, d.email].filter(Boolean).join(' · ')}`;
  }
  return text;
}

export function describeActivity(item: ActivityItem): ActivityView {
  const d = item.details || {};
  const kind = item.kind;

  switch (kind) {
    case 'signup':
      return base({ text: d.referred ? 'joined Planmoni through a referral' : 'joined Planmoni' });

    case 'login': {
      const device = [d.device, d.os].filter(Boolean).join(' · ');
      const where = place(d);
      return base({
        text: 'signed in',
        sub: [device || d.browser, where, d.ip].filter(Boolean).join(' · ') || null,
        tone: d.suspicious ? 'warn' : 'normal',
        status: d.suspicious ? 'suspicious' : null,
      });
    }

    case 'account_deletion_requested': {
      const cancelled = d.status === 'cancelled' || !!d.cancelled_at;
      const when = day(d.scheduled_for);
      return base({
        text: 'asked to delete their account',
        sub: cancelled ? 'Cancelled by the user' : when ? `Scheduled for ${when}` : titleCase(d.status || ''),
        tone: cancelled ? 'normal' : 'warn',
      });
    }

    case 'statement_requested': {
      const a = day(d.start_date);
      const b = day(d.end_date);
      return base({
        text: a && b ? `requested an account statement for ${a} – ${b}` : 'requested an account statement',
        status: d.status === 'failed' ? 'failed' : null,
        tone: d.status === 'failed' ? 'error' : 'normal',
      });
    }

    case 'wallet_created':
      return base({ text: `was given wallet account number ${d.account_number ?? ''}`.trim() });

    case 'bank_account_added':
      return base({
        text: 'added a payout account',
        account: toAccountRef(d.account),
        accountLabel: 'Added',
      });

    case 'kyc_started':
      return base({ text: 'started KYC verification' });
    case 'kyc_submitted':
      return base({ text: 'submitted their KYC details', sub: d.message || null });
    case 'kyc_document_uploaded': {
      const label = DOC_LABEL[String(d.verification_type || '').toLowerCase()] ?? String(d.verification_type || '');
      return base({ text: label ? `uploaded a ${label} document` : 'uploaded a document' });
    }
    case 'kyc_bvn_verified':
      return base({ text: 'verified their BVN' });
    case 'kyc_nin_verified':
      return base({ text: 'verified their NIN' });
    case 'kyc_liveness_passed':
      return base({ text: 'passed the liveness check' });
    case 'kyc_liveness_failed':
      return base({ text: 'failed the liveness check', sub: d.message || null, tone: 'error' });
    case 'kyc_verified':
      return base({ text: 'completed KYC verification' });

    case 'payout_plan_created': {
      const { frequencyLabel, durationText } = describePlanSchedule(d.frequency, toNumber(d.duration));
      const parts = [
        toNumber(d.payout_amount) != null ? `${formatNaira(toNumber(d.payout_amount))} per payout` : null,
        toNumber(d.total_amount) != null ? `${formatNaira(toNumber(d.total_amount))} in total` : null,
        day(d.start_date) ? `Starts ${day(d.start_date)}` : null,
      ].filter(Boolean);
      return base({
        text: `created a ${frequencyLabel} payout named "${d.name ?? 'Untitled'}"${durationText ? ` for ${durationText}` : ''}`,
        sub: parts.join(' · ') || null,
        account: toAccountRef(d.account),
        accountLabel: 'Pays out to',
        status: d.status && d.status !== 'active' ? d.status : null,
      });
    }

    case 'vault_created': {
      const target = toNumber(d.total_budget);
      return base({
        text: `created a vault named "${d.name ?? 'Untitled'}"`,
        sub: target ? `Budget ${formatNaira(target)}${day(d.end_date) ? ` · until ${day(d.end_date)}` : ''}` : null,
      });
    }

    case 'vault_topup': {
      const from = describeVaultFundingSource(d.source).label;
      return base({
        text: `added ${formatNaira(toNumber(d.amount))} to ${d.name ? `the vault "${d.name}"` : 'a vault'}`,
        sub: `From ${from.toLowerCase() === 'wallet' ? 'their wallet' : from}`,
        status: d.status && d.status !== 'completed' ? d.status : null,
        tone: d.status === 'failed' ? 'error' : 'normal',
      });
    }

    case 'emergency_withdrawal': {
      const failed = d.status === 'failed';
      const net = toNumber(d.net);
      const fee = toNumber(d.fee);
      return base({
        text: `withdrew ${formatNaira(toNumber(d.amount))} early${d.plan_name ? ` from "${d.plan_name}"` : ''}`,
        sub:
          failed && d.error
            ? d.error
            : [d.type ? titleCase(String(d.type)) : null, fee ? `Fee ${formatNaira(fee)}` : null, net != null ? `Received ${formatNaira(net)}` : null]
                .filter(Boolean)
                .join(' · ') || null,
        account: toAccountRef(d.account),
        accountLabel: 'Paid to',
        status: d.status && d.status !== 'completed' ? d.status : null,
        tone: failed ? 'error' : 'normal',
      });
    }

    case 'deposit': {
      const amount = formatNaira(toNumber(d.amount ?? item.details.tx?.amount));
      const status = d.status || item.details.tx?.status || null;
      return base({
        text: status === 'completed' ? `received a ${amount} deposit` : `has a ${amount} deposit that is ${status ?? 'unconfirmed'}`,
        status: status === 'completed' ? null : status,
        tone: status === 'failed' ? 'error' : 'normal',
      });
    }

    case 'payout': {
      const amount = formatNaira(toNumber(d.amount ?? item.details.tx?.amount));
      const status = d.status || item.details.tx?.status || null;
      const text =
        status === 'completed'
          ? `received a ${amount} payout`
          : status === 'failed'
            ? `had a ${amount} payout fail`
            : status === 'refunded'
              ? `had a ${amount} payout refunded`
              : `has a ${amount} payout pending`;
      return base({ text, status: status === 'completed' ? null : status, tone: status === 'failed' ? 'error' : 'normal' });
    }

    case 'admin_action': {
      const who = item.details.email || item.details.name;
      return base({
        lead: 'actor',
        text: describeAdminAction(String(d.action || 'admin action'), d),
        sub: d.reason ? `Reason: ${d.reason}` : d.external_reference ? `Reference: ${d.external_reference}` : null,
        aboutUser: !!item.user && !who,
      });
    }

    case 'post_no_debit':
      return base({
        lead: 'actor',
        text: d.active ? 'placed a post-no-debit restriction' : 'applied a post-no-debit restriction (since lifted)',
        sub: d.reason ? `Reason: ${d.reason}` : null,
        aboutUser: true,
        tone: d.active ? 'warn' : 'normal',
      });

    default:
      return base({ text: titleCase(kind) });
  }
}

/** "Ada Okafor", or the email, or "Unknown user". */
export const personName = (p: ActivityPerson | null | undefined): string =>
  p ? userLabel(p) : 'Unknown user';

/** Who an admin action was done by: their profile, the free-text "by", or a generic label. */
export function actorName(item: ActivityItem): string {
  if (item.actor && fullName(item.actor) !== 'Unknown user') return fullName(item.actor);
  if (item.actor?.email) return item.actor.email;
  const by = item.details?.by;
  return typeof by === 'string' && by ? by : 'An admin';
}

// ---------------------------------------------------------------------------------------------
// Highlights

/** Happens all day long and says little on its own: plain logins, wallet numbers, payouts that went through. */
const isRoutine = (item: ActivityItem) =>
  item.kind === 'login' ||
  item.kind === 'wallet_created' ||
  (item.kind === 'payout' && (item.details?.status ?? item.details?.tx?.status) === 'completed');

/**
 * A short list for the dashboard: notable events first (sign-ups, KYC, new plans, failures, admin
 * actions), topped up with routine ones if there are not enough, newest first.
 */
export function pickHighlights(rows: ActivityItem[], count: number): ActivityItem[] {
  const notable = rows.filter((r) => !isRoutine(r));
  const routine = rows.filter(isRoutine);
  return [...notable, ...routine]
    .slice(0, Math.max(count, 0))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

// ---------------------------------------------------------------------------------------------
// Grouping

/** Local calendar day a timestamp belongs to ("2026-11-01"). */
export const dayKey = (iso: string) => format(new Date(iso), 'yyyy-MM-dd');
