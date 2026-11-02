import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
  ShieldAlert,
  TriangleAlert,
  X,
} from 'lucide-react';
import { AccountBlock } from '@/components/CalendarEventCard';
import { PayoutPlanIcon } from '@/components/PlanIcons';
import ProcessPayoutDialog from '@/components/processPayouts/ProcessPayoutDialog';
import { usePermissions } from '@/contexts/PermissionsContext';
import { DUE_PAYOUTS_PAGE_SIZE, useDuePayouts } from '@/hooks/queries/useProcessPayouts';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { formatNaira, formatNairaCompact } from '@/lib/calendarEvents';
import {
  DUE_PERIODS,
  DUE_STATES,
  STATE_FILTERS,
  overdueLabel,
  resolveDuePeriod,
  summarizeDue,
  type DuePayoutRow,
  type DuePeriodKey,
  type DueState,
  type StateFilter,
} from '@/lib/processPayoutsView';
import { userLabel } from '@/lib/transactionsView';

const pill = (active: boolean) =>
  `px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
    active
      ? 'bg-gray-900 text-white shadow-sm border border-gray-900'
      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
  }`;

const money = (amount: number) => (Math.abs(amount) >= 1_000_000 ? formatNairaCompact(amount) : formatNaira(amount));
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

function SummaryTile({
  label,
  value,
  hint,
  Icon,
  alert = false,
  title,
}: {
  label: string;
  value: string;
  hint: string;
  Icon: typeof Banknote;
  alert?: boolean;
  title?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-soft" title={title}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${alert ? 'text-error' : 'text-gray-500'}`} />
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-lg font-semibold text-gray-900 truncate">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
    </div>
  );
}

