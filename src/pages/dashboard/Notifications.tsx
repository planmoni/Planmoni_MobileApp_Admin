import { useState, useEffect } from 'react';
import { Bell, Send, RefreshCw, Users, CircleCheck as CheckCircle, Circle as XCircle, Search, Filter, Clock, CircleAlert as AlertCircle, TrendingUp, Activity, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { useNotifications, useNotificationSegments, useNotificationStats, useNotificationDispatchLogs, useRealtimeDispatch, useReengagementStats, useReengagementUsers, useDispatchStats } from '@/hooks/queries/useNotifications';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import StatCard from '@/components/StatCard';
import { REENGAGEMENT_CATEGORIES, getCategoryDisplayName } from '@/lib/notificationTemplates';

interface NotificationFormData {
  title: string;
  body: string;
  data: Record<string, any>;
  target_type: 'all' | 'individual' | 'segment';
  target_user_ids: string[];
  target_segment_id: string;
  personalize: boolean;
}

export default function Notifications() {
  const { data: notifications, isLoading, error } = useNotifications();
  const { data: segments } = useNotificationSegments();
  const { data: stats } = useNotificationStats();
  const { data: reengagementStats } = useReengagementStats();
  const refreshData = useRefreshData();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'history' | 'dispatch'>('history');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [allUsersCount, setAllUsersCount] = useState<number | null>(null);

  const [formData, setFormData] = useState<NotificationFormData>({
    title: '',
    body: '',
    data: {},
    target_type: 'all',
    target_user_ids: [],
    target_segment_id: '',
    personalize: false,
  });

  const [dispatchFilters, setDispatchFilters] = useState({
    status: '',
    category: '',
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  const [selectedReengagement, setSelectedReengagement] = useState<string | null>(null);
  const [showReengagementModal, setShowReengagementModal] = useState(false);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const { data: dispatchLogs, isLoading: dispatchLoading } = useNotificationDispatchLogs(100, 0, dispatchFilters);
  const { data: dispatchStatsData } = useDispatchStats();
  const { data: reengagementUsers } = useReengagementUsers(selectedReengagement || '', !!selectedReengagement && showRecipientsModal);

  const [newDispatches, setNewDispatches] = useState<any[]>([]);
  const { realtimeEnabled, setRealtimeEnabled } = useRealtimeDispatch((dispatch) => {
    setNewDispatches((prev) => [dispatch, ...prev.slice(0, 49)]);
    setTimeout(() => {
      setNewDispatches((prev) => prev.filter((d) => d.id !== dispatch.id));
    }, 5000);
  });

  const handleRefresh = () => {
    refreshData.mutate(['push-notifications', 'notification-stats', 'push-notification-segments', 'notification-dispatch-logs', 'reengagement-stats', 'dispatch-stats']);
  };

  useEffect(() => {
    const fetchAllUsersCount = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_active_push_token_count');

        if (!error && data !== null) {
          setAllUsersCount(data);
        }
      } catch (err) {
        console.error('Error fetching all users count:', err);
      }
    };

    fetchAllUsersCount();
  }, []);

  const handleSendNotification = async () => {
    if (!formData.title.trim() || !formData.body.trim()) {
      showToast('Please fill in title and message', 'error');
      return;
    }

    if (formData.target_type === 'segment' && !formData.target_segment_id) {
      showToast('Please select a segment', 'error');
      return;
    }

    setIsSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-push-notifications`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'send_notification',
            title: formData.title,
            body: formData.body,
            data: formData.data,
            target_type: formData.target_type,
            target_user_ids: formData.target_user_ids,
            target_segment_id: formData.target_segment_id || undefined,
            personalize: formData.personalize,
            notification_type: 'manual',
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send notification');
      }

      showToast(result.message || 'Notification sent successfully', 'success');
      setShowCreateModal(false);
      setFormData({
        title: '',
        body: '',
        data: {},
        target_type: 'all',
        target_user_ids: [],
        target_segment_id: '',
        personalize: false,
      });
      handleRefresh();
    } catch (err) {
      console.error('Error sending notification:', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to send notification',
        'error'
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSendReengagement = async (categoryId: string) => {
    const category = REENGAGEMENT_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return;

    setIsSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-push-notifications`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'send_reengagement',
            category: categoryId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send re-engagement alert');
      }

      showToast(result.message || 'Re-engagement alert sent successfully', 'success');
      setShowReengagementModal(false);
      setSelectedReengagement(null);
      handleRefresh();
    } catch (err) {
      console.error('Error sending re-engagement:', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to send re-engagement alert',
        'error'
      );
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Draft' },
      sending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Sending' },
      sent: { bg: 'bg-green-100', text: 'text-green-800', label: 'Sent' },
      delivered: { bg: 'bg-green-100', text: 'text-green-800', label: 'Delivered' },
      failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
    };

    const badge = badges[status] || badges.draft;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      system: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'System' },
      manual: { bg: 'bg-green-100', text: 'text-green-800', label: 'Manual' },
      reengagement: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Re-engagement' },
      marketing: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Marketing' },
    };

    const badge = badges[type] || badges.manual;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard`, 'success');
  };

  const filteredNotifications = notifications?.filter((notification) => {
    const matchesSearch =
      notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.body.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || notification.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getReengagementCount = (categoryId: string) => {
    const stat = reengagementStats?.find(s => s.category === categoryId);
    return stat?.eligible_count || 0;
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Failed to load notifications</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Push Notifications</h1>
          <p className="text-gray-500 mt-1">Send push notifications to mobile app users</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            <Send className="h-5 w-5" />
            <span>Send Notification</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Sent"
          value={String(stats?.total_sent || 0)}
          icon={<Send className="h-6 w-6 text-gray-600" />}
          trend={0}
        />
        <StatCard
          title="Delivered"
          value={String(stats?.total_delivered || 0)}
          icon={<CheckCircle className="h-6 w-6 text-green-600" />}
          trend={0}
        />
        <StatCard
          title="Failed"
          value={String(stats?.total_failed || 0)}
          icon={<XCircle className="h-6 w-6 text-red-600" />}
          trend={0}
        />
        <StatCard
          title="Delivery Rate"
          value={`${stats?.delivery_rate || 0}%`}
          icon={<Bell className="h-6 w-6 text-blue-600" />}
          trend={0}
        />
      </div>

      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-100 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <span>Re-engagement Alerts</span>
            </h3>
            <p className="text-sm text-gray-600 mt-1">Send targeted notifications to bring users back</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REENGAGEMENT_CATEGORIES.map((category) => {
            const count = getReengagementCount(category.id);
            return (
              <div key={category.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{category.title}</h4>
                      <p className="text-xs text-gray-600">{category.description}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-bold text-2xl text-gray-900">{count}</span>
                    <span className="text-gray-600 ml-1">eligible</span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setSelectedReengagement(category.id);
                        setShowRecipientsModal(true);
                      }}
                      className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      disabled={count === 0}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReengagement(category.id);
                        setShowReengagementModal(true);
                      }}
                      className="px-3 py-1.5 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={count === 0}
                    >
                      Send Alert
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="border-b border-gray-100">
          <div className="flex space-x-1 p-1">
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'history'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Notification History
            </button>
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                activeTab === 'dispatch'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Live Dispatch</span>
              {realtimeEnabled && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
            </button>
          </div>
        </div>

        {activeTab === 'history' ? (
          <>
            <div className="p-6 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search notifications..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="sent">Sent</option>
                    <option value="sending">Sending</option>
                    <option value="failed">Failed</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notification
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Target
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recipients
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delivery Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredNotifications && filteredNotifications.length > 0 ? (
                    filteredNotifications.map((notification) => {
                      const deliveryRate = notification.total_recipients > 0
                        ? Math.round((notification.delivered_count / notification.total_recipients) * 100)
                        : 0;

                      return (
                        <tr key={notification.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{notification.title}</div>
                              <div className="text-sm text-gray-500 truncate max-w-md">{notification.body}</div>
                              {notification.notification_type && (
                                <div className="mt-1">{getTypeBadge(notification.notification_type)}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900 capitalize">
                              {notification.target_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(notification.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-1">
                              <Users className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-900">{notification.total_recipients}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <div className="flex-1">
                                <div className="text-sm text-gray-900">{deliveryRate}%</div>
                                <div className="text-xs text-gray-500">
                                  {notification.delivered_count} / {notification.total_recipients}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {notification.sent_at
                              ? format(new Date(notification.sent_at), 'MMM dd, yyyy HH:mm')
                              : format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Bell className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-500">No notifications found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Live Notification Dispatch</h3>
                  <p className="text-sm text-gray-600">Real-time view of notifications being sent to users</p>
                </div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={realtimeEnabled}
                    onChange={(e) => setRealtimeEnabled(e.target.checked)}
                    className="h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Auto-refresh</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-blue-600 font-medium">Dispatched Today</p>
                      <p className="text-2xl font-bold text-blue-900">{dispatchStatsData?.total_dispatched || 0}</p>
                    </div>
                    <Send className="h-8 w-8 text-blue-600 opacity-50" />
                  </div>
                </div>
                <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-green-600 font-medium">Success Rate</p>
                      <p className="text-2xl font-bold text-green-900">{dispatchStatsData?.success_rate || 0}%</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600 opacity-50" />
                  </div>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-red-600 font-medium">Failed</p>
                      <p className="text-2xl font-bold text-red-900">{dispatchStatsData?.total_failed || 0}</p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-red-600 opacity-50" />
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-600 font-medium">Avg. Delivery</p>
                      <p className="text-2xl font-bold text-purple-900">{dispatchStatsData?.avg_delivery_time || 0}s</p>
                    </div>
                    <Clock className="h-8 w-8 text-purple-600 opacity-50" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by user email or name..."
                    value={dispatchFilters.search}
                    onChange={(e) => setDispatchFilters({ ...dispatchFilters, search: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <select
                  value={dispatchFilters.status}
                  onChange={(e) => setDispatchFilters({ ...dispatchFilters, status: e.target.value })}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                </select>
                <select
                  value={dispatchFilters.category}
                  onChange={(e) => setDispatchFilters({ ...dispatchFilters, category: e.target.value })}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {REENGAGEMENT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notification
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {dispatchLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
                        </div>
                      </td>
                    </tr>
                  ) : dispatchLogs && dispatchLogs.length > 0 ? (
                    dispatchLogs.map((log) => {
                      const isNew = newDispatches.some(d => d.id === log.id);
                      const isExpanded = expandedLog === log.id;

                      return (
                        <>
                          <tr
                            key={log.id}
                            className={`hover:bg-gray-50 transition-colors ${isNew ? 'bg-green-50 animate-pulse' : ''}`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-gray-400" />
                                <span>{format(new Date(log.sent_at), 'HH:mm:ss')}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {format(new Date(log.sent_at), 'MMM dd, yyyy')}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-semibold">
                                  {(log.user_full_name || log.user_email || 'U').substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{log.user_full_name || 'N/A'}</div>
                                  <div className="text-xs text-gray-500">{log.user_email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{log.notification_title}</div>
                                <div className="text-xs text-gray-500 truncate max-w-xs">{log.notification_body}</div>
                                {log.notification_type && (
                                  <div className="mt-1">{getTypeBadge(log.notification_type)}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {log.notification_category ? (
                                <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                                  {getCategoryDisplayName(log.notification_category)}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(log.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="px-6 py-4 bg-gray-50">
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-xs font-medium text-gray-600 mb-1">User ID</p>
                                      <div className="flex items-center space-x-2">
                                        <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200">{log.user_id}</code>
                                        <button
                                          onClick={() => copyToClipboard(log.user_id, 'User ID')}
                                          className="text-gray-400 hover:text-gray-600"
                                        >
                                          <Copy className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-gray-600 mb-1">Notification ID</p>
                                      <div className="flex items-center space-x-2">
                                        <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200">{log.push_notification_id}</code>
                                        <button
                                          onClick={() => copyToClipboard(log.push_notification_id, 'Notification ID')}
                                          className="text-gray-400 hover:text-gray-600"
                                        >
                                          <Copy className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                  {log.error_message && (
                                    <div>
                                      <p className="text-xs font-medium text-red-600 mb-1">Error Message</p>
                                      <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-800">
                                        {log.error_message}
                                      </div>
                                    </div>
                                  )}
                                  {log.delivered_at && (
                                    <div>
                                      <p className="text-xs font-medium text-gray-600 mb-1">Delivered At</p>
                                      <p className="text-xs text-gray-900">{format(new Date(log.delivered_at), 'MMM dd, yyyy HH:mm:ss')}</p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Activity className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-500">No dispatch logs found</p>
                        <p className="text-xs text-gray-400 mt-1">Notifications will appear here as they are sent</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Send Push Notification</h2>
              <p className="text-gray-500 mt-1">Create and send a push notification to mobile users</p>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter notification title"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.title.length}/100</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="Enter notification message"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                  maxLength={200}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">{formData.body.length}/200</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.personalize}
                    onChange={(e) => setFormData({ ...formData, personalize: e.target.checked })}
                    className="mt-0.5 h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900">Add personalized greeting</span>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.personalize
                        ? 'Message will start with "Hello [FirstName], ..." Users without a first name will see "Hello there, ..."'
                        : 'Your message will be sent exactly as written without personalization'}
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Audience *
                </label>
                <select
                  value={formData.target_type}
                  onChange={(e) => setFormData({ ...formData, target_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="all">
                    All Users {allUsersCount !== null ? `(${allUsersCount} users with push tokens)` : ''}
                  </option>
                  <option value="segment">User Segment</option>
                </select>
                {formData.target_type === 'all' && allUsersCount !== null && (
                  <p className="text-xs text-gray-500 mt-1">
                    {allUsersCount} users have active push tokens and will receive this notification
                  </p>
                )}
              </div>

              {formData.target_type === 'segment' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Segment *
                  </label>
                  <select
                    value={formData.target_segment_id}
                    onChange={(e) => setFormData({ ...formData, target_segment_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    <option value="">Choose a segment</option>
                    {segments?.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name} ({segment.user_count} users)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex">
                  <Bell className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-blue-900">Preview</h3>
                    <div className="mt-2 text-sm text-blue-800">
                      <p className="font-semibold">{formData.title || 'Notification title'}</p>
                      <p className="mt-1">
                        {formData.personalize ? (
                          formData.body
                            ? `Hello John, ${formData.body}`
                            : 'Hello John, your notification message will appear here'
                        ) : (
                          formData.body || 'Your notification message will appear here'
                        )}
                      </p>
                    </div>
                    {formData.personalize && (
                      <p className="mt-2 text-xs text-blue-700">
                        "John" is shown as example. Each user will see their own first name. Users without a first name will see "Hello there" instead.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    title: '',
                    body: '',
                    data: {},
                    target_type: 'all',
                    target_user_ids: [],
                    target_segment_id: '',
                    personalize: false,
                  });
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                onClick={handleSendNotification}
                disabled={isSending}
                className="flex items-center space-x-2 px-6 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Send Notification</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReengagementModal && selectedReengagement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Confirm Re-engagement Alert</h2>
            </div>

            <div className="p-6 space-y-4">
              {(() => {
                const category = REENGAGEMENT_CATEGORIES.find(c => c.id === selectedReengagement);
                const count = getReengagementCount(selectedReengagement);
                return category ? (
                  <>
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl">{category.icon}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{category.title}</h3>
                        <p className="text-sm text-gray-600">{category.description}</p>
                      </div>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <p className="text-sm text-gray-900">
                        This will send a notification to <span className="font-bold text-orange-600">{count} eligible users</span>.
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <div className="flex">
                        <Bell className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="ml-3 flex-1">
                          <h4 className="text-sm font-medium text-blue-900">Preview</h4>
                          <div className="mt-2 text-sm text-blue-800">
                            <p className="font-semibold">{category.template.title}</p>
                            <p className="mt-1">{category.template.body}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500">
                      Only users who have opted in to {category.preferenceKey} notifications will receive this alert.
                    </p>
                  </>
                ) : null;
              })()}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowReengagementModal(false);
                  setSelectedReengagement(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSendReengagement(selectedReengagement)}
                disabled={isSending}
                className="flex items-center space-x-2 px-6 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Send Alert</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecipientsModal && selectedReengagement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Eligible Recipients</h2>
              <p className="text-gray-500 mt-1">
                {REENGAGEMENT_CATEGORIES.find(c => c.id === selectedReengagement)?.title}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {reengagementUsers && reengagementUsers.length > 0 ? (
                <div className="space-y-3">
                  {reengagementUsers.map((user) => (
                    <div key={user.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-semibold">
                          {(user.full_name || user.email || 'U').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.full_name || 'N/A'}</p>
                          <p className="text-xs text-gray-600">{user.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500">No eligible users found</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => {
                  setShowRecipientsModal(false);
                  setSelectedReengagement(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
