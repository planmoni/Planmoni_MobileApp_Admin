import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

type ControlDialogProps = {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  /** Asks for a written reason and keeps the confirm button disabled until there is one. */
  requireReason?: boolean;
  checkboxLabel?: string;
  checkboxDefault?: boolean;
  pending?: boolean;
  onConfirm: (values: { reason: string; checked: boolean }) => void;
  onClose: () => void;
};

export default function ControlDialog({
  open,
  title,
  description,
  confirmLabel,
  requireReason,
  checkboxLabel,
  checkboxDefault = false,
  pending,
  onConfirm,
  onClose,
}: ControlDialogProps) {
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(checkboxDefault);

  useEffect(() => {
    if (open) {
      setReason('');
      setChecked(checkboxDefault);
    }
  }, [open, checkboxDefault]);

  if (!open) return null;
  const canConfirm = !pending && (!requireReason || reason.trim().length > 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 md:p-8">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={() => !pending && onClose()}
            className="p-2 -mr-2 -mt-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="text-sm text-gray-600 leading-relaxed">{description}</div>

        {requireReason && (
          <div className="mt-4">
            <label htmlFor="control-reason" className="block text-sm font-semibold text-gray-900 mb-2">
              Reason
            </label>
            <textarea
              id="control-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Shown to the person when they try to sign in"
              className="block w-full px-4 py-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
        )}

        {checkboxLabel && (
          <label className="mt-4 flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            {checkboxLabel}
          </label>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={pending}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ reason: reason.trim(), checked })}
            disabled={!canConfirm}
            className="flex-1 px-4 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
          >
            {pending ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
