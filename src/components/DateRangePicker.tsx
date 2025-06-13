import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';

type DateRangePickerProps = {
  onChange: (startDate: Date, endDate: Date) => void;
  startDate: Date | null;
  endDate: Date | null;
  className?: string;
  placeholder?: string;
};

export default function DateRangePicker({ onChange, startDate, endDate, className = '', placeholder }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDateRange = () => {
    if (!startDate || !endDate) return placeholder || 'Select date range';
    return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-4 py-2 border border-border dark:border-border rounded-md bg-white dark:bg-surface text-primary dark:text-primary-light hover:bg-background-tertiary dark:hover:bg-background-tertiary focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-light"
      >
        <Calendar className="h-5 w-5 mr-2" />
        {formatDateRange()}
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 bg-white dark:bg-surface border border-border dark:border-border rounded-lg shadow-lg p-4 w-72">
          <div className="text-center mb-4">
            <h3 className="text-sm font-medium text-text dark:text-text">Select Date Range</h3>
          </div>
          
          {/* Date picker UI would go here */}
          <div className="text-center text-text-secondary dark:text-text-secondary">
            Date picker component would be implemented here
          </div>
          
          <div className="flex justify-between mt-4">
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-sm text-text-secondary dark:text-text-secondary hover:text-text dark:hover:text-text"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // For demo purposes, set a default date range
                const today = new Date();
                const lastMonth = new Date();
                lastMonth.setMonth(lastMonth.getMonth() - 1);
                
                onChange(lastMonth, today);
                setIsOpen(false);
              }}
              className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary-dark"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}