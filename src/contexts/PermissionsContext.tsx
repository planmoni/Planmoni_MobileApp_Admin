import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string;
}

interface PermissionsContextType {
  permissions: Permission[];
  loading: boolean;
  hasPermission: (resource: string, action?: string) => boolean;
  hasAnyPermission: (checks: Array<{ resource: string; action?: string }>) => boolean;
  refetchPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    if (!session?.user) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: userPermissions, error } = await supabase.rpc('get_user_permissions', {
        target_user_id: session.user.id
      });

      if (error) {
        console.error('Error fetching permissions:', error);
        setPermissions([]);
      } else {
        setPermissions(userPermissions || []);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [session?.user?.id]);

  const hasPermission = (resource: string, action?: string): boolean => {
    if (!session?.user) return false;

    if (action) {
      return permissions.some(
        p => p.resource === resource && p.action === action
      );
    }

    return permissions.some(p => p.resource === resource);
  };

  const hasAnyPermission = (checks: Array<{ resource: string; action?: string }>): boolean => {
    return checks.some(check => hasPermission(check.resource, check.action));
  };

  const refetchPermissions = async () => {
    await fetchPermissions();
  };

  const value: PermissionsContextType = {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    refetchPermissions,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
