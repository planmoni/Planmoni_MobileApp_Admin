import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, Calendar as CalendarIcon, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { useCalendarEvents } from '@/hooks/queries/useCalendarEvents';

type ViewMode = 'month' | 'week' | 'list';
type EventType = 'payout_received' | 'payout_created' | 'scheduled_payout' | 'payout_failed' | 'deposit' | 'withdrawal';

interface CalendarEvent {
  id: string;
  type: EventType;
  date: Date;
  title: string;
  description: string;
  amount?: number;
  user_name?: string;
  plan_name?: string;
}

const eventTypeConfig = {
  payout_received: {
    label: 'Payout received',
    color: 'bg-green-500',
    textColor: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-100',
    icon: CheckCircle2,
  },
  payout_created: {
    label: 'Payout created',
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100',
    icon: CalendarIcon,
  },
  scheduled_payout: {
    label: 'Scheduled payout',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-100',
    icon: Clock,
  },
  payout_failed: {
    label: 'Payout failed',
    color: 'bg-red-500',
    textColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-100',
    icon: XCircle,
  },
  deposit: {
    label: 'Deposit',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-100',
    icon: ArrowDownCircle,
  },
  withdrawal: {
    label: 'Withdrawal',
    color: 'bg-orange-500',
    textColor: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-100',
    icon: ArrowUpCircle,
  },
};

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [listPage, setListPage] = useState(1);
  const itemsPerPage = 10;

  const { data: eventsData } = useCalendarEvents(currentDate);
  const events: CalendarEvent[] = eventsData || [];

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(event.date, date));
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
    setListPage(1);
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
    setListPage(1);
  };

  const handlePreviousWeek = () => {
    const newDate = subWeeks(selectedDate || currentDate, 1);
    setSelectedDate(newDate);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = addWeeks(selectedDate || currentDate, 1);
    setSelectedDate(newDate);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
    setListPage(1);
  };

  const getEventTypeColor = (type: EventType) => {
    return eventTypeConfig[type]?.color || 'bg-gray-500';
  };

  const groupEventsByDate = (events: CalendarEvent[]) => {
    const grouped = events.reduce((acc, event) => {
      const dateKey = format(event.date, 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(event);
      return acc;
    }, {} as Record<string, CalendarEvent[]>);

    return Object.entries(grouped)
      .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
      .map(([date, events]) => ({
        date: new Date(date),
        events: events.sort((a, b) => b.date.getTime() - a.date.getTime()),
      }));
  };

  const groupedEvents = groupEventsByDate(events);
  const totalPages = Math.ceil(groupedEvents.length / itemsPerPage);
  const paginatedGroups = groupedEvents.slice(
    (listPage - 1) * itemsPerPage,
    listPage * itemsPerPage
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Calendar</h1>
          <p className="text-gray-500">View payout schedules and events</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePreviousMonth}
                    className="p-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-600" />
                  </button>
                  <h2 className="text-xl font-bold text-gray-900">
                    {format(currentDate, 'MMMM yyyy')}
                  </h2>
                  <button
                    onClick={handleNextMonth}
                    className="p-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
                <button
                  onClick={handleToday}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors text-sm font-semibold"
                >
                  Today
                </button>
              </div>

              <div className="inline-flex items-center gap-2 bg-gray-50 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    viewMode === 'month'
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    viewMode === 'week'
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    viewMode === 'list'
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  List
                </button>
              </div>
            </div>

            {viewMode === 'month' && (
              <div className="p-6">
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-center text-sm font-semibold text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, index) => {
                    const dayEvents = getEventsForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, new Date());

                    return (
                      <button
                        key={index}
                        onClick={() => setSelectedDate(day)}
                        className={`
                          min-h-[80px] p-2 rounded-xl text-left transition-all
                          ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                          ${isSelected ? 'ring-2 ring-gray-900 bg-gray-50' : 'hover:bg-gray-50'}
                          ${isToday && !isSelected ? 'ring-2 ring-blue-500' : ''}
                        `}
                      >
                        <div className={`text-sm font-semibold mb-1 ${
                          isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className={`w-2 h-2 rounded-full ${getEventTypeColor(event.type)}`}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-gray-500 font-medium">
                              +{dayEvents.length - 3}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'week' && (
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={handlePreviousWeek}
                      className="p-2 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <h3 className="text-lg font-bold text-gray-900">
                      {format(startOfWeek(selectedDate || currentDate), 'MMMM d, yyyy')} - {format(endOfWeek(selectedDate || currentDate), 'MMMM d, yyyy')}
                    </h3>
                    <button
                      onClick={handleNextWeek}
                      className="p-2 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <ChevronRight className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {eachDayOfInterval({
                      start: startOfWeek(selectedDate || currentDate),
                      end: endOfWeek(selectedDate || currentDate),
                    }).map((day) => {
                      const dayEvents = getEventsForDate(day);
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, new Date());

                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => setSelectedDate(day)}
                          className={`
                            p-3 rounded-xl text-center transition-all
                            ${isSelected ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}
                            ${isToday && !isSelected ? 'ring-2 ring-blue-500' : ''}
                          `}
                        >
                          <div className={`text-xs font-medium mb-1 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                            {format(day, 'EEE')}
                          </div>
                          <div className={`text-2xl font-bold mb-2 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                            {format(day, 'd')}
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            {dayEvents.slice(0, 3).map((event) => (
                              <div
                                key={event.id}
                                className={`w-1.5 h-1.5 rounded-full ${getEventTypeColor(event.type)}`}
                              />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {format(selectedDate || currentDate, 'EEEE, MMMM d, yyyy')}
                    </h3>
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold">
                      {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {selectedDateEvents.length > 0 ? (
                    <div className="space-y-3">
                      {selectedDateEvents.map((event) => {
                        const config = eventTypeConfig[event.type];
                        const Icon = config.icon;
                        return (
                          <div
                            key={event.id}
                            className={`p-4 rounded-xl ${config.bgColor} border ${config.borderColor} hover:shadow-sm transition-shadow`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0`}>
                                <Icon className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h4 className="text-sm font-bold text-gray-900">
                                    {event.amount ? `₦${event.amount.toLocaleString()}` : event.title}
                                  </h4>
                                  <span className="text-xs text-gray-500 flex-shrink-0">
                                    {format(event.date, 'h:mm a')}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">{event.description}</p>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${config.textColor} bg-white`}>
                                    {config.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                        <CalendarIcon className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm">No events on this day</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {viewMode === 'list' && (
              <>
                <div className="divide-y divide-gray-100">
                  {paginatedGroups.length > 0 ? (
                    paginatedGroups.map((group) => (
                      <div key={group.date.toISOString()} className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-gray-900">
                            {format(group.date, 'MMMM d, yyyy')}
                          </h3>
                          <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold">
                            {group.events.length} event{group.events.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {group.events.map((event) => {
                            const config = eventTypeConfig[event.type];
                            const Icon = config.icon;
                            return (
                              <div
                                key={event.id}
                                className={`p-4 rounded-xl ${config.bgColor} border ${config.borderColor} hover:shadow-sm transition-shadow`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center flex-shrink-0`}>
                                    <Icon className="h-5 w-5 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <h4 className="text-sm font-bold text-gray-900">
                                        {event.amount ? `₦${event.amount.toLocaleString()}` : event.title}
                                      </h4>
                                      <span className="text-xs text-gray-500 flex-shrink-0">
                                        {format(event.date, 'h:mm a')}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-1">{event.description}</p>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${config.textColor} bg-white`}>
                                        {config.label}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                        <CalendarIcon className="h-7 w-7 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No events found</p>
                      <p className="text-gray-400 text-sm mt-1">There are no payout events for this period</p>
                    </div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="p-6 border-t border-gray-100">
                    <div className="flex items-center justify-between">
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
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="lg:w-96">
          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden sticky top-6">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
              </h3>
              {selectedDateEvents.length > 0 && (
                <p className="text-sm text-blue-600 font-medium">
                  {selectedDateEvents.length} event{selectedDateEvents.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {selectedDateEvents.length > 0 ? (
                selectedDateEvents.map((event) => {
                  const config = eventTypeConfig[event.type];
                  const Icon = config.icon;
                  return (
                    <div key={event.id} className={`p-5 ${config.bgColor} border-l-4 ${config.color.replace('bg-', 'border-')}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl ${config.color} flex items-center justify-center`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-bold ${config.textColor} mb-1`}>
                            {config.label}
                          </h4>
                          <p className="text-sm text-gray-900 font-medium mb-1">{event.title}</p>
                          <p className="text-xs text-gray-600 mb-2">{event.description}</p>
                          {event.amount && (
                            <p className="text-sm font-bold text-gray-900">₦{event.amount.toLocaleString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                    <CalendarIcon className="h-7 w-7 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No events</p>
                  <p className="text-gray-400 text-sm mt-1">No events scheduled for this date</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 mt-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">Event Types</h3>
            <div className="space-y-3">
              {Object.entries(eventTypeConfig).map(([type, config]) => (
                <div key={type} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${config.color}`} />
                  <span className="text-sm text-gray-600">{config.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
