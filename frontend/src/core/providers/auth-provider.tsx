import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiClient, tokenStore, type ProfileUser, type Role } from "../config/api";

export interface User extends ProfileUser {
  is_admin: boolean;
  is_examinee: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (
    username: string,
    password: string,
    accountType?: "admin" | "student"
  ) => Promise<User>;
  register: (userData: {
    username: string;
    email: string;
    password: string;
    password2: string;
    role: Role;
    first_name?: string;
    last_name?: string;
  }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isExaminee: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decorate(profile: ProfileUser): User {
  return {
    ...profile,
    is_admin: profile.role === "ADMIN",
    is_examinee: profile.role === "EXAMINEE",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.access) {
      setUserState(null);
      return;
    }
    try {
      const profile = await apiClient.getProfile();
      setUserState(decorate(profile));
    } catch {
      tokenStore.clear();
      setUserState(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      await apiClient.login({ username, password });
      const profile = await apiClient.getProfile();
      const decorated = decorate(profile);
      setUserState(decorated);
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
      role: Role;
      first_name?: string;
      last_name?: string;
    }) => {
      setIsLoading(true);
      try {
        await apiClient.register(userData);
        return await login(userData.username, userData.password);
      } finally {
        setIsLoading(false);
      }
    },
    [login]
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUserState(null);
  }, []);

  const setUser = useCallback((u: User | null) => setUserState(u), []);

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
      isAdmin: user?.role === "ADMIN",
      isExaminee: user?.role === "EXAMINEE",
    }),
    [user, login, register, logout, refresh, setUser, isLoading]
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
