import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GoogleOAuthStatus } from '../types/api';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';

interface GmailContextType {
  oauthStatus: GoogleOAuthStatus | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  connectGmail: () => Promise<void>;
  disconnectGmail: () => Promise<void>;
  checkConnection: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

const GmailContext = createContext<GmailContextType | undefined>(undefined);

export const useGmail = () => {
  const context = useContext(GmailContext);
  if (context === undefined) {
    throw new Error('useGmail must be used within a GmailProvider');
  }
  return context;
};

interface GmailProviderProps {
  children: ReactNode;
}

export const GmailProvider: React.FC<GmailProviderProps> = ({ children }) => {
  const [oauthStatus, setOauthStatus] = useState<GoogleOAuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { isAuthenticated } = useAuth();
  const isConnected = oauthStatus?.authenticated ?? false;

  // Fetch OAuth status when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Add delay to ensure tokens are properly set
      setTimeout(() => {
        refreshStatus();
      }, 500);
    } else {
      setOauthStatus(null);
    }
  }, [isAuthenticated]);

  const refreshStatus = async () => {
    if (!isAuthenticated) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const status = await apiService.getGoogleOAuthStatus();
      setOauthStatus(status);
    } catch (err: any) {
      console.error('Gmail status error:', err);
      setError(err.response?.data?.detail || 'Failed to check Gmail connection');
      setOauthStatus({
        has_token: false,
        is_expired: null,
        is_connected: false,
        scopes: [],
        authenticated: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  const connectGmail = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { url } = await apiService.getGoogleAuthUrl();
      
      // Open OAuth in same window for better compatibility
      window.location.href = url;
      
    } catch (err: any) {
      console.error('OAuth URL error:', err);
      setError(err.response?.data?.detail || 'Failed to initiate Gmail connection');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectGmail = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await apiService.revokeGoogleAuth();
      setOauthStatus({
        has_token: false,
        is_expired: null,
        is_connected: false,
        scopes: [],
        authenticated: false
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to disconnect Gmail');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const checkConnection = async (): Promise<boolean> => {
    try {
      const result = await apiService.testGmailConnectivity();
      return result.connected;
    } catch (err) {
      return false;
    }
  };

  const value: GmailContextType = {
    oauthStatus,
    isConnected,
    isLoading,
    error,
    connectGmail,
    disconnectGmail,
    checkConnection,
    refreshStatus,
  };

  return (
    <GmailContext.Provider value={value}>
      {children}
    </GmailContext.Provider>
  );
};