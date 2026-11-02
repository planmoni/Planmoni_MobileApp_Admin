import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, TriangleAlert } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';
import PayoutEventDetailsModal from '@/components/PayoutEventDetailsModal';
import PayoutEventRow from '@/components/PayoutEventRow';
import { useTodayPayoutEvents } from '@/hooks/queries/usePayoutEventsList';
import { formatNaira, formatNairaCompact } from '@/lib/calendarEvents';
import { pickEventHighlights, summarizeEvents, type PayoutEventItem } from '@/lib/payoutEventsView';

const SHOWN = 6;
const money = (amount: number) => (Math.abs(amount) >= 1_000_000 ? formatNairaCompact(amount) : formatNaira(amount));

/** The dashboard's "Today's Payout Events": what was paid out since midnight, problems first. */
export default function TodaysPayoutEvents() {
  const { data, isLoading, error } = useTodayPayoutEvents();
  const { isSuperAdmin, hasPermission } = usePermissions();
  const canProcess = isSuperAdmin || hasPermission('payouts', 'process');
  const [selected, setSelected] = useState<PayoutEventItem | null>(null);

  const rows = useMemo(() => pickEventHighlights(data?.rows ?? [], SHOWN), [data?.rows]);
  const summary = useMemo(() => summarizeEvents(data?.facets ?? []), [data?.facets]);
  const total = data?.total ?? 0;
  // only today's payouts: stuck, or failed with money held
  const attention = summary.attention.count;

  const parts = [
    summary.completed.count ? `${summary.completed.count.toLocaleString()} paid · ${money(summary.completed.amount)}` : null,
    summary.inProgress.count ? `${summary.inProgress.count.toLocaleString()} in progress` : null,
    summary.failed.count ? `${summary.failed.count.toLocaleString()} failed` : null,
  ].filter(Boolean);

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
        </div>
      ) : error && !data ? (
        <div className="text-center py-8 px-4">
          <p className="text-sm text-gray-900">Could not load today's payout events</p>
          <p className="text-xs text-gray-500 mt-1">{(error as Error).message}</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center py-8 text-gray-500 text-sm">No payout events today</p>
      ) : (
        <>
          {parts.length > 0 && (
            <p className="px-4 md:px-5 pt-3 pb-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
              {parts.join(' · ')}
            </p>
          )}
          <div className="divide-y divide-gray-100">
            {rows.map((row) => (
              <PayoutEventRow key={row.id} item={row} compact onOpen={setSelected} />
            ))}
          </div>
        </>
      )}

      {attention > 0 && (
        <Link
          to="/payout-events"
          state={{ status: 'attention', period: 'today' }}
          className="flex items-center justify-center gap-2 border-t border-gray-100 px-4 py-2.5 text-xs md:text-sm font-medium text-amber-800 bg-warning-light hover:opacity-90 transition-opacity"
        >
          <TriangleAlert className="h-4 w-4" />
          {attention.toLocaleString()} {attention === 1 ? 'payout needs' : 'payouts need'} attention today
        </Link>
      )}

      {canProcess && attention > 0 && (
        <Link
          to="/process-payouts"
          className="flex items-center justify-center gap-2 border-t border-amber-200 px-4 py-2.5 text-xs md:text-sm font-medium text-gray-900 bg-white hover:bg-gray-50 transition-colors"
        >
          <Send className="h-4 w-4" />
          Review and process due payouts
        </Link>
      )}

      <div className="border-t border-gray-100 p-3 md:p-4 text-center bg-gray-50">
        <Link
          to="/payout-events"
          className="text-primary hover:text-primary-light text-xs md:text-sm font-medium transition-colors"
        >
          {total > rows.length ? `View all ${total.toLocaleString()} payout events today` : 'View All Payout Events'}
        </Link>
      </div>

      <PayoutEventDetailsModal event={selected} isOpen={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}
