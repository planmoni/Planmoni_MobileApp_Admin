import { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Search, TriangleAlert, X } from 'lucide-react';
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { useCalendarEvents } from '@/hooks/queries/useCalendarEvents';
import CalendarEventCard, { EVENT_TYPE_META } from '@/components/CalendarEventCard';
import { formatNaira, formatNairaCompact, type CalendarEvent, type CalendarEventType } from '@/lib/calendarEvents';

type ViewMode = 'month' | 'week' | 'list';

/** Order in which event types are listed everywhere (tiles, day cells, cards). */
const TYPE_ORDER: CalendarEventType[] = [
  'deposit',
  'payout_completed',
  'payout_scheduled',
  'payout_failed',
  'plan_created',
  'withdrawal',
];

const PANEL_PAGE = 30; // cards shown in the day panel before "Show more"
const GROUP_PAGE = 20; // cards shown per day in the list view before "Show all"
const LIST_DAYS_PER_PAGE = 10;

const dayKey = (date: Date) => format(date, 'yyyy-MM-dd');

/** Deposits first, then payouts, ...; newest first within a type; undated entries last. */
const compareWithinDay = (a: CalendarEvent, b: CalendarEvent) =>
  TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
  (b.time?.getTime() ?? 0) - (a.time?.getTime() ?? 0) ||
  (b.amount ?? 0) - (a.amount ?? 0);

