import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Set up an authenticator app (Google Authenticator, Authy, 1Password, ...) on Supabase Auth MFA.
// The secret is created and kept by Supabase; the code is verified by the server.
// Used for first-time setup (forced at sign-in) and for moving to a new phone.
export function TotpEnrollForm({
  onDone,
  onCancel,
  submitLabel = 'Turn on 2FA',
}: {
  onDone: () => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  const start = async () => {
    setIsStarting(true);
    setError(null);
    try {
      // A half-finished earlier setup (closed the tab before verifying) blocks a new one: clear it
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) {
        if (f.factor_type === 'totp' && f.status === 'unverified') {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Planmoni Admin',
        friendlyName: `Authenticator ${new Date().toISOString()}`,
      });
      if (enrollError) throw enrollError;

      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start 2FA setup');
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app');
      return;
    }
    setIsVerifying(true);
    setError(null);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) throw verifyError;
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work. Try the next one.');
      setCode('');
    } finally {
      setIsVerifying(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the secret is visible to copy by hand */
    }
  };

  if (isStarting) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleVerify} className="space-y-5">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {factorId ? (
        <>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Open Google Authenticator (or any authenticator app) on your phone.</li>
            <li>Scan this QR code, or type the key in by hand.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>

          <div className="flex justify-center">
            <img src={qr} alt="2FA QR code" className="w-48 h-48 rounded-xl border border-gray-200 p-2 bg-white" />
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Can&apos;t scan? Enter this key in the app:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 break-all select-all">
                {secret}
              </code>
              <button
                type="button"
                onClick={copySecret}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                aria-label="Copy key"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="totp-code" className="block text-sm font-semibold text-gray-900 mb-2">
              6-digit code
            </label>
            <input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isVerifying}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="flex-1 px-4 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {isVerifying ? 'Verifying...' : submitLabel}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void start()}
          className="w-full px-4 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800"
        >
          Try again
        </button>
      )}
    </form>
  );
}
