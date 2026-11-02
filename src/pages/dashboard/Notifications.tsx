import { useState } from 'react';
import { Send, RefreshCw, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useNotifications, useNotificationSegments, useNotificationStats, useNotificationDispatchLogs, useReengagementStats, useReengagementUsers, useDispatchStats, useAudiencePreview } from '@/hooks/queries/useNotifications';
import QueueProgress from '@/components/notifications/QueueProgress';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { REENGAGEMENT_CATEGORIES, getCategoryDisplayName } from '@/lib/notificationTemplates';

interface NotificationFormData {
  title: string;
  body: string;
  data: Record<string, any>;
  target_type: 'all' | 'individual' | 'segment';
  target_user_ids: string[];
  target_segment_id: string;
  personalize: boolean;
  respect_marketing: boolean;
  rate_per_minute: number;
}

const SPEED_PRESETS = [
  { value: 500, label: 'Gentle', hint: '500 devices / min' },
  { value: 1000, label: 'Standard', hint: '1,000 devices / min' },
  { value: 3000, label: 'Fast', hint: '3,000 devices / min' },
];

const EMPTY_FORM: NotificationFormData = {
  title: '',
  body: '',
  data: {},
  target_type: 'all',
  target_user_ids: [],
  target_segment_id: '',
  personalize: false,
  respect_marketing: false,
  rate_per_minute: 1000,
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return 'under a minute';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `about ${h}h${m ? ` ${m}m` : ''}`;
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
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // one id per compose session: a repeated request returns the first send instead of sending twice
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());

  const [formData, setFormData] = useState<NotificationFormData>(EMPTY_FORM);

  const { data: audience, isLoading: audienceLoading, error: audienceError } = useAudiencePreview(
    {
      targetType: formData.target_type,
      segmentId: formData.target_segment_id || undefined,
      respectMarketing: formData.respect_marketing,
    },
    showCreateModal,
  );

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

  const handleRefresh = () => {
    refreshData.mutate(['push-notifications', 'notification-stats', 'push-notification-segments', 'notification-dispatch-logs', 'reengagement-stats', 'dispatch-stats']);
  };

  const postToAdminFunction = async (payload: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-push-notifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Request failed');
    return result;
  };

  const validateForm = () => {
    if (!formData.title.trim() || !formData.body.trim()) {
      showToast('Please fill in title and message', 'error');
      return false;
    }
    if (formData.target_type === 'segment' && !formData.target_segment_id) {
      showToast('Please select a segment', 'error');
      return false;
    }
    return true;
  };

  const closeCompose = () => {
    setShowCreateModal(false);
    setShowConfirm(false);
    setFormData(EMPTY_FORM);
    setRequestId(crypto.randomUUID());
  };

  const handleSendTest = async () => {
    if (!formData.title.trim() || !formData.body.trim()) {
      showToast('Please fill in title and message', 'error');
      return;
    }
    setIsSendingTest(true);
    try {
      await postToAdminFunction({
        action: 'send_test',
        title: formData.title,
        body: formData.body,
        data: formData.data,
        personalize: formData.personalize,
      });
      showToast('Test queued for your own devices', 'success');
      handleRefresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send test', 'error');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendNotification = async () => {
    if (!validateForm()) return;

    setIsSending(true);
    try {
      const result = await postToAdminFunction({
        action: 'send_notification',
        title: formData.title,
        body: formData.body,
        data: formData.data,
        target_type: formData.target_type,
        target_user_ids: formData.target_user_ids,
        target_segment_id: formData.target_segment_id || undefined,
        personalize: formData.personalize,
        respect_marketing_pref: formData.respect_marketing,
        rate_per_minute: formData.rate_per_minute,
        notification_type: 'manual',
        request_id: requestId,
      });

      showToast(result.message || 'Notification queued', 'success');
      closeCompose();
      handleRefresh();
    } catch (err) {
      console.error('Error sending notification:', err);
      // a rejected request can be retried as a new send; a dropped connection keeps the id so a retry cannot double-send
      if (!(err instanceof TypeError)) setRequestId(crypto.randomUUID());
      showToast(err instanceof Error ? err.message : 'Failed to send notification', 'error');
    } finally {
      setIsSending(false);
      setShowConfirm(false);
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

      showToast(result.message || 'Re-engagement alert queued', 'success');
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
      sending: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Sending' },
      paused: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Paused' },
      scheduled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Scheduled' },
      sent: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Sent' },
      delivered: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Delivered' },
      failed: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Failed' },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' },
      pending: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Pending' },
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
      system: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'System' },
      manual: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Manual' },
      reengagement: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Re-engagement' },
      marketing: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Marketing' },
    };

    const badge = badges[type] || badges.manual;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
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
    <div className="w-full min-w-0">
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-2xl font-semibold text-gray-900 mb-1">Push Notifications</h1>
          <p className="text-sm md:text-base text-gray-500">Send push notifications to mobile app users</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            className="p-2.5 md:p-3 rounded-xl bg-white hover:bg-gray-50 transition-colors shadow-soft border border-gray-100"
            disabled={refreshData.isPending}
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${refreshData.isPending ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            <span className="hidden sm:inline">Send Notification</span>
            <span className="sm:hidden">Send</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6 md:mb-8">
        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-3 md:mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Sent</p>
              <p className="text-lg font-semibold text-gray-900">{stats?.total_sent || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-3 md:mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Delivered</p>
              <p className="text-lg font-semibold text-gray-900">{stats?.total_delivered || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-3 md:mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Failed</p>
              <p className="text-lg font-semibold text-gray-900">{stats?.total_failed || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 md:p-6 shadow-soft border border-gray-100">
          <div className="flex justify-between items-start mb-3 md:mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Delivery Rate</p>
              <p className="text-lg font-semibold text-gray-900">{stats?.delivery_rate || 0}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100 mb-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Re-engagement Alerts</h3>
          <p className="text-sm text-gray-500">Send targeted notifications to bring users back</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REENGAGEMENT_CATEGORIES.map((category) => {
            const count = getReengagementCount(category.id);
            return (
              <div key={category.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">{category.title}</h4>
                  <p className="text-xs text-gray-600">{category.description}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-semibold text-xl text-gray-900">{count}</span>
                    <span className="text-gray-600 ml-1">eligible</span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setSelectedReengagement(category.id);
                        setShowRecipientsModal(true);
                      }}
                      className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                      disabled={count === 0}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReengagement(category.id);
                        setShowReengagementModal(true);
                      }}
                      className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={count === 0}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-gray-100">
        <div className="border-b border-gray-100 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Notification History
            </button>
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center space-x-2 ${
                activeTab === 'dispatch'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>Live Dispatch</span>
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
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="sent">Sent</option>
                  <option value="sending">Sending</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="failed">Failed</option>
                  <option value="draft">Draft</option>
                </select>
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
                          <td className="px-6 py-4 align-top">
                            {getStatusBadge(notification.status)}
                            <QueueProgress notification={notification} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">{notification.total_recipients.toLocaleString()}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex-1">
                              <div className="text-sm text-gray-900">{deliveryRate}%</div>
                              <div className="text-xs text-gray-500">
                                {notification.delivered_count} / {notification.total_recipients}
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
                        <p className="text-sm text-gray-500">No notifications found</p>
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
                  <p className="text-sm text-gray-600">Most recent devices notified (latest 100)</p>
                </div>
                <span className="text-xs text-gray-500">Refreshes every 10 seconds</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-600 mb-1">Dispatched Today</p>
                  <p className="text-lg font-semibold text-gray-900">{dispatchStatsData?.total_dispatched || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-600 mb-1">Success Rate</p>
                  <p className="text-lg font-semibold text-gray-900">{dispatchStatsData?.success_rate || 0}%</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-600 mb-1">Failed</p>
                  <p className="text-lg font-semibold text-gray-900">{dispatchStatsData?.total_failed || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-xs text-gray-600 mb-1">Avg. Delivery</p>
                  <p className="text-lg font-semibold text-gray-900">{dispatchStatsData?.avg_delivery_time || 0}s</p>
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
                      const isExpanded = expandedLog === log.id;

                      return (
                        <>
                          <tr
                            key={log.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              <div>{format(new Date(log.sent_at), 'HH:mm:ss')}</div>
                              <div className="text-xs text-gray-500">
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
                                      <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200">{log.user_id}</code>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-gray-600 mb-1">Notification ID</p>
                                      <code className="text-xs bg-white px-2 py-1 rounded border border-gray-200">{log.push_notification_id}</code>
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
                        <p className="text-sm text-gray-500">No dispatch logs found</p>
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
              <h2 className="text-2xl font-semibold text-gray-900">Send Push Notification</h2>
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
                        ? 'Message will start with "Hello [FirstName], ..."'
                        : 'Your message will be sent exactly as written'}
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
                  <option value="all">All users with notifications on</option>
                  <option value="segment">User Segment</option>
                </select>
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

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.respect_marketing}
                    onChange={(e) => setFormData({ ...formData, respect_marketing: e.target.checked })}
                    className="mt-0.5 h-4 w-4 text-gray-900 focus:ring-gray-900 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-900">Respect marketing preference</span>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.respect_marketing
                        ? 'Only users who switched marketing alerts on. This is usually a very small group.'
                        : 'Everyone who has notifications on. Users who switched notifications off are always skipped.'}
                    </p>
                  </div>
                </label>
              </div>

              <div className="border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-900 mb-1">Who will receive this</p>
                {audienceLoading ? (
                  <p className="text-sm text-gray-500">Counting...</p>
                ) : audienceError ? (
                  <p className="text-sm text-red-600">
                    {audienceError instanceof Error ? audienceError.message : 'Could not count the audience'}
                  </p>
                ) : audience ? (
                  <div className="text-sm text-gray-700 space-y-1">
                    <p>
                      <span className="text-xl font-semibold text-gray-900">{audience.users.toLocaleString()}</span> users ·{' '}
                      <span className="font-semibold text-gray-900">{audience.devices.toLocaleString()}</span> devices
                    </p>
                    <p className="text-xs text-gray-500">
                      {audience.opted_out_users.toLocaleString()} users skipped (notifications off
                      {formData.respect_marketing ? ' or marketing off' : ''})
                      {audience.devices_over_cap > 0 &&
                        ` · ${audience.devices_over_cap.toLocaleString()} older devices skipped (newest 3 per user)`}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Choose a segment to see the audience</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Send speed</label>
                <div className="grid grid-cols-3 gap-2">
                  {SPEED_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, rate_per_minute: preset.value })}
                      className={`px-3 py-2 rounded-xl border text-left transition-colors ${
                        formData.rate_per_minute === preset.value
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-sm font-medium">{preset.label}</div>
                      <div className={`text-xs ${formData.rate_per_minute === preset.value ? 'text-gray-300' : 'text-gray-500'}`}>
                        {preset.hint}
                      </div>
                    </button>
                  ))}
                </div>
                {audience && audience.devices > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Takes {formatDuration((audience.devices / formData.rate_per_minute) * 60)} to reach everyone. You can pause or stop it at any time.
                  </p>
                )}
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Preview</h3>
                <div className="text-sm text-gray-800">
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
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end space-x-3">
              <button
                onClick={closeCompose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                onClick={handleSendTest}
                disabled={isSending || isSendingTest}
                className="px-4 py-2 text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50"
              >
                {isSendingTest ? 'Sending test...' : 'Send test to me'}
              </button>
              <button
                onClick={() => validateForm() && setShowConfirm(true)}
                disabled={isSending || audienceLoading || !!audienceError || !audience || audience.devices === 0}
                className="flex items-center space-x-2 px-6 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
                <span>Review and send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirm && audience && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">Send to {audience.devices.toLocaleString()} devices?</h2>
            </div>
            <div className="p-6 space-y-3 text-sm text-gray-700">
              <p>
                <span className="font-semibold text-gray-900">{formData.title}</span>
                <br />
                {formData.body}
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
                <p>{audience.users.toLocaleString()} users · {audience.devices.toLocaleString()} devices</p>
                <p>Speed: {formData.rate_per_minute.toLocaleString()} devices per minute</p>
                <p>Takes {formatDuration((audience.devices / formData.rate_per_minute) * 60)}</p>
                {formData.respect_marketing && <p>Marketing preference respected</p>}
              </div>
              <p className="text-xs text-gray-500">Once a device has been notified it cannot be recalled. You can pause or cancel the rest from the history.</p>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                disabled={isSending}
              >
                Back
              </button>
              <button
                onClick={handleSendNotification}
                disabled={isSending}
                className="flex items-center space-x-2 px-6 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                    <span>Queuing...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Send now</span>
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
              <h2 className="text-2xl font-semibold text-gray-900">Confirm Re-engagement Alert</h2>
            </div>

            <div className="p-6 space-y-4">
              {(() => {
                const category = REENGAGEMENT_CATEGORIES.find(c => c.id === selectedReengagement);
                const count = getReengagementCount(selectedReengagement);
                return category ? (
                  <>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{category.title}</h3>
                      <p className="text-sm text-gray-600">{category.description}</p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <p className="text-sm text-gray-900">
                        This will send a notification to <span className="font-semibold">{count} eligible users</span>.
                      </p>
                    </div>

                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Preview</h4>
                      <div className="text-sm text-gray-800">
                        <p className="font-semibold">{category.template.title}</p>
                        <p className="mt-1">{category.template.body}</p>
                      </div>
                    </div>
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
              <h2 className="text-2xl font-semibold text-gray-900">Eligible Recipients</h2>
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
                  <p className="text-sm text-gray-500">No eligible users found</p>
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
