import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ActivityRow from '@/components/ActivityRow';
import { useTodayActivity } from '@/hooks/queries/useActivityList';
import { countFacets, pickHighlights } from '@/lib/activityView';

const SHOWN = 6;

/** The dashboard's "Today's Activities": the notable things that happened since midnight. */
export default function TodaysActivities() {
  const { data, isLoading, error } = useTodayActivity();

  const rows = useMemo(() => pickHighlights(data?.rows ?? [], SHOWN), [data?.rows]);
  const total = data?.total ?? 0;
  const signups = countFacets(data?.facets ?? [], { kind: 'signup' });
  const kyc = countFacets(data?.facets ?? [], { kind: 'kyc_submitted' });
  const plans = countFacets(data?.facets ?? [], { kind: 'payout_plan_created' });

  const summary = [
    signups ? `${signups.toLocaleString()} new ${signups === 1 ? 'sign-up' : 'sign-ups'}` : null,
    kyc ? `${kyc.toLocaleString()} KYC ${kyc === 1 ? 'submission' : 'submissions'}` : null,
    plans ? `${plans.toLocaleString()} new ${plans === 1 ? 'plan' : 'plans'}` : null,
  ].filter(Boolean);

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
        </div>
      ) : error && !data ? (
        <div className="text-center py-8 px-4">
          <p className="text-sm text-gray-900">Could not load today's activity</p>
          <p className="text-xs text-gray-500 mt-1">{(error as Error).message}</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center py-8 text-gray-500 text-sm">Nothing has happened yet today</p>
      ) : (
        <>
          {summary.length > 0 && (
            <p className="px-4 md:px-5 pt-3 pb-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
              {summary.join(' · ')}
            </p>
          )}
          <div className="divide-y divide-gray-100">
            {rows.map((row) => (
              <ActivityRow key={row.id} item={row} compact />
            ))}
          </div>
        </>
      )}
      <div className="border-t border-gray-100 p-3 md:p-4 text-center bg-gray-50">
        <Link
          to="/activity"
          className="text-primary hover:text-primary-light text-xs md:text-sm font-medium transition-colors"
        >
          {total > rows.length ? `View all ${total.toLocaleString()} activities today` : 'View All Activities'}
        </Link>
      </div>
    </div>
  );
}
