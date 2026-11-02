import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getAdminSessionToken, logPageView, setAdminSessionToken } from '@/lib/adminActivity';

const HEARTBEAT_MS = 30 * 1000;

type HeartbeatResult = { valid: boolean; reason?: string; session_token?: string; tracked?: boolean };

// Mounted once inside the dashboard. While the tab is visible it tells the server every 30 seconds that this admin is
// here (that is what "online" and "last seen" are built from), records each page opened, and signs this browser out
// when a Super Admin ended the session or suspended the account.
export function useAdminActivityTracker() {
  const { session, signOut } = useAuth();
  const { pathname } = useLocation();
  const userId = session?.user?.id;
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;
  const endedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    endedRef.current = false;
    let cancelled = false;

    const beat = async () => {
      if (cancelled || endedRef.current || document.visibilityState !== 'visible') return;
      try {
        const { data, error } = await supabase.rpc('admin_heartbeat', {
          p_session_token: getAdminSessionToken(),
          p_path: pathRef.current,
        });
        if (error || cancelled) return; // network trouble: try again on the next beat
        const result = data as HeartbeatResult | null;
        if (!result) return;
        if (!result.valid) {
          if (result.reason === 'suspended' || result.reason === 'logged_out') {
            endedRef.current = true;
            void signOutRef.current({ reason: result.reason });
          }
          return;
        }
        if (result.session_token && result.session_token !== getAdminSessionToken()) {
          setAdminSessionToken(result.session_token);
        }
      } catch {
        // ignore; the next beat retries
      }
    };

    void beat();
    const interval = window.setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void beat();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);

  // one page_view per route change (the same page is not logged twice in a row)
  const lastLogged = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || lastLogged.current === pathname) return;
    lastLogged.current = pathname;
    void logPageView(pathname);
  }, [userId, pathname]);
}
