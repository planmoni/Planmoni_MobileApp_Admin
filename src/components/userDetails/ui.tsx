import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export const naira = (n: number | null | undefined) => `₦${(Number(n) || 0).toLocaleString()}`;

/** White card with a small header, used for every block on the user profile. */
export function Panel({
  title,
  subtitle,
  action,
  children,
  flush = false,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  /** no inner padding (for lists that draw their own dividers) */
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 border-b border-gray-100">
          <div className="min-w-0">
            {title && <h2 className="text-sm md:text-base font-semibold text-gray-900">{title}</h2>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={flush ? '' : 'p-4 md:p-5'}>{children}</div>
    </section>
  );
}

/** Small label over a modest value. */
export function Field({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-0.5 text-sm font-medium text-gray-900 break-words ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </p>
    </div>
  );
}

const STATUS: Record<string, string> = {
  active: 'bg-gray-900 text-white',
  funded: 'bg-gray-900 text-white',
  paused: 'bg-warning-light text-amber-800',
  pending: 'bg-warning-light text-amber-800',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-white text-gray-500 border border-gray-300',
  failed: 'bg-error-light text-red-700',
};

export function StatusPill({ status }: { status?: string | null }) {
  const s = (status || 'unknown').toLowerCase();
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium whitespace-nowrap ${
        STATUS[s] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="py-10 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export function titleCase(s?: string | null) {
  if (!s) return '';
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
