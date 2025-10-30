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
  isSuperAdmin: boolean;
  hasPermission: (resource: string, action?: string) => boolean;
  hasAnyPermission: (checks: Array<{ resource: string; action?: string }>) => boolean;
  refetchPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchPermissions = async () => {
    if (!session?.user) {
      setPermissions([]);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data: superAdminCheck, error: superAdminError } = await supabase.rpc('is_super_admin');

      if (!superAdminError && superAdminCheck) {
        setIsSuperAdmin(true);
      } else {
        setIsSuperAdmin(false);
      }

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
      setIsSuperAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [session?.user?.id]);

  const hasPermission = (resource: string, action?: string): boolean => {
    if (!session?.user) return false;

    if (isSuperAdmin) return true;

    if (action) {
      return permissions.some(
        p => p.resource === resource && p.action === action
      );
    }

    return permissions.some(p => p.resource === resource);
  };

  const hasAnyPermission = (checks: Array<{ resource: string; action?: string }>): boolean => {
    if (isSuperAdmin) return true;
    return checks.some(check => hasPermission(check.resource, check.action));
  };

  const refetchPermissions = async () => {
    await fetchPermissions();
  };

  const value: PermissionsContextType = {
    permissions,
    loading,
    isSuperAdmin,
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
