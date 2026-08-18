import type { ReactNode } from "react";

export type AppRole =
  | "ADMIN"
  | "GUIDANCE_STAFF"
  | "PROGRAM_HEAD"
  | "FACULTY"
  | "PROCTOR"
  | "STUDENT";

export interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole;
  /** Gate by module access instead of/in addition to a specific role, e.g. "exams". */
  requiredModule?: string;
  /** Gate by a specific action permission, e.g. "exams.delete". */
  requiredPermission?: string;
  requireAuth?: boolean;
}
