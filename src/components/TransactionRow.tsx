import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  Clock,
  Undo2,
  TriangleAlert,
} from 'lucide-react';
import { AccountBlock, Flow, PlanSummary } from '@/components/CalendarEventCard';
import { formatNaira } from '@/lib/calendarEvents';
import {
  amountSign,
  describeTransaction,
  statusLabel,
  userLabel,
  type TransactionItem,
} from '@/lib/transactionsView';

const STATUS_STYLE: Record<string, { className: string; Icon: ComponentType<{ className?: string }> }> = {
  completed: { className: 'bg-gray-100 text-gray-700', Icon: Check },
  pending: { className: 'bg-warning-light text-amber-800', Icon: Clock },
  failed: { className: 'bg-error-light text-red-700', Icon: TriangleAlert },
  refunded: { className: 'bg-white text-gray-700 border border-gray-300', Icon: Undo2 },
};

export function TransactionStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? { className: 'bg-gray-100 text-gray-700', Icon: Clock };
  const Icon = style.Icon;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${style.className}`}>
      <Icon className="h-3 w-3 mr-1" />
      {statusLabel(status)}
    </span>
  );
}

const DIRECTION_ICON = {
  in: ArrowDownLeft,
  out: ArrowUpRight,
  internal: ArrowLeftRight,
} as const;

/** Detail block shared by the list row and the details modal. */
export function TransactionBreakdown({ item, hideNote = false }: { item: TransactionItem; hideNote?: boolean }) {
  const view = describeTransaction(item);
  const noteClass = view.noteTone === 'error' ? 'text-error' : 'text-gray-500';

  return (
    <div className="space-y-2.5">
      {view.kind === 'payout' && (
        <>
          <AccountBlock account={view.account} label={item.status === 'completed' ? 'Paid to' : 'Pays out to'} />
          <PlanSummary plan={view.plan} />
        </>
      )}

      {view.kind === 'withdrawal' && (
        <>
          <Flow from={view.from} />
          <AccountBlock account={view.account} />
        </>
      )}

      {(view.kind === 'deposit' || view.kind === 'vault_topup' || view.kind === 'other') &&
        (view.from || view.to) && <Flow from={view.from} to={view.to} />}

      {view.kind === 'other' && view.account && <AccountBlock account={view.account} />}

      {item.fee !== null && item.fee > 0 && (
        <p className="text-xs text-gray-500">
          Fee <span className="text-gray-900 font-medium">{formatNaira(item.fee)}</span>
        </p>
      )}
      {view.note && !hideNote && <p className={`text-xs ${noteClass}`}>{view.note}</p>}
    </div>
  );
}

export default function TransactionRow({
  item,
  onOpen,
}: {
  item: TransactionItem;
  onOpen: (item: TransactionItem) => void;
}) {
  const view = describeTransaction(item);
  const Icon = DIRECTION_ICON[view.direction];
  const failed = item.status === 'failed';
  const settled = item.status === 'completed';
  const when = new Date(item.created_at);

  const amountBlock = (
    <>
      <p className={`text-sm font-semibold ${settled ? 'text-gray-900' : 'text-gray-500'}`}>
        {amountSign(view, item.status)}
        {formatNaira(item.amount)}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">{format(when, 'h:mm a')}</p>
    </>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(item);
        }
      }}
      className="px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none focus-visible:bg-gray-50"
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
            failed ? 'bg-error-light border-error-light' : 'bg-gray-50 border-gray-100'
          }`}
        >
          <Icon className={`h-4 w-4 ${failed ? 'text-error' : 'text-gray-600'}`} />
        </div>

        <div className="flex-1 min-w-0 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] lg:gap-6">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{view.title}</p>
                <TransactionStatusBadge status={item.status} />
              </div>
              {/* on a phone the amount sits on the title line so the details get the full width */}
              <div className="text-right shrink-0 sm:hidden">{amountBlock}</div>
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              {item.user?.id ? (
                <Link
                  to={`/users/${item.user.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-gray-900 hover:underline"
                >
                  {userLabel(item.user)}
                </Link>
              ) : (
                <span className="font-medium text-gray-900">{userLabel(item.user)}</span>
              )}
            </p>
            {item.reference && (
              <p className="text-xs text-gray-400 font-mono mt-1 break-all" title={item.reference}>
                {item.reference.length > 28 ? `${item.reference.slice(0, 28)}…` : item.reference}
              </p>
            )}
          </div>

          <TransactionBreakdown item={item} />
        </div>

        <div className="text-right shrink-0 hidden sm:block">{amountBlock}</div>
      </div>
    </div>
  );
}
