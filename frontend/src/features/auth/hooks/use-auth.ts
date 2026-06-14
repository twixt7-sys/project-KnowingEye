/**
 * Re-export the canonical auth hook. The single implementation lives in the
 * app-wide AuthProvider so there is exactly one source of session truth.
 */
export { useAuth } from "../../../core/providers/auth-provider";
export type { User } from "../../../core/providers/auth-provider";