function StateBadge({ state }: { state: DueState }) {
  const meta = DUE_STATES[state];
  const className =
    meta.tone === 'error'
      ? 'bg-error-light text-red-700'
      : meta.tone === 'warn'
        ? 'bg-warning-light text-amber-800'
        : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${className}`} title={meta.hint}>
      {meta.label}
    </span>
  );
}

function DueRow({ item, onReview }: { item: DuePayoutRow; onReview: (item: DuePayoutRow) => void }) {
  const due = new Date(item.next_payout_date);
  const account = item.account?.account_number
    ? {
        bankName: item.account.bank_name,
        bankCode: item.account.bank_code,
        accountNumber: item.account.account_number,
        accountName: item.account.account_name,
      }
    : null;
  const error = item.attempt?.error;

  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3">
        <PayoutPlanIcon purpose={item.plan.purpose} name={item.plan.name} size="sm" />

        <div className="flex-1 min-w-0 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 break-words">{item.plan.name}</p>
              <StateBadge state={item.state} />
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              {item.user ? (
                <Link to={`/users/${item.user.id}`} className="font-medium text-gray-900 hover:underline">
                  {userLabel(item.user)}
                </Link>
              ) : (
                <span className="font-medium text-gray-900">Unknown user</span>
              )}
              <span className="text-gray-500">
                {' '}
                · Payout {item.installment} of {item.duration}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Due {format(due, 'MMM d, yyyy · h:mm a')} ·{' '}
              <span className={item.days_overdue >= 1 ? 'text-amber-800 font-medium' : ''}>{overdueLabel(item.days_overdue)}</span>
              {item.attempts > 1 ? ` · ${plural(item.attempts, 'attempt')}` : ''}
            </p>
            {error && (
              <p className="text-xs mt-1 text-error line-clamp-2 break-words" title={error}>
                {error}
              </p>
            )}
            {item.attempt?.reference && (
              <p className="text-xs text-gray-400 font-mono mt-1 break-all" title={item.attempt.reference}>
                {item.attempt.reference.length > 34 ? `${item.attempt.reference.slice(0, 34)}…` : item.attempt.reference}
              </p>
            )}
          </div>

          <AccountBlock account={account} label="Pays out to" />
        </div>

        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          <p className="text-sm font-semibold text-gray-900">{formatNaira(item.amount)}</p>
          <button
            onClick={() => onReview(item)}
            className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          >
            Review
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProcessPayouts() {
  const location = useLocation();
  const { isSuperAdmin, hasPermission } = usePermissions();
  const allowed = isSuperAdmin || hasPermission('payouts', 'process');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [periodKey, setPeriodKey] = useState<DuePeriodKey>('all');
  const [state, setState] = useState<StateFilter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DuePayoutRow | null>(null);

  // arriving from the dashboard or Payout Events can preset a state
  useEffect(() => {
    const preset = location.state as { state?: string } | null;
    if (preset?.state && STATE_FILTERS.some((s) => s.key === preset.state)) {
      setState(preset.state as StateFilter);
      setPage(1);
    }
  }, [location.state]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const period = useMemo(() => resolveDuePeriod(periodKey), [periodKey]);

  const { data, isLoading, isFetching, error, refetch } = useDuePayouts({
    from: period.from,
    to: period.to,
    state,
    search,
    page,
  });
  const refreshData = useRefreshData();
  const summary = useMemo(() => summarizeDue(data?.facets ?? []), [data?.facets]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / DUE_PAYOUTS_PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * DUE_PAYOUTS_PAGE_SIZE + 1;
  const lastShown = Math.min(page * DUE_PAYOUTS_PAGE_SIZE, total);

  useEffect(() => {
    if (data && page > pageCount) setPage(pageCount);
  }, [data, page, pageCount]);

  const filtersActive = state !== 'all' || !!search.trim();
  const held = summary.byState.stuck.amount + summary.byState.failed_held.amount;
  const heldCount = summary.byState.stuck.count + summary.byState.failed_held.count;

  if (!allowed) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-900 font-medium">You do not have access to Process Due Payouts</p>
        <p className="text-sm text-gray-500 mt-1">Ask a Super Admin for the “payouts.process” permission.</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-1">Failed to load due payouts</p>
        <p className="text-sm text-gray-500 mb-4">{(error as Error).message}</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-1">Process Due Payouts</h1>
          <p className="text-gray-500">Every plan whose payout is due and not finished. Review one at a time; nothing is sent without your confirmation.</p>
        </div>
        <button
          onClick={() => refreshData.mutate(['due-payouts'])}
          className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
          title="Refresh"
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending || isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by name, email, plan, reference, amount or account number..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="block w-full pl-11 pr-10 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
        />
        {searchInput && (
          <button
            onClick={() => setSearchInput('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-700"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Due date */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {DUE_PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              setPeriodKey(p.key);
              setPage(1);
            }}
            className={pill(periodKey === p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mb-6">
        {period.label}
        {data ? ` · ${plural(summary.total.count, 'plan')}` : ''}
      </p>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <SummaryTile
          label="Due and unfinished"
          Icon={Banknote}
          value={summary.total.count.toLocaleString()}
          hint={`${money(summary.total.amount)} in total`}
          title={formatNaira(summary.total.amount)}
        />
        <SummaryTile
          label="Not started"
          Icon={Clock}
          value={summary.byState.ready.count.toLocaleString()}
          hint={summary.byState.ready.count ? `${money(summary.byState.ready.amount)} waiting for the job` : 'Nothing waiting'}
          title={formatNaira(summary.byState.ready.amount)}
        />
        <SummaryTile
          label="Money held"
          Icon={TriangleAlert}
          alert={heldCount > 0}
          value={heldCount.toLocaleString()}
          hint={heldCount ? `${money(held)} stuck or failed after a debit` : 'Nothing is held'}
          title={formatNaira(held)}
        />
        <SummaryTile
          label="Failed, will retry"
          Icon={ShieldAlert}
          alert={summary.byState.failed_retrying.count > 0}
          value={summary.byState.failed_retrying.count.toLocaleString()}
          hint={summary.byState.failed_retrying.count ? `${money(summary.byState.failed_retrying.amount)} refunded, retrying hourly` : 'No failures'}
          title={formatNaira(summary.byState.failed_retrying.amount)}
        />
      </div>

      {/* State */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATE_FILTERS.map((s) => {
          const count = s.key === 'all' ? summary.total.count : summary.byState[s.key].count;
          return (
            <button
              key={s.key}
              onClick={() => {
                setState(state === s.key && s.key !== 'all' ? 'all' : s.key);
                setPage(1);
              }}
              className={pill(state === s.key)}
            >
              {s.label}
              <span className={`ml-2 text-xs ${state === s.key ? 'text-gray-300' : 'text-gray-400'}`}>{count.toLocaleString()}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
        </div>
      ) : (data?.rows.length ?? 0) === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Search className="h-7 w-7 text-gray-300" />
          </div>
          <p className="text-gray-900 font-medium">
            {filtersActive || periodKey !== 'all' ? 'No due payouts match these filters' : 'Nothing is due and unfinished'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {filtersActive || periodKey !== 'all' ? 'Try removing a filter or choosing All.' : 'Every due payout has been paid.'}
          </p>
          {(filtersActive || periodKey !== 'all') && (
            <div className="mt-5 flex justify-center gap-2">
              <button
                onClick={() => {
                  setState('all');
                  setSearchInput('');
                  setPeriodKey('all');
                  setPage(1);
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-800"
              >
                Show everything
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={`space-y-4 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {data!.rows.map((row) => (
              <DueRow key={row.plan_id} item={row} onReview={setSelected} />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {firstShown.toLocaleString()}–{lastShown.toLocaleString()} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </button>
              <span className="text-sm text-gray-500 px-2">
                Page {page} of {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}

      <ProcessPayoutDialog row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