const matchesSearch = (event: CalendarEvent, query: string) => {
  if (!query) return true;
  const haystack = [
    event.userName,
    event.plan?.name,
    event.account?.bankName,
    event.account?.accountNumber,
    event.account?.accountName,
    event.from?.label,
    event.from?.sublabel,
    event.to?.label,
    event.to?.sublabel,
    event.note,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
};

/** "↓ 12  ↑ 30" - how many of each kind happen on a day. */
function DayCounts({ events, limit = 4 }: { events: CalendarEvent[]; limit?: number }) {
  const counts = TYPE_ORDER.map((type) => ({ type, count: events.filter((e) => e.type === type).length })).filter(
    (c) => c.count > 0
  );
  if (counts.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {counts.slice(0, limit).map(({ type, count }) => {
        const { Icon, plural } = EVENT_TYPE_META[type];
        return (
          <div
            key={type}
            title={`${count} ${plural.toLowerCase()}`}
            className={`flex items-center gap-1 text-[11px] font-medium ${
              type === 'payout_failed' ? 'text-error' : 'text-gray-600'
            }`}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span>{count}</span>
          </div>
        );
      })}
      {counts.length > limit && <div className="text-[11px] text-gray-400">+{counts.length - limit} more</div>}
    </div>
  );
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [typeFilter, setTypeFilter] = useState<CalendarEventType | null>(null);
  const [search, setSearch] = useState('');
  const [listPage, setListPage] = useState(1);
  const [panelLimit, setPanelLimit] = useState(PANEL_PAGE);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching, isError } = useCalendarEvents(currentDate);
  const allEvents = data?.events;

  const query = search.trim().toLowerCase();

  // events shown on the calendar: respects the type filter and the search box
  const visibleEvents = useMemo(
    () => (allEvents || []).filter((e) => (!typeFilter || e.type === typeFilter) && matchesSearch(e, query)),
    [allEvents, typeFilter, query]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of visibleEvents) {
      const key = dayKey(event.date);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    for (const list of map.values()) list.sort(compareWithinDay);
    return map;
  }, [visibleEvents]);

  const eventsOn = (date: Date) => eventsByDay.get(dayKey(date)) || [];

  // the month overview ignores the type filter (so the tiles can switch between types) but follows the search
  const monthStats = useMemo(() => {
    const stats = Object.fromEntries(TYPE_ORDER.map((t) => [t, { count: 0, total: 0 }])) as Record<
      CalendarEventType,
      { count: number; total: number }
    >;
    for (const event of allEvents || []) {
      if (!isSameMonth(event.date, currentDate) || !matchesSearch(event, query)) continue;
      stats[event.type].count += 1;
      stats[event.type].total += event.amount ?? 0;
    }
    return stats;
  }, [allEvents, currentDate, query]);

  const monthStart = startOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(endOfMonth(currentDate)),
  });
  const weekDays = eachDayOfInterval({ start: startOfWeek(selectedDate), end: endOfWeek(selectedDate) });

  const selectedEvents = eventsOn(selectedDate);
  const selectedIn = selectedEvents.filter((e) => e.type === 'deposit').reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const selectedOut = selectedEvents
    .filter((e) => e.type === 'payout_completed' || e.type === 'withdrawal')
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);

  // list view: the current month only, newest day first
  const listGroups = useMemo(() => {
    const groups: { key: string; date: Date; events: CalendarEvent[] }[] = [];
    for (const [key, events] of eventsByDay) {
      if (!isSameMonth(events[0].date, currentDate)) continue;
      groups.push({ key, date: events[0].date, events });
    }
    return groups.sort((a, b) => b.key.localeCompare(a.key));
  }, [eventsByDay, currentDate]);

  const totalPages = Math.max(1, Math.ceil(listGroups.length / LIST_DAYS_PER_PAGE));
  const pagedGroups = listGroups.slice((listPage - 1) * LIST_DAYS_PER_PAGE, listPage * LIST_DAYS_PER_PAGE);

  // --- navigation ---

  const selectDate = (date: Date) => {
    setSelectedDate(date);
    setPanelLimit(PANEL_PAGE);
  };

  const goToMonth = (date: Date) => {
    setCurrentDate(date);
    selectDate(isSameMonth(date, new Date()) ? new Date() : startOfMonth(date));
    setListPage(1);
  };

  const goToWeek = (date: Date) => {
    setCurrentDate(date);
    selectDate(date);
  };

  const handlePrevious = () => (viewMode === 'week' ? goToWeek(subWeeks(selectedDate, 1)) : goToMonth(subMonths(currentDate, 1)));
  const handleNext = () => (viewMode === 'week' ? goToWeek(addWeeks(selectedDate, 1)) : goToMonth(addMonths(currentDate, 1)));
  const handleToday = () => goToMonth(new Date());

  const heading =
    viewMode === 'week'
      ? `${format(startOfWeek(selectedDate), 'MMM d')} – ${format(endOfWeek(selectedDate), 'MMM d, yyyy')}`
      : format(currentDate, 'MMMM yyyy');

  const toggleTypeFilter = (type: CalendarEventType) => {
    setTypeFilter((current) => (current === type ? null : type));
    setListPage(1);
  };

  const toggleDay = (key: string) =>
    setExpandedDays((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const showDetailPanel = viewMode !== 'list';

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-1">Calendar</h1>
          <p className="text-gray-500">Deposits, payouts and new plans, day by day</p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setListPage(1);
            }}
            placeholder="Search user, plan, bank or account number"
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-9 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {(isError || (data?.warnings?.length ?? 0) > 0 || data?.truncated) && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 space-y-1">
          {isError && (
            <p className="flex items-start gap-2">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0 text-gray-900" />
              Could not load the calendar. Try again in a moment.
            </p>
          )}
          {data?.warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-2">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0 text-gray-900" />
              {warning}
            </p>
          ))}
          {data?.truncated && (
            <p className="flex items-start gap-2">
              <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0 text-gray-900" />
              This month has a very large number of events, so only the first 10,000 of some types are shown.
            </p>
          )}
        </div>
      )}

      {/* Month overview. Click a tile to show only that kind of event. */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-2">
        {TYPE_ORDER.map((type) => {
          const { plural, Icon } = EVENT_TYPE_META[type];
          const { count, total } = monthStats[type];
          const active = typeFilter === type;
          return (
            <button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              aria-pressed={active}
              className={`rounded-2xl border bg-white p-4 text-left shadow-soft transition-all ${
                active ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-100 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${type === 'payout_failed' && count > 0 ? 'text-error' : 'text-gray-500'}`} />
                <span className="text-xs font-medium text-gray-500">{plural}</span>
              </div>
              <p className="text-lg font-semibold text-gray-900">{count.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {total > 0 ? `${formatNairaCompact(total)}${type === 'plan_created' ? ' committed' : ''}` : '—'}
              </p>
            </button>
          );
        })}
      </div>
      <div className="h-6 mb-2 text-xs text-gray-500">
        {(typeFilter || query) && (
          <span>
            Showing {typeFilter ? EVENT_TYPE_META[typeFilter].plural.toLowerCase() : 'all events'}
            {query ? ` matching "${search.trim()}"` : ''}.{' '}
            <button
              onClick={() => {
                setTypeFilter(null);
                setSearch('');
                setListPage(1);
              }}
              className="font-medium text-gray-900 hover:underline"
            >
              Clear
            </button>
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 min-w-0 w-full">
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevious}
                  className="p-2 rounded-xl hover:bg-gray-50 transition-colors"
                  aria-label={viewMode === 'week' ? 'Previous week' : 'Previous month'}
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <h2 className="text-xl font-semibold text-gray-900 min-w-[11rem] text-center">{heading}</h2>
                <button
                  onClick={handleNext}
                  className="p-2 rounded-xl hover:bg-gray-50 transition-colors"
                  aria-label={viewMode === 'week' ? 'Next week' : 'Next month'}
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
                {isFetching && !isLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-400" />
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleToday}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-900 rounded-xl hover:bg-gray-50 transition-colors text-sm font-semibold"
                >
                  Today
                </button>
                <div className="inline-flex items-center gap-1 bg-gray-50 p-1 rounded-xl">
                  {(['month', 'week', 'list'] as ViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${
                        viewMode === mode ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {viewMode === 'month' && (
              <div className="p-6">
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day) => {
                    const dayEvents = eventsOn(day);
                    const inMonth = isSameMonth(day, currentDate);
                    const selected = isSameDay(day, selectedDate);
                    const today = isSameDay(day, new Date());

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => selectDate(day)}
                        className={`min-h-[96px] p-2 rounded-xl text-left border transition-all ${
                          selected
                            ? 'border-gray-900 ring-1 ring-gray-900 bg-gray-50'
                            : 'border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                        } ${inMonth ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
                      >
                        <span
                          className={`inline-flex items-center justify-center text-sm font-semibold mb-1.5 ${
                            today ? 'w-6 h-6 rounded-full bg-gray-900 text-white' : 'text-gray-900'
                          }`}
                        >
                          {format(day, 'd')}
                        </span>
                        <DayCounts events={dayEvents} />
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 pt-4">
                  {TYPE_ORDER.map((type) => {
                    const { Icon, plural } = EVENT_TYPE_META[type];
                    return (
                      <span key={type} className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Icon className={`h-3.5 w-3.5 ${type === 'payout_failed' ? 'text-error' : ''}`} />
                        {plural}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'week' && (
              <div className="p-6">
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day) => {
                    const dayEvents = eventsOn(day);
                    const selected = isSameDay(day, selectedDate);
                    const today = isSameDay(day, new Date());

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => selectDate(day)}
                        className={`min-h-[220px] p-3 rounded-xl text-left border transition-all ${
                          selected
                            ? 'border-gray-900 ring-1 ring-gray-900 bg-gray-50'
                            : 'border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200'
                        }`}
                      >
                        <p className="text-xs font-medium text-gray-500">{format(day, 'EEE')}</p>
                        <span
                          className={`inline-flex items-center justify-center text-xl font-semibold mb-3 ${
                            today ? 'w-8 h-8 rounded-full bg-gray-900 text-white text-base' : 'text-gray-900'
                          }`}
                        >
                          {format(day, 'd')}
                        </span>
                        <div className="space-y-1.5">
                          {dayEvents.slice(0, 6).map((event) => {
                            const { Icon } = EVENT_TYPE_META[event.type];
                            return (
                              <div
                                key={event.id}
                                className={`flex items-center gap-1.5 text-xs ${
                                  event.type === 'payout_failed' ? 'text-error' : 'text-gray-700'
                                }`}
                              >
                                <Icon className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {event.amount !== null ? formatNairaCompact(event.amount) : EVENT_TYPE_META[event.type].title}
                                </span>
                              </div>
                            );
                          })}
                          {dayEvents.length > 6 && (
                            <p className="text-xs text-gray-400">+{dayEvents.length - 6} more</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'list' && (
              <>
                <div className="divide-y divide-gray-100">
                  {pagedGroups.length > 0 ? (
                    pagedGroups.map((group) => {
                      const expanded = expandedDays.has(group.key);
                      const shown = expanded ? group.events : group.events.slice(0, GROUP_PAGE);
                      return (
                        <div key={group.key} className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">{format(group.date, 'EEEE, MMMM d, yyyy')}</h3>
                            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                              {group.events.length} event{group.events.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                            {shown.map((event) => (
                              <CalendarEventCard key={event.id} event={event} />
                            ))}
                          </div>
                          {group.events.length > GROUP_PAGE && (
                            <button
                              onClick={() => toggleDay(group.key)}
                              className="mt-4 text-sm font-semibold text-gray-900 hover:underline"
                            >
                              {expanded ? 'Show fewer' : `Show all ${group.events.length}`}
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                        <CalendarIcon className="h-7 w-7 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">{isLoading ? 'Loading events...' : 'No events found'}</p>
                      {!isLoading && <p className="text-gray-400 text-sm mt-1">Nothing matches for this month</p>}
                    </div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="p-6 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Page {listPage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setListPage(listPage - 1)}
                        disabled={listPage === 1}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setListPage(listPage + 1)}
                        disabled={listPage === totalPages}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {showDetailPanel && (
          <aside className="w-full lg:w-[28rem] shrink-0">
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden lg:sticky lg:top-6">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">{format(selectedDate, 'EEEE, MMMM d')}</h3>
                <p className="text-sm text-gray-500">
                  {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
                  {selectedIn > 0 && <> · In {formatNaira(selectedIn)}</>}
                  {selectedOut > 0 && <> · Out {formatNaira(selectedOut)}</>}
                </p>
              </div>

              <div className="p-4 space-y-3 max-h-[calc(100vh-15rem)] overflow-y-auto">
                {selectedEvents.length > 0 ? (
                  <>
                    {selectedEvents.slice(0, panelLimit).map((event) => (
                      <CalendarEventCard key={event.id} event={event} />
                    ))}
                    {selectedEvents.length > panelLimit && (
                      <button
                        onClick={() => setPanelLimit(panelLimit + PANEL_PAGE)}
                        className="w-full py-2.5 text-sm font-semibold text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        Show more ({selectedEvents.length - panelLimit} left)
                      </button>
                    )}
                  </>
                ) : (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                      <CalendarIcon className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">{isLoading ? 'Loading events...' : 'No events'}</p>
                    {!isLoading && <p className="text-gray-400 text-sm mt-1">Nothing recorded for this day</p>}
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
