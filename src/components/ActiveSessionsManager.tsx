import { Monitor, Smartphone, LogOut, RefreshCw, Clock, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Button from './Button';
import { formatDistanceToNow } from 'date-fns';

interface AdminSession {
  id: string;
  user_id: string;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  last_active: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export function ActiveSessionsManager() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['admin-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_sessions')
        .select(`
          *,
          profiles (
            first_name,
            last_name,
            email
          )
        `)
        .eq('is_active', true)
        .order('last_active', { ascending: false });

      if (error) throw error;
      return data as AdminSession[];
    },
    refetchInterval: 30000,
  });

  const logoutSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.rpc('invalidate_session', {
        p_session_id: sessionId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sessions'] });
      showToast('Session logged out successfully', 'success');
    },
    onError: (error) => {
      console.error('Error logging out session:', error);
      showToast('Failed to logout session', 'error');
    },
  });

  const handleLogoutSession = (sessionId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to log out ${userName}? They will need to sign in again.`)) {
      logoutSessionMutation.mutate(sessionId);
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor className="w-5 h-5" />;
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="w-5 h-5" />;
    }
    return <Monitor className="w-5 h-5" />;
  };

  const getBrowserInfo = (userAgent: string | null) => {
    if (!userAgent) return 'Unknown Browser';

    const ua = userAgent.toLowerCase();
    let browser = 'Unknown';
    let os = 'Unknown OS';

    if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';

    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('ios') || ua.includes('iphone')) os = 'iOS';

    return `${browser} on ${os}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-6">
        <div className="flex justify-center items-center h-32">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  const activeSessions = sessions || [];
  const groupedSessions = activeSessions.reduce((acc, session) => {
    const email = session.profiles.email;
    if (!acc[email]) {
      acc[email] = [];
    }
    acc[email].push(session);
    return acc;
  }, {} as Record<string, AdminSession[]>);

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-gray-100">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Active Admin Sessions</h3>
            <p className="text-sm text-gray-600 mt-1">
              {activeSessions.length} active {activeSessions.length === 1 ? 'session' : 'sessions'}
            </p>
          </div>
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-sessions'] })}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {activeSessions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No active sessions found
          </div>
        ) : (
          Object.entries(groupedSessions).map(([email, userSessions]) => (
            <div key={email} className="p-6">
              <div className="mb-4">
                <h4 className="font-semibold text-gray-900">
                  {userSessions[0].profiles.first_name} {userSessions[0].profiles.last_name}
                </h4>
                <p className="text-sm text-gray-600">{email}</p>
              </div>

              <div className="space-y-3">
                {userSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-start justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-white rounded-lg">
                        {getDeviceIcon(session.user_agent)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {getBrowserInfo(session.user_agent)}
                        </p>
                        <div className="flex flex-col gap-1 mt-1">
                          {session.ip_address && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{session.ip_address}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              Last active {formatDistanceToNow(new Date(session.last_active), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Logged in {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() =>
                        handleLogoutSession(
                          session.id,
                          `${session.profiles.first_name} ${session.profiles.last_name}`
                        )
                      }
                      variant="secondary"
                      className="ml-4 text-red-600 hover:bg-red-50 flex items-center gap-2"
                      disabled={logoutSessionMutation.isPending}
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
