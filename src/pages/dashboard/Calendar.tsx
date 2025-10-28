import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, XCircle, Calendar as CalendarIcon, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
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
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const getEventTypeColor = (type: EventType) => {
    return eventTypeConfig[type]?.color || 'bg-gray-500';
  };

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

            {viewMode === 'list' && (
              <div className="divide-y divide-gray-100">
                {events.length > 0 ? (
                  events.map((event) => {
                    const config = eventTypeConfig[event.type];
                    const Icon = config.icon;
                    return (
                      <div key={event.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                            <Icon className={`h-5 w-5 ${config.textColor}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-base font-semibold text-gray-900">{event.title}</h3>
                              <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${config.bgColor} ${config.textColor} border ${config.borderColor}`}>
                                {config.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>{format(event.date, 'MMM d, yyyy')}</span>
                              {event.amount && <span>₦{event.amount.toLocaleString()}</span>}
                              {event.user_name && <span>{event.user_name}</span>}
                            </div>
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
                    <p className="text-gray-500 font-medium">No events found</p>
                    <p className="text-gray-400 text-sm mt-1">There are no payout events for this period</p>
                  </div>
                )}
              </div>
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
