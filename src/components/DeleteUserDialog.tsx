import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, X, TriangleAlert, CircleCheck } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useDeleteUser, useUserDeleteCheck } from '@/hooks/queries/useUsersData';

type DeleteUserDialogProps = {
  userId: string;
  userName?: string;
  open: boolean;
  onClose: () => void;
};

export default function DeleteUserDialog({ userId, userName, open, onClose }: DeleteUserDialogProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: check, isLoading, error } = useUserDeleteCheck(userId, open);
  const deleteUser = useDeleteUser();
  const [confirmEmail, setConfirmEmail] = useState('');

  if (!open) return null;

  const displayName = userName?.trim() || check?.name || 'this user';
  const email = check?.email || '';
  const emailMatches = !!email && confirmEmail.trim().toLowerCase() === email.toLowerCase();
  const blocked = !!check && !check.can_delete;

  const close = () => {
    if (deleteUser.isPending) return;
    setConfirmEmail('');
    onClose();
  };

  const confirm = async () => {
    try {
      const { files } = await deleteUser.mutateAsync({ userId, confirmEmail });
      showToast(
        files.failed > 0
          ? 'User deleted. Some uploaded files could not be removed from storage.'
          : 'User deleted',
        files.failed > 0 ? 'warning' : 'success'
      );
      setConfirmEmail('');
      onClose();
      navigate('/users', { replace: true });
    } catch (err) {
      showToast((err as { message?: string })?.message || 'Failed to delete user', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl">
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center shadow-lg">
              <Trash2 className="h-6 w-6 text-white" />
            </div>
            <button
              onClick={close}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-2">Delete user</h2>

          {isLoading && (
            <div className="flex items-center gap-3 py-6 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-gray-900"></div>
              <span>Checking whether {displayName} can be deleted...</span>
            </div>
          )}

          {!isLoading && error && (
            <p className="text-sm text-error">
              {(error as { message?: string })?.message || 'Could not check this user.'}
            </p>
          )}

          {blocked && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                {displayName} cannot be deleted yet. Resolve the following first:
              </p>
              <ul className="rounded-xl bg-gray-50 border border-gray-200 divide-y divide-gray-200 text-sm text-gray-700">
                {check!.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2 px-4 py-3">
                    <TriangleAlert className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-900" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <button
                  onClick={close}
                  className="w-full px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all font-medium"
                >
                  Close
                </button>
              </div>
            </>
          )}

          {check?.can_delete && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                This permanently deletes {displayName} and cannot be undone.
              </p>

              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
                <p className="flex items-start gap-2">
                  <CircleCheck className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-900" />
                  <span>No active payout plans, vaults or wallet balance.</span>
                </p>
                <p className="text-gray-600">
                  Their login, profile, wallet, KYC data and uploaded documents will be removed
                  {check.counts.plans_total > 0 || check.counts.transactions > 0
                    ? `, along with ${check.counts.plans_total} past plan${check.counts.plans_total === 1 ? '' : 's'} and ${check.counts.transactions} transaction${check.counts.transactions === 1 ? '' : 's'}`
                    : ''}
                  . A record of this deletion is kept in the audit log.
                </p>
              </div>

              <label htmlFor="delete-confirm-email" className="block text-sm font-medium text-gray-900 mt-5 mb-2">
                Type <span className="font-semibold">{email}</span> to confirm
              </label>
              <input
                id="delete-confirm-email"
                type="text"
                autoComplete="off"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={email}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />

              <div className="flex gap-3 mt-6">
                <button
                  onClick={close}
                  disabled={deleteUser.isPending}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirm}
                  disabled={!emailMatches || deleteUser.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-error text-white rounded-xl hover:bg-red-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteUser.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete permanently</span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
