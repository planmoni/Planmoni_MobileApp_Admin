import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useToast } from './ToastContext';
import { logSignOut } from '../lib/adminActivity';

// Where the signed-in admin is in the two-factor flow (Supabase MFA / TOTP):
//   loading          checking the session's assurance level
//   ready            signed in with password + authenticator code (aal2): dashboard unlocked
//   needs_challenge  has an authenticator, must enter a code for this session
//   needs_enroll     has no authenticator yet, must set one up (every admin has to)
//   error            could not check (network / MFA not available)
export type MfaState = {
  status: 'loading' | 'ready' | 'needs_challenge' | 'needs_enroll' | 'error';
  factorId?: string;
  error?: string;
};

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  mfa: MfaState;
  refreshMfa: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: (options?: { reason?: SignOutReason }) => Promise<void>;
};

// idle: 5 minutes without activity. logged_out / suspended: a Super Admin ended this session or suspended the account.
export type SignOutReason = 'idle' | 'logged_out' | 'suspended';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mfa, setMfa] = useState<MfaState>({ status: 'loading' });
  const { showToast } = useToast();

  const refreshMfa = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      if (data.currentLevel === 'aal2') {
        setMfa({ status: 'ready' });
        return;
      }
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const factor = factors?.totp?.[0]; // listFactors().totp only holds verified factors
      if (factor) {
        setMfa({ status: 'needs_challenge', factorId: factor.id });
      } else {
        setMfa({ status: 'needs_enroll' });
      }
    } catch (err) {
      console.error('Error checking two-factor status:', err);
      setMfa({
        status: 'error',
        error: err instanceof Error ? err.message : 'Could not check two-factor status',
      });
    }
  }, []);

  // Re-check when the signed-in user changes (not on every token refresh)
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      setMfa({ status: 'loading' });
      return;
    }
    setMfa({ status: 'loading' });
    void refreshMfa();
  }, [userId, refreshMfa]);

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const initializeSession = async () => {
      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          if (isMounted) {
            setSession(null);
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setSession(session);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Unexpected error in getSession:', err);
        if (isMounted) {
          setSession(null);
          setIsLoading(false);
        }
      }
    };

    // Initialize session first
    initializeSession();

    // Set up auth state change listener
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change event:', event, 'Session:', !!session);
        
        if (isMounted) {
          if (event === 'SIGNED_OUT') {
            setSession(null);
          } else {
            // For SIGNED_IN, TOKEN_REFRESHED, etc., use the session from the event
            setSession(session);
          }
          setIsLoading(false);
        }
      }
    );

    subscription = authSubscription;

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const checkUserRole = async (userId: string): Promise<boolean> => {
    try {
      // First check if user has admin flag in profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error checking profile admin status:', profileError);
      } else if (profile?.is_admin) {
        return true; // User is admin, allow access
      }

      // Check user roles using the get_user_roles function
      const { data: userRoles, error: rolesError } = await supabase
        .rpc('get_user_roles', { target_user_id: userId });

      if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
        return false;
      }

      // Allow any user with at least one active role
      const hasAllowedRole = userRoles?.some((role: any) => role.is_active);

      return hasAllowedRole || false;
    } catch (error) {
      console.error('Error in role check:', error);
      return false;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in with:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
      }

      if (!data.user || !data.session) {
        return { success: false, error: 'Authentication failed' };
      }

      // A suspended admin is turned away before anything else loads
      const { data: access } = await supabase.rpc('admin_access_status');
      if ((access as { blocked?: boolean } | null)?.blocked) {
        const reason = (access as { reason?: string }).reason;
        await supabase.auth.signOut({ scope: 'local' });
        return {
          success: false,
          error: `Your admin access has been suspended${reason ? `: ${reason}` : '.'} Contact a Super Admin if you think this is a mistake.`,
        };
      }

      console.log('Authentication successful, checking user roles...');

      // Check if user has required role for admin dashboard access
      const hasRequiredRole = await checkUserRole(data.user.id);

      if (!hasRequiredRole) {
        console.log('User does not have required role, signing out...');

        // Sign out the user immediately
        await supabase.auth.signOut();

        return {
          success: false,
          error: 'Access denied. This dashboard is restricted to administrators only.'
        };
      }

      console.log('User has required role, login successful');
      // Set session immediately so routing can happen right away
      // onAuthStateChange will also fire but that's okay - double setting is safe
      setSession(data.session);
      setIsLoading(false);

      return { success: true };
    } catch (error) {
      console.error('Unexpected sign in error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      };
    }
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (options?: { reason?: SignOutReason }) => {
    try {
      console.log('Starting sign out process...');

      // Record a deliberate or idle sign-out. When a Super Admin ended the session the server already closed it.
      if (!options?.reason || options.reason === 'idle') {
        await Promise.race([logSignOut(options?.reason), new Promise((resolve) => setTimeout(resolve, 1500))]);
      }

      // Clear session immediately
      setSession(null);

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('Sign out error:', error);
      }

      // Clear all local storage related to auth
      localStorage.clear();
      sessionStorage.clear();

      if (!options?.reason) showToast('Successfully signed out', 'success');

      // Force redirect to login page (the login page explains an automatic sign-out)
      window.location.replace(options?.reason ? `/login?reason=${options.reason}` : '/login');
    } catch (error) {
      console.error('Unexpected sign out error:', error);
      showToast('Failed to sign out', 'error');
      // Still try to redirect even if there's an error
      window.location.replace('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, mfa, refreshMfa, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}