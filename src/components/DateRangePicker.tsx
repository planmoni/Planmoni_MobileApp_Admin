import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isBefore, isAfter, isWithinInterval } from 'date-fns';

type DateRangePickerProps = {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (startDate: Date, endDate: Date) => void;
  placeholder?: string;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
};

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = 'Select date range',
  className = '',
  minDate,
  maxDate,
  disabled = false
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(startDate || new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(endDate);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset temp dates if not applied
        setTempStartDate(startDate);
        setTempEndDate(endDate);
        setSelectingStart(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [startDate, endDate]);

  const handleDateSelect = (date: Date) => {
    if (selectingStart) {
      setTempStartDate(date);
      setTempEndDate(null);
      setSelectingStart(false);
    } else {
      if (tempStartDate && isBefore(date, tempStartDate)) {
        // If end date is before start date, swap them
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

  const handleCancel = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setSelectingStart(true);
    setIsOpen(false);
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

  const isDateSelected = (date: Date) => {
    if (tempStartDate && isSameDay(date, tempStartDate)) return true;
    if (tempEndDate && isSameDay(date, tempEndDate)) return true;
    return false;
  };

  const formatDisplayRange = () => {
    if (!startDate || !endDate) return placeholder;
    return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
  };

  const getCalendarDays = () => {
    const firstDay = startOfMonth(currentMonth);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Quick select options
  const quickSelects = [
    {
      label: 'Today',
      getValue: () => {
        const today = new Date();
        return { start: today, end: today };
      }
    },
    {
      label: 'Last 7 days',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 6);
        return { start, end };
      }
    },
    {
      label: 'Last 30 days',
      getValue: () => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 29);
        return { start, end };
      }
    },
    {
      label: 'This month',
      getValue: () => {
        const today = new Date();
        return { 
          start: startOfMonth(today), 
          end: endOfMonth(today) 
        };
      }
    }
  ];

  const handleQuickSelect = (getValue: () => { start: Date; end: Date }) => {
    const { start, end } = getValue();
    setTempStartDate(start);
    setTempEndDate(end);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          inline-flex items-center justify-between w-full px-4 py-2 text-left
          border border-border dark:border-border rounded-md
          bg-white dark:bg-background-tertiary
          text-text dark:text-text
          hover:bg-background-tertiary dark:hover:bg-background-secondary
          focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light
          transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-text-secondary dark:text-text-secondary" />
          <span className={startDate && endDate ? 'text-text dark:text-text' : 'text-text-secondary dark:text-text-secondary'}>
            {formatDisplayRange()}
          </span>
        </div>
        {startDate && endDate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null as any, null as any);
            }}
            className="ml-2 p-1 hover:bg-background-secondary dark:hover:bg-background-tertiary rounded"
          >
            <X className="h-4 w-4 text-text-secondary dark:text-text-secondary" />
          </button>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white dark:bg-surface border border-border dark:border-border rounded-lg shadow-lg w-96">
          <div className="flex">
            {/* Quick Select Sidebar */}
            <div className="w-32 border-r border-border dark:border-border p-3">
              <h4 className="text-xs font-medium text-text-secondary dark:text-text-secondary mb-2 uppercase tracking-wide">
                Quick Select
              </h4>
              <div className="space-y-1">
                {quickSelects.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => handleQuickSelect(option.getValue)}
                    className="w-full text-left text-xs px-2 py-1 rounded text-text dark:text-text hover:bg-background-tertiary dark:hover:bg-background-tertiary transition-colors"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar */}
            <div className="flex-1 p-4">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-background-tertiary dark:hover:bg-background-tertiary rounded-full transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-text-secondary dark:text-text-secondary" />
                </button>
                
                <h3 className="text-lg font-semibold text-text dark:text-text">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
                
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-background-tertiary dark:hover:bg-background-tertiary rounded-full transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-text-secondary dark:text-text-secondary" />
                </button>
              </div>

              {/* Selection Status */}
              <div className="mb-4 text-center">
                <p className="text-sm text-text-secondary dark:text-text-secondary">
                  {selectingStart ? 'Select start date' : 'Select end date'}
                </p>
                {tempStartDate && tempEndDate && (
                  <p className="text-sm text-primary dark:text-primary-light mt-1">
                    {format(tempStartDate, 'MMM d')} - {format(tempEndDate, 'MMM d, yyyy')}
                  </p>
                )}
              </div>

              {/* Days of Week */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-text-secondary dark:text-text-secondary py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1 mb-4">
                {getCalendarDays().map((date, index) => {
                  const isCurrentMonth = isSameMonth(date, currentMonth);
                  const isSelected = isDateSelected(date);
                  const isInRange = isDateInRange(date);
                  const isTodayDate = isToday(date);
                  const isDisabled = isDateDisabled(date);

                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => !isDisabled && handleDateSelect(date)}
                      disabled={isDisabled}
                      className={`
                        w-8 h-8 text-sm rounded-full transition-colors relative
                        ${!isCurrentMonth 
                          ? 'text-text-tertiary dark:text-text-tertiary' 
                          : 'text-text dark:text-text'
                        }
                        ${isSelected 
                          ? 'bg-primary text-white' 
                          : isInRange
                            ? 'bg-primary/20 text-primary dark:text-primary-light'
                            : isTodayDate 
                              ? 'bg-primary/10 text-primary dark:text-primary-light font-semibold'
                              : 'hover:bg-background-tertiary dark:hover:bg-background-tertiary'
                        }
                        ${isDisabled 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'cursor-pointer'
                        }
                      `}
                    >
                      {format(date, 'd')}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-sm text-text-secondary dark:text-text-secondary hover:text-text dark:hover:text-text"
                >
                  Clear
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1 text-sm text-text-secondary dark:text-text-secondary hover:text-text dark:hover:text-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    disabled={!tempStartDate || !tempEndDate}
                    className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
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