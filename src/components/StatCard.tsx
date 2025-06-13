import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Card from './Card';

type StatCardProps = {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: number;
  className?: string;
};

export default function StatCard({ title, value, icon, trend = 0, className = '' }: StatCardProps) {
  return (
    <Card className={`flex flex-col items-center p-4 ${className}`}>
      <div className="flex justify-between items-center w-full mb-2">
        <span className="text-text-secondary dark:text-text-secondary text-sm">{title}</span>
        <div className="w-10 h-10 rounded-full bg-background-tertiary dark:bg-background-tertiary flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-text dark:text-text self-start">{value}</div>
      {trend !== 0 && (
        <div className="flex items-center text-xs mt-2 self-start">
          {trend > 0 ? (
            <>
              <TrendingUp className="h-3 w-3 mr-1 text-success dark:text-success" />
              <span className="text-success dark:text-success">+{trend}% vs last month</span>
            </>
          ) : (
            <>
              <TrendingDown className="h-3 w-3 mr-1 text-error dark:text-error" />
              <span className="text-error dark:text-error">{trend}% vs last month</span>
            </>
          )}
        </div>
      )}
    </Card>
  );
}