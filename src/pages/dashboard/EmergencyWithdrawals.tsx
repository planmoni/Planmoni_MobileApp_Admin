import { useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  User,
  CreditCard,
  Calendar,
  FileText,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { useEmergencyWithdrawals, EmergencyWithdrawalsFilters } from '@/hooks/queries/useEmergencyWithdrawals';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';

export default function EmergencyWithdrawals() {
  const refreshData = useRefreshData();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);

  const [filters, setFilters] = useState<EmergencyWithdrawalsFilters>({
    status: undefined,
    withdrawalType: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    searchQuery: undefined,
  });

  const { data: withdrawals, isLoading, error } = useEmergencyWithdrawals(filters);

  const handleRefresh = () => {
    refreshData.mutate(['emergency-withdrawals']);
  };

  const handleSearch = () => {
    setFilters({ ...filters, searchQuery: searchQuery || undefined });
  };

  const handleClearFilters = () => {
    setFilters({
      status: undefined,
      withdrawalType: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      searchQuery: undefined,
    });
    setSearchQuery('');
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
      case 'transferred':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed':
      case 'cancelled':
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
      case 'processing':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
      case 'transferred':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'failed':
      case 'cancelled':
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'pending':
      case 'processing':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    return type === 'instant'
      ? 'bg-orange-50 text-orange-700 border-orange-200'
      : 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const formatUserName = (withdrawal: any) => {
    const profile = withdrawal.profiles;
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile?.email) {
      return profile.email;
    }
    return withdrawal.user_id.slice(0, 8);
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(parseFloat(amount.toString()));
  };

  const exportToJson = () => {
    const dataStr = JSON.stringify(withdrawals, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `emergency-withdrawals-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const calculateStats = () => {
    if (!withdrawals) return { total: 0, pending: 0, completed: 0, failed: 0, totalAmount: 0, totalFees: 0 };

    const completedWithdrawals = withdrawals.filter(w => w.status === 'completed' || w.status === 'success' || w.status === 'transferred');

    return {
      total: withdrawals.length,
      pending: withdrawals.filter(w => w.status === 'pending' || w.status === 'processing').length,
      completed: completedWithdrawals.length,
      failed: withdrawals.filter(w => w.status === 'failed' || w.status === 'cancelled' || w.status === 'rejected').length,
      totalAmount: completedWithdrawals.reduce((sum, w) => sum + parseFloat(w.withdrawal_amount), 0),
      totalFees: completedWithdrawals.reduce((sum, w) => sum + parseFloat(w.fee_amount), 0),
    };
  };

  const stats = calculateStats();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-error mb-4">Failed to load emergency withdrawals</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-light transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Emergency Withdrawals</h1>
          </div>
          <p className="text-gray-500">
            Monitor and manage emergency withdrawal requests from users
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={exportToJson}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 transition-colors border border-gray-200 text-gray-700"
            title="Export withdrawals"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={handleRefresh}
            className="p-2.5 rounded-xl bg-white hover:bg-gray-50 transition-colors border border-gray-200"
            disabled={refreshData.isPending}
            title="Refresh withdrawals"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-6">
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Requests</span>
            <FileText className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Pending</span>
            <Clock className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Completed</span>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Failed</span>
            <XCircle className="h-5 w-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Amount</span>
            <TrendingUp className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(stats.totalAmount)}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Fees</span>
            <CreditCard className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {formatCurrency(stats.totalFees)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by reference or transfer code..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
            >
              Search
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
                showFilters ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="transferred">Transferred</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={filters.withdrawalType || ''}
                  onChange={(e) => setFilters({ ...filters, withdrawalType: e.target.value || undefined })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All Types</option>
                  <option value="instant">Instant</option>
                  <option value="standard">Standard</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {withdrawals?.length || 0} Withdrawal{withdrawals?.length !== 1 ? 's' : ''}
          </h2>
        </div>

        {withdrawals && withdrawals.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {withdrawals.map((withdrawal) => (
              <div
                key={withdrawal.id}
                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setSelectedWithdrawal(withdrawal)}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-6 w-6 text-orange-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-base font-semibold text-gray-900">
                            {formatCurrency(withdrawal.withdrawal_amount)}
                          </h3>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(withdrawal.status)}`}>
                            {getStatusIcon(withdrawal.status)}
                            {withdrawal.status}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getTypeColor(withdrawal.withdrawal_type)}`}>
                            {withdrawal.withdrawal_type}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{formatUserName(withdrawal)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>{withdrawal.reference}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(withdrawal.requested_at), 'MMM dd, yyyy HH:mm')}</span>
                          </div>
                          {withdrawal.payout_accounts && (
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              <span>{withdrawal.payout_accounts.account_number} - {withdrawal.payout_accounts.bank_name}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex items-center gap-6 text-sm">
                          <div>
                            <span className="text-gray-500">Fee: </span>
                            <span className="font-medium text-gray-900">{formatCurrency(withdrawal.fee_amount)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Net: </span>
                            <span className="font-semibold text-green-600">{formatCurrency(withdrawal.net_amount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No emergency withdrawals found</p>
            <p className="text-sm text-gray-400 mt-2">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Withdrawal Details</h2>
              <button
                onClick={() => setSelectedWithdrawal(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-88px)]">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Reference</p>
                      <p className="text-sm font-medium text-gray-900">{selectedWithdrawal.reference}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(selectedWithdrawal.status)}`}>
                        {getStatusIcon(selectedWithdrawal.status)}
                        {selectedWithdrawal.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">User</p>
                      <p className="text-sm font-medium text-gray-900">{formatUserName(selectedWithdrawal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Type</p>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getTypeColor(selectedWithdrawal.withdrawal_type)}`}>
                        {selectedWithdrawal.withdrawal_type}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Financial Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Withdrawal Amount</p>
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(selectedWithdrawal.withdrawal_amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Fee Amount</p>
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(selectedWithdrawal.fee_amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Net Amount</p>
                      <p className="text-sm font-bold text-green-600">{formatCurrency(selectedWithdrawal.net_amount)}</p>
                    </div>
                  </div>
                </div>

                {selectedWithdrawal.payout_accounts && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Bank Account</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Account Name</p>
                        <p className="text-sm font-medium text-gray-900">{selectedWithdrawal.payout_accounts.account_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Account Number</p>
                        <p className="text-sm font-medium text-gray-900">{selectedWithdrawal.payout_accounts.account_number}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Bank Name</p>
                        <p className="text-sm font-medium text-gray-900">{selectedWithdrawal.payout_accounts.bank_name}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Timeline</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Requested At</p>
                      <p className="text-sm font-medium text-gray-900">
                        {format(new Date(selectedWithdrawal.requested_at), 'MMM dd, yyyy HH:mm:ss')}
                      </p>
                    </div>
                    {selectedWithdrawal.processed_at && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Processed At</p>
                        <p className="text-sm font-medium text-gray-900">
                          {format(new Date(selectedWithdrawal.processed_at), 'MMM dd, yyyy HH:mm:ss')}
                        </p>
                      </div>
                    )}
                    {selectedWithdrawal.transferred_at && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Transferred At</p>
                        <p className="text-sm font-medium text-gray-900">
                          {format(new Date(selectedWithdrawal.transferred_at), 'MMM dd, yyyy HH:mm:ss')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedWithdrawal.transfer_code && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Transfer Code</h3>
                    <p className="text-sm font-mono bg-gray-50 p-3 rounded-lg border border-gray-200">
                      {selectedWithdrawal.transfer_code}
                    </p>
                  </div>
                )}

                {selectedWithdrawal.error_message && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Error Message</h3>
                    <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                      {selectedWithdrawal.error_message}
                    </p>
                  </div>
                )}

                {selectedWithdrawal.notes && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes</h3>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      {selectedWithdrawal.notes}
                    </p>
                  </div>
                )}

                {selectedWithdrawal.metadata && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Metadata</h3>
                    <pre className="bg-gray-50 p-4 rounded-xl text-xs overflow-x-auto border border-gray-200">
                      {JSON.stringify(selectedWithdrawal.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
