import type { ReactNode } from 'react';
import { X, User, ExternalLink, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, TriangleAlert } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useUserPayoutActions } from '@/hooks/queries/usePayoutActions';
import { useTransactionDetail } from '@/hooks/queries/useTransactionsList';
import { InstallmentActions } from '@/components/PayoutActions';
import { TransactionBreakdown, TransactionStatusBadge } from '@/components/TransactionRow';
import { formatNaira } from '@/lib/calendarEvents';
import {
  amountSign,
  describeTransaction,
  legacyToItem,
  titleCase,
  userLabel,
  type LegacyTransaction,
  type TransactionItem,
} from '@/lib/transactionsView';

interface TransactionDetailsModalProps {
  /** a row from the Transactions page, or the bare transaction other pages already have */
  transaction: TransactionItem | LegacyTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  showViewProfile?: boolean;
}

const DIRECTION_ICON = { in: ArrowDownLeft, out: ArrowUpRight, internal: ArrowLeftRight } as const;

const stamp = (value: string | null | undefined) => (value ? format(new Date(value), 'MMM d, yyyy · h:mm a') : null);

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5">
      <dt className="text-sm text-gray-500 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 text-right break-all">{children}</dd>
    </div>
  );
}

export default function TransactionDetailsModal({
  transaction,
  isOpen,
  onClose,
  showViewProfile = true,
}: TransactionDetailsModalProps) {
  const navigate = useNavigate();
  const { isSuperAdmin, hasPermission } = usePermissions();

  const base: TransactionItem | null = transaction
    ? 'user' in transaction
      ? (transaction as TransactionItem)
      : legacyToItem(transaction as LegacyTransaction)
    : null;

  // the list row (or the bare transaction) is enough to open; the full record fills in the rest
  const { data: detail } = useTransactionDetail(base?.id, isOpen);
  const item: TransactionItem | null = detail ?? base;
  const userId = item?.user?.id || null;

  // Payouts that are not completed can be resolved from here (retry / mark completed / mark refunded)
  const canManagePayouts = isSuperAdmin || hasPermission('payout_plans', 'manage');
  const isResolvablePayout = !!item && item.type === 'payout' && ['pending', 'failed', 'refunded'].includes(item.status);
  const { data: payoutActions } = useUserPayoutActions(userId, isOpen && canManagePayouts && isResolvablePayout);
  const payoutState = item ? payoutActions?.transactions[item.id] : undefined;

  if (!isOpen || !item) return null;

  const view = describeTransaction(item);
  const Icon = DIRECTION_ICON[view.direction];
  const failed = item.status === 'failed';

  const showActions =
    canManagePayouts &&
    !!userId &&
    !!payoutState &&
    payoutState.state !== 'completed' &&
    !(payoutState.state === 'unlinked' && item.status === 'refunded');
  // the failure reason is shown once: in the action panel when there is one, otherwise in its own panel
  const showFailReason = failed && !!item.error && !showActions;

  const openProfile = () => {
    if (!userId) return;
    onClose();
    navigate(`/users/${userId}`);
  };

  const candidateDetails: Array<[string, ReactNode] | null> = [
    ['Transaction ID', <span className="font-mono text-xs">{item.id}</span>],
    item.reference ? ['Reference', <span className="font-mono text-xs">{item.reference}</span>] : null,
    ['Created', stamp(item.created_at)],
    item.completed_at ? ['Completed', stamp(item.completed_at)] : null,
    item.transfer?.transferred_at ? ['Transferred', stamp(item.transfer.transferred_at)] : null,
    item.channel ? ['Channel', titleCase(item.channel)] : null,
    item.payment_gateway ? ['Gateway', titleCase(item.payment_gateway)] : null,
    item.provider ? ['Transfer provider', titleCase(item.provider)] : null,
    item.transfer?.reference ? ['Transfer reference', <span className="font-mono text-xs">{item.transfer.reference}</span>] : null,
    item.transfer?.code ? ['Transfer code', <span className="font-mono text-xs">{item.transfer.code}</span>] : null,
    item.transfer?.session_id ? ['Session ID', <span className="font-mono text-xs">{item.transfer.session_id}</span>] : null,
    item.manual?.reference ? ['Manual reference', <span className="font-mono text-xs">{item.manual.reference}</span>] : null,
    item.manual?.notes ? ['Admin notes', item.manual.notes] : null,
  ];
  const extraDetails = candidateDetails.filter(
    (row): row is [string, ReactNode] => !!row && row[1] !== null && row[1] !== undefined
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="relative transform overflow-hidden rounded-3xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-xl">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-gray-900">Transaction details</h3>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* What happened */}
            <div className="flex items-start gap-4 mb-5">
              <div
                className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
                  failed ? 'bg-error-light border-error-light' : 'bg-gray-50 border-gray-100'
                }`}
              >
                <Icon className={`h-6 w-6 ${failed ? 'text-error' : 'text-gray-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-gray-900">{view.title}</p>
                  <TransactionStatusBadge status={item.status} />
                </div>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {amountSign(view, item.status)}
                  {formatNaira(item.amount)}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {item.user && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{userLabel(item.user)}</p>
                      {item.user.email && <p className="text-xs text-gray-500 truncate">{item.user.email}</p>}
                    </div>
                  </div>
                  {userId && (
                    <button
                      onClick={openProfile}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 shrink-0"
                    >
                      Open profile
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <TransactionBreakdown item={item} hideNote={failed && !!item.error} />

              {showFailReason && (
                <div className="flex items-start gap-2 rounded-xl bg-error-light px-3 py-2.5">
                  <TriangleAlert className="h-4 w-4 text-error mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-800">Why it failed</p>
                    <p className="text-sm text-red-800 break-words">{item.error}</p>
                  </div>
                </div>
              )}

              {item.description && (
                <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                  <p className="text-xs font-medium text-gray-500 mb-0.5">Description</p>
                  <p className="text-sm text-gray-900">{item.description}</p>
                </div>
              )}

              <dl className="divide-y divide-gray-100 border-t border-gray-100">
                {extraDetails.map(([label, value]) => (
                  <Detail key={label} label={label}>
                    {value}
                  </Detail>
                ))}
              </dl>
            </div>
          </div>

          {showActions && userId && payoutState && (
            <div className="px-6 pb-5">
              <InstallmentActions userId={userId} state={payoutState} variant="modal" onDone={onClose} />
            </div>
          )}

          <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
            {showViewProfile && userId && (
              <button
                onClick={openProfile}
                className="px-5 py-2.5 bg-white text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-medium border border-gray-200 flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                View profile
              </button>
            )}
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
