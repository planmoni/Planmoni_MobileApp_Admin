import { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Card from './Card';

type StatCardProps = {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: number;
  className?: string;
};

export default function StatCard({ title, value, icon, trend = 0, className = '' }: StatCardProps) {
  const { colors } = useTheme();

  // Helper function to format trend value for display
  const formatTrendValue = (trendValue: number) => {
    // For currency values (large numbers), format with K/M suffixes
    if (Math.abs(trendValue) >= 1000000) {
      return `${(trendValue / 1000000).toFixed(1)}M`;
    } else if (Math.abs(trendValue) >= 1000) {
      return `${(trendValue / 1000).toFixed(1)}K`;
    }
    return trendValue.toString();
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-text-secondary dark:text-text-secondary font-medium">{title}</p>
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: colors?.backgroundTertiary || '#f3f4f6' }}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-text dark:text-text mb-2">{value}</p>
      
      <div className="flex items-center gap-1">
        {trend > 0 ? (
          <TrendingUp size={16} color="#22C55E" />
        ) : trend < 0 ? (
          <TrendingDown size={16} color="#EF4444" />
        ) : (
          <Minus size={16} color="#94A3B8" />
        )}
        <span 
          className="text-xs font-semibold"
          style={{ 
            color: trend > 0 ? '#22C55E' : trend < 0 ? '#EF4444' : '#94A3B8'
          }}
        >
          {trend > 0 ? '+' : ''}{formatTrendValue(trend)}
        </span>
        <span className="text-xs text-text-tertiary dark:text-text-tertiary">vs last month</span>
      </div>
    </Card>
  );
}