import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/contexts/PermissionsContext';
import { ShieldOff } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  resource: string;
  action?: string;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  resource,
  action,
  fallback,
  redirectTo = '/dashboard'
}: ProtectedRouteProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Checking permissions...</p>
        </div>
      </div>
    );
  }

  const hasAccess = hasPermission(resource, action);

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
            <ShieldOff className="h-10 w-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. Contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

interface ProtectedContentProps {
  children: ReactNode;
  resource: string;
  action?: string;
  fallback?: ReactNode;
}

export function ProtectedContent({
  children,
  resource,
  action,
  fallback = null
}: ProtectedContentProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return null;
  }

  const hasAccess = hasPermission(resource, action);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
