import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type StatCardProps = {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: number;
  className?: string;
};

export default function StatCard({ title, value, icon, trend = 0, className = '' }: StatCardProps) {
  const formatTrendValue = (trendValue: number) => {
    if (Math.abs(trendValue) >= 1000000) {
      return `${(trendValue / 1000000).toFixed(1)}M`;
    } else if (Math.abs(trendValue) >= 1000) {
      return `${(trendValue / 1000).toFixed(1)}K`;
    }
    return trendValue.toString();
  };

  return (
    <div className={`relative bg-white rounded-2xl p-6 shadow-soft hover:shadow-medium transition-all duration-300 border border-gray-100 ${className}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
          {icon}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
          trend > 0 ? 'bg-green-50' : trend < 0 ? 'bg-red-50' : 'bg-gray-50'
        }`}>
          {trend > 0 ? (
            <TrendingUp size={14} className="text-green-600" />
          ) : trend < 0 ? (
            <TrendingDown size={14} className="text-red-600" />
          ) : (
            <Minus size={14} className="text-gray-400" />
          )}
          <span className={`text-xs font-semibold ${
            trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-400'
          }`}>
            {trend > 0 ? '+' : ''}{formatTrendValue(trend)}
          </span>
        </div>
        <span className="text-xs text-gray-400">vs last month</span>
      </div>
    </div>
  );
}
