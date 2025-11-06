import { useState } from 'react';
import { Plus, RefreshCw, Mail, TrendingUp, Send, Users, BarChart, Edit2, Trash2, Target } from 'lucide-react';
import { useMarketingCampaigns, useCampaignStats } from '@/hooks/queries/useMarketingCampaigns';
import { useSegments } from '@/hooks/queries/useSegments';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export default function Marketing() {
  const { data: campaigns, isLoading, error } = useMarketingCampaigns();
  const { data: stats } = useCampaignStats();
  const { data: segments } = useSegments();
  const refreshData = useRefreshData();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [selectedSegment, setSelectedSegment] = useState<any>(null);

  const handleRefresh = () => {
    refreshData.mutate(['marketing-campaigns', 'campaign-stats', 'campaign-segments']);
  };

  const handleDeleteSegment = async (segmentId: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) return;

    try {
      const { error } = await supabase
        .from('campaign_segments')
        .delete()
        .eq('id', segmentId);

      if (error) throw error;

      refreshData.mutate(['campaign-segments']);
    } catch (error) {
      console.error('Error deleting segment:', error);
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      promotional: 'bg-purple-100 text-purple-800',
      product_update: 'bg-blue-100 text-blue-800',
      educational: 'bg-green-100 text-green-800',
      announcement: 'bg-amber-100 text-amber-800',
      retention: 'bg-red-100 text-red-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      sending: 'bg-amber-100 text-amber-800',
      sent: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error mb-4">Failed to load campaigns</p>
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketing Campaigns</h1>
          <p className="text-gray-500 mt-1">Create and manage email marketing campaigns</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-dark transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Campaigns</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total_campaigns || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Sent</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total_sent || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <Send className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Total Opens</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.total_opened || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-500 mb-1">Avg Open Rate</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.avg_open_rate.toFixed(1) || 0}%</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
              <BarChart className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">User Segments</h2>
          <button
            onClick={() => {
              setSelectedSegment(null);
              setShowSegmentModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Segment</span>
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments?.map((segment) => (
              <div
                key={segment.id}
                className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Target className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{segment.name}</h3>
                      <p className="text-xs text-gray-500">{segment.user_count} users</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setSelectedSegment(segment);
                        setShowSegmentModal(true);
                      }}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSegment(segment.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {segment.description && (
                  <p className="text-sm text-gray-600 mb-3">{segment.description}</p>
                )}
                <div className="space-y-1">
                  {Object.entries(segment.filters).map(([key, value]) => (
                    <div key={key} className="text-xs text-gray-500">
                      <span className="font-medium">{key.replace('_', ' ')}:</span> {String(value)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {(!segments || segments.length === 0) && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No segments created yet</p>
                <p className="text-sm">Create custom audience segments to target your campaigns</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">All Campaigns</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recipients
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {campaigns?.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{campaign.title}</p>
                      <p className="text-xs text-gray-500">{campaign.subject}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryBadgeColor(campaign.category)}`}>
                      {campaign.category.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-1 text-sm text-gray-900">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{campaign.recipient_count || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs text-gray-500">
                      <div>Delivered: {campaign.delivered_count || 0}</div>
                      <div>Opened: {campaign.opened_count || 0}</div>
                      <div>Clicked: {campaign.clicked_count || 0}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(campaign.created_at), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {campaign.status === 'draft' && (
                      <button
                        onClick={() => {
                          setSelectedCampaign(campaign);
                          setShowSendModal(true);
                        }}
                        className="text-accent hover:text-accent-dark transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refreshData.mutate(['marketing-campaigns', 'campaign-stats']);
          }}
        />
      )}

      {showSendModal && selectedCampaign && (
        <SendCampaignModal
          campaign={selectedCampaign}
          onClose={() => {
            setShowSendModal(false);
            setSelectedCampaign(null);
          }}
          onSuccess={() => {
            setShowSendModal(false);
            setSelectedCampaign(null);
            refreshData.mutate(['marketing-campaigns', 'campaign-stats']);
          }}
        />
      )}

      {showSegmentModal && (
        <SegmentModal
          segment={selectedSegment}
          onClose={() => {
            setShowSegmentModal(false);
            setSelectedSegment(null);
          }}
          onSuccess={() => {
            setShowSegmentModal(false);
            setSelectedSegment(null);
            refreshData.mutate(['campaign-segments']);
          }}
        />
      )}
    </div>
  );
}

function CreateCampaignModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    html_content: '',
    category: 'promotional',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-campaigns`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_campaign',
          ...formData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create campaign');
      }

      showToast('Campaign created successfully', 'success');
      onSuccess();
    } catch (error) {
      console.error('Error creating campaign:', error);
      showToast('Failed to create campaign', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Create New Campaign</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Campaign Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g., New Feature Launch"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Subject
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Introducing Smart Savings"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              <option value="promotional">Promotional</option>
              <option value="product_update">Product Update</option>
              <option value="educational">Educational</option>
              <option value="announcement">Announcement</option>
              <option value="retention">Retention</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Content (HTML)
            </label>
            <textarea
              rows={12}
              required
              placeholder="Enter HTML content..."
              value={formData.html_content}
              onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent resize-none font-mono text-sm"
            />
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SendCampaignModal({
  campaign,
  onClose,
  onSuccess,
}: {
  campaign: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [segment, setSegment] = useState('all_active');
  const [scheduledDate, setScheduledDate] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-campaigns`;

      const body = isScheduled
        ? {
            action: 'schedule_campaign',
            campaign_id: campaign.id,
            scheduled_at: scheduledDate,
            recipient_filters: { segment },
          }
        : {
            action: 'send_campaign',
            campaign_id: campaign.id,
            recipient_filters: { segment },
          };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to send campaign');
      }

      const result = await response.json();
      showToast(result.message || 'Campaign sent successfully', 'success');
      onSuccess();
    } catch (error) {
      console.error('Error sending campaign:', error);
      showToast('Failed to send campaign', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Send Campaign</h2>
          <p className="text-sm text-gray-500 mt-1">{campaign.title}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Audience
            </label>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              <option value="all_active">All Active Users</option>
              <option value="kyc_verified">KYC Verified Users</option>
              <option value="active_payout_plans">Users with Active Payout Plans</option>
            </select>
          </div>

          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="w-4 h-4 text-accent rounded focus:ring-2 focus:ring-accent"
              />
              <span className="text-sm text-gray-700">Schedule for later</span>
            </label>
          </div>

          {isScheduled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schedule Date & Time
              </label>
              <input
                type="datetime-local"
                required={isScheduled}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>
          )}

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : isScheduled ? 'Schedule' : 'Send Now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SegmentModal({
  segment,
  onClose,
  onSuccess,
}: {
  segment?: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name: segment?.name || '',
    description: segment?.description || '',
    kycStatus: segment?.filters?.kyc_status || '',
    hasPayoutPlan: segment?.filters?.has_payout_plan || false,
    inactiveDays: segment?.filters?.inactive_days || '',
    minBalance: segment?.filters?.min_balance || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimatedUsers, setEstimatedUsers] = useState(segment?.user_count || 0);

  const calculateUserCount = async () => {
    try {
      let query = supabase.from('profiles').select('id', { count: 'exact', head: true });

      if (formData.kycStatus) {
        query = query.eq('kyc_status', formData.kycStatus);
      }

      if (formData.hasPayoutPlan) {
        const { data: activePlans } = await supabase
          .from('payout_plans')
          .select('user_id')
          .eq('status', 'active');

        const userIds = activePlans?.map((p) => p.user_id) || [];
        if (userIds.length > 0) {
          query = query.in('id', userIds);
        } else {
          setEstimatedUsers(0);
          return;
        }
      }

      const { count } = await query;
      setEstimatedUsers(count || 0);
    } catch (error) {
      console.error('Error calculating user count:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const filters: Record<string, any> = {};
      if (formData.kycStatus) filters.kyc_status = formData.kycStatus;
      if (formData.hasPayoutPlan) filters.has_payout_plan = true;
      if (formData.inactiveDays) filters.inactive_days = parseInt(formData.inactiveDays);
      if (formData.minBalance) filters.min_balance = parseFloat(formData.minBalance);

      const payload = {
        name: formData.name,
        description: formData.description || null,
        filters,
        user_count: estimatedUsers,
      };

      let error;
      if (segment) {
        const result = await supabase
          .from('campaign_segments')
          .update(payload)
          .eq('id', segment.id);
        error = result.error;
      } else {
        const result = await supabase.from('campaign_segments').insert([payload]);
        error = result.error;
      }

      if (error) throw error;

      showToast(
        segment ? 'Segment updated successfully' : 'Segment created successfully',
        'success'
      );
      onSuccess();
    } catch (error) {
      console.error('Error saving segment:', error);
      showToast('Failed to save segment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">
            {segment ? 'Edit Segment' : 'Create New Segment'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Define filters to create a targeted audience segment
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Segment Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Active Premium Users"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Brief description of this segment..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Audience Filters</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  KYC Status
                </label>
                <select
                  value={formData.kycStatus}
                  onChange={(e) => setFormData({ ...formData, kycStatus: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Users</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasPayoutPlan}
                    onChange={(e) =>
                      setFormData({ ...formData, hasPayoutPlan: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Has Active Payout Plan</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Inactive for (days)
                </label>
                <input
                  type="number"
                  placeholder="e.g., 30"
                  value={formData.inactiveDays}
                  onChange={(e) => setFormData({ ...formData, inactiveDays: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g., 1000"
                  value={formData.minBalance}
                  onChange={(e) => setFormData({ ...formData, minBalance: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Estimated Audience Size</p>
                <p className="text-xs text-gray-500">Based on current filters</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{estimatedUsers}</p>
                <button
                  type="button"
                  onClick={calculateUserCount}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  Recalculate
                </button>
              </div>
            </div>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting
                ? 'Saving...'
                : segment
                ? 'Update Segment'
                : 'Create Segment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
