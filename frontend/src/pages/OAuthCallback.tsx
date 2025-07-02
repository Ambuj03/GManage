import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, Alert } from '@mui/material';
import { apiService } from '../services/api';

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting to Gmail...');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      try {
        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code || !state) {
          throw new Error('Missing OAuth parameters (code or state)');
        }

        // Handle OAuth callback
        await apiService.handleGoogleCallback(code, state);
        
        setStatus('success');
        setMessage('Gmail connected successfully! Redirecting to dashboard...');
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
        
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setMessage(err.message || 'Failed to connect Gmail');
        
        // Redirect to dashboard with error after 3 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
        p: 4,
      }}
    >
      {status === 'loading' && <CircularProgress />}
      
      {status === 'success' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Gmail Connected Successfully!
        </Alert>
      )}
      
      {status === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Connection Failed
        </Alert>
      )}
      
      <Typography variant="h6" align="center">
        {message}
      </Typography>
    </Box>
  );
};

export default OAuthCallback;