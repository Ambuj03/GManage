import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box } from '@mui/material';

import { ThemeContextProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GmailProvider } from './contexts/GmailContext';  // Add this import
import { ThemeToggle } from './components/ThemeToggle';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import OAuthCallback from './pages/OAuthCallback';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>; // Replace with proper loading component later
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Main App Routes
const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Box sx={{ minHeight: '100vh', position: 'relative' }}>
      {/* Theme Toggle - Always visible */}
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 1000,
        }}
      >
        <ThemeToggle />
      </Box>

      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Box>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContextProvider>
        <AuthProvider>
          <GmailProvider>  {/* Move GmailProvider INSIDE AuthProvider */}
            <Router>
              <AppRoutes />
            </Router>
          </GmailProvider>
        </AuthProvider>
      </ThemeContextProvider>
    </QueryClientProvider>
  );
};

export default App;