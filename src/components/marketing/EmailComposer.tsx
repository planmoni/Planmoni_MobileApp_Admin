import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Eye, ImagePlus, Save, Send, X, Info } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { useSegments } from '@/hooks/queries/useSegments';
import { useSenderEmails } from '@/hooks/queries/useSenderEmails';
import { logAdminAction } from '@/lib/adminActivity';
import {
  callMarketingCampaigns,
  EMPTY_EMAIL,
  emailFromCampaign,
  toEdgeEmail,
  toggleBoldSelection,
  uploadMarketingBanner,
  type MarketingEmailFields,
} from '@/lib/marketingEmail';
import EmailPreviewModal from './EmailPreviewModal';
import SendTestEmailModal from './SendTestEmailModal';

type Props = { campaign?: any; onClose: () => void; onSuccess: () => void };

const COUNT_RPC: Record<string, { fn: string; args?: Record<string, number> }> = {
  all: { fn: 'get_all_users_count' },
  active_users: { fn: 'get_active_users_count' },
  users_with_balance: { fn: 'get_users_with_balance_count' },
  users_with_plans: { fn: 'get_users_with_plans_count' },
  kyc_tier_0: { fn: 'get_kyc_tier_count', args: { tier_level: 0 } },
  kyc_tier_1: { fn: 'get_kyc_tier_count', args: { tier_level: 1 } },
  kyc_tier_2: { fn: 'get_kyc_tier_count', args: { tier_level: 2 } },
  kyc_tier_3: { fn: 'get_kyc_tier_count', args: { tier_level: 3 } },
  users_with_zero_balance: { fn: 'get_users_with_zero_balance_count' },
};

const INPUT = 'w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent';

/** Returns a message for the first problem, or null when the email can be rendered. */
function validate(e: MarketingEmailFields): string | null {
  if (!e.subject.trim()) return 'Enter a title (the email subject)';
  if (!e.heading.trim()) return 'Enter a heading';
  if (!e.body.trim()) return 'Enter the email body';
  if (e.lower_body.length > 5000) return 'The lower body can be up to 5000 characters';
  const label = e.button_label.trim();
  const url = e.button_url.trim();
  if (label || url) {
    if (!label || !url) return 'Enter both a button name and a button link, or leave both empty';
    if (!/^https:\/\//i.test(url)) return 'The button link must start with https://';
  }
  const banner = e.banner_url.trim();
  if (banner && !/^https:\/\//i.test(banner)) return 'The banner image link must start with https://';
  return null;
}

export default function EmailComposer({ campaign, onClose, onSuccess }: Props) {
  const { showToast } = useToast();
  const { data: segments } = useSegments();
  const { data: senderEmails } = useSenderEmails();

  const saved = emailFromCampaign(campaign);
  const isLegacy = !!campaign && !saved;

  const [email, setEmail] = useState<MarketingEmailFields>(saved ?? { ...EMPTY_EMAIL, subject: campaign?.subject || '' });
  const [category, setCategory] = useState<string>(campaign?.category || 'promotional');
  const [targetSegment, setTargetSegment] = useState('all');
  const [fromEmailId, setFromEmailId] = useState<string>(campaign?.from_email_id || '');
  const [estimatedRecipients, setEstimatedRecipients] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(campaign?.id || null);
  const [lastSaved, setLastSaved] = useState<Date | null>(campaign?.updated_at ? new Date(campaign.updated_at) : null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lowerBodyRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ field: 'body' | 'lower_body'; start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    const pending = pendingSelection.current;
    if (!pending) return;
    pendingSelection.current = null;
    const el = pending.field === 'body' ? bodyRef.current : lowerBodyRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(pending.start, pending.end);
  });

  const set = (key: keyof MarketingEmailFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEmail((prev) => ({ ...prev, [key]: e.target.value }));

  const handleBoldShortcut = (field: 'body' | 'lower_body') => (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'b') return;
    event.preventDefault();
    const el = event.currentTarget;
    const { value, start, end } = toggleBoldSelection(el.value, el.selectionStart, el.selectionEnd);
    pendingSelection.current = { field, start, end };
    setEmail((prev) => ({ ...prev, [field]: value }));
  };

  const handleBannerPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsUploadingBanner(true);
    try {
      const url = await uploadMarketingBanner(file);
      setEmail((prev) => ({ ...prev, banner_url: url }));
      showToast('Banner uploaded', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not upload the banner', 'error');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  // default sender
  useEffect(() => {
    if (!fromEmailId && senderEmails && senderEmails.length > 0) {
      setFromEmailId((senderEmails.find((s) => s.is_default) || senderEmails[0]).id);
    }
  }, [senderEmails, fromEmailId]);

  const calculateRecipients = useCallback(
    async (segment: string) => {
      setIsCalculating(true);
      try {
        const rpc = COUNT_RPC[segment];
        if (rpc) {
          const { data, error } = await supabase.rpc(rpc.fn, rpc.args);
          if (error) throw error;
          setEstimatedRecipients(Number(data) || 0);
        } else {
          setEstimatedRecipients(segments?.find((s) => s.id === segment)?.user_count || 0);
        }
      } catch (error) {
        console.error('Error calculating recipients:', error);
        setEstimatedRecipients(0);
      } finally {
        setIsCalculating(false);
      }
    },
    [segments]
  );

  useEffect(() => {
    calculateRecipients(targetSegment);
  }, [calculateRecipients, targetSegment]);

  const sender = senderEmails?.find((s) => s.id === fromEmailId);
  const fromLabel = sender ? `${sender.display_name} <${sender.email}>` : 'Martins Osodi - Planmoni CEO <hello@planmoni.com>';

  const requireValid = (): boolean => {
    const problem = validate(email);
    if (problem) {
      showToast(problem, 'error');
      return false;
    }
    return true;
  };

  /** Creates or updates the campaign and returns its id. Tracks draftId so Save Draft never duplicates. */
  const persistCampaign = async (): Promise<string> => {
    const isUpdate = !!draftId;
    const data = await callMarketingCampaigns<{ campaign: { id: string } }>({
      action: isUpdate ? 'update_campaign' : 'create_campaign',
      ...(isUpdate && { campaign_id: draftId }),
      email: toEdgeEmail(email),
      category,
      from_email_id: fromEmailId || null,
    });
    const id = data.campaign?.id || draftId!;
    setDraftId(id);
    setLastSaved(new Date());
    return id;
  };

  const handleSaveDraft = async () => {
    if (!requireValid()) return;
    setIsSavingDraft(true);
    try {
      const wasNew = !draftId;
      await persistCampaign();
      void logAdminAction(wasNew ? 'Saved a marketing campaign draft' : 'Updated a marketing campaign draft');
      showToast('Draft saved', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save the draft', 'error');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireValid()) return;
    setIsSaving(true);
    try {
      const wasNew = !draftId;
      await persistCampaign();
      void logAdminAction(wasNew ? 'Created a marketing campaign' : 'Updated a marketing campaign');
      showToast(wasNew ? 'Campaign created' : 'Campaign updated', 'success');
      onSuccess();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save the campaign', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-gray-900">{draftId ? 'Edit Campaign' : 'Create New Campaign'}</h2>
            <p className="text-sm text-gray-500 mt-1">Written once, sent in the standard Planmoni email design.</p>
            {lastSaved && (
              <p className="text-xs text-gray-500 mt-1">
                {isSavingDraft ? 'Saving draft...' : `Last saved: ${format(lastSaved, 'MMM dd, yyyy h:mm a')}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSavingDraft || isSaving}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSavingDraft ? 'Saving...' : 'Save Draft'}
            </button>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {isLegacy && (
            <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <p>
                This campaign was written in the old editor. Saving it will replace its content with the new standard email design, so fill in
                the heading and body below.
              </p>
            </div>
          )}

          <label className="flex items-center justify-between gap-3 px-4 py-3 border border-gray-200 rounded-xl cursor-pointer">
            <span className="text-sm text-gray-700">Header logo</span>
            <input
              type="checkbox"
              checked={email.show_header}
              onChange={(e) => setEmail((prev) => ({ ...prev, show_header: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
            />
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Banner image (optional)</label>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleBannerPick}
            />
            {email.banner_url ? (
              <div className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                <img src={email.banner_url} alt="Banner preview" className="w-full max-h-48 object-cover" />
                <button
                  type="button"
                  onClick={() => setEmail((prev) => ({ ...prev, banner_url: '' }))}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white shadow-sm"
                  aria-label="Remove banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isUploadingBanner}
                onClick={() => bannerInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-accent hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <ImagePlus className="w-6 h-6" />
                <span className="text-sm font-medium">{isUploadingBanner ? 'Uploading...' : 'Upload banner image'}</span>
                <span className="text-xs text-gray-500">JPEG, PNG, WebP or GIF · up to 5MB · shown above the greeting</span>
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input type="text" maxLength={150} placeholder="e.g., Introducing Smart Savings" value={email.subject} onChange={set('subject')} className={INPUT} />
            <p className="text-xs text-gray-500 mt-1">Used as the email subject.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Heading</label>
            <input type="text" maxLength={120} placeholder="e.g., Save smarter this month" value={email.heading} onChange={set('heading')} className={INPUT} />
            <p className="text-xs text-gray-500 mt-1">The large heading at the top of the email.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Body</label>
            <textarea
              ref={bodyRef}
              rows={8}
              maxLength={5000}
              placeholder="Write your message..."
              value={email.body}
              onChange={set('body')}
              onKeyDown={handleBoldShortcut('body')}
              className={`${INPUT} resize-y text-sm`}
            />
            <p className="text-xs text-gray-500 mt-1">
              Plain text. Leave a blank line for a new paragraph. Select text and press Ctrl/Cmd+B for bold.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Button name (optional)</label>
              <input type="text" maxLength={40} placeholder="e.g., Open Planmoni" value={email.button_label} onChange={set('button_label')} className={INPUT} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Button link (optional)</label>
              <input type="url" maxLength={500} placeholder="https://..." value={email.button_url} onChange={set('button_url')} className={INPUT} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Lower body (optional)</label>
            <textarea
              ref={lowerBodyRef}
              rows={5}
              maxLength={5000}
              placeholder="Text that appears below the button..."
              value={email.lower_body}
              onChange={set('lower_body')}
              onKeyDown={handleBoldShortcut('lower_body')}
              className={`${INPUT} resize-y text-sm`}
            />
            <p className="text-xs text-gray-500 mt-1">Shown below the button. Ctrl/Cmd+B for bold, same as the body.</p>
          </div>

          <label className="flex items-center justify-between gap-3 px-4 py-3 border border-gray-200 rounded-xl cursor-pointer">
            <span className="text-sm text-gray-700">Footer banner</span>
            <input
              type="checkbox"
              checked={email.show_footer}
              onChange={(e) => setEmail((prev) => ({ ...prev, show_footer: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
            />
          </label>

          <div className="border-t border-gray-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>
                <option value="promotional">Promotional</option>
                <option value="product_update">Product Update</option>
                <option value="educational">Educational</option>
                <option value="announcement">Announcement</option>
                <option value="retention">Retention</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
              <select
                value={targetSegment}
                onChange={(e) => {
                  setEstimatedRecipients(0);
                  setTargetSegment(e.target.value);
                }}
                className={INPUT}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">From Email Address</label>
            <select value={fromEmailId} onChange={(e) => setFromEmailId(e.target.value)} className={INPUT} required>
              {senderEmails && senderEmails.length > 0 ? (
                senderEmails.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name} &lt;{s.email}&gt;{s.is_default ? ' (Default)' : ''}
                  </option>
                ))
              ) : (
                <option value="">Loading email addresses...</option>
              )}
            </select>
          </div>

          {(estimatedRecipients > 0 || isCalculating) && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Estimated Recipients</p>
                <p className="text-xs text-gray-500">Based on selected audience</p>
              </div>
              {isCalculating ? (
                <span className="text-sm text-blue-600">Calculating...</span>
              ) : (
                <p className="text-lg font-semibold text-blue-600">{estimatedRecipients}</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => requireValid() && setShowPreview(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
            <button
              type="button"
              onClick={() => requireValid() && setShowTest(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Send className="w-4 h-4" /> Send test email
            </button>
          </div>

          <div className="flex space-x-4 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isSavingDraft}
              className="flex-1 px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : draftId ? 'Save Changes' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>

      {showPreview && <EmailPreviewModal email={email} from={fromLabel} onClose={() => setShowPreview(false)} />}
      {showTest && <SendTestEmailModal email={email} fromEmailId={fromEmailId} onClose={() => setShowTest(false)} />}
    </div>
  );
}
