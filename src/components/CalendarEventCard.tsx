import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarPlus,
  Clock,
  Layers,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { BankLogo } from '@/components/BankAccountRow';
import { PayoutPlanIcon, VaultIcon } from '@/components/PlanIcons';
import {
  describePlanSchedule,
  formatNaira,
  type AccountRef,
  type CalendarEvent,
  type CalendarEventType,
  type Party,
  type PlanInfo,
} from '@/lib/calendarEvents';

export const EVENT_TYPE_META: Record<
  CalendarEventType,
  { title: string; plural: string; Icon: ComponentType<{ className?: string }> }
> = {
  deposit: { title: 'Deposit received', plural: 'Deposits', Icon: ArrowDownLeft },
  payout_completed: { title: 'Payout completed', plural: 'Payouts completed', Icon: ArrowUpRight },
  payout_scheduled: { title: 'Payout scheduled', plural: 'Scheduled', Icon: Clock },
  payout_failed: { title: 'Payout failed', plural: 'Failed', Icon: TriangleAlert },
  plan_created: { title: 'Plan created', plural: 'Plans created', Icon: CalendarPlus },
  withdrawal: { title: 'Withdrawal', plural: 'Withdrawals', Icon: Banknote },
};

function Tile({ children }: { children: ReactNode }) {
  return (
    <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
      {children}
    </div>
  );
}

/** One end of a money movement, with the provider's logo where we have one. */
export function PartyChip({ party }: { party: Party }) {
  let visual: ReactNode;

  if (party.kind === 'provider') {
    visual = <BankLogo bankName={party.label} className="w-9 h-9" wideClassName="w-14 h-9" />;
  } else if (party.kind === 'vault') {
    visual = (
      <VaultIcon
        categories={party.vault?.categories}
        subcategories={party.vault?.subcategories}
        name={party.vault?.name}
        size="sm"
      />
    );
  } else if (party.kind === 'wallet') {
    visual = (
      <Tile>
        <Wallet className="h-4 w-4 text-gray-500" />
      </Tile>
    );
  } else if (party.kind === 'manual') {
    visual = (
      <Tile>
        <Banknote className="h-4 w-4 text-gray-500" />
      </Tile>
    );
  } else {
    visual = (
      <Tile>
        <Layers className="h-4 w-4 text-gray-500" />
      </Tile>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      {visual}
      <div className="min-w-0">
        {/* wrap rather than truncate: the names are the point of this row */}
        <p className="text-sm font-semibold text-gray-900 leading-tight break-words">{party.label}</p>
        {party.sublabel && <p className="text-xs text-gray-500 leading-tight mt-0.5 break-words">{party.sublabel}</p>}
      </div>
    </div>
  );
}

/** "Paystack  ->  Wallet" */
export function Flow({ from, to }: { from?: Party | null; to?: Party | null }) {
  if (!from && !to) return null;
  return (
    <div
      className={`grid items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 ${
        from && to ? 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]' : 'grid-cols-1'
      }`}
    >
      {from && <PartyChip party={from} />}
      {from && to && <ArrowRight className="h-4 w-4 text-gray-400" />}
      {to && <PartyChip party={to} />}
    </div>
  );
}

/** Where the money is going: bank logo, bank, account number and name. */
export function AccountBlock({ account, label = 'Paid to' }: { account?: AccountRef | null; label?: string }) {
  if (!account) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs text-gray-500">
        Destination account not recorded
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
      <BankLogo bankName={account.bankName} bankCode={account.bankCode} className="w-9 h-9" wideClassName="w-14 h-9" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">
          {label} <span className="text-gray-700 font-medium">{account.bankName || 'Unknown bank'}</span>
        </p>
        <p className="text-sm text-gray-900">
          <span className="font-mono font-semibold tracking-wide">{account.accountNumber}</span>
          {account.accountName && <span className="text-gray-600"> · {account.accountName}</span>}
        </p>
      </div>
    </div>
  );
}

function UserLink({ event }: { event: CalendarEvent }) {
  if (!event.userId) return <span className="font-semibold text-gray-900">{event.userName}</span>;
  return (
    <Link to={`/users/${event.userId}`} className="font-semibold text-gray-900 hover:underline">
      {event.userName}
    </Link>
  );
}

