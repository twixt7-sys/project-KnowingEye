import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiClient } from '../config/api';

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
    password2: string;
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
    // accountType is currently an optional hint; we don't use it directly now (backend determines role)
    try {
      setIsLoading(true);
      const response = await apiClient.login({ username, password });

      const userData: User = {
        id: response.user.id,
        username: response.user.username,
        email: response.user.email,
        role: response.user.role as 'ADMIN' | 'EXAMINEE',
        is_admin: response.user.role === 'ADMIN',
        is_examinee: response.user.role === 'EXAMINEE',
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
    password2: string;
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
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}