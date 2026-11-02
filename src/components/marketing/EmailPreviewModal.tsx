import { useEffect, useState } from 'react';
import { Monitor, Smartphone, X } from 'lucide-react';
import { callMarketingCampaigns, toEdgeEmail, type MarketingEmailFields } from '@/lib/marketingEmail';

type Props = {
  email: MarketingEmailFields;
  from: string;
  onClose: () => void;
};

/** Shows the email exactly as the server renders it with the shared Planmoni template. */
export default function EmailPreviewModal({ email, from, onClose }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'desktop' | 'phone'>('desktop');

  useEffect(() => {
    let cancelled = false;
    callMarketingCampaigns<{ html: string }>({ action: 'render_email', email: toEdgeEmail(email) })
      .then((r) => !cancelled && setHtml(r.html))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not render the preview'));
    return () => {
      cancelled = true;
    };
    // the preview is a snapshot of the email at the moment it was opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">Email preview</h2>
            <p className="text-xs text-gray-500 mt-1 truncate">From: {from}</p>
            <p className="text-xs text-gray-500 truncate">Subject: {email.subject}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setView('desktop')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${view === 'desktop' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
              >
                <Monitor className="w-3.5 h-3.5" /> Desktop
              </button>
              <button
                type="button"
                onClick={() => setView('phone')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${view === 'phone' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'}`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Phone
              </button>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close preview">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-gray-100 p-4 overflow-auto flex justify-center">
          {error ? (
            <p className="text-sm text-red-600 self-center">{error}</p>
          ) : html === null ? (
            <p className="text-sm text-gray-500 self-center">Rendering preview...</p>
          ) : (
            <iframe
              title="Email preview"
              srcDoc={html}
              sandbox=""
              className="bg-white border-0 rounded-lg shadow-sm"
              style={{ width: view === 'phone' ? 375 : '100%', maxWidth: '100%', height: '65vh' }}
            />
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="w-full px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors">
            Close preview
          </button>
        </div>
      </div>
    </div>
  );
}
