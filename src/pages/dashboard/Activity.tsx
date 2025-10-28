import { useState, useMemo } from 'react';
import { RefreshCw, Activity as ActivityIcon, Users, Zap, TrendingUp, Clock, User, Shield, FileText, Search, Filter } from 'lucide-react';
import { useActivityData } from '@/hooks/queries/useActivityData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { format } from 'date-fns';

export default function Activity() {
  const { data: activityData, isLoading, error } = useActivityData();
  const refreshData = useRefreshData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'audit' | 'events'>('all');
  const [actionFilter, setActionFilter] = useState<'all' | 'create' | 'update' | 'delete' | 'login'>('all');

  const handleRefresh = () => {
    refreshData.mutate(['activity']);
  };

  const filteredAuditLogs = useMemo(() => {
    if (!activityData?.auditLogs) return [];

    return activityData.auditLogs.filter((log) => {
      const matchesSearch = !searchQuery ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.resource_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesActionFilter = actionFilter === 'all' ||
        log.action.toLowerCase().includes(actionFilter.toLowerCase());

      return matchesSearch && matchesActionFilter;
    });
  }, [activityData?.auditLogs, searchQuery, actionFilter]);

  const filteredEvents = useMemo(() => {
    if (!activityData?.events) return [];

    return activityData.events.filter((event) => {
      const matchesSearch = !searchQuery ||
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.user?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.user?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [activityData?.events, searchQuery]);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load activity data</p>
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

  const stats = activityData?.stats || {
    totalActions: 0,
    totalEvents: 0,
    activeUsers: 0,
    todayActions: 0,
  };

  const getActionIcon = (action: string) => {
    if (action.includes('create')) return '🆕';
    if (action.includes('update')) return '✏️';
    if (action.includes('delete')) return '🗑️';
    if (action.includes('login')) return '🔐';
    return '📝';
  };

  const getEventIcon = (type: string) => {
    if (type.includes('payout')) return '💰';
    if (type.includes('kyc')) return '📋';
    if (type.includes('transaction')) return '💳';
    if (type.includes('notification')) return '🔔';
    return '📌';
  };

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'bg-green-50 text-green-700 border-green-200';
    if (action.includes('update')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (action.includes('delete')) return 'bg-red-50 text-red-700 border-red-200';
    if (action.includes('login')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const displayedAuditLogs = filterType === 'events' ? [] : filteredAuditLogs;
  const displayedEvents = filterType === 'audit' ? [] : filteredEvents;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">User Activity</h1>
          <p className="text-gray-500">Monitor all user actions and system events</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by user, action, type, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="pl-10 pr-8 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all appearance-none bg-white cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="audit">Audit Logs Only</option>
                <option value="events">Events Only</option>
              </select>
            </div>

            <div className="relative">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as any)}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all appearance-none bg-white cursor-pointer"
              >
                <option value="all">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="login">Login</option>
              </select>
            </div>
          </div>
        </div>

        {(searchQuery || filterType !== 'all' || actionFilter !== 'all') && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                Search: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-gray-900">×</button>
              </span>
            )}
            {filterType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                Type: {filterType}
                <button onClick={() => setFilterType('all')} className="hover:text-gray-900">×</button>
              </span>
            )}
            {actionFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                Action: {actionFilter}
                <button onClick={() => setActionFilter('all')} className="hover:text-gray-900">×</button>
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
                setActionFilter('all');
              }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Actions</p>
              <p className="text-3xl font-bold text-gray-900">{displayedAuditLogs.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <ActivityIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Filtered from {stats.totalActions}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">System Events</p>
              <p className="text-3xl font-bold text-gray-900">{displayedEvents.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <Zap className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Filtered from {stats.totalEvents}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Active Users</p>
              <p className="text-3xl font-bold text-gray-900">{stats.activeUsers}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Unique users in period</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Today's Actions</p>
              <p className="text-3xl font-bold text-gray-900">{stats.todayActions}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Actions since midnight</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {filterType !== 'events' && (
          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Recent Audit Logs
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {displayedAuditLogs.length} of {activityData?.auditLogs.length || 0} logs
              </p>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {displayedAuditLogs && displayedAuditLogs.length > 0 ? (
                displayedAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-lg">
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-50 text-gray-600">
                            {log.resource_type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <User className="h-3 w-3" />
                          <span className="font-medium">
                            {log.user?.first_name && log.user?.last_name
                              ? `${log.user.first_name} ${log.user.last_name}`
                              : log.user?.email || 'Unknown User'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                        </div>
                        {log.ip_address && (
                          <div className="text-xs text-gray-400 mt-1">
                            IP: {log.ip_address}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Shield className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No audit logs match your filters</p>
                </div>
              )}
            </div>
          </div>
        )}

        {filterType !== 'audit' && (
          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                System Events
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {displayedEvents.length} of {activityData?.events.length || 0} events
              </p>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {displayedEvents && displayedEvents.length > 0 ? (
                displayedEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-lg">
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 mb-1">{event.title}</h4>
                        {event.description && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{event.description}</p>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                            event.status === 'completed' ? 'bg-green-50 text-green-700' :
                            event.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                            event.status === 'failed' ? 'bg-red-50 text-red-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
                            {event.status}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-50 text-gray-600">
                            {event.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <User className="h-3 w-3" />
                          <span className="font-medium">
                            {event.user?.first_name && event.user?.last_name
                              ? `${event.user.first_name} ${event.user.last_name}`
                              : event.user?.email || 'System'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          {format(new Date(event.created_at), 'MMM d, yyyy HH:mm:ss')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No events match your filters</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
