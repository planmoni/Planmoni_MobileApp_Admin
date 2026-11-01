import { useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Search,
  User,
  UserCog,
  UserPlus,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import ActivityRow from '@/components/ActivityRow';
import DateRangePicker from '@/components/DateRangePicker';
import TransactionDetailsModal from '@/components/TransactionDetailsModal';
import { useActivityList, ACTIVITY_PAGE_SIZE } from '@/hooks/queries/useActivityList';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import {
  ACTIVITY_PERIODS,
  CATEGORIES,
  KINDS,
  categoryOfKind,
  countFacets,
  dayKey,
  type ActivityCategory,
  type ActivityItem,
} from '@/lib/activityView';
import { resolvePeriod, type PeriodKey, type TransactionItem } from '@/lib/transactionsView';

const pill = (active: boolean) =>
  `px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
    active
      ? 'bg-gray-900 text-white shadow-sm border border-gray-900'
      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
  }`;

const smallPill = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
    active
      ? 'bg-gray-900 text-white border border-gray-900'
      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
  }`;

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** A headline number that doubles as a shortcut to that kind of activity. */
function SummaryTile({
  label,
  value,
  hint,
  Icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  Icon: typeof UserPlus;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-2xl border bg-white p-4 shadow-soft transition-all hover:bg-gray-50 ${
        active ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-gray-500" />
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="text-lg font-semibold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
    </button>
  );
}

export default function Activity() {
  const location = useLocation();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [periodKey, setPeriodKey] = useState<PeriodKey>('last_7');
  const [custom, setCustom] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [category, setCategory] = useState<'all' | ActivityCategory>('all');
  const [kind, setKind] = useState('all');
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);

  // Arriving from a user's profile can show just that person
  useEffect(() => {
    const state = location.state as { userId?: string; userName?: string } | null;
    if (!state?.userId) return;
    setUserId(state.userId);
    setUserName(state.userName || null);
    setPeriodKey('all');
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

  const { data, isLoading, isFetching, error, refetch } = useActivityList({
    from: period.from,
    to: period.to,
    category,
    kind,
    search,
    userId,
    page,
  });

  const refreshData = useRefreshData();

  const facets = data?.facets ?? [];
  const everything = countFacets(facets);
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (page - 1) * ACTIVITY_PAGE_SIZE + 1;
  const lastShown = Math.min(page * ACTIVITY_PAGE_SIZE, total);

  // a filter can leave us past the last page (e.g. after a refresh)
  useEffect(() => {
    if (data && page > pageCount) setPage(pageCount);
  }, [data, page, pageCount]);

  const groups = useMemo(() => {
    const byDay = new Map<string, ActivityItem[]>();
    for (const row of data?.rows ?? []) {
      const key = dayKey(row.at);
      byDay.set(key, [...(byDay.get(key) ?? []), row]);
    }
    return Array.from(byDay.entries());
  }, [data?.rows]);

  const filtersActive = category !== 'all' || kind !== 'all' || !!search.trim() || !!userId;

  const choosePeriod = (key: PeriodKey) => {
    setPeriodKey(key);
    setPage(1);
  };
  const chooseCategory = (key: 'all' | ActivityCategory) => {
    setCategory(key);
    setKind('all');
    setPage(1);
  };
  const chooseKind = (key: string) => {
    // clicking the active one again goes back to the whole category
    const next = kind === key ? 'all' : key;
    const owner = categoryOfKind(key);
    if (owner) setCategory(owner);
    setKind(next);
    setPage(1);
  };

  const dayLabel = (key: string) => {
    const date = new Date(`${key}T12:00:00`);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d, yyyy');
  };

  if (error && !data) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-1">Failed to load activity</p>
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

  const kindChips = category === 'all' ? [] : KINDS[category];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-1">Activity</h1>
          <p className="text-gray-500">Sign-ups, KYC, plans, money movement and admin actions as they happen</p>
        </div>
        <button
          onClick={() => refreshData.mutate(['activity'])}
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
          placeholder="Search by name, email, plan, bank account or reference..."
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
        {ACTIVITY_PERIODS.map((p) => (
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
            choosePeriod(start && end ? 'custom' : 'last_7');
          }}
        />
      </div>
      <p className="text-xs text-gray-500 mb-6">
        {period.label}
        {data ? ` · ${plural(everything, 'event')}` : ''}
      </p>

      {/* Headlines for the period; each one is a shortcut */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <SummaryTile
          label="New sign-ups"
          Icon={UserPlus}
          value={countFacets(facets, { kind: 'signup' })}
          hint="People who joined"
          active={kind === 'signup'}
          onClick={() => chooseKind('signup')}
        />
        <SummaryTile
          label="KYC submissions"
          Icon={FileText}
          value={countFacets(facets, { kind: 'kyc_submitted' })}
          hint="Sent in for review"
          active={kind === 'kyc_submitted'}
          onClick={() => chooseKind('kyc_submitted')}
        />
        <SummaryTile
          label="Payout plans created"
          Icon={CalendarPlus}
          value={countFacets(facets, { kind: 'payout_plan_created' })}
          hint="New scheduled payouts"
          active={kind === 'payout_plan_created'}
          onClick={() => chooseKind('payout_plan_created')}
        />
        <SummaryTile
          label="Admin actions"
          Icon={UserCog}
          value={countFacets(facets, { category: 'admin' })}
          hint="Done by the team"
          active={category === 'admin' && kind === 'all'}
          onClick={() => chooseCategory(category === 'admin' && kind === 'all' ? 'all' : 'admin')}
        />
      </div>

      {/* What */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => chooseCategory('all')} className={pill(category === 'all')}>
          All
          <span className={`ml-2 text-xs ${category === 'all' ? 'text-gray-300' : 'text-gray-400'}`}>
            {everything.toLocaleString()}
          </span>
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => chooseCategory(c.key)} className={pill(category === c.key)}>
            {c.label}
            <span className={`ml-2 text-xs ${category === c.key ? 'text-gray-300' : 'text-gray-400'}`}>
              {countFacets(facets, { category: c.key }).toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {kindChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {kindChips.map((k) => {
            const count = countFacets(facets, { kind: k.key });
            if (count === 0 && kind !== k.key) return null;
            return (
              <button key={k.key} onClick={() => chooseKind(k.key)} className={smallPill(kind === k.key)}>
                {k.label}
                <span className={`ml-1.5 ${kind === k.key ? 'text-gray-300' : 'text-gray-400'}`}>
                  {count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {kindChips.length === 0 && <div className="mb-3" />}

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
            {filtersActive ? 'No activity matches these filters' : `No activity ${period.label === 'All time' ? 'yet' : 'in this period'}`}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {filtersActive ? 'Try removing a filter or widening the dates.' : 'Pick a wider period to see more.'}
          </p>
          {(filtersActive || periodKey !== 'all') && (
            <div className="mt-5 flex justify-center gap-2">
              {filtersActive && (
                <button
                  onClick={() => {
                    setCategory('all');
                    setKind('all');
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
                <button
                  onClick={() => choosePeriod('all')}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-900 text-white hover:bg-gray-800"
                >
                  Show all time
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className={`space-y-6 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {groups.map(([key, rows]) => (
            <div key={key}>
              <h3 className="text-sm font-semibold text-gray-500 mb-3">{dayLabel(key)}</h3>
              <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden divide-y divide-gray-100">
                {rows.map((row) => (
                  <ActivityRow key={row.id} item={row} onOpenTransaction={setSelectedTx} />
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

      <TransactionDetailsModal transaction={selectedTx} isOpen={!!selectedTx} onClose={() => setSelectedTx(null)} />
    </div>
  );
}
