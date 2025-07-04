import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Alert,
  Stack,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Construction as ConstructionIcon,
  Email as EmailIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useGmail } from '../contexts/GmailContext';

const EmailManagement: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected } = useGmail();
  
  // Redirect if not connected
  useEffect(() => {
    if (!isConnected) {
      navigate('/dashboard');
    }
  }, [isConnected, navigate]);

  if (!isConnected) {
    return null;
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/dashboard')}
            sx={{ mr: 2 }}
          >
            Back to Dashboard
          </Button>
          <Typography variant="h4" component="h1">
            Email Management
          </Typography>
        </Box>

        {/* Coming Soon Section */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              py: 8,
              textAlign: 'center'
            }}>
              <ConstructionIcon sx={{ fontSize: 80, color: 'primary.main', mb: 3 }} />
              
              <Typography variant="h4" gutterBottom color="primary">
                Coming Soon!
              </Typography>
              
              <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 600 }}>
                Advanced email search and management features are currently under development
              </Typography>
              
              <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                <Chip 
                  icon={<SearchIcon />} 
                  label="Gmail Search" 
                  variant="outlined" 
                  color="primary"
                />
                <Chip 
                  icon={<FilterIcon />} 
                  label="Advanced Filters" 
                  variant="outlined" 
                  color="primary"
                />
                <Chip 
                  icon={<EmailIcon />} 
                  label="Email Preview" 
                  variant="outlined" 
                  color="primary"
                />
              </Stack>
              
              <Alert severity="info" sx={{ maxWidth: 500 }}>
                <Typography variant="body2">
                  We're working hard to bring you powerful email management tools. 
                  In the meantime, you can use the <strong>Bulk Operations</strong> feature 
                  to manage your emails in bulk.
                </Typography>
              </Alert>
            </Box>
          </CardContent>
        </Card>

        {/* Navigation to Available Features */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Available Features
            </Typography>
            
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              mt: 2
            }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/bulk-operations')}
                sx={{ flex: 1 }}
              >
                Bulk Operations
              </Button>
              
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/recovery-tools')}
                sx={{ flex: 1 }}
              >
                Recovery Tools
              </Button>
              
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/dashboard')}
                sx={{ flex: 1 }}
              >
                Dashboard
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default EmailManagement;