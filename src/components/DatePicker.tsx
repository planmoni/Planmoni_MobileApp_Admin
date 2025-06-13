import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, isBefore, isAfter } from 'date-fns';

type DatePickerProps = {
  selected?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
};

export default function DatePicker({
  selected,
  onChange,
  placeholder = 'Select date',
  className = '',
  minDate,
  maxDate,
  disabled = false
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(selected || new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDateSelect = (date: Date) => {
    onChange(date);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return false;
  };

  const formatDisplayDate = () => {
    if (!selected) return placeholder;
    return format(selected, 'MMM d, yyyy');
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };

  const getCalendarDays = () => {
    const daysInMonth = getDaysInMonth();
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
          <span className={selected ? 'text-text dark:text-text' : 'text-text-secondary dark:text-text-secondary'}>
            {formatDisplayDate()}
          </span>
        </div>
        {selected && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-2 p-1 hover:bg-background-secondary dark:hover:bg-background-tertiary rounded"
          >
            <X className="h-4 w-4 text-text-secondary dark:text-text-secondary" />
          </button>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white dark:bg-surface border border-border dark:border-border rounded-lg shadow-lg p-4 w-80">
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

          {/* Days of Week */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-text-secondary dark:text-text-secondary py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {getCalendarDays().map((date, index) => {
              const isCurrentMonth = isSameMonth(date, currentMonth);
              const isSelected = selected && isSameDay(date, selected);
              const isTodayDate = isToday(date);
              const isDisabled = isDateDisabled(date);

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => !isDisabled && handleDateSelect(date)}
                  disabled={isDisabled}
                  className={`
                    w-10 h-10 text-sm rounded-full transition-colors
                    ${!isCurrentMonth 
                      ? 'text-text-tertiary dark:text-text-tertiary' 
                      : 'text-text dark:text-text'
                    }
                    ${isSelected 
                      ? 'bg-primary text-white' 
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
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-border dark:border-border">
            <button
              type="button"
              onClick={() => handleDateSelect(new Date())}
              className="text-sm text-primary dark:text-primary-light hover:underline"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-text-secondary dark:text-text-secondary hover:text-text dark:hover:text-text"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}