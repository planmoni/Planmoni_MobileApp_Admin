import { useState } from 'react';
import { Bell, Send, ChevronDown } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { REENGAGEMENT_CATEGORIES } from '@/lib/notificationTemplates';

interface SendReengagementButtonProps {
  userId: string;
  userBalance: number;
  hasActivePlans: boolean;
  hasDeposits: boolean;
  hasUnfundedVaults: boolean;
  isInactive: boolean;
}

export default function SendReengagementButton({
  userId,
  userBalance,
  hasActivePlans,
  hasDeposits,
  hasUnfundedVaults,
  isInactive,
}: SendReengagementButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const { showToast } = useToast();

  const eligibleCategories = REENGAGEMENT_CATEGORIES.filter(category => {
    switch (category.id) {
      case 'zero_balance_reminder':
        return userBalance === 0;
      case 'vault_unfunded_reminder':
        return hasUnfundedVaults;
      case 'deposit_no_plan':
        return hasDeposits && !hasActivePlans;
      case 'no_plan_yet':
        return !hasActivePlans;
      case 're_engagement':
        return isInactive;
      default:
        return false;
    }
  });

  const handleSendAlert = async (categoryId: string) => {
    setSelectedCategory(categoryId);
    setShowConfirmModal(true);
    setShowDropdown(false);
  };

  const confirmSend = async () => {
    if (!selectedCategory) return;

    setIsSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const category = REENGAGEMENT_CATEGORIES.find(c => c.id === selectedCategory);

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
            title: category?.template.title,
            body: category?.template.body,
            data: category?.template.data,
            target_type: 'individual',
            target_user_ids: [userId],
            notification_type: 'reengagement',
            notification_category: selectedCategory,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send alert');
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to send notification');
      }

      const stats = result.stats || {};
      if (stats.delivered === 0 && stats.failed > 0) {
        throw new Error('User has no active push tokens or all deliveries failed');
      }

      showToast(
        stats.delivered > 0
          ? `Alert sent successfully to ${stats.delivered} device${stats.delivered > 1 ? 's' : ''}`
          : 'Alert sent successfully',
        'success'
      );
      setShowConfirmModal(false);
      setSelectedCategory(null);
    } catch (err) {
      console.error('Error sending re-engagement:', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to send alert',
        'error'
      );
    } finally {
      setIsSending(false);
    }
  };

  if (eligibleCategories.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-md hover:shadow-lg"
      >
        <Bell className="h-5 w-5" />
        <span>Send Alert</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">Send Re-engagement Alert</h3>
              <p className="text-xs text-gray-600 mt-1">Choose an alert type to send</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {eligibleCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleSendAlert(category.id)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900">{category.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">{category.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {showConfirmModal && selectedCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl transform transition-all">
            <div className="p-8">
              {(() => {
                const category = REENGAGEMENT_CATEGORIES.find(c => c.id === selectedCategory);
                return category ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="mx-auto w-16 h-16 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                        <Bell className="h-8 w-8 text-white" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Confirm Alert</h2>
                      <p className="text-gray-600 text-sm">You're about to send a notification to this user</p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                      <div className="flex items-start space-x-3 mb-4">
                        <span className="text-3xl">{category.icon}</span>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-gray-900">{category.title}</h3>
                          <p className="text-xs text-gray-600 mt-1">{category.description}</p>
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start space-x-2">
                          <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{category.template.title}</p>
                            <p className="text-sm text-gray-600 mt-1">{category.template.body}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setShowConfirmModal(false);
                          setSelectedCategory(null);
                        }}
                        className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all font-medium"
                        disabled={isSending}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmSend}
                        disabled={isSending}
                        className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl"
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
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
