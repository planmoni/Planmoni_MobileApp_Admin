import { useCallback, useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { TotpEnrollForm } from './mfa/TotpEnrollForm';

// Your own two-factor status, and moving to a new phone.
// 2FA is required for every admin, so there is no "turn off" here.
export function TwoFactorSetup() {
  const { refreshMfa } = useAuth();
  const { showToast } = useToast();
  const [enrolledAt, setEnrolledAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChanging, setIsChanging] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = (data?.all ?? []).filter((f) => f.factor_type === 'totp' && f.status === 'verified');
    setEnrolledAt(verified.length ? verified.map((f) => f.created_at).sort()[0] : null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The new authenticator is already verified at this point. Remove the old ones so only the
  // new phone works, then re-check the session.
  const handleNewDeviceDone = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = (data?.all ?? [])
      .filter((f) => f.factor_type === 'totp' && f.status === 'verified')
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    // the newest verified factor is the one just set up
    for (const old of verified.slice(0, -1)) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: old.id });
      if (error) {
        showToast(`New device is on, but the old one could not be removed: ${error.message}`, 'error');
      }
    }
    showToast('Two-factor authentication moved to your new device', 'success');
    setIsChanging(false);
    await load();
    await refreshMfa();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Shield className="h-5 w-5 text-gray-900" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900">Two-factor authentication</h3>
          {isLoading ? (
            <p className="text-sm text-gray-500 mt-1">Checking...</p>
          ) : (
            <p className="text-sm text-gray-500 mt-1">
              {enrolledAt
                ? `On since ${new Date(enrolledAt).toLocaleDateString()}. Required for every admin account.`
                : 'Not set up yet. You will be asked to set it up.'}
            </p>
          )}
        </div>
        {!isChanging && enrolledAt && (
          <button
            onClick={() => setIsChanging(true)}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Set up a new device
          </button>
        )}
      </div>

      {isChanging && (
        <div className="mt-6 pt-6 border-t border-gray-100 max-w-md">
          <p className="text-sm text-gray-500 mb-4">
            Scan the new code with your new phone. Once it works, your old authenticator stops working.
          </p>
          <TotpEnrollForm
            onDone={handleNewDeviceDone}
            onCancel={() => {
              setIsChanging(false);
              // an unfinished setup leaves an unverified factor behind: clear it
              void (async () => {
                const { data } = await supabase.auth.mfa.listFactors();
                for (const f of data?.all ?? []) {
                  if (f.factor_type === 'totp' && f.status === 'unverified') {
                    await supabase.auth.mfa.unenroll({ factorId: f.id });
                  }
                }
              })();
            }}
            submitLabel="Switch to this device"
          />
        </div>
      )}
    </div>
  );
}
