import { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { callMarketingCampaigns, toEdgeEmail, type MarketingEmailFields } from '@/lib/marketingEmail';

type Props = {
  email: MarketingEmailFields;
  fromEmailId: string;
  onClose: () => void;
};

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

/** Sends the email once, to one address, so the admin can see it in a real inbox. */
export default function SendTestEmailModal({ email, fromEmailId, onClose }: Props) {
  const { showToast } = useToast();
  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // start with the admin's own address
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const own = data.session?.user?.email;
      if (own) setTo((current) => current || own);
    });
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = to.trim();
    if (!EMAIL_RE.test(address)) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await callMarketingCampaigns({
        action: 'send_test_email',
        email: toEdgeEmail(email),
        to: address,
        from_email_id: fromEmailId || null,
      });
      showToast(`Test email sent to ${address}`, 'success');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the test email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <form onSubmit={handleSend} className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Send test email</h2>
            <p className="text-sm text-gray-500 mt-1">Sends this email to one address, with “[Test]” added to the subject.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-2">
          <label className="block text-sm font-medium text-gray-700">Send to</label>
          <input
            type="email"
            autoFocus
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent focus:border-transparent"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending}
            className="flex-1 px-4 py-2 bg-accent text-white rounded-xl hover:bg-accent-dark disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send test'}
          </button>
        </div>
      </form>
    </div>
  );
}
