import { useState } from 'react';
import {
  RefreshCw,
  Search,
  Filter,
  Download,
  FileText,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  User,
  Database,
  Activity,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuditLogs, AuditLogsFilters } from '@/hooks/queries/useAuditLogs';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';

export default function AuditLogs() {
  const refreshData = useRefreshData();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const [filters, setFilters] = useState<AuditLogsFilters>({
    logType: 'all',
    status: undefined,
    operationType: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    searchQuery: undefined,
    page: 1,
    pageSize: 20,
  });

  const { data, isLoading, error } = useAuditLogs(filters);
  const logs = data?.logs || [];
  const totalLogs = data?.total || 0;
  const currentPage = data?.page || 1;
  const totalPages = data?.totalPages || 1;

  const handleRefresh = () => {
    refreshData.mutate(['audit-logs']);
  };

  const handleSearch = () => {
    setFilters({ ...filters, searchQuery: searchQuery || undefined, page: 1 });
  };

  const handleClearFilters = () => {
    setFilters({
      logType: 'all',
      status: undefined,
      operationType: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      searchQuery: undefined,
      page: 1,
      pageSize: 20,
    });
    setSearchQuery('');
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setFilters({ ...filters, pageSize: newPageSize, page: 1 });
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('success') || statusLower.includes('completed') || statusLower.includes('verified')) {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
    if (statusLower.includes('fail') || statusLower.includes('error') || statusLower.includes('rejected')) {
      return <XCircle className="h-5 w-5 text-red-600" />;
    }
    if (statusLower.includes('pending') || statusLower.includes('processing')) {
      return <Clock className="h-5 w-5 text-yellow-600" />;
    }
    return <AlertCircle className="h-5 w-5 text-gray-600" />;
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('success') || statusLower.includes('completed') || statusLower.includes('verified')) {
      return 'bg-green-50 text-green-700 border-green-200';
    }
    if (statusLower.includes('fail') || statusLower.includes('error') || statusLower.includes('rejected')) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    if (statusLower.includes('pending') || statusLower.includes('processing')) {
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    }
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const formatUserName = (log: any) => {
    const profile = log.data.profiles;
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (profile?.email) {
      return profile.email;
    }
    return log.data.user_id.slice(0, 8);
  };

  const exportToJson = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
        <p className="text-error mb-4">Failed to load audit logs</p>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Audit Logs</h1>
          <p className="text-gray-500">
            View and monitor system audit logs for KYC and SafeHaven operations
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={exportToJson}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 transition-colors border border-gray-200 text-gray-700"
            title="Export logs"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={handleRefresh}
            className="p-2.5 rounded-xl bg-white hover:bg-gray-50 transition-colors border border-gray-200"
            disabled={refreshData.isPending}
            title="Refresh logs"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
          </button>
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
              placeholder="Search by operation, type, or message..."
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Log Type</label>
                <select
                  value={filters.logType}
                  onChange={(e) => setFilters({ ...filters, logType: e.target.value as any })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="all">All Logs</option>
                  <option value="kyc">KYC Only</option>
                  <option value="safehaven">SafeHaven Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                  <option value="error">Error</option>
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

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 mb-4">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {totalLogs.toLocaleString()} Total Log{totalLogs !== 1 ? 's' : ''}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Showing {((currentPage - 1) * (filters.pageSize || 20)) + 1} - {Math.min(currentPage * (filters.pageSize || 20), totalLogs)} of {totalLogs.toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>KYC</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>SafeHaven</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Per page:</label>
                <select
                  value={filters.pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {logs && logs.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div
                key={`${log.type}-${log.data.id}`}
                className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    log.type === 'kyc' ? 'bg-blue-50' : 'bg-green-50'
                  }`}>
                    {log.type === 'kyc' ? (
                      <Shield className={`h-6 w-6 ${log.type === 'kyc' ? 'text-blue-600' : 'text-green-600'}`} />
                    ) : (
                      <Database className="h-6 w-6 text-green-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-base font-semibold text-gray-900">
                            {log.data.operation_type}
                          </h3>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                            log.type === 'kyc' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'
                          }`}>
                            {log.type === 'kyc' ? 'KYC' : 'SafeHaven'}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(log.data.status)}`}>
                            {getStatusIcon(log.data.status)}
                            {log.data.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <User className="h-4 w-4" />
                            <span>{formatUserName(log)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            <span>{format(new Date(log.data.created_at), 'MMM dd, yyyy HH:mm:ss')}</span>
                          </div>
                          {log.type === 'kyc' && 'verification_type' in log.data && log.data.verification_type && (
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-4 w-4" />
                              <span>{log.data.verification_type}</span>
                            </div>
                          )}
                          {log.type === 'safehaven' && 'response_time_ms' in log.data && log.data.response_time_ms && (
                            <div className="flex items-center gap-1.5">
                              <Activity className="h-4 w-4" />
                              <span>{log.data.response_time_ms}ms</span>
                            </div>
                          )}
                        </div>

                        {'result_message' in log.data && log.data.result_message && (
                          <p className="mt-2 text-sm text-gray-600 line-clamp-1">
                            {log.data.result_message}
                          </p>
                        )}
                      </div>

                      <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No audit logs found</p>
            <p className="text-sm text-gray-400 mt-2">Try adjusting your filters</p>
          </div>
        )}

        {logs && logs.length > 0 && totalPages > 1 && (
          <div className="p-6 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  First
                </button>

                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
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
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Last
                </button>
              </div>

              <div className="text-sm text-gray-600">
                {totalLogs.toLocaleString()} total
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Log Details</h2>
              <button
                onClick={() => setSelectedLog(null)}
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
                      <p className="text-xs text-gray-500 mb-1">Log Type</p>
                      <p className="text-sm font-medium text-gray-900">{selectedLog.type.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(selectedLog.data.status)}`}>
                        {getStatusIcon(selectedLog.data.status)}
                        {selectedLog.data.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Operation</p>
                      <p className="text-sm font-medium text-gray-900">{selectedLog.data.operation_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">User</p>
                      <p className="text-sm font-medium text-gray-900">{formatUserName(selectedLog)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Created At</p>
                      <p className="text-sm font-medium text-gray-900">
                        {format(new Date(selectedLog.data.created_at), 'MMM dd, yyyy HH:mm:ss')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">IP Address</p>
                      <p className="text-sm font-medium text-gray-900">{selectedLog.data.ip_address || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {selectedLog.type === 'kyc' && (
                  <>
                    {selectedLog.data.verification_type && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Verification Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Type</p>
                            <p className="text-sm font-medium text-gray-900">{selectedLog.data.verification_type}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Provider</p>
                            <p className="text-sm font-medium text-gray-900">{selectedLog.data.verification_provider || 'N/A'}</p>
                          </div>
                          {selectedLog.data.confidence_score && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Confidence Score</p>
                              <p className="text-sm font-medium text-gray-900">{selectedLog.data.confidence_score}%</p>
                            </div>
                          )}
                          {selectedLog.data.risk_score && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Risk Score</p>
                              <p className="text-sm font-medium text-gray-900">{selectedLog.data.risk_score}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {selectedLog.type === 'safehaven' && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">SafeHaven Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedLog.data.safehaven_endpoint && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Endpoint</p>
                          <p className="text-sm font-medium text-gray-900">{selectedLog.data.safehaven_endpoint}</p>
                        </div>
                      )}
                      {selectedLog.data.status_code && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Status Code</p>
                          <p className="text-sm font-medium text-gray-900">{selectedLog.data.status_code}</p>
                        </div>
                      )}
                      {selectedLog.data.response_time_ms && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Response Time</p>
                          <p className="text-sm font-medium text-gray-900">{selectedLog.data.response_time_ms}ms</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedLog.data.request_data && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Request Data</h3>
                    <pre className="bg-gray-50 p-4 rounded-xl text-xs overflow-x-auto border border-gray-200">
                      {JSON.stringify(selectedLog.data.request_data, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.data.response_data && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Response Data</h3>
                    <pre className="bg-gray-50 p-4 rounded-xl text-xs overflow-x-auto border border-gray-200">
                      {JSON.stringify(selectedLog.data.response_data, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.data.error_data && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Error Data</h3>
                    <pre className="bg-red-50 p-4 rounded-xl text-xs overflow-x-auto border border-red-200">
                      {JSON.stringify(selectedLog.data.error_data, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.data.metadata && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Metadata</h3>
                    <pre className="bg-gray-50 p-4 rounded-xl text-xs overflow-x-auto border border-gray-200">
                      {JSON.stringify(selectedLog.data.metadata, null, 2)}
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
