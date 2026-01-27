import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Mail, TrendingUp, Send, Users, BarChart, Edit2, Trash2, Target, Eye, Save, Code } from 'lucide-react';
import { useMarketingCampaigns, useCampaignStats } from '@/hooks/queries/useMarketingCampaigns';
import { useSegments } from '@/hooks/queries/useSegments';
import { useSenderEmails } from '@/hooks/queries/useSenderEmails';
import { useRefreshData } from '@/hooks/mutations/useRefreshData';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import RichTextEditor from '@/components/RichTextEditor';

export default function Marketing() {
  const { data: campaigns, isLoading, error } = useMarketingCampaigns();
  const { data: stats } = useCampaignStats();
  const { data: segments } = useSegments();
  const refreshData = useRefreshData();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [selectedSegment, setSelectedSegment] = useState<any>(null);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);

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
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  const calculateRecipients = useCallback(async (segmentValue?: string) => {
    const targetSegment = segmentValue || formData.target_segment;
    setIsCalculatingRecipients(true);
    try {
      if (targetSegment === 'all') {
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true });
        setEstimatedRecipients(count || 0);
      } else if (targetSegment === 'active_users') {
        // Users with active payout plans OR transactions in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const [plansResult, transactionsResult] = await Promise.all([
          supabase
            .from('payout_plans')
            .select('user_id')
            .eq('status', 'active'),
          supabase
            .from('transactions')
            .select('user_id')
            .gte('created_at', thirtyDaysAgo.toISOString())
        ]);
        
        const planUserIds = new Set(plansResult.data?.map((p: any) => p.user_id) || []);
        const transactionUserIds = new Set(transactionsResult.data?.map((t: any) => t.user_id) || []);
        
        const allActiveUserIds = new Set([...planUserIds, ...transactionUserIds]);
        setEstimatedRecipients(allActiveUserIds.size);
      } else if (targetSegment === 'users_with_balance') {
        const { count } = await supabase
          .from('wallets')
          .select('user_id', { count: 'exact', head: true })
          .gt('balance', 0);
        setEstimatedRecipients(count || 0);
      } else if (targetSegment === 'users_with_plans') {
        // Get distinct user count
        const { data } = await supabase
          .from('payout_plans')
          .select('user_id')
          .eq('status', 'active');
        const uniqueUsers = new Set(data?.map((p: any) => p.user_id) || []);
        setEstimatedRecipients(uniqueUsers.size);
      } else if (targetSegment === 'kyc_tier_0') {
        // Users without any KYC tier completed
        const { data: allUsers } = await supabase
          .from('profiles')
          .select('id');
        const { data: kycProgress } = await supabase
          .from('kyc_progress')
          .select('user_id')
          .or('tier_1_completed.eq.true,tier_2_completed.eq.true,tier_3_completed.eq.true');
        
        const usersWithKyc = new Set(kycProgress?.map((k: any) => k.user_id) || []);
        const usersWithoutKyc = (allUsers || []).filter((u: any) => !usersWithKyc.has(u.id));
        setEstimatedRecipients(usersWithoutKyc.length);
      } else if (targetSegment === 'kyc_tier_1') {
        const { count } = await supabase
          .from('kyc_progress')
          .select('user_id', { count: 'exact', head: true })
          .eq('tier_1_completed', true);
        setEstimatedRecipients(count || 0);
      } else if (targetSegment === 'kyc_tier_2') {
        const { count } = await supabase
          .from('kyc_progress')
          .select('user_id', { count: 'exact', head: true })
          .eq('tier_2_completed', true);
        setEstimatedRecipients(count || 0);
      } else if (targetSegment === 'kyc_tier_3') {
        const { count } = await supabase
          .from('kyc_progress')
          .select('user_id', { count: 'exact', head: true })
          .eq('tier_3_completed', true);
        setEstimatedRecipients(count || 0);
      } else if (targetSegment === 'users_with_zero_balance') {
        const { count } = await supabase
          .from('wallets')
          .select('user_id', { count: 'exact', head: true })
          .eq('balance', 0);
        setEstimatedRecipients(count || 0);
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Email Content
              </label>
              <button
                type="button"
                onClick={() => setShowHtmlPreview(!showHtmlPreview)}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {showHtmlPreview ? (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>Show Editor</span>
                  </>
                ) : (
                  <>
                    <Code className="w-4 h-4" />
                    <span>View HTML</span>
                  </>
                )}
              </button>
            </div>
            {!showHtmlPreview ? (
              <div className="min-h-[400px]">
                <RichTextEditor
                  value={formData.html_content}
                  onChange={(value) => setFormData({ ...formData, html_content: value })}
                  placeholder="Compose your email content here..."
                />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                <div className="p-3 bg-gray-100 border-b border-gray-200">
                  <p className="text-xs text-gray-600 font-medium">HTML Code</p>
                  <p className="text-xs text-gray-500 mt-1">Generated HTML from the editor</p>
                </div>
                <textarea
                  readOnly
                  value={formData.html_content || ''}
                  className="w-full px-4 py-3 border-0 focus:ring-0 resize-none font-mono text-sm min-h-[400px] bg-gray-50"
                  placeholder="HTML will appear here as you compose..."
                />
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

      const body = isScheduled
        ? {
            action: 'schedule_campaign',
            campaign_id: campaign.id,
            scheduled_at: scheduledDate,
            recipient_filters: { segment_id: segmentId },
          }
        : {
            action: 'send_campaign',
            campaign_id: campaign.id,
            recipient_filters: { segment_id: segmentId },
          };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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
