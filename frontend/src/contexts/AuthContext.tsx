import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginRequest, RegisterRequest } from '../types/api';
import { apiService } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!localStorage.getItem('access_token');

  const clearAuthData = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  useEffect(() => {
    // Check if user is logged in on app start
    const token = localStorage.getItem('access_token');
    if (token) {
      // Create basic user object - we'll fetch real data later
      setUser({
        id: 1,
        username: 'user',
        email: '',
        first_name: '',
        last_name: '',
      });
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      const loginResponse = await apiService.login(credentials);
      
      localStorage.setItem('access_token', loginResponse.access);
      localStorage.setItem('refresh_token', loginResponse.refresh);
      
      // Create user object from Django response
      setUser({
        id: 1,
        username: credentials.username,
        email: '',
        first_name: '',
        last_name: '',
      });
    } catch (error) {
      clearAuthData();
      throw error;
    }
  };

  const register = async (userData: RegisterRequest) => {
    try {
      await apiService.register(userData);
      // Auto-login after successful registration
      await login({ username: userData.username, password: userData.password });
    } catch (error) {
      clearAuthData();
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Call logout API but don't fail if it errors
      await apiService.logout();
    } catch (error) {
      console.warn('Logout API error (ignoring):', error);
    } finally {
      // Always clear local data regardless of API call result
      clearAuthData();
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};