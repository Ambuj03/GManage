import React from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Stack,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';  // Add this import

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  const testGmailStatus = async () => {
    try {
      const result = await apiService.getGoogleOAuthStatus();
      console.log('Gmail Status:', result);
    } catch (error) {
      console.error('Gmail Status Error:', error);
    }
  };

  const startGmailOAuth = async () => {
    try {
      const data = await apiService.getGoogleAuthUrl();
      console.log('OAuth URL:', data);
      // Open OAuth URL in popup
      if (data.url) {
        window.open(data.url, 'gmail-oauth', 'width=500,height=600');
      }
    } catch (error) {
      console.error('OAuth URL Error:', error);
    }
  };

  // Add this temporary debug function
  const debugLogin = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Ambuj03', password: 'Ambuj@123' })
      });
      const data = await response.json();
      console.log('Django login response:', data);
    } catch (error) {
      console.error('Debug login error:', error);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1">
            Gmail Purge Dashboard
          </Typography>
          <Button variant="outlined" onClick={logout}>
            Logout
          </Button>
        </Box>

        <Typography variant="h6" sx={{ mb: 3 }}>
          Welcome back, {user?.username}!
        </Typography>

        <Stack spacing={2} direction="row">
          <Button 
            variant="contained" 
            onClick={testGmailStatus}
          >
            Check Gmail Status
          </Button>
          
          <Button 
            variant="outlined" 
            onClick={startGmailOAuth}
          >
            Connect Gmail
          </Button>

          {/* Add button to test debug login */}
          <Button 
            variant="outlined" 
            onClick={debugLogin}
          >
            Debug Login Response
          </Button>
        </Stack>

        {/* More dashboard content will go here */}
      </Box>
    </Container>
  );
};

export default Dashboard;