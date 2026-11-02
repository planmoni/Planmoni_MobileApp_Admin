import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldOff, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';

type AdminRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  enrolled: boolean;
  enrolled_at: string | null;
};

type Overview = {
  require_mfa_for_money: boolean;
  caller_has_2fa: boolean;
  caller_aal: string;
  admins: AdminRow[];
};

const KEY = ['admin-2fa-overview'];

// Super Admin only: who has 2FA, the server-side enforcement switch, and reset for a lost phone.
export function AdminTwoFactorManager() {
  const { showToast } = useToast();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [resettingId, setResettingId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Overview> => {
      const { data, error } = await supabase.rpc('admin_2fa_overview');
      if (error) throw new Error(error.message);
      return data as Overview;
    },
  });

  const setEnforcement = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.rpc('admin_set_mfa_enforcement', { p_enabled: enabled });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, enabled) => {
      showToast(enabled ? 'Payout actions now need 2FA' : 'Payout actions no longer need 2FA', 'success');
      queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => showToast(e.message, 'error'),
  });

  const reset = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('admin_reset_user_2fa', { p_user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      showToast('2FA reset. They will set up a new device at next sign-in.', 'success');
      queryClient.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => showToast(e.message, 'error'),
    onSettled: () => setResettingId(null),
  });

  const handleReset = (a: AdminRow) => {
    const who = a.email || a.name || 'this admin';
    if (
      window.confirm(
        `Reset 2FA for ${who}?\n\nTheir authenticator is removed and they are signed out everywhere. At next sign-in they must set up a new one.`
      )
    ) {
      setResettingId(a.user_id);
      reset.mutate(a.user_id);
    }
  };

  if (isLoading) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-6 text-sm text-gray-500">Loading 2FA status...</div>;
  }
  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-sm text-red-700">
        Could not load 2FA status: {(error as Error | null)?.message}
      </div>
    );
  }

  const missing = data.admins.filter((a) => !a.enrolled).length;
  const canEnable = data.caller_aal === 'aal2';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Admin 2FA</h3>
        <p className="text-sm text-gray-500 mt-1">
          Every admin must set up an authenticator app at sign-in. {data.admins.length - missing} of {data.admins.length} have.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Require 2FA for payout actions</p>
          <p className="text-sm text-gray-500 mt-1">
            When on, the server refuses payout controls and Process Due Payouts unless the admin signed in with their
            authenticator code. {missing > 0 && !data.require_mfa_for_money && `Turn this on after the ${missing} admin(s) below have enrolled, or they cannot use payout actions.`}
          </p>
          {!canEnable && !data.require_mfa_for_money && (
            <p className="text-xs text-amber-700 mt-2">
              Sign out and back in with your authenticator code to turn this on.
            </p>
          )}
        </div>
        <button
          onClick={() => setEnforcement.mutate(!data.require_mfa_for_money)}
          disabled={setEnforcement.isPending || (!data.require_mfa_for_money && !canEnable)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold flex-shrink-0 disabled:opacity-50 ${
            data.require_mfa_for_money
              ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          {data.require_mfa_for_money ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
        {data.admins.map((a) => (
          <div key={a.user_id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3 min-w-0">
              {a.enrolled ? (
                <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <ShieldOff className="h-5 w-5 text-amber-600 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{a.name || a.email}</p>
                <p className="text-xs text-gray-500 truncate">
                  {a.name ? `${a.email} · ` : ''}
                  {a.enrolled
                    ? `2FA on${a.enrolled_at ? ` since ${new Date(a.enrolled_at).toLocaleDateString()}` : ''}`
                    : 'Not set up yet (will be asked at next sign-in)'}
                </p>
              </div>
            </div>
            {a.enrolled && a.user_id !== session?.user.id && (
              <button
                onClick={() => handleReset(a)}
                disabled={resettingId === a.user_id}
                className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {resettingId === a.user_id ? 'Resetting...' : 'Reset 2FA'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
