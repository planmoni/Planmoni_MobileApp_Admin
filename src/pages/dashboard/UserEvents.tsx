import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Shield, Zap, Clock, Filter, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';

export default function UserEvents() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'all' | 'audit' | 'events'>('all');
  const refreshData = useRefreshData();

  const { data: userData } = useQuery({
    queryKey: ['user-basic', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: userActivity, isLoading } = useQuery({
    queryKey: ['user-activity-all', id],
    queryFn: async () => {
      const [auditResult, eventsResult] = await Promise.all([
        supabase
          .from('audit_logs')
          .select('*')
          .eq('user_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('*')
          .eq('user_id', id)
          .order('created_at', { ascending: false })
      ]);

      if (auditResult.error) throw auditResult.error;
      if (eventsResult.error) throw eventsResult.error;

      return {
        auditLogs: auditResult.data || [],
        events: eventsResult.data || []
      };
    },
    enabled: !!id,
  });

  const handleRefresh = () => {
    if (id) {
      refreshData.mutate(['user-activity-all', id]);
    }
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const filteredData = () => {
    if (activeTab === 'audit') {
      return { auditLogs: userActivity?.auditLogs || [], events: [] };
    } else if (activeTab === 'events') {
      return { auditLogs: [], events: userActivity?.events || [] };
    }
    return userActivity || { auditLogs: [], events: [] };
  };

  const data = filteredData();

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link
            to={`/users/${id}`}
            className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">User Activity</h1>
            {userData && (
              <p className="text-gray-500">
                {userData.first_name} {userData.last_name} ({userData.email})
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
          disabled={refreshData.isPending}
        >
          <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 mb-6">
        <div className="border-b border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Activity
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === 'audit'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Audit Logs ({userActivity?.auditLogs?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  activeTab === 'events'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                System Events ({userActivity?.events?.length || 0})
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(activeTab === 'all' || activeTab === 'audit') && data.auditLogs.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Audit Logs
                <span className="ml-auto text-sm font-normal text-gray-500">
                  {data.auditLogs.length} {data.auditLogs.length === 1 ? 'entry' : 'entries'}
                </span>
              </h3>
            </div>
            <div className="space-y-3 max-h-[800px] overflow-y-auto">
              {data.auditLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-lg">
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-50 text-gray-600">
                          {log.resource_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                      </div>
                      {log.ip_address && (
                        <div className="text-xs text-gray-400 mt-1">
                          IP: {log.ip_address}
                        </div>
                      )}
                      {log.user_agent && (
                        <div className="text-xs text-gray-400 mt-1 truncate" title={log.user_agent}>
                          User Agent: {log.user_agent}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(activeTab === 'all' || activeTab === 'events') && data.events.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-600" />
                System Events
                <span className="ml-auto text-sm font-normal text-gray-500">
                  {data.events.length} {data.events.length === 1 ? 'event' : 'events'}
                </span>
              </h3>
            </div>
            <div className="space-y-3 max-h-[800px] overflow-y-auto">
              {data.events.map((event: any) => (
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
                        <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                      )}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        {format(new Date(event.created_at), 'MMM d, yyyy HH:mm:ss')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'audit' && data.auditLogs.length === 0 && (
          <div className="bg-white rounded-2xl p-12 shadow-soft border border-gray-100 text-center col-span-2">
            <Shield className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">No audit logs found</p>
            <p className="text-gray-400 text-sm mt-1">This user has no recorded audit logs</p>
          </div>
        )}

        {activeTab === 'events' && data.events.length === 0 && (
          <div className="bg-white rounded-2xl p-12 shadow-soft border border-gray-100 text-center col-span-2">
            <Zap className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">No system events found</p>
            <p className="text-gray-400 text-sm mt-1">This user has no recorded system events</p>
          </div>
        )}

        {activeTab === 'all' && data.auditLogs.length === 0 && data.events.length === 0 && (
          <div className="bg-white rounded-2xl p-12 shadow-soft border border-gray-100 text-center col-span-2">
            <Shield className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">No activity found</p>
            <p className="text-gray-400 text-sm mt-1">This user has no recorded activity</p>
          </div>
        )}
      </div>
    </div>
  );
}
