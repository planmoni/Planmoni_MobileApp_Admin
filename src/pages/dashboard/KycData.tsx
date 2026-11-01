import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  CheckCircle,
  Circle,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  KYC_PAGE_SIZE,
  useKycData,
  useKycTierStats,
  type KycListRow,
  type KycReviewStatus,
  type KycTier,
} from '@/hooks/queries/useKycData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { usePermissions } from '@/contexts/PermissionsContext';
import { ReviewStatusBadge, TierBadge } from '@/components/KycBadges';
import { TierIcon } from '@/components/TierIcon';
import KycReviewDrawer from '@/components/KycReviewDrawer';

type Tab = 'all' | 'review';
type ReviewFilter = KycReviewStatus | 'none' | 'all';

const parseTier = (value: string | null): KycTier | null => {
  if (value === '0' || value === '1' || value === '2' || value === '3') return Number(value) as KycTier;
  return null;
};

const checklistFor = (row: KycListRow) => [
  { label: 'Liveness', done: row.liveness_done },
  { label: 'BVN', done: row.bvn_verified },
  { label: 'ID match', done: row.id_face_verified },
  { label: 'Docs', done: row.documents_verified },
  { label: 'Address', done: row.address_completed },
  { label: 'Utility bill', done: row.utility_bill_verified },
];

