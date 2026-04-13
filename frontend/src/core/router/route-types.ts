import type { ReactNode } from 'react';

export type AppRole = 'ADMIN' | 'EXAMINEE';

export interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole;
  requireAuth?: boolean;
}
