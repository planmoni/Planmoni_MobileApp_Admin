import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfDay,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  addDays,
  subDays,
  isToday,
  isBefore,
  isAfter,
  isWithinInterval,
} from 'date-fns';

type DateRangePickerProps = {
  startDate: Date | null;
  endDate: Date | null;
  /** called with the chosen days, or with nulls when the range is cleared */
  onChange: (startDate: Date | null, endDate: Date | null) => void;
  placeholder?: string;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  /** highlight the trigger, e.g. when this range is the active filter */
  active?: boolean;
};

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = 'Select date range',
  className = '',
  minDate,
  maxDate,
  disabled = false,
  active = false,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(startDate || new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(endDate);
  const containerRef = useRef<HTMLDivElement>(null);

  const closeAndReset = () => {
    setIsOpen(false);
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setSelectingStart(true);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeAndReset();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleDateSelect = (date: Date) => {
    if (selectingStart) {
      setTempStartDate(date);
      setTempEndDate(null);
      setSelectingStart(false);
    } else {
      if (tempStartDate && isBefore(date, tempStartDate)) {
        setTempStartDate(date);
        setTempEndDate(tempStartDate);
      } else {
        setTempEndDate(date);
      }
      setSelectingStart(true);
    }
  };

  const handleApply = () => {
    if (tempStartDate && tempEndDate) {
      onChange(tempStartDate, tempEndDate);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setTempStartDate(null);
    setTempEndDate(null);
    setSelectingStart(true);
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return false;
  };

  const isDateInRange = (date: Date) => {
    if (!tempStartDate || !tempEndDate) return false;
    return isWithinInterval(date, { start: tempStartDate, end: tempEndDate });
  };

  const isDateSelected = (date: Date) =>
    (!!tempStartDate && isSameDay(date, tempStartDate)) || (!!tempEndDate && isSameDay(date, tempEndDate));

  const hasRange = !!startDate && !!endDate;
  const triggerLabel = hasRange
    ? `${format(startDate!, 'MMM d')} – ${format(endDate!, 'MMM d, yyyy')}`
    : placeholder;

  // six Monday-first weeks
  const getCalendarDays = () => {
    const first = startOfMonth(currentMonth);
    const offset = (first.getDay() + 6) % 7;
    const start = subDays(first, offset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  };

  const today = startOfDay(new Date());
  const quickSelects = [
    { label: 'Today', getValue: () => ({ start: today, end: today }) },
    { label: 'Last 7 days', getValue: () => ({ start: subDays(today, 6), end: today }) },
    { label: 'Last 30 days', getValue: () => ({ start: subDays(today, 29), end: today }) },
    { label: 'Last 90 days', getValue: () => ({ start: subDays(today, 89), end: today }) },
    { label: 'This month', getValue: () => ({ start: startOfMonth(today), end: endOfMonth(today) }) },
  ];

  const handleQuickSelect = (getValue: () => { start: Date; end: Date }) => {
    const { start, end } = getValue();
    setTempStartDate(start);
    setTempEndDate(end);
    setCurrentMonth(start);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`inline-flex items-center rounded-xl border text-sm font-medium transition-all duration-200 ${
          active || hasRange
            ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            if (isOpen) closeAndReset();
            else setIsOpen(true);
          }}
          disabled={disabled}
          className="inline-flex items-center px-4 py-2 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 rounded-xl"
        >
          <Calendar className="h-4 w-4 mr-2" />
          {triggerLabel}
        </button>
        {hasRange && (
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="mr-2 p-1 rounded-lg hover:bg-white/20 transition-colors"
            title="Clear dates"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-2 right-0 bg-white border border-gray-100 rounded-2xl shadow-large w-[22rem] max-w-[calc(100vw-2rem)]">
          <div className="flex">
            <div className="w-28 border-r border-gray-100 p-3 shrink-0">
              <h4 className="text-xs font-medium text-gray-500 mb-2">Quick select</h4>
              <div className="space-y-1">
                {quickSelects.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => handleQuickSelect(option.getValue)}
                    className="w-full text-left text-xs px-2 py-1.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-3 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <h3 className="text-sm font-semibold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h3>
                <button
                  type="button"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
              </div>

              <p className="mb-2 text-center text-xs text-gray-500 h-4">
                {tempStartDate && tempEndDate
                  ? `${format(tempStartDate, 'MMM d')} – ${format(tempEndDate, 'MMM d, yyyy')}`
                  : selectingStart
                    ? 'Select start date'
                    : 'Select end date'}
              </p>

              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5 mb-3 place-items-center">
                {getCalendarDays().map((date) => {
                  const inMonth = isSameMonth(date, currentMonth);
                  const selected = isDateSelected(date);
                  const inRange = isDateInRange(date);
                  const isDisabled = isDateDisabled(date);

                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={() => !isDisabled && handleDateSelect(date)}
                      disabled={isDisabled}
                      className={`w-8 h-8 text-xs rounded-full transition-colors ${
                        selected
                          ? 'bg-gray-900 text-white'
                          : inRange
                            ? 'bg-gray-100 text-gray-900'
                            : isToday(date)
                              ? 'border border-gray-300 text-gray-900 font-semibold'
                              : inMonth
                                ? 'text-gray-900 hover:bg-gray-100'
                                : 'text-gray-300 hover:bg-gray-50'
                      } ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {format(date, 'd')}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Clear
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeAndReset}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={!tempStartDate || !tempEndDate}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