function Checklist({ row }: { row: KycListRow }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {checklistFor(row).map((item) => (
        <span
          key={item.label}
          className={`inline-flex items-center gap-1 text-xs ${item.done ? 'text-gray-900' : 'text-gray-400'}`}
        >
          {item.done ? <CheckCircle className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default function KycData() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const refreshData = useRefreshData();

  const tab: Tab = searchParams.get('tab') === 'review' ? 'review' : 'all';
  const tierFilter = parseTier(searchParams.get('tier'));
  const statusParam = searchParams.get('status');
  const reviewFilter: ReviewFilter =
    statusParam === 'pending' || statusParam === 'approved' || statusParam === 'rejected' || statusParam === 'none'
      ? statusParam
      : 'all';
  const openUserId = searchParams.get('review');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const canReview = isSuperAdmin || hasPermission('kyc', 'approve') || hasPermission('kyc', 'reject');

  // Debounce the search box
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(changes).forEach(([key, value]) => {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          });
          return next;
        },
        { replace: true }
      );
      setPage(0);
    },
    [setSearchParams]
  );

  const effectiveReviewStatus: KycReviewStatus | 'none' | null =
    tab === 'review' ? 'pending' : reviewFilter === 'all' ? null : reviewFilter;

  const { data, isLoading, isFetching, error } = useKycData({
    search,
    tier: tierFilter,
    reviewStatus: effectiveReviewStatus,
    page,
  });
  const { data: stats } = useKycTierStats();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / KYC_PAGE_SIZE));
  const hasFilters = !!search || tierFilter !== null || (tab === 'all' && reviewFilter !== 'all');

  const handleRefresh = () => {
    refreshData.mutate(['kyc-data', 'kyc-tier-stats', 'kyc-tier3-queue']);
  };

  const openDrawer = (userId: string) => updateParamsKeepPage({ review: userId });
  const closeDrawer = () => updateParamsKeepPage({ review: null });

  // Opening/closing the drawer should not reset the list page
  function updateParamsKeepPage(changes: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        });
        return next;
      },
      { replace: true }
    );
  }

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    updateParams({ tier: null, status: null });
  };

  const tierCards: Array<{ tier: KycTier; label: string; value: number; description: string }> = [
    { tier: 1, label: 'Tier 1', value: stats?.tier1 ?? 0, description: 'BVN, liveness and ID match' },
    { tier: 2, label: 'Tier 2', value: stats?.tier2 ?? 0, description: 'Personal info and ID documents' },
    { tier: 3, label: 'Tier 3', value: stats?.tier3 ?? 0, description: 'Proof of address (manual review)' },
  ];

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-1">KYC Data</h1>
          <p className="text-gray-500">Verification tiers, submitted documents and Tier 3 manual review</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
          aria-label="Refresh"
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending || isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tier stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {tierCards.map((card) => {
          const active = tab === 'all' && tierFilter === card.tier;
          return (
            <button
              key={card.tier}
              onClick={() => updateParams({ tab: null, tier: active ? null : String(card.tier) })}
              className={`text-left bg-white rounded-2xl p-5 shadow-soft border transition-colors ${
                active ? 'border-gray-900' : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.label}</p>
                  <p className="text-lg font-semibold text-gray-900">{card.value.toLocaleString()}</p>
                </div>
                <TierIcon tier={card.tier} className="h-11 w-11" />
              </div>
              <p className="text-xs text-gray-500">{card.description}</p>
            </button>
          );
        })}

        <button
          onClick={() => updateParams({ tab: 'review', tier: null, status: null })}
          className={`text-left bg-white rounded-2xl p-5 shadow-soft border transition-colors ${
            tab === 'review' ? 'border-gray-900' : 'border-gray-100 hover:border-gray-200'
          }`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Awaiting Tier 3 review</p>
              <p className="text-lg font-semibold text-gray-900">{(stats?.tier3_pending ?? 0).toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500">Submitted documents to verify</p>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {([
          { id: 'all', label: 'All submissions', count: stats?.total },
          { id: 'review', label: 'Tier 3 review', count: stats?.tier3_pending },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => updateParams({ tab: t.id === 'review' ? 'review' : null })}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  t.id === 'review' && t.count > 0 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {t.count.toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-soft border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone, BVN or NIN..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
            />
          </div>

          <select
            value={tierFilter === null ? 'all' : String(tierFilter)}
            onChange={(e) => updateParams({ tier: e.target.value === 'all' ? null : e.target.value })}
            className="px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            aria-label="Filter by tier"
          >
            <option value="all">All tiers</option>
            <option value="0">Unverified</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </select>

          {tab === 'all' && (
            <select
              value={reviewFilter}
              onChange={(e) => updateParams({ status: e.target.value === 'all' ? null : e.target.value })}
              className="px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              aria-label="Filter by Tier 3 status"
            >
              <option value="all">Any Tier 3 status</option>
              <option value="pending">Awaiting review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="none">Not submitted</option>
            </select>
          )}
        </div>

        {hasFilters && (
          <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
            <span>
              {total.toLocaleString()} result{total === 1 ? '' : 's'}
            </span>
            <button onClick={clearFilters} className="underline hover:text-gray-700">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        {error ? (
          <div className="text-center py-12">
            <p className="text-error mb-4">Failed to load KYC data</p>
            <p className="text-sm text-gray-500 mb-4">{(error as Error).message}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">
              {tab === 'review'
                ? 'No Tier 3 submissions are waiting for review'
                : hasFilters
                  ? 'No KYC data matches your filters'
                  : 'No KYC data available'}
            </p>
          </div>
        ) : (
          <>
            <div className={`hidden md:block overflow-x-auto transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['User', 'Tier', 'Verification', 'Tier 3', 'Submitted', ''].map((h) => (
                      <th
                        key={h || 'action'}
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => openDrawer(row.user_id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                            <span className="text-sm font-semibold">
                              {row.first_name?.[0]}
                              {row.last_name?.[0]}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 whitespace-nowrap">
                              {row.first_name} {row.last_name}
                            </div>
                            <div className="text-sm text-gray-500 truncate max-w-[200px]">{row.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <TierBadge tier={row.tier} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-[260px]">
                          <Checklist row={row} />
                          <div className="text-xs text-gray-400 mt-1 capitalize">
                            {row.current_step?.replace(/_/g, ' ') || 'Not started'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <ReviewStatusBadge status={row.review_status} />
                          {row.bill_type_label && row.review_status && (
                            <div className="text-xs text-gray-500">{row.bill_type_label}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {row.review_status === 'pending'
                            ? formatDistanceToNow(new Date(row.submitted_at), { addSuffix: true })
                            : format(new Date(row.created_at), 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-primary">
                          {row.review_status === 'pending' && canReview ? 'Review' : 'View'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={`md:hidden divide-y divide-gray-100 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
              {rows.map((row) => (
                <button
                  key={row.id}
                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                  onClick={() => openDrawer(row.user_id)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                      <span className="text-sm font-semibold">
                        {row.first_name?.[0]}
                        {row.last_name?.[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900">
                        {row.first_name} {row.last_name}
                      </div>
                      <div className="text-sm text-gray-500 truncate">{row.email}</div>
                    </div>
                    <TierBadge tier={row.tier} size="sm" />
                  </div>
                  <Checklist row={row} />
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <ReviewStatusBadge status={row.review_status} />
                    <span className="text-xs text-gray-500">
                      {row.review_status === 'pending'
                        ? `Submitted ${formatDistanceToNow(new Date(row.submitted_at), { addSuffix: true })}`
                        : format(new Date(row.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 md:px-6 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-sm text-gray-500">
                {page * KYC_PAGE_SIZE + 1}-{Math.min((page + 1) * KYC_PAGE_SIZE, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page + 1} of {pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                  className="p-2 rounded-lg border border-gray-200 bg-white disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <KycReviewDrawer userId={openUserId} onClose={closeDrawer} />
    </div>
  );
}
