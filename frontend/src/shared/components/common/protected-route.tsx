import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../../../core/providers/auth-provider';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'ADMIN' | 'EXAMINEE';
  requireAuth?: boolean;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requireAuth = true
}: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin, isExaminee, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is authenticated but trying to access wrong role route
  if (isAuthenticated && requiredRole) {
    if (requiredRole === 'ADMIN' && !isAdmin) {
      return <Navigate to="/student/dashboard" replace />;
    }
    if (requiredRole === 'EXAMINEE' && !isExaminee) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}