import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Check, Clock, TriangleAlert } from 'lucide-react';
import { AccountBlock } from '@/components/CalendarEventCard';
import { PayoutPlanIcon } from '@/components/PlanIcons';
import { formatNaira } from '@/lib/calendarEvents';
import {
  describeEvent,
  eventStatusLabel,
  eventUserName,
  type EventTone,
  type PayoutEventItem,
} from '@/lib/payoutEventsView';

export function EventStatusBadge({ status }: { status: string }) {
  const style =
    status === 'completed'
      ? { className: 'bg-gray-100 text-gray-700', Icon: Check }
      : status === 'failed'
        ? { className: 'bg-error-light text-red-700', Icon: TriangleAlert }
        : { className: 'bg-warning-light text-amber-800', Icon: Clock };
  const Icon = style.Icon;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${style.className}`}>
      <Icon className="h-3 w-3 mr-1" />
      {eventStatusLabel(status)}
    </span>
  );
}

/** "Stuck" / "Money held": the reason a person has to look at this one. */
export function EventFlag({ flag, tone }: { flag: string | null; tone: EventTone }) {
  if (!flag) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium border ${
        tone === 'error' ? 'bg-white text-red-700 border-red-200' : 'bg-white text-amber-800 border-amber-300'
      }`}
    >
      {flag}
    </span>
  );
}

const noteClass = (tone: EventTone) => (tone === 'error' ? 'text-error' : tone === 'warn' ? 'text-amber-800' : 'text-gray-500');

function UserLink({ item }: { item: PayoutEventItem }) {
  const name = eventUserName(item);
  if (!item.user?.id) return <span className="font-medium text-gray-900">{name}</span>;
  return (
    <Link
      to={`/users/${item.user.id}`}
      onClick={(e) => e.stopPropagation()}
      className="font-medium text-gray-900 hover:underline"
    >
      {name}
    </Link>
  );
}

export default function PayoutEventRow({
  item,
  onOpen,
  compact = false,
}: {
  item: PayoutEventItem;
  onOpen?: (item: PayoutEventItem) => void;
  /** one short block per event, no bank account: for small cards such as the dashboard */
  compact?: boolean;
}) {
  const view = describeEvent(item);
  const when = new Date(item.created_at);
  const settled = item.status === 'completed';
  const planName = item.plan?.name ?? 'Payout plan';
  const clickable = !!onOpen;

  const amountBlock = (
    <>
      <p className={`text-sm font-bold ${settled ? 'text-gray-900' : 'text-gray-500'}`}>{formatNaira(item.amount)}</p>
      <p className="text-xs text-gray-500 mt-0.5">{format(when, 'h:mm a')}</p>
    </>
  );

  const reason = view.reason;

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onOpen?.(item) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen?.(item);
              }
            }
          : undefined
      }
      className={`${compact ? 'px-4 py-3 md:px-5' : 'px-5 py-4'} transition-colors ${
        clickable ? 'hover:bg-gray-50 cursor-pointer focus:outline-none focus-visible:bg-gray-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <PayoutPlanIcon purpose={item.plan?.purpose} name={planName} size="sm" />

        <div
          className={`flex-1 min-w-0 grid gap-3 ${
            !compact && view.account ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-6' : ''
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <p className="text-sm font-semibold text-gray-900 break-words">{planName}</p>
                <EventStatusBadge status={item.status} />
                <EventFlag flag={view.flag} tone={view.tone} />
              </div>
              {/* on a phone the amount sits on the title line so the details get the full width */}
              <div className="text-right shrink-0 sm:hidden">{amountBlock}</div>
            </div>

            <p className="text-sm text-gray-600 mt-0.5">
              <UserLink item={item} />
              {view.position && <span className="text-gray-500"> · {view.position}</span>}
            </p>

            {view.note && <p className={`text-xs mt-1 ${noteClass(view.tone)}`}>{view.note}</p>}
            {reason && (
              <p className="text-xs mt-1 text-error line-clamp-2 break-words" title={reason}>
                {reason}
              </p>
            )}
            {!compact && item.reference && (
              <p className="text-xs text-gray-400 font-mono mt-1 break-all" title={item.reference}>
                {item.reference.length > 34 ? `${item.reference.slice(0, 34)}…` : item.reference}
              </p>
            )}
          </div>

          {!compact && view.account && (
            <AccountBlock account={view.account} label={settled ? 'Paid to' : 'Pays out to'} />
          )}
        </div>

        <div className="text-right shrink-0 hidden sm:block">{amountBlock}</div>
      </div>
    </div>
  );
}
