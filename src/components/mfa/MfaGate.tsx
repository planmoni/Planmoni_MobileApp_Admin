import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/LoadingScreen';
import { TotpEnrollForm } from './TotpEnrollForm';

// Shown instead of the dashboard until the admin is signed in with password + authenticator code.
// Every admin must have an authenticator: no authenticator -> forced setup, no way to skip.
export default function MfaGate() {
  const { mfa, refreshMfa, signOut } = useAuth();

  if (mfa.status === 'loading') return <LoadingScreen />;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src="/assets/images/planmoni_logo_updated.png" alt="Planmoni" className="h-[50px] w-auto mx-auto mb-4" />
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-gray-900" />
          </div> */}

          {mfa.status === 'needs_enroll' && (
            <>
              <h2 className="text-2xl font-semibold text-gray-900 text-center mb-1">Set up two-factor</h2>
              <p className="text-sm text-gray-500 text-center mb-6">
                Every admin account needs an authenticator app. Set it up now to continue.
              </p>
              <TotpEnrollForm onDone={refreshMfa} submitLabel="Turn on 2FA" />
            </>
          )}

          {mfa.status === 'needs_challenge' && mfa.factorId && (
            <ChallengeForm factorId={mfa.factorId} onDone={refreshMfa} />
          )}

          {mfa.status === 'error' && (
            <>
              <h2 className="text-2xl font-semibold text-gray-900 text-center mb-2">Couldn&apos;t check 2FA</h2>
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex items-start gap-2 mb-4">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800">{mfa.error}</p>
              </div>
              <button
                onClick={() => void refreshMfa()}
                className="w-full px-4 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800"
              >
                Try again
              </button>
            </>
          )}

          <button
            onClick={() => void signOut()}
            className="w-full mt-4 text-sm text-gray-500 hover:text-gray-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function ChallengeForm({ factorId, onDone }: { factorId: string; onDone: () => Promise<void> }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 text-center mb-1">Two-factor verification</h2>
        <p className="text-sm text-gray-500 text-center">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-gray-900"
        autoFocus
      />

      <button
        type="submit"
        disabled={isVerifying || code.length !== 6}
        className="w-full px-4 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
      >
        {isVerifying ? 'Verifying...' : 'Verify'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Lost access to your authenticator app? Ask a Super Admin to reset your 2FA, then sign in again to set up a new one.
      </p>
    </form>
  );
}
