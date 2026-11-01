import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CalendarPlus,
  Camera,
  FileText,
  FileUp,
  Fingerprint,
  Landmark,
  LogIn,
  PiggyBank,
  ScanFace,
  ScrollText,
  ShieldCheck,
  Siren,
  UserCog,
  UserPlus,
  UserX,
  Wallet,
  Zap,
  BadgeCheck,
  Undo2,
} from 'lucide-react';
import { AccountBlock } from '@/components/CalendarEventCard';
import { PayoutPlanIcon, VaultIcon } from '@/components/PlanIcons';
import { TransactionBreakdown, TransactionStatusBadge } from '@/components/TransactionRow';
import { actorName, describeActivity, personName, type ActivityItem, type ActivityPerson } from '@/lib/activityView';
import type { TransactionItem } from '@/lib/transactionsView';

type IconType = ComponentType<{ className?: string }>;

const KIND_ICON: Record<string, IconType> = {
  signup: UserPlus,
  login: LogIn,
  account_deletion_requested: UserX,
  statement_requested: ScrollText,
  wallet_created: Wallet,
  bank_account_added: Landmark,
  kyc_started: ShieldCheck,
  kyc_submitted: FileText,
  kyc_document_uploaded: FileUp,
  kyc_bvn_verified: Fingerprint,
  kyc_nin_verified: Fingerprint,
  kyc_liveness_passed: ScanFace,
  kyc_liveness_failed: Camera,
  kyc_verified: BadgeCheck,
  payout_plan_created: CalendarPlus,
  vault_created: PiggyBank,
  vault_topup: PiggyBank,
  deposit: ArrowDownLeft,
  payout: ArrowUpRight,
  emergency_withdrawal: Zap,
  admin_action: UserCog,
  post_no_debit: Ban,
};

function PersonLink({ person, fallback }: { person: ActivityPerson | null; fallback?: string }) {
  const name = fallback ?? personName(person);
  if (!person?.id) return <span className="font-medium text-gray-900">{name}</span>;
  return (
    <Link
      to={`/users/${person.id}`}
      onClick={(e) => e.stopPropagation()}
      className="font-medium text-gray-900 hover:underline"
    >
      {name}
    </Link>
  );
}

/** Status shown as a small chip; anything that is not a good outcome gets a quiet or alert style. */
function StatusChip({ status, tone }: { status: string; tone: 'normal' | 'warn' | 'error' }) {
  if (['completed', 'pending', 'failed', 'refunded'].includes(status)) return <TransactionStatusBadge status={status} />;
  const style =
    tone === 'error'
      ? 'bg-error-light text-red-700'
      : tone === 'warn'
        ? 'bg-warning-light text-amber-800'
        : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${style}`}>
      {status.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

function Tile({ item, alert }: { item: ActivityItem; alert: boolean }) {
  const d = item.details || {};
  if (item.kind === 'payout_plan_created') return <PayoutPlanIcon purpose={d.purpose} name={d.name} size="sm" />;
  if (item.kind === 'vault_created' || item.kind === 'vault_topup') {
    return <VaultIcon categories={d.categories} subcategories={d.subcategories} name={d.name} size="sm" />;
  }
  const Icon = KIND_ICON[item.kind] ?? (item.category === 'admin' ? Siren : Undo2);
  return (
    <div
      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
        alert ? 'bg-error-light border-error-light' : 'bg-gray-50 border-gray-100'
      }`}
    >
      <Icon className={`h-4 w-4 ${alert ? 'text-error' : 'text-gray-600'}`} />
    </div>
  );
}

export default function ActivityRow({
  item,
  onOpenTransaction,
  compact = false,
}: {
  item: ActivityItem;
  onOpenTransaction?: (tx: TransactionItem) => void;
  /** one short line per event, no bank / plan blocks: for small cards such as the dashboard */
  compact?: boolean;
}) {
  const view = describeActivity(item);
  const tx = item.details?.tx ?? null;
  const when = new Date(item.at);
  const alert = view.tone === 'error';

  const lead =
    view.lead === 'actor' ? (
      <PersonLink person={item.actor} fallback={actorName(item)} />
    ) : (
      <PersonLink person={item.user} />
    );

  // what goes on the right of the sentence: block-style details
  const blocks: ReactNode[] = [];
  if (!compact) {
    if (tx) blocks.push(<TransactionBreakdown key="tx" item={tx} />);
    if (view.account) blocks.push(<AccountBlock key="acct" account={view.account} label={view.accountLabel} />);
  }

  const clickable = !!tx && !!onOpenTransaction;

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onOpenTransaction?.(tx as TransactionItem) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenTransaction?.(tx as TransactionItem);
              }
            }
          : undefined
      }
      className={`${compact ? 'px-4 py-3 md:px-5' : 'px-5 py-4'} transition-colors ${
        clickable ? 'hover:bg-gray-50 cursor-pointer focus:outline-none focus-visible:bg-gray-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <Tile item={item} alert={alert} />

        <div
          className={`flex-1 min-w-0 grid gap-3 ${blocks.length ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-6' : ''}`}
        >
          <div className="min-w-0">
            <p className="text-sm text-gray-600 leading-snug">
              {lead} <span className={alert ? 'text-red-700' : 'text-gray-900'}>{view.text}</span>
            </p>

            {view.aboutUser && item.user && (
              <p className="text-xs text-gray-500 mt-1">
                Customer: <PersonLink person={item.user} />
              </p>
            )}

            {view.sub && <p className={`text-xs mt-1 ${alert ? 'text-error' : 'text-gray-500'}`}>{view.sub}</p>}

            {view.status && (
              <div className="mt-2">
                <StatusChip status={view.status} tone={view.tone} />
              </div>
            )}
          </div>

          {blocks.length > 0 && <div className="space-y-2.5">{blocks}</div>}
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs text-gray-500">{format(when, 'h:mm a')}</p>
        </div>
      </div>
    </div>
  );
}