function PlanLine({ event }: { event: CalendarEvent }) {
  return <PlanSummary plan={event.plan} />;
}

/** Plan icon, name, "Weekly plan · Payout 3 of 12". */
export function PlanSummary({ plan }: { plan?: PlanInfo | null }) {
  if (!plan) return null;
  const { frequencyLabel } = describePlanSchedule(plan.frequency, plan.duration);
  const installment = plan.installment
    ? plan.installment.total
      ? `Payout ${plan.installment.index} of ${plan.installment.total}`
      : `Payout ${plan.installment.index}`
    : null;

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <PayoutPlanIcon purpose={plan.purpose} name={plan.name} size="sm" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{plan.name}</p>
        <p className="text-xs text-gray-500 truncate">
          {[plan.frequency ? `${frequencyLabel} plan` : null, installment].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  );
}

export default function CalendarEventCard({ event }: { event: CalendarEvent }) {
  const meta = EVENT_TYPE_META[event.type];
  const Icon = meta.Icon;
  const failed = event.type === 'payout_failed';

  const sign =
    event.type === 'deposit' ? '+' : event.type === 'payout_completed' || event.type === 'withdrawal' ? '−' : '';

  const title = event.statusLabel ? `${meta.title} · ${event.statusLabel}` : meta.title;

  // "Plan created" reads as a sentence: who created what, and for how long
  const planSentence = () => {
    const plan = event.plan;
    const { frequencyLabel, durationText } = describePlanSchedule(plan?.frequency, plan?.duration);
    return (
      <p className="text-sm text-gray-700 leading-relaxed">
        <UserLink event={event} /> created a {frequencyLabel} payout named{' '}
        <span className="font-semibold text-gray-900">"{plan?.name}"</span>
        {durationText ? ` for ${durationText}` : ''}
      </p>
    );
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
            failed ? 'bg-error-light border-error-light' : 'bg-gray-50 border-gray-100'
          }`}
        >
          <Icon className={`h-4 w-4 ${failed ? 'text-error' : 'text-gray-600'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <div className="text-right shrink-0">
              {event.amount !== null && (
                <p className="text-sm font-bold text-gray-900">
                  {sign}
                  {formatNaira(event.amount)}
                </p>
              )}
              {event.time && <p className="text-xs text-gray-500">{format(event.time, 'h:mm a')}</p>}
            </div>
          </div>

          {event.type === 'plan_created' ? (
            <div className="mt-2 space-y-3">
              {planSentence()}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                {event.plan?.payoutAmount != null && (
                  <span>
                    <span className="text-gray-900 font-medium">{formatNaira(event.plan.payoutAmount)}</span> per payout
                  </span>
                )}
                {event.plan?.totalAmount != null && (
                  <span>
                    <span className="text-gray-900 font-medium">{formatNaira(event.plan.totalAmount)}</span> in total
                  </span>
                )}
                {event.plan?.startDate && <span>Starts {format(new Date(`${event.plan.startDate}T12:00:00`), 'MMM d, yyyy')}</span>}
              </div>
              <AccountBlock account={event.account} label="Pays out to" />
              {event.plan && (
                <div className="pt-0.5">
                  <PlanLine event={{ ...event, plan: { ...event.plan, installment: null } }} />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 space-y-3">
              <p className="text-sm text-gray-600">
                <UserLink event={event} />
              </p>

              {event.type === 'deposit' && (
                <>
                  <Flow from={event.from} to={event.to} />
                  {event.note && <p className="text-xs text-gray-500">{event.note}</p>}
                </>
              )}

              {event.type === 'withdrawal' && (
                <>
                  <Flow from={event.from} />
                  <AccountBlock account={event.account} />
                </>
              )}

              {(event.type === 'payout_completed' ||
                event.type === 'payout_scheduled' ||
                event.type === 'payout_failed') && (
                <>
                  <AccountBlock
                    account={event.account}
                    label={event.type === 'payout_completed' ? 'Paid to' : 'Pays out to'}
                  />
                  <PlanLine event={event} />
                  {event.note && (
                    <p className={`text-xs ${failed ? 'text-error' : 'text-gray-500'}`}>{event.note}</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
