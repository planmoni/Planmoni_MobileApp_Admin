import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Scale,
  Search,
  TriangleAlert,
  User,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import DateRangePicker from '@/components/DateRangePicker';
import TransactionDetailsModal from '@/components/TransactionDetailsModal';
import TransactionRow from '@/components/TransactionRow';
import { useTransactionsList, TRANSACTIONS_PAGE_SIZE } from '@/hooks/queries/useTransactionsList';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { formatNaira, formatNairaCompact } from '@/lib/calendarEvents';
import {
  PERIODS,
  STATUS_FILTERS,
  TYPE_FILTERS,
  resolvePeriod,
  summarize,
  type PeriodKey,
  type StatusFilter,
  type TransactionItem,
  type TypeFilter,
} from '@/lib/transactionsView';

const pill = (active: boolean) =>
  `px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
    active
      ? 'bg-gray-900 text-white shadow-sm border border-gray-900'
      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
  }`;

const money = (amount: number) => (Math.abs(amount) >= 1_000_000 ? formatNairaCompact(amount) : formatNaira(amount));

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
  Icon: typeof ArrowDownLeft;
  alert?: boolean;
  title?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-soft" title={title}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${alert ? 'text-error' : 'text-gray-500'}`} />
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
    </div>
  );
}

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

