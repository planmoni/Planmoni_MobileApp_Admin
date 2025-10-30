import { ReactNode } from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';

interface PermissionGateProps {
  children: ReactNode;
  resource: string;
  action: string;
  fallback?: ReactNode;
}

export function PermissionGate({ children, resource, action, fallback = null }: PermissionGateProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return null;
  }

  if (!hasPermission(resource, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
