import { useState, useEffect } from 'react';
import { Bell, Send, RefreshCw, Users, CheckCircle, XCircle, Search, Filter, Clock } from 'lucide-react';
import { useNotifications, useNotificationSegments, useNotificationStats } from '@/hooks/queries/useNotifications';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import StatCard from '@/components/StatCard';

interface NotificationFormData {
  title: string;
  body: string;
  data: Record<string, any>;
  target_type: 'all' | 'individual' | 'segment';
  target_user_ids: string[];
  target_segment_id: string;
  send_time: 'now' | 'later';
  scheduled_date: string;
  scheduled_time: string;
  personalize: boolean;
}

export default function Notifications() {
  const { data: notifications, isLoading, error } = useNotifications();
  const { data: segments } = useNotificationSegments();
  const { data: stats } = useNotificationStats();
  const refreshData = useRefreshData();
  const { showToast } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [processingScheduled, setProcessingScheduled] = useState<string | null>(null);

  const [formData, setFormData] = useState<NotificationFormData>({
    title: '',
    body: '',
    data: {},
    target_type: 'all',
    target_user_ids: [],
    target_segment_id: '',
    send_time: 'now',
    scheduled_date: '',
    scheduled_time: '',
    personalize: false,
  });

  const handleRefresh = () => {
    refreshData.mutate(['push-notifications', 'notification-stats', 'push-notification-segments']);
  };

  const processDueScheduledNotifications = async () => {
    try {
      if (!notifications) return;

      const dueNotifications = notifications.filter((n: any) =>
        n.status === 'scheduled' &&
        n.scheduled_for &&
        new Date(n.scheduled_for) <= new Date()
      );

      if (dueNotifications.length === 0) return;

      console.log(`Found ${dueNotifications.length} due notifications, processing...`);

      for (const notification of dueNotifications) {
        await handleSendScheduledNotification(notification.id);
      }
    } catch (err) {
      console.error('Error processing due notifications:', err);
    }
  };

  useEffect(() => {
    processDueScheduledNotifications();

    const interval = setInterval(() => {
      processDueScheduledNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [notifications]);

  const handleSendScheduledNotification = async (notificationId: string) => {
    setProcessingScheduled(notificationId);

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
            action: 'process_scheduled',
            notification_id: notificationId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send scheduled notification');
      }

      showToast(result.message || 'Scheduled notification sent successfully', 'success');
      handleRefresh();
    } catch (err) {
      console.error('Error sending scheduled notification:', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to send scheduled notification',
        'error'
      );
    } finally {
      setProcessingScheduled(null);
    }
  };

  const handleSendNotification = async () => {
    if (!formData.title.trim() || !formData.body.trim()) {
      showToast('Please fill in title and message', 'error');
      return;
    }

    if (formData.target_type === 'segment' && !formData.target_segment_id) {
      showToast('Please select a segment', 'error');
      return;
    }

    if (formData.send_time === 'later' && (!formData.scheduled_date || !formData.scheduled_time)) {
      showToast('Please select date and time for scheduled notification', 'error');
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
            schedule_for: formData.send_time === 'later'
              ? (() => {
                  const watDateTime = `${formData.scheduled_date}T${formData.scheduled_time}:00`;
                  const date = new Date(watDateTime);
                  const watOffset = 1 * 60;
                  const localOffset = date.getTimezoneOffset();
                  const offsetDiff = watOffset + localOffset;
                  date.setMinutes(date.getMinutes() - offsetDiff);
                  return date.toISOString();
                })()
              : undefined,
            personalize: formData.personalize,
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
        send_time: 'now',
        scheduled_date: '',
        scheduled_time: '',
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Draft' },
      scheduled: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Scheduled' },
      sending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Sending' },
      sent: { bg: 'bg-green-100', text: 'text-green-800', label: 'Sent' },
      failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' },
    };

    const badge = badges[status] || badges.draft;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
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
                <option value="scheduled">Scheduled</option>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {notification.status === 'scheduled' && (
                          <button
                            onClick={() => handleSendScheduledNotification(notification.id)}
                            disabled={processingScheduled === notification.id}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingScheduled === notification.id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></div>
                                <span className="text-xs">Sending...</span>
                              </>
                            ) : (
                              <>
                                <Send className="h-3 w-3" />
                                <span className="text-xs">Send Now</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Bell className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">No notifications found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                  <option value="all">All Users</option>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send Time *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, send_time: 'now' })}
                    className={`px-4 py-3 rounded-xl border-2 transition-all ${
                      formData.send_time === 'now'
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Send className="h-4 w-4" />
                      <span className="font-medium">Send Now</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, send_time: 'later' })}
                    className={`px-4 py-3 rounded-xl border-2 transition-all ${
                      formData.send_time === 'later'
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">Schedule</span>
                    </div>
                  </button>
                </div>
              </div>

              {formData.send_time === 'later' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formData.scheduled_date}
                      onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time *
                    </label>
                    <input
                      type="time"
                      value={formData.scheduled_time}
                      onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>
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
                    send_time: 'now',
                    scheduled_date: '',
                    scheduled_time: '',
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
                    <span>{formData.send_time === 'later' ? 'Scheduling...' : 'Sending...'}</span>
                  </>
                ) : (
                  <>
                    {formData.send_time === 'later' ? (
                      <>
                        <Clock className="h-4 w-4" />
                        <span>Schedule Notification</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Send Notification</span>
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
