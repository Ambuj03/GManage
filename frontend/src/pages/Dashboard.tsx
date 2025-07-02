import React from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

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

        <Typography variant="h6">
          Welcome back, {user?.username}!
        </Typography>
        
        {/* More dashboard content will go here */}
      </Box>
    </Container>
  );
};

export default Dashboard;