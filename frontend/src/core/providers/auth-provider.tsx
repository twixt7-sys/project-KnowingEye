import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { type AccessMap, type ProfileUser, type Role, apiClient, tokenStore } from "../config/api";

export interface User extends ProfileUser {
  is_admin: boolean;
  is_student: boolean;
}

const EMPTY_ACCESS: AccessMap = { role: null, modules: [], permissions: [] };

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<User>;
  register: (userData: {
    username: string;
    email: string;
    password: string;
    password2: string;
    role?: Role;
    first_name: string;
    last_name: string;
    avatar?: File | null;
  }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isGuidanceStaff: boolean;
  isProgramHead: boolean;
  isFaculty: boolean;
  isProctor: boolean;
  isStudent: boolean;
  /** Any non-student role (admin/guidance_staff/program_head/faculty/proctor) - the "staff workspace" audience. */
  isStaff: boolean;
  /** Program Head or Admin - Level 1 exam-approval authority (Directive A1). */
  canApproveExams: boolean;
  /** Feature areas this user can see, e.g. "exams", "monitoring", "user-mgmt". */
  modules: Set<string>;
  /** Mutating actions this user is granted, e.g. "exams.update", "behavior.resolve". */
  permissions: Set<string>;
  hasModule: (module: string) => boolean;
  can: (action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decorate(profile: ProfileUser): User {
  return {
    ...profile,
    is_admin: profile.role === "ADMIN",
    is_student: profile.role === "STUDENT",
  };
}

async function fetchAccess(): Promise<AccessMap> {
  try {
    return await apiClient.getAccessMap();
  } catch {
    return EMPTY_ACCESS;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [access, setAccess] = useState<AccessMap>(EMPTY_ACCESS);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.access) {
      setUserState(null);
      setAccess(EMPTY_ACCESS);
      return;
    }
    try {
      const [profile, accessMap] = await Promise.all([apiClient.getProfile(), fetchAccess()]);
      setUserState(decorate(profile));
      setAccess(accessMap);
    } catch {
      tokenStore.clear();
      setUserState(null);
      setAccess(EMPTY_ACCESS);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      await apiClient.login({ username, password });
      const [profile, accessMap] = await Promise.all([apiClient.getProfile(), fetchAccess()]);
      const decorated = decorate(profile);
      setUserState(decorated);
      setAccess(accessMap);
      return decorated;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (userData: {
      username: string;
      email: string;
      password: string;
      password2: string;
      role?: Role;
      first_name: string;
      last_name: string;
      avatar?: File | null;
    }) => {
      setIsLoading(true);
      try {
        const { verification_email_sent } = await apiClient.register(userData);
        const user = await login(userData.username, userData.password);
        if (!verification_email_sent) {
          // Registration still succeeded - the OTP send itself failed (e.g.
          // mail misconfiguration). Let the user know explicitly rather than
          // leaving them to assume a code is already on its way.
          toast.error("Account created, but the verification email couldn't be sent.", {
            description: "Use \"Send verification code\" to try again.",
          });
        }
        return user;
      } finally {
        setIsLoading(false);
      }
    },
    [login],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUserState(null);
    setAccess(EMPTY_ACCESS);
  }, []);

  const setUser = useCallback((u: User | null) => setUserState(u), []);

  const modules = useMemo(() => new Set(access.modules), [access]);
  const permissions = useMemo(() => new Set(access.permissions), [access]);
  const isAdmin = user?.role === "ADMIN";
  const hasModule = useCallback(
    (module: string) => isAdmin || modules.has(module),
    [isAdmin, modules],
  );
  const can = useCallback(
    (action: string) => isAdmin || permissions.has(action),
    [isAdmin, permissions],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      login,
      register,
      logout,
      refresh,
      setUser,
      isLoading,
      isAuthenticated: !!user,
      isAdmin,
      isGuidanceStaff: user?.role === "GUIDANCE_STAFF",
      isProgramHead: user?.role === "PROGRAM_HEAD",
      isFaculty: user?.role === "FACULTY",
      isProctor: user?.role === "PROCTOR",
      isStudent: user?.role === "STUDENT",
      isStaff: !!user && user.role !== "STUDENT",
      canApproveExams: isAdmin || user?.role === "PROGRAM_HEAD",
      modules,
      permissions,
      hasModule,
      can,
    }),
    [
      user,
      login,
      register,
      logout,
      refresh,
      setUser,
      isLoading,
      isAdmin,
      modules,
      permissions,
      hasModule,
      can,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
