import { RefreshCw, Activity as ActivityIcon, Users, Zap, TrendingUp, Clock, User, Shield, FileText } from 'lucide-react';
import { useActivityData } from '@/hooks/queries/useActivityData';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { format } from 'date-fns';

export default function Activity() {
  const { data: activityData, isLoading, error } = useActivityData();
  const refreshData = useRefreshData();

  const handleRefresh = () => {
    refreshData.mutate(['activity']);
  };

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

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Actions</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalActions}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <ActivityIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Last 100 actions logged</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">System Events</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalEvents}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <Zap className="h-5 w-5 text-green-600" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Recent events tracked</span>
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
        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Recent Audit Logs
            </h3>
            <p className="text-sm text-gray-500 mt-1">User actions and system changes</p>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {activityData?.auditLogs && activityData.auditLogs.length > 0 ? (
              activityData.auditLogs.map((log) => (
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
                <p>No audit logs found</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              System Events
            </h3>
            <p className="text-sm text-gray-500 mt-1">Application events and notifications</p>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {activityData?.events && activityData.events.length > 0 ? (
              activityData.events.map((event) => (
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
                <p>No events found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
