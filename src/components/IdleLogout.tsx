import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Signs the admin out after 5 minutes without activity. A warning with a countdown appears for the
// last 30 seconds. Activity is shared between tabs through localStorage, so working in one tab keeps
// the others signed in, and a laptop that slept (timers paused) is signed out as soon as it wakes.
const IDLE_MS = 5 * 60 * 1000;
const WARN_MS = 30 * 1000;
const STORAGE_KEY = 'admin_last_activity';
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

const readLast = (): number | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
};

export default function IdleLogout() {
  const { session, signOut } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const warningRef = useRef(false);
  const signingOut = useRef(false);
  const lastWrite = useRef(0);
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  const touch = useCallback(() => {
    const now = Date.now();
    lastWrite.current = now;
    localStorage.setItem(STORAGE_KEY, String(now));
  }, []);

  const lastSignIn = session?.user?.last_sign_in_at ? Date.parse(session.user.last_sign_in_at) : 0;
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;

    // A timestamp from before this sign-in belongs to an older session: start fresh.
    // A timestamp from this sign-in that is already stale (browser was closed, then reopened): out.
    const stored = readLast();
    if (stored === null || stored < lastSignIn) touch();

    const tick = () => {
      if (signingOut.current) return;
      const last = readLast() ?? Date.now();
      const idle = Date.now() - last;
      if (idle >= IDLE_MS) {
        signingOut.current = true;
        void signOutRef.current({ reason: 'idle' });
        return;
      }
      if (idle >= IDLE_MS - WARN_MS) {
        warningRef.current = true;
        setSecondsLeft(Math.max(1, Math.ceil((IDLE_MS - idle) / 1000)));
      } else if (warningRef.current) {
        // activity in another tab
        warningRef.current = false;
        setSecondsLeft(null);
      }
    };

    const onActivity = () => {
      // Once the warning is up only the button keeps you signed in, so a bumped mouse doesn't hide it
      if (warningRef.current) return;
      if (Date.now() - lastWrite.current < 1000) return;
      touch();
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(tick, 1000);
    tick();

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [userId, lastSignIn, touch]);

  if (secondsLeft === null) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Clock className="h-6 w-6 text-gray-900" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Still there?</h2>
        <p className="text-sm text-gray-500 mt-2">
          You will be signed out in {secondsLeft} second{secondsLeft === 1 ? '' : 's'} because of inactivity.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              signingOut.current = true;
              void signOut();
            }}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50"
          >
            Sign out
          </button>
          <button
            onClick={() => {
              warningRef.current = false;
              setSecondsLeft(null);
              touch();
            }}
            className="flex-1 px-4 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800"
            autoFocus
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
