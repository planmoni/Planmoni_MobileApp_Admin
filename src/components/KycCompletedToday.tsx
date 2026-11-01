import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { TierBadge } from '@/components/KycBadges';
import { TierIcon } from '@/components/TierIcon';
import { useKycCompletedToday } from '@/hooks/queries/useKycData';

/** Dashboard card: KYC tiers completed since midnight, per tier, with the latest completions. */
export default function KycCompletedToday({ enabled = true }: { enabled?: boolean }) {
  const { data, isLoading, error } = useKycCompletedToday(6, enabled);

  const total = data?.total ?? 0;
  const tiers = [
    { tier: 1 as const, count: data?.tier1 ?? 0 },
    { tier: 2 as const, count: data?.tier2 ?? 0 },
    { tier: 3 as const, count: data?.tier3 ?? 0 },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 md:px-6 py-4 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-900">KYC Completed</h3>
          <p className="text-xs text-gray-500">Tiers completed today</p>
        </div>
        <p className="text-xl font-semibold text-gray-900">{isLoading ? '...' : total.toLocaleString()}</p>
      </div>

      {error && !data ? (
        <div className="px-6 py-6 text-sm">
          <p className="text-gray-900">Could not load today's KYC completions</p>
          <p className="mt-1 text-xs text-gray-500 break-words">{(error as Error).message}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            {tiers.map(({ tier, count }) => (
              <Link
                key={tier}
                to={`/kyc-data?tier=${tier}`}
                className="flex items-center gap-2.5 px-3 md:px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <TierIcon tier={tier} className="h-7 w-7 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-base md:text-lg font-semibold leading-tight text-gray-900 tabular-nums">
                    {isLoading ? '...' : count.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Tier {tier}</p>
                </div>
              </Link>
            ))}
          </div>

          {isLoading ? (
            <p className="px-6 py-6 text-sm text-gray-500">Loading...</p>
          ) : !data || data.rows.length === 0 ? (
            <p className="px-6 py-6 text-sm text-gray-500">No one has completed a KYC tier yet today.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {data.rows.map((row) => {
                const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || 'Unknown user';
                return (
                  <li key={`${row.user_id}-${row.tier}`}>
                    <Link
                      to={`/users/${row.user_id}`}
                      className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white">
                          <span className="text-xs font-semibold">
                            {(row.first_name?.[0] ?? name[0] ?? '?').toUpperCase()}
                            {row.last_name?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {row.email ? `${row.email} · ` : ''}
                            {format(new Date(row.completed_at), 'h:mm a')}
                          </p>
                        </div>
                      </div>
                      <TierBadge tier={row.tier} size="sm" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-gray-100 p-3 md:p-4 text-center bg-gray-50">
            <Link
              to="/kyc-data"
              className="text-primary hover:text-primary-light text-xs md:text-sm font-medium transition-colors"
            >
              {total > (data?.rows.length ?? 0) ? `View all KYC data (${total.toLocaleString()} today)` : 'View KYC data'}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
