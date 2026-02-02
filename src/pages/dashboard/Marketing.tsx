import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Mail, TrendingUp, Send, Users, BarChart, Edit2, Eye, Save, CheckCircle, XCircle, Clock, Search, RotateCcw, Trash2, Filter, X } from 'lucide-react';
import { useMarketingCampaigns, useCampaignStats } from '@/hooks/queries/useMarketingCampaigns';
import { useSegments } from '@/hooks/queries/useSegments';
import { useSenderEmails } from '@/hooks/queries/useSenderEmails';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import RichTextEditor from '@/components/RichTextEditor';
import { useQuery } from '@tanstack/react-query';
import { EMAIL_TEMPLATES } from '@/lib/emailTemplates';

export default function Marketing() {
  const { data: campaigns, isLoading, error } = useMarketingCampaigns();
  const { data: stats } = useCampaignStats();
  const refreshData = useRefreshData();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [selectedSegment, setSelectedSegment] = useState<any>(null);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    dateFrom: '',
    dateTo: '',
  });
  const [deleting, setDeleting] = useState(false);

  const { showToast } = useToast();

  const handleRefresh = () => {
    refreshData.mutate(['marketing-campaigns', 'campaign-stats', 'campaign-segments']);
  };

  const handleSelectCampaign = (campaignId: string) => {
    setSelectedCampaignIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId);
      } else {
        newSet.add(campaignId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedCampaignIds.size === filteredCampaigns.length) {
      setSelectedCampaignIds(new Set());
    } else {
      setSelectedCampaignIds(new Set(filteredCampaigns.map((c: any) => c.id)));
    }
  };

  const handleDeleteCampaigns = async () => {
    if (selectedCampaignIds.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedCampaignIds.size} campaign(s)? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const campaignIdsArray = Array.from(selectedCampaignIds);

      // Delete campaigns via edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'delete_campaigns',
          campaign_ids: campaignIdsArray,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to delete campaigns');
      }

      if (!result.success) {
        throw new Error(result.message || 'Failed to delete campaigns');
      }

      showToast(`Successfully deleted ${campaignIdsArray.length} campaign(s)`, 'success');
      setSelectedCampaignIds(new Set());
      handleRefresh();
    } catch (error) {
      console.error('Error deleting campaigns:', error);
      showToast(error instanceof Error ? error.message : 'Failed to delete campaigns', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Filter campaigns based on filters
  const filteredCampaigns = campaigns?.filter((campaign: any) => {
    if (filters.status !== 'all' && campaign.status !== filters.status) return false;
    if (filters.category !== 'all' && campaign.category !== filters.category) return false;
    if (filters.dateFrom) {
      const campaignDate = new Date(campaign.created_at);
      const fromDate = new Date(filters.dateFrom);
      if (campaignDate < fromDate) return false;
    }
    if (filters.dateTo) {
      const campaignDate = new Date(campaign.created_at);
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // Include the entire day
      if (campaignDate > toDate) return false;
    }
    return true;
  }) || [];

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
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">All Campaigns</h2>
            <div className="flex items-center space-x-2">
              {selectedCampaignIds.size > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {selectedCampaignIds.size} selected
                  </span>
                  <button
                    onClick={handleDeleteCampaigns}
                    disabled={deleting}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{deleting ? 'Deleting...' : 'Delete Selected'}</span>
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 text-sm border rounded-lg transition-colors flex items-center space-x-2 ${
                  showFilters || filters.status !== 'all' || filters.category !== 'all' || filters.dateFrom || filters.dateTo
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {(filters.status !== 'all' || filters.category !== 'all' || filters.dateFrom || filters.dateTo) && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {[filters.status !== 'all', filters.category !== 'all', filters.dateFrom, filters.dateTo].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>
          </div>
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="sending">Sending</option>
                    <option value="sent">Sent</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  >
                    <option value="all">All Categories</option>
                    <option value="promotional">Promotional</option>
                    <option value="product_update">Product Update</option>
                    <option value="educational">Educational</option>
                    <option value="announcement">Announcement</option>
                    <option value="retention">Retention</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                    {(filters.status !== 'all' || filters.category !== 'all' || filters.dateFrom || filters.dateTo) && (
                      <button
                        onClick={() => setFilters({ status: 'all', category: 'all', dateFrom: '', dateTo: '' })}
                        className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                        title="Clear filters"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={selectedCampaignIds.size === filteredCampaigns.length && filteredCampaigns.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                </th>
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
              {filteredCampaigns.map((campaign: any) => (
                <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedCampaignIds.has(campaign.id)}
                      onChange={() => handleSelectCampaign(campaign.id)}
                      className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                  </td>
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
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {
                          setSelectedCampaign(campaign);
                          setShowPreviewModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {(campaign.status === 'sent' || campaign.status === 'sending') && (
                        <button
                          onClick={() => {
                            setSelectedCampaign(campaign);
                            setShowRecipientsModal(true);
                          }}
                          className="text-green-600 hover:text-green-800 transition-colors"
                          title="View Recipients"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                      )}
                      {campaign.status === 'draft' && (
                        <>
                          <button
                            onClick={() => {
                              setEditingCampaign(campaign);
                              setShowCreateModal(true);
                            }}
                            className="text-gray-600 hover:text-gray-800 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCampaign(campaign);
                              setShowSendModal(true);
                            }}
                            className="text-accent hover:text-accent-dark transition-colors"
                            title="Send"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateCampaignModal
          campaign={editingCampaign}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCampaign(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingCampaign(null);
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

      {showPreviewModal && selectedCampaign && (
        <PreviewModal
          campaign={selectedCampaign}
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedCampaign(null);
          }}
        />
      )}

      {showRecipientsModal && selectedCampaign && (
        <RecipientsModal
          campaign={selectedCampaign}
          onClose={() => {
            setShowRecipientsModal(false);
            setSelectedCampaign(null);
          }}
        />
      )}
    </div>
  );
}

function RecipientsModal({ campaign, onClose }: { campaign: any; onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [retrying, setRetrying] = useState(false);
  const { showToast } = useToast();

  const { data: recipients, isLoading, refetch } = useQuery({
    queryKey: ['campaign-recipients', campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_recipients')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!campaign.id,
  });

  const handleRetry = async (recipientIds?: string[]) => {
    setRetrying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-campaigns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'retry_campaign',
          campaign_id: campaign.id,
          recipient_ids: recipientIds,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to retry campaign');
      }

      if (!result.success) {
        throw new Error(result.message || 'Failed to retry campaign');
      }

      showToast(result.message || 'Campaign retry initiated successfully', 'success');
      refetch();
    } catch (error) {
      console.error('Error retrying campaign:', error);
      showToast(error instanceof Error ? error.message : 'Failed to retry campaign', 'error');
    } finally {
      setRetrying(false);
    }
  };

  const filteredRecipients = recipients?.filter((r: any) => {
    const matchesSearch = !searchQuery || 
      r.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const statusCounts = recipients?.reduce((acc: any, r: any) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {}) || {};

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'sent':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'bounced':
        return <XCircle className="w-4 h-4 text-orange-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'pending':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'sent':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'bounced':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Campaign Recipients</h2>
            <p className="text-sm text-gray-500 mt-1">{campaign.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">Total:</span>
                <span className="text-sm font-bold text-gray-900">{recipients?.length || 0}</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">Delivered: {statusCounts.delivered || 0}</span>
              </div>
              <div className="flex items-center space-x-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-gray-600">Failed: {statusCounts.failed || 0}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Pending: {statusCounts.pending || 0}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {(statusCounts.failed > 0 || statusCounts.pending > 0) && (
                <button
                  onClick={() => handleRetry()}
                  disabled={retrying}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                  <span>{retrying ? 'Retrying...' : `Retry All (${(statusCounts.failed || 0) + (statusCounts.pending || 0)})`}</span>
                </button>
              )}
              <button
                onClick={() => refetch()}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="delivered">Delivered</option>
              <option value="sent">Sent</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="bounced">Bounced</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
            </div>
          ) : filteredRecipients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No recipients found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecipients.map((recipient: any) => {
                const isPending = recipient.status === 'pending';
                const isFailed = recipient.status === 'failed';
                const isPendingTimeout = isPending && recipient.created_at && 
                  (Date.now() - new Date(recipient.created_at).getTime()) > 5 * 60 * 1000; // 5 minutes timeout

                return (
                  <div
                    key={recipient.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {getStatusIcon(recipient.status)}
                          <span className="font-medium text-gray-900">{recipient.email}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(recipient.status)}`}>
                            {recipient.status}
                          </span>
                          {isPendingTimeout && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                              Timeout
                            </span>
                          )}
                        </div>
                        {recipient.error_message && (
                          <p className="text-sm text-red-600 ml-7 mt-1">
                            Error: {recipient.error_message}
                          </p>
                        )}
                        {isPendingTimeout && (
                          <p className="text-sm text-orange-600 ml-7 mt-1">
                            This email has been pending for more than 5 minutes. Consider retrying.
                          </p>
                        )}
                        <div className="flex items-center space-x-4 ml-7 mt-2 text-xs text-gray-500">
                          {recipient.sent_at && (
                            <span>Sent: {format(new Date(recipient.sent_at), 'MMM dd, yyyy HH:mm')}</span>
                          )}
                          {recipient.delivered_at && (
                            <span>Delivered: {format(new Date(recipient.delivered_at), 'MMM dd, yyyy HH:mm')}</span>
                          )}
                          {recipient.opened_at && (
                            <span className="text-green-600">Opened: {format(new Date(recipient.opened_at), 'MMM dd, yyyy HH:mm')}</span>
                          )}
                          {recipient.clicked_at && (
                            <span className="text-blue-600">Clicked: {format(new Date(recipient.clicked_at), 'MMM dd, yyyy HH:mm')}</span>
                          )}
                          {isPending && recipient.created_at && (
                            <span className="text-gray-400">
                              Pending for: {Math.floor((Date.now() - new Date(recipient.created_at).getTime()) / 60000)}m
                            </span>
                          )}
                        </div>
                      </div>
                      {(isFailed || isPendingTimeout) && (
                        <button
                          onClick={() => handleRetry([recipient.id])}
                          disabled={retrying}
                          className="ml-4 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Retry this email"
                        >
                          <RotateCcw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ campaign, onClose }: { campaign: any; onClose: () => void }) {
  const { data: senderEmails } = useSenderEmails();
  const [senderEmail, setSenderEmail] = useState<{ display_name: string; email: string } | null>(null);

  useEffect(() => {
    const fetchSenderEmail = async () => {
      if (campaign.from_email_id && senderEmails) {
        const email = senderEmails.find(e => e.id === campaign.from_email_id);
        if (email) {
          setSenderEmail({ display_name: email.display_name, email: email.email });
          return;
        }
      }
      // Fallback to default or hardcoded
      const defaultEmail = senderEmails?.find(e => e.is_default) || senderEmails?.[0];
      if (defaultEmail) {
        setSenderEmail({ display_name: defaultEmail.display_name, email: defaultEmail.email });
      } else {
        setSenderEmail({ display_name: 'Martins Osodi - Planmoni CEO', email: 'hello@planmoni.com' });
      }
    };

    fetchSenderEmail();
  }, [campaign.from_email_id, senderEmails]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Campaign Preview</h2>
            <p className="text-sm text-gray-500 mt-1">{campaign.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Subject</p>
                <p className="text-base font-semibold text-gray-900">{campaign.subject}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Category</p>
                  <p className="text-sm text-gray-900 capitalize">{campaign.category.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Status</p>
                  <p className="text-sm text-gray-900 capitalize">{campaign.status}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Email Content</h3>
              <span className="text-xs text-gray-500">HTML Preview</span>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <div className="p-4 bg-gray-100 border-b border-gray-200">
                <p className="text-xs text-gray-600">
                  From: {senderEmail ? `${senderEmail.display_name} <${senderEmail.email}>` : 'Loading...'}
                </p>
                <p className="text-xs text-gray-600 mt-1">Subject: {campaign.subject}</p>
              </div>
              <div className="p-6 max-h-96 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: campaign.html_content }} />
              </div>
            </div>
          </div>

          {campaign.plain_text_content && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Plain Text Version</h3>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                  {campaign.plain_text_content}
                </pre>
              </div>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

/** Wraps fragment (e.g. from Rich Editor) in a full document with styles so preview isn't broken */
const PREVIEW_FRAGMENT_STYLES = `
  body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #333; background: #f9fafb; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  p { margin: 0 0 1em; }
  h1, h2, h3, h4, h5, h6 { margin: 0 0 0.5em; font-weight: 600; line-height: 1.3; }
  ul, ol { margin: 0 0 1em; padding-left: 1.5em; }
  blockquote { margin: 0 0 1em; padding-left: 1em; border-left: 4px solid #e5e7eb; color: #6b7280; }
  img { max-width: 100%; height: auto; }
  .ql-align-center { text-align: center; }
  .ql-align-right { text-align: right; }
  .ql-align-justify { text-align: justify; }
  .ql-size-small { font-size: 0.875em; }
  .ql-size-large { font-size: 1.25em; }
  .ql-size-huge { font-size: 1.5em; }
`;

/** Parse full HTML document and return { bodyHTML, styles } for use in Rich Editor */
function parseFullHtmlDocument(html: string): { bodyHTML: string; styles: string } | null {
  const trimmed = html.trim();
  if (!/^\s*<!DOCTYPE|^\s*<html/i.test(trimmed)) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const bodyHTML = doc.body?.innerHTML ?? '';
    const styleEls = doc.querySelectorAll('style');
    const styles = Array.from(styleEls)
      .map((el) => el.textContent || '')
      .filter(Boolean)
      .join('\n');
    return { bodyHTML, styles };
  } catch {
    return null;
  }
}

/** Scope CSS so it only applies inside .ql-editor (for Rich Text Editor). Handles @media and other at-rules. */
function scopeCssToQuillEditor(css: string): string {
  if (!css.trim()) return css;
  const scope = '.ql-editor';

  function scopeSelectors(selectorBlock: string): string {
    return selectorBlock
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((sel) => (sel.startsWith('body') ? scope : `${scope} ${sel}`))
      .join(', ');
  }

  function scopeBlock(block: string): string {
    const trimmed = block.trim();
    if (!trimmed) return block;
    // At-rule (e.g. @media, @supports): keep header, scope inner body
    const atRuleMatch = trimmed.match(/^(@[\w-]+[^{]*)\{/);
    if (atRuleMatch) {
      const atRuleHeader = atRuleMatch[1];
      const innerStart = atRuleMatch[0].length;
      let depth = 1;
      let i = innerStart;
      while (i < block.length && depth > 0) {
        const c = block[i];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        i++;
      }
      const innerBody = block.slice(innerStart, i - 1);
      const scopedInner = scopeCssByBraceDepth(innerBody);
      return `${atRuleHeader}{ ${scopedInner} }`;
    }
    // Ordinary rule: scope selectors
    const idx = trimmed.indexOf('{');
    if (idx === -1) return block;
    const before = trimmed.slice(0, idx).trim();
    const rest = trimmed.slice(idx);
    const selectors = scopeSelectors(before);
    return selectors ? `${selectors} ${rest}` : block;
  }

  function scopeCssByBraceDepth(text: string): string {
    const result: string[] = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '}' || ch === '{') {
        i++;
        continue;
      }
      const start = i;
      let depth = 0;
      while (i < text.length) {
        const c = text[i];
        if (c === '{') {
          depth++;
          i++;
        } else if (c === '}') {
          depth--;
          i++;
          if (depth === 0) break;
        } else {
          i++;
        }
      }
      const block = text.slice(start, i).trim();
      if (block) result.push(scopeBlock(block));
    }
    return result.join(' ');
  }

  const blocks: string[] = [];
  let i = 0;
  while (i < css.length) {
    const start = i;
    let depth = 0;
    while (i < css.length) {
      const c = css[i];
      if (c === '{') {
        depth++;
        i++;
      } else if (c === '}') {
        depth--;
        i++;
        if (depth === 0) break;
      } else {
        i++;
      }
    }
    const block = css.slice(start, i).trim();
    if (block) blocks.push(scopeBlock(block));
  }
  return blocks.join('\n');
}

function EmailPreviewIframe({ htmlContent, optionalStyles }: { htmlContent: string; optionalStyles?: string | null }) {
  const isFullDocument = /^\s*<!DOCTYPE|^\s*<html/i.test(htmlContent.trim());
  const fragmentStyles = optionalStyles || PREVIEW_FRAGMENT_STYLES;
  const srcDoc = isFullDocument
    ? htmlContent
    : `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>${fragmentStyles}</style></head><body>${htmlContent}</body></html>`;

  return (
    <iframe
      title="Email preview"
      srcDoc={srcDoc}
      className="w-full border-0 rounded-b-xl"
      style={{ height: '500px', display: 'block' }}
      sandbox="allow-same-origin"
    />
  );
}

function CreateCampaignModal({ campaign, onClose, onSuccess }: { campaign?: any; onClose: () => void; onSuccess: () => void }) {
  const { showToast } = useToast();
  const { data: segments } = useSegments();
  const { data: senderEmails } = useSenderEmails();
  const [formData, setFormData] = useState({
    title: campaign?.title || '',
    subject: campaign?.subject || '',
    html_content: campaign?.html_content || '',
    plain_text_content: campaign?.plain_text_content || '',
    category: campaign?.category || 'promotional',
    target_segment: 'all',
    from_email_id: campaign?.from_email_id || (senderEmails?.find(e => e.is_default)?.id || ''),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [estimatedRecipients, setEstimatedRecipients] = useState(0);
  const [isCalculatingRecipients, setIsCalculatingRecipients] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(campaign?.updated_at ? new Date(campaign.updated_at) : null);
  const [editorMode, setEditorMode] = useState<'rich' | 'html' | 'preview'>('rich');
  const [extractedStylesForEditor, setExtractedStylesForEditor] = useState<string | null>(null);

  const calculateRecipients = useCallback(async (segmentValue?: string) => {
    const targetSegment = segmentValue || formData.target_segment;
    setIsCalculatingRecipients(true);
    try {
      if (targetSegment === 'all') {
        const { data, error } = await supabase.rpc('get_all_users_count');
        if (error) throw error;
        setEstimatedRecipients(data || 0);
      } else if (targetSegment === 'active_users') {
        const { data, error } = await supabase.rpc('get_active_users_count');
        if (error) throw error;
        setEstimatedRecipients(data || 0);
      } else if (targetSegment === 'users_with_balance') {
        const { data, error } = await supabase.rpc('get_users_with_balance_count');
        if (error) throw error;
        setEstimatedRecipients(data || 0);
      } else if (targetSegment === 'users_with_plans') {
        const { data, error } = await supabase.rpc('get_users_with_plans_count');
        if (error) throw error;
        setEstimatedRecipients(data || 0);
      } else if (targetSegment === 'kyc_tier_0') {
        const { data, error } = await supabase.rpc('get_kyc_tier_count', { tier_level: 0 });
        if (error) throw error;
        setEstimatedRecipients(data || 0);
      } else if (targetSegment === 'kyc_tier_1') {
        const { data, error } = await supabase.rpc('get_kyc_tier_count', { tier_level: 1 });
        if (error) throw error;
        setEstimatedRecipients(data || 0);
      } else if (targetSegment === 'kyc_tier_2') {
        const { data, error } = await supabase.rpc('get_kyc_tier_count', { tier_level: 2 });
        if (error) throw error;
        setEstimatedRecipients(data || 0);
      } else if (targetSegment === 'kyc_tier_3') {
        const { data, error } = await supabase.rpc('get_kyc_tier_count', { tier_level: 3 });
        if (error) throw error;
        setEstimatedRecipients(data || 0);
      } else if (targetSegment === 'users_with_zero_balance') {
        const { data, error } = await supabase.rpc('get_users_with_zero_balance_count');
        if (error) throw error;
        setEstimatedRecipients(data || 0);
      } else {
        // Custom segment
        const segment = segments?.find(s => s.id === targetSegment);
        if (segment) {
          setEstimatedRecipients(segment.user_count || 0);
        }
      }
    } catch (error) {
      console.error('Error calculating recipients:', error);
      setEstimatedRecipients(0);
    } finally {
      setIsCalculatingRecipients(false);
    }
  }, [formData.target_segment, segments]);

  const handleSaveDraft = useCallback(async (isAutoSave = false) => {
    if (!formData.title || !formData.subject) {
      if (!isAutoSave) {
        showToast('Please enter title and subject to save draft', 'error');
      }
      return;
    }

    setIsSavingDraft(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-campaigns`;

      const payload = {
        action: campaign ? 'update_campaign' : 'create_campaign',
        ...(campaign && { campaign_id: campaign.id }),
        ...formData,
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save draft');
      }

      setLastSaved(new Date());
      if (!isAutoSave) {
        showToast('Draft saved successfully', 'success');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      if (!isAutoSave) {
        showToast('Failed to save draft', 'error');
      }
    } finally {
      setIsSavingDraft(false);
    }
  }, [formData, campaign, showToast]);

  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (formData.title && formData.subject && !isSubmitting && !isSavingDraft) {
        handleSaveDraft(true);
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [formData, isSubmitting, isSavingDraft, handleSaveDraft]);

  useEffect(() => {
    calculateRecipients();
  }, [calculateRecipients]);

  // Set default from_email_id when senderEmails loads
  useEffect(() => {
    if (senderEmails && senderEmails.length > 0 && !formData.from_email_id) {
      const defaultEmail = senderEmails.find(e => e.is_default) || senderEmails[0];
      if (defaultEmail) {
        setFormData(prev => ({ ...prev, from_email_id: defaultEmail.id }));
      }
    }
  }, [senderEmails]);

  // When switching to Rich Editor, import styles from full HTML so the editor shows template styling
  useEffect(() => {
    if (editorMode !== 'rich') return;
    const html = formData.html_content || '';
    if (!/^\s*<!DOCTYPE|^\s*<html/i.test(html.trim())) return;
    const parsed = parseFullHtmlDocument(html);
    if (parsed) {
      setFormData((prev) => ({ ...prev, html_content: parsed.bodyHTML }));
      setExtractedStylesForEditor(parsed.styles || null);
    }
  }, [editorMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-campaigns`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{campaign ? 'Edit Campaign' : 'Create New Campaign'}</h2>
              {lastSaved && (
                <p className="text-xs text-gray-500 mt-1">
                  {isSavingDraft ? 'Saving...' : `Last saved: ${format(lastSaved, 'MMM dd, yyyy h:mm a')}`}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleSaveDraft(false)}
              disabled={isSavingDraft}
              className="flex items-center space-x-2 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
            </button>
          </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                Target Audience
              </label>
              <select
                value={formData.target_segment}
                onChange={(e) => {
                  const newSegment = e.target.value;
                  setFormData({ ...formData, target_segment: newSegment });
                  // Reset count and calculate recipients immediately with the new value
                  setEstimatedRecipients(0);
                  calculateRecipients(newSegment);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
              >
                <optgroup label="Predefined Segments">
                  <option value="all">All Users</option>
                  <option value="active_users">Active Users</option>
                  <option value="users_with_balance">Users with Balance</option>
                  <option value="users_with_plans">Users with Plans</option>
                  <option value="kyc_tier_0">Users with KYC Tier 0</option>
                  <option value="kyc_tier_1">Users with KYC Tier 1</option>
                  <option value="kyc_tier_2">Users with KYC Tier 2</option>
                  <option value="kyc_tier_3">Users with KYC Tier 3</option>
                  <option value="users_with_zero_balance">Users with 0 Balance</option>
                </optgroup>
                {segments && segments.length > 0 && (
                  <optgroup label="Custom Segments">
                    {segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name} ({segment.user_count} users)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Email Address
            </label>
            <select
              value={formData.from_email_id}
              onChange={(e) => setFormData({ ...formData, from_email_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
              required
            >
              {senderEmails && senderEmails.length > 0 ? (
                senderEmails.map((email) => (
                  <option key={email.id} value={email.id}>
                    {email.display_name} &lt;{email.email}&gt;{email.is_default ? ' (Default)' : ''}
                  </option>
                ))
              ) : (
                <option value="">Loading email addresses...</option>
              )}
            </select>
            <p className="text-xs text-gray-500 mt-1">Select the email address to send campaigns from</p>
          </div>

          {(estimatedRecipients > 0 || isCalculatingRecipients) && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Estimated Recipients</p>
                  <p className="text-xs text-gray-500">Based on selected audience</p>
                </div>
                {isCalculatingRecipients ? (
                  <div className="flex items-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm text-blue-600">Calculating...</span>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-blue-600">{estimatedRecipients}</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Choose a Template (Optional)
            </label>
            <p className="text-xs text-gray-500 mb-3">Start from a template or write from scratch</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {EMAIL_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      subject: template.subject,
                      html_content: template.html_content,
                    }));
                    setEditorMode('preview');
                  }}
                  className="text-left p-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50/50 transition-colors"
                >
                  <Mail className="w-6 h-6 text-blue-600 mb-2" />
                  <p className="font-medium text-gray-900 text-sm">{template.name}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Email Content
              </label>
              <div className="flex items-center space-x-2">
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => {
                      const html = formData.html_content || '';
                      if (/^\s*<!DOCTYPE|^\s*<html/i.test(html.trim())) {
                        const parsed = parseFullHtmlDocument(html);
                        if (parsed) {
                          setFormData((prev) => ({ ...prev, html_content: parsed.bodyHTML }));
                          setExtractedStylesForEditor(parsed.styles || null);
                        }
                      }
                      setEditorMode('rich');
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      editorMode === 'rich'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Rich Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('html')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      editorMode === 'html'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    HTML Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('preview')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      editorMode === 'preview'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 inline mr-1" />
                    Preview
                  </button>
                </div>
              </div>
            </div>
            
            {editorMode === 'rich' && (
              <div className="min-h-[400px] border border-gray-200 rounded-xl overflow-hidden relative">
                {extractedStylesForEditor && (
                  <style dangerouslySetInnerHTML={{ __html: scopeCssToQuillEditor(extractedStylesForEditor) }} />
                )}
                <RichTextEditor
                  value={formData.html_content}
                  onChange={(value) => setFormData({ ...formData, html_content: value })}
                  placeholder="Compose your email content here..."
                />
              </div>
            )}
            
            {editorMode === 'html' && (
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <div className="p-3 bg-gray-100 border-b border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">HTML Editor</p>
                  <p className="text-xs text-gray-500 mt-1">Paste or edit HTML content directly</p>
                </div>
                <textarea
                  value={formData.html_content || ''}
                  onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                  className="w-full px-4 py-3 border-0 focus:ring-2 focus:ring-gray-900 focus:outline-none resize-none font-mono text-sm min-h-[400px] bg-white"
                  placeholder="<!DOCTYPE html>&#10;<html>&#10;  <head>...</head>&#10;  <body>...</body>&#10;</html>"
                  spellCheck={false}
                />
              </div>
            )}
            
            {editorMode === 'preview' && (
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <div className="p-3 bg-gray-100 border-b border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">Email Preview</p>
                  <p className="text-xs text-gray-500 mt-1">How your email will appear to recipients</p>
                </div>
                <div className="bg-gray-50" style={{ minHeight: '400px' }}>
                  {formData.html_content ? (
                    <EmailPreviewIframe htmlContent={formData.html_content} optionalStyles={extractedStylesForEditor} />
                  ) : (
                    <div className="text-center py-20 text-gray-400">
                      <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No content to preview. Add content using Rich Editor, Drag & Drop Editor, or HTML Editor.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plain Text Content (Optional)
            </label>
            <textarea
              rows={6}
              placeholder="Enter plain text fallback content..."
              value={formData.plain_text_content}
              onChange={(e) => setFormData({ ...formData, plain_text_content: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent resize-none text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Used as fallback for email clients that don't support HTML</p>
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
              disabled={isSubmitting || isSavingDraft}
              className="flex-1 px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (campaign ? 'Updating...' : 'Creating...') : (campaign ? 'Update Campaign' : 'Create Campaign')}
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
  const { data: segments } = useSegments();
  const [segmentId, setSegmentId] = useState('all');
  const [scheduledDate, setScheduledDate] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-campaigns`;

      // Determine if segmentId is a predefined segment (string) or custom segment (UUID)
      const isPredefinedSegment = ['all', 'active_users', 'users_with_balance', 'users_with_plans', 
        'kyc_tier_0', 'kyc_tier_1', 'kyc_tier_2', 'kyc_tier_3', 'users_with_zero_balance'].includes(segmentId);
      
      const recipientFilters = isPredefinedSegment 
        ? { segment: segmentId }
        : { segment_id: segmentId };

      const body = isScheduled
        ? {
            action: 'schedule_campaign',
            campaign_id: campaign.id,
            scheduled_at: scheduledDate,
            recipient_filters: recipientFilters,
          }
        : {
            action: 'send_campaign',
            campaign_id: campaign.id,
            recipient_filters: recipientFilters,
          };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || result.error || 'Failed to send campaign');
      }

      if (!result.success) {
        throw new Error(result.message || 'Failed to send campaign');
      }

      showToast(result.message || 'Campaign sent successfully', 'success');
      onSuccess();
    } catch (error) {
      console.error('Error sending campaign:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send campaign';
      showToast(errorMessage, 'error');
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
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              <optgroup label="Predefined Segments">
                <option value="all">All Users</option>
                <option value="active_users">Active Users</option>
                <option value="users_with_balance">Users with Balance</option>
                <option value="users_with_plans">Users with Plans</option>
                <option value="kyc_tier_0">Users with KYC Tier 0</option>
                <option value="kyc_tier_1">Users with KYC Tier 1</option>
                <option value="kyc_tier_2">Users with KYC Tier 2</option>
                <option value="kyc_tier_3">Users with KYC Tier 3</option>
                <option value="users_with_zero_balance">Users with 0 Balance</option>
              </optgroup>
              {segments && segments.length > 0 && (
                <optgroup label="Custom Segments">
                  {segments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name} ({segment.user_count} users)
                    </option>
                  ))}
                </optgroup>
              )}
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