export default function Transactions() {
  const location = useLocation();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [periodKey, setPeriodKey] = useState<PeriodKey>('last_30');
  const [custom, setCustom] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [selected, setSelected] = useState<TransactionItem | null>(null);

  // Arriving from the dashboard or a user's profile can preset the type and the user
  useEffect(() => {
    const state = location.state as { filterType?: string; userId?: string; userName?: string } | null;
    if (!state) return;
    if (state.filterType && TYPE_FILTERS.some((t) => t.key === state.filterType)) {
      setTypeFilter(state.filterType as TypeFilter);
    }
    if (state.userId) {
      setUserId(state.userId);
      setUserName(state.userName || null);
      setPeriodKey('all'); // a person's whole history, not just the last month
    }
    setPage(1);
  }, [location.state]);

  // wait for a pause in typing before asking the database
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const period = useMemo(() => resolvePeriod(periodKey, custom), [periodKey, custom]);

  const { data, isLoading, isFetching, error, refetch } = useTransactionsList({
    from: period.from,
    to: period.to,
    type: typeFilter,
    status: statusFilter,
    search,
    userId,
    page,
  });

  const refreshData = useRefreshData();

  const summary = useMemo(() => summarize(data?.facets ?? [], typeFilter), [data?.facets, typeFilter]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * TRANSACTIONS_PAGE_SIZE + 1;
  const lastShown = Math.min(page * TRANSACTIONS_PAGE_SIZE, total);

  // a filter can leave us past the last page (e.g. after a refresh)
  useEffect(() => {
    if (data && page > pageCount) setPage(pageCount);
  }, [data, page, pageCount]);

  const groups = useMemo(() => {
    const byDay = new Map<string, TransactionItem[]>();
    for (const row of data?.rows ?? []) {
      const day = format(new Date(row.created_at), 'yyyy-MM-dd');
      byDay.set(day, [...(byDay.get(day) ?? []), row]);
    }
    return Array.from(byDay.entries());
  }, [data?.rows]);

  const filtersActive = typeFilter !== 'all' || statusFilter !== 'all' || !!search.trim() || !!userId;

  const choosePeriod = (key: PeriodKey) => {
    setPeriodKey(key);
    setPage(1);
  };
  const chooseType = (key: TypeFilter) => {
    setTypeFilter(key);
    setStatusFilter('all');
    setPage(1);
  };
  const chooseStatus = (key: StatusFilter) => {
    setStatusFilter(key);
    setPage(1);
  };

  const dayLabel = (day: string) => {
    const date = new Date(`${day}T12:00:00`);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d, yyyy');
  };

  if (error && !data) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-1">Failed to load transactions</p>
        <p className="text-sm text-gray-500 mb-4">{(error as Error).message}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Transactions</h1>
          <p className="text-gray-500">Every deposit, payout and withdrawal, with where the money came from and went</p>
        </div>
        <button
          onClick={() => refreshData.mutate(['transactions'])}
          className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
          title="Refresh"
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending || isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by name, email, reference, plan or account number..."
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

      {userId && userName && (
        <div className="mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-xl border border-gray-200 shadow-soft">
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Showing {userName}</span>
            <button
              onClick={() => {
                setUserId(null);
                setUserName(null);
                setPage(1);
              }}
              className="ml-1 hover:bg-gray-100 rounded-full p-1 transition-colors"
              title="Show everyone"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* When */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => choosePeriod(p.key)} className={pill(periodKey === p.key)}>
            {p.label}
          </button>
        ))}
        <DateRangePicker
          startDate={custom.start}
          endDate={custom.end}
          placeholder="Custom range"
          active={periodKey === 'custom'}
          onChange={(start, end) => {
            setCustom({ start, end });
            choosePeriod(start && end ? 'custom' : 'last_30');
          }}
        />
      </div>
      <p className="text-xs text-gray-500 mb-6">
        {period.label}
        {data ? ` · ${plural(summary.total, 'transaction')}` : ''}
      </p>

      {/* Summary of the period */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <SummaryTile
          label="Money in"
          Icon={ArrowDownLeft}
          value={money(summary.moneyIn.amount)}
          hint={`${plural(summary.moneyIn.count, 'completed deposit')}`}
          title={formatNaira(summary.moneyIn.amount)}
        />
        <SummaryTile
          label="Money out"
          Icon={ArrowUpRight}
          value={money(summary.moneyOut.amount)}
          hint={`${plural(summary.moneyOut.count, 'completed transfer')} to banks`}
          title={formatNaira(summary.moneyOut.amount)}
        />
        <SummaryTile
          label="Net movement"
          Icon={Scale}
          value={`${summary.net < 0 ? '−' : ''}${money(Math.abs(summary.net))}`}
          hint="Deposits minus payouts and withdrawals"
          title={formatNaira(summary.net)}
        />
        <SummaryTile
          label="Needs attention"
          Icon={TriangleAlert}
          alert={summary.attention.count > 0}
          value={summary.attention.count.toLocaleString()}
          hint={summary.attention.count > 0 ? `${money(summary.attention.amount)} pending or failed` : 'Nothing pending or failed'}
        />
      </div>

      {/* What */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((t) => {
            const count = t.key === 'all' ? summary.total : summary.byType[t.key] || 0;
            return (
              <button key={t.key} onClick={() => chooseType(t.key)} className={pill(typeFilter === t.key)}>
                {t.label}
                <span className={`ml-2 text-xs ${typeFilter === t.key ? 'text-gray-300' : 'text-gray-400'}`}>
                  {count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => {
            const count = s.key === 'all' ? Object.values(summary.byStatus).reduce((a, b) => a + b, 0) : summary.byStatus[s.key] || 0;
            return (
              <button key={s.key} onClick={() => chooseStatus(s.key)} className={pill(statusFilter === s.key)}>
                {s.label}
                {s.key !== 'all' && (
                  <span className={`ml-2 text-xs ${statusFilter === s.key ? 'text-gray-300' : 'text-gray-400'}`}>
                    {count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Search className="h-7 w-7 text-gray-300" />
          </div>
          <p className="text-gray-900 font-medium">
            {filtersActive ? 'No transactions match these filters' : `No transactions ${period.label === 'All time' ? 'yet' : 'in this period'}`}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {filtersActive ? 'Try removing a filter or widening the dates.' : 'Pick a wider period to see more.'}
          </p>
          {(filtersActive || periodKey !== 'all') && (
            <div className="mt-5 flex justify-center gap-2">
              {filtersActive && (
                <button
                  onClick={() => {
                    setTypeFilter('all');
                    setStatusFilter('all');
                    setSearchInput('');
                    setUserId(null);
                    setUserName(null);
                    setPage(1);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                >
                  Clear filters
                </button>
              )}
              {periodKey !== 'all' && (
                <button onClick={() => choosePeriod('all')} className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-800">
                  Show all time
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className={`space-y-6 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {groups.map(([day, rows]) => (
            <div key={day}>
              <h3 className="text-sm font-semibold text-gray-500 mb-3">{dayLabel(day)}</h3>
              <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden divide-y divide-gray-100">
                {rows.map((row) => (
                  <TransactionRow key={row.id} item={row} onOpen={setSelected} />
                ))}
              </div>
            </div>
          ))}

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

      <TransactionDetailsModal
        transaction={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
