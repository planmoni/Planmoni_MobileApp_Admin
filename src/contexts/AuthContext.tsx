import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useToast } from './ToastContext';

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
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

      // Check if user has any of the allowed roles
      const allowedRoles = ['Super Admin', 'Admin', 'Moderator'];
      const hasAllowedRole = userRoles?.some((role: any) => 
        allowedRoles.includes(role.role_name) && role.is_active
      );

      return hasAllowedRole || false;
    } catch (error) {
      console.error('Error in role check:', error);
      return false;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log('Attempting to sign in with:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Authentication failed' };
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

      console.log('User has required role, sign in successful');
      return { success: true };
    } catch (error) {
      console.error('Unexpected sign in error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      };
    } finally {
      setIsLoading(false);
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

  const signOut = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      setSession(null);
      showToast('Successfully signed out', 'success');
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
      showToast('Failed to sign out', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signUp, signOut }}>
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