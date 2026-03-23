import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiClient } from './api';

// User type definition
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'EXAMINEE';
  is_admin: boolean;
  is_examinee: boolean;
}

// Auth context type
interface AuthContextType {
  user: User | null;
  login: (
    username: string,
    password: string,
    accountType?: 'admin' | 'student'
  ) => Promise<void>;
  register: (userData: {
    username: string;
    email: string;
    password: string;
    role: 'ADMIN' | 'EXAMINEE';
  }) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isExaminee: boolean;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on app start
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // TODO: Validate token and get user info
      // For now, we'll assume the token is valid
      // In a real app, you'd call an endpoint to get current user info
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (
    username: string,
    password: string,
    accountType?: 'admin' | 'student'
  ) => {
    try {
      setIsLoading(true);
      await apiClient.login({ username, password });

      // Prefer explicit account-type input, fallback to username-based heuristics
      const userRole = accountType
        ? accountType === 'admin'
          ? 'ADMIN'
          : 'EXAMINEE'
        : username.toLowerCase().includes('admin') || username.toLowerCase().includes('administrator')
        ? 'ADMIN'
        : 'EXAMINEE';

      const userData: User = {
        id: 1, // Should be from backend when profile endpoint exists
        username,
        email: `${username}@example.com`, // Placeholder, should be backend value
        role: userRole,
        is_admin: userRole === 'ADMIN',
        is_examinee: userRole === 'EXAMINEE',
      };

      setUser(userData);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: {
    username: string;
    email: string;
    password: string;
    role: 'ADMIN' | 'EXAMINEE';
  }) => {
    try {
      setIsLoading(true);
      await apiClient.register(userData);

      // After successful registration, automatically log in with role hint
      await login(
        userData.username,
        userData.password,
        userData.role === 'ADMIN' ? 'admin' : 'student'
      );
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isExaminee: user?.role === 'EXAMINEE',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}