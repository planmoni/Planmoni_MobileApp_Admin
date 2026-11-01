import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';

export type StatDelta = { tone: 'up' | 'down' | 'flat'; text: string };

/** Today vs yesterday as a short label: "+12", "-₦4,000" or flat. */
export function compareDays(today: number, yesterday: number, format?: (n: number) => string): StatDelta {
  const diff = (Number(today) || 0) - (Number(yesterday) || 0);
  if (diff === 0) return { tone: 'flat', text: 'Same as yesterday' };
  const abs = Math.abs(diff);
  const shown = format ? format(abs) : abs.toLocaleString();
  return { tone: diff > 0 ? 'up' : 'down', text: `${diff > 0 ? '+' : '-'}${shown}` };
}

const deltaStyle = {
  up: { cls: 'bg-green-50 text-green-700', Icon: TrendingUp },
  down: { cls: 'bg-red-50 text-red-700', Icon: TrendingDown },
  flat: { cls: '', Icon: Minus },
} as const;

/**
 * Compact dashboard stat tile: icon chip on the left, small label, a modest bold value, and a
 * today-vs-yesterday pill. Meant to be scanned quickly, so the value is semibold at text-base/lg, not a hero number.
 */
export default function StatCard({
  to,
  state,
  icon: Icon,
  label,
  value,
  delta,
  children,
}: {
  to: string;
  state?: unknown;
  icon: LucideIcon;
  label: string;
  value?: ReactNode;
  delta?: StatDelta;
  /** replaces the value / delta (used by tiles with their own content, e.g. the countdown) */
  children?: ReactNode;
}) {
  return (
    <Link
      to={to}
      state={state}
      className="group flex items-start gap-3 bg-white rounded-2xl p-3.5 md:p-4 shadow-soft border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all min-w-0"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gray-50 text-gray-600 group-hover:bg-gray-100 flex items-center justify-center transition-colors">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        {children ?? (
          <>
            <p className="mt-0.5 text-base md:text-2xl font-semibold text-gray-900 break-words leading-snug">
              {value}
            </p>
            {delta &&
              (delta.tone === 'flat' ? (
                <p className="mt-1.5 text-[11px] text-gray-400">{delta.text}</p>
              ) : (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-gray-400">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${deltaStyle[delta.tone].cls}`}
                  >
                    {(() => {
                      const D = deltaStyle[delta.tone].Icon;
                      return <D className="h-3 w-3" />;
                    })()}
                    {delta.text}
                  </span>
                  vs yesterday
                </p>
              ))}
          </>
        )}
      </div>
    </Link>
  );
}
