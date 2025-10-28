import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, CheckCircle, XCircle, Clock, DollarSign, Calendar, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePayoutEvents } from '@/hooks/queries/usePayoutEvents';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { format } from 'date-fns';

export default function PayoutEvents() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'processing' | 'completed' | 'failed'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const { data, isLoading, error } = usePayoutEvents(searchQuery, statusFilter, currentPage, pageSize);
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['payout-events']);
  };

  const handleCardClick = (status: string) => {
    setStatusFilter(status as any);
    setCurrentPage(1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-700';
      case 'processing':
        return 'bg-yellow-50 text-yellow-700';
      case 'failed':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'processing':
        return <Clock className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load payout events</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  const { events = [], stats, totalCount = 0, totalPages = 0 } = data || {};

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Payout Events</h1>
          <p className="text-gray-500">Monitor and manage all payout activities</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <button
          onClick={() => handleCardClick('all')}
          className={`bg-white rounded-2xl p-6 shadow-soft border transition-all hover:shadow-md ${
            statusFilter === 'all' ? 'border-gray-900 ring-2 ring-gray-900' : 'border-gray-100'
          }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Events</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-gray-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">All payout events</span>
          </div>
        </button>

        <button
          onClick={() => handleCardClick('processing')}
          className={`bg-white rounded-2xl p-6 shadow-soft border transition-all hover:shadow-md ${
            statusFilter === 'processing' ? 'border-yellow-600 ring-2 ring-yellow-600' : 'border-gray-100'
          }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-500 mb-1">Processing</p>
              <p className="text-3xl font-bold text-yellow-600">{stats?.processing || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">In progress</span>
          </div>
        </button>

        <button
          onClick={() => handleCardClick('completed')}
          className={`bg-white rounded-2xl p-6 shadow-soft border transition-all hover:shadow-md ${
            statusFilter === 'completed' ? 'border-green-600 ring-2 ring-green-600' : 'border-gray-100'
          }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-500 mb-1">Completed</p>
              <p className="text-3xl font-bold text-green-600">{stats?.completed || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Successfully paid</span>
          </div>
        </button>

        <button
          onClick={() => handleCardClick('failed')}
          className={`bg-white rounded-2xl p-6 shadow-soft border transition-all hover:shadow-md ${
            statusFilter === 'failed' ? 'border-red-600 ring-2 ring-red-600' : 'border-gray-100'
          }`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-500 mb-1">Failed</p>
              <p className="text-3xl font-bold text-red-600">{stats?.failed || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Require attention</span>
          </div>
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-soft border border-gray-100 mb-6">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by user, amount, reference, or plan..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all appearance-none bg-white cursor-pointer text-sm"
            >
              <option value="all">All Status</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {(searchQuery || statusFilter !== 'all') && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-gray-900">×</button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('all')} className="hover:text-gray-900">×</button>
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden">
        {events && events.length > 0 ? (
          <>
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Payout Plan
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Scheduled Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Transfer Ref
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((event: any) => (
                  <tr
                    key={event.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/users/${event.user_id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                          {event.user?.first_name && event.user?.last_name ? (
                            <span className="text-sm font-semibold">
                              {event.user.first_name[0]}{event.user.last_name[0]}
                            </span>
                          ) : (
                            <User className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          {event.user?.first_name && event.user?.last_name ? (
                            <div className="font-medium text-gray-900">
                              {event.user.first_name} {event.user.last_name}
                            </div>
                          ) : null}
                          <div className="text-sm text-gray-500">{event.user?.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {event.payout_plan ? (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900">{event.payout_plan.name}</div>
                          <div className="text-xs text-gray-500 capitalize">
                            {event.payout_plan.frequency}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {new Intl.NumberFormat('en-NG', {
                          style: 'currency',
                          currency: 'NGN'
                        }).format(event.amount || 0)}
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium ${getStatusColor(event.status)}`}>
                        {getStatusIcon(event.status)}
                        <span className="ml-1 capitalize">{event.status}</span>
                      </span>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-3 w-3" />
                        {event.scheduled_date ? format(new Date(event.scheduled_date), 'MMM d, yyyy') : 'N/A'}
                      </div>
                      {event.execution_date && (
                        <div className="text-xs text-gray-400">
                          Executed: {format(new Date(event.execution_date), 'h:mm a')}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 font-mono">
                        {event.transfer_reference || 'N/A'}
                      </div>
                      {event.error_message && (
                        <div className="text-xs text-red-500 mt-1 max-w-xs truncate" title={event.error_message}>
                          {event.error_message}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-100">
            {events.map((event: any) => (
              <div
                key={event.id}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/users/${event.user_id}`)}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white shadow-sm">
                    {event.user?.first_name && event.user?.last_name ? (
                      <span className="text-sm font-semibold">
                        {event.user.first_name[0]}{event.user.last_name[0]}
                      </span>
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {event.user?.first_name && event.user?.last_name && (
                      <div className="font-semibold text-gray-900 mb-0.5">
                        {event.user.first_name} {event.user.last_name}
                      </div>
                    )}
                    <div className="text-sm text-gray-500 truncate">{event.user?.email}</div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${getStatusColor(event.status)} flex-shrink-0`}>
                    {getStatusIcon(event.status)}
                    <span className="ml-1 capitalize">{event.status}</span>
                  </span>
                </div>

                <div className="space-y-2.5">
                  {event.payout_plan && (
                    <div>
                      <div className="text-sm font-semibold text-gray-900 mb-0.5">{event.payout_plan.name}</div>
                      <div className="text-xs text-gray-500 capitalize">{event.payout_plan.frequency}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Amount</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {new Intl.NumberFormat('en-NG', {
                          style: 'currency',
                          currency: 'NGN',
                          notation: 'compact'
                        }).format(event.amount || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-0.5">Scheduled</div>
                      <div className="text-sm text-gray-900">
                        {event.scheduled_date ? format(new Date(event.scheduled_date), 'MMM d, yyyy') : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {event.transfer_reference && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-1">Transfer Reference</div>
                      <div className="text-xs text-gray-600 font-mono break-all">
                        {event.transfer_reference}
                      </div>
                    </div>
                  )}

                  {event.error_message && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                        {event.error_message}
                      </div>
                    </div>
                  )}

                  {event.execution_date && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-2 border-t border-gray-100">
                      <Calendar className="h-3 w-3" />
                      Executed: {format(new Date(event.execution_date), 'MMM d, yyyy h:mm a')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        ) : (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">
              {searchQuery || statusFilter !== 'all'
                ? 'No payout events match your filters'
                : 'No payout events available'}
            </p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-4 md:px-6 py-4 border-t border-gray-100">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="text-sm text-gray-500 text-center md:text-left">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} results
              </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                        currentPage === pageNum
                          ? 'bg-gray-900 text-white'
                          : 'border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
