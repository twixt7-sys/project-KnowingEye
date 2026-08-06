import { Navigate, useLocation } from "react-router";
import { useAuth } from "../../../core/providers/auth-provider";
import type { ProtectedRouteProps } from "../../../core/router/route-types";

export function ProtectedRoute({
  children,
  requiredRole,
  requiredModule,
  requiredPermission,
  requireAuth = true,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isStudent, hasModule, can, isLoading } = useAuth();
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

  // Gate by role, module access, and/or action permission - all three are ANDed
  // when present. The redirect target is a sane home for whichever side of the
  // workspace the user actually belongs to.
  if (isAuthenticated) {
    const fallback = isStudent ? "/examinee" : "/examiner";

    if (requiredRole && user?.role !== requiredRole) {
      return <Navigate to={fallback} replace />;
    }
    if (requiredModule && !hasModule(requiredModule)) {
      return <Navigate to={fallback} replace />;
    }
    if (requiredPermission && !can(requiredPermission)) {
      return <Navigate to={fallback} replace />;
    }
  }

  return <>{children}</>;
}
