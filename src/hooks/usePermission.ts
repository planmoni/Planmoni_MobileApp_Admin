import { usePermissions } from '@/contexts/PermissionsContext';

export function usePermission(resource: string, action?: string) {
  const { hasPermission, loading } = usePermissions();

  return {
    hasPermission: hasPermission(resource, action),
    loading,
  };
}

export function useAnyPermission(checks: Array<{ resource: string; action?: string }>) {
  const { hasAnyPermission, loading } = usePermissions();

  return {
    hasPermission: hasAnyPermission(checks),
    loading,
  };
}
