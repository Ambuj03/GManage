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
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const clearAuthData = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  const fetchUserProfile = async () => {
    try {
      const userProfile = await apiService.getCurrentUser();
      setUser(userProfile);
      setIsAuthenticated(true); // Add this line!
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      clearAuthData();
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        await fetchUserProfile(); // This will now set isAuthenticated to true
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      const loginResponse = await apiService.login(credentials);

      localStorage.setItem('access_token', loginResponse.access);
      localStorage.setItem('refresh_token', loginResponse.refresh);

      // Fetch real user profile after successful login
      await fetchUserProfile(); // This will now set isAuthenticated to true
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