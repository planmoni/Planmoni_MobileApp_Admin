import { useState } from 'react';
import { Ban, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSetPostNoDebit, useUserRestriction } from '@/hooks/queries/useUsersData';

type PostNoDebitDialogProps = {
  userId: string;
  userName?: string;
  open: boolean;
  onClose: () => void;
};

export default function PostNoDebitDialog({ userId, userName, open, onClose }: PostNoDebitDialogProps) {
  const { session } = useAuth();
  const { showToast } = useToast();
  const { data: restriction } = useUserRestriction(userId);
  const setPostNoDebit = useSetPostNoDebit();
  const [reason, setReason] = useState('');

  const isRestricted = restriction?.post_no_debit === true;
  const adminEmail = session?.user?.email || '';
  const displayName = userName?.trim() || 'this user';

  const close = () => {
    if (setPostNoDebit.isPending) return;
    setReason('');
    onClose();
  };

  const confirm = async () => {
    try {
      if (isRestricted) {
        await setPostNoDebit.mutateAsync({ userId, enable: false });
        showToast('Post No Debit removed', 'success');
      } else {
        await setPostNoDebit.mutateAsync({ userId, enable: true, reason, adminEmail });
        showToast('Post No Debit applied', 'success');
      }
      setReason('');
      onClose();
    } catch (err) {
      showToast((err as { message?: string })?.message || 'Failed to update restriction', 'error');
    }
  };

  const canConfirm = isRestricted || reason.trim().length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl">
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center shadow-lg">
              {isRestricted ? <ShieldCheck className="h-6 w-6 text-white" /> : <Ban className="h-6 w-6 text-white" />}
            </div>
            <button
              onClick={close}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isRestricted ? 'Remove Post No Debit' : 'Apply Post No Debit'}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {isRestricted
              ? `${displayName} will be able to create payout plans and lock funds again.`
              : `${displayName} will not be able to create new payout plans or lock funds. Deposits still work.`}
          </p>

          {isRestricted ? (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-1">
              {restriction?.post_no_debit_reason && (
                <p>
                  <span className="text-gray-500">Reason: </span>
                  {restriction.post_no_debit_reason}
                </p>
              )}
              {restriction?.post_no_debit_by && (
                <p>
                  <span className="text-gray-500">Applied by: </span>
                  {restriction.post_no_debit_by}
                </p>
              )}
            </div>
          ) : (
            <>
              <label htmlFor="pnd-reason" className="block text-sm font-medium text-gray-900 mb-2">
                Reason
              </label>
              <textarea
                id="pnd-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Add a note for the team (required)"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-3">
                Existing active payout plans are not paused. To stop scheduled payouts, pause those plans separately.
              </p>
            </>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={close}
              disabled={setPostNoDebit.isPending}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={!canConfirm || setPostNoDebit.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {setPostNoDebit.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isRestricted ? 'Remove restriction' : 'Apply restriction'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
