import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Stack,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Email as EmailIcon,
  Refresh as RefreshIcon,
  DeleteForever as DeleteIcon,
  Security as SecurityIcon,
  ConnectWithoutContact as ConnectIcon,
  LinkOff as LinkOffIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useGmail } from '../contexts/GmailContext';
import { apiService } from '../services/api';
import { useNavigate } from 'react-router-dom';

interface EmailStats {
  total_emails: number;
  total_threads: number;
}

interface ConnectivityStatus {
  status: string;
  connected: boolean;
  last_checked: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { 
    oauthStatus, 
    isConnected, 
    isLoading: gmailLoading, 
    error: gmailError,
    connectGmail,
    disconnectGmail,
    refreshStatus 
  } = useGmail();

  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [connectivity, setConnectivity] = useState<ConnectivityStatus | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [connectivityLoading, setConnectivityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch email statistics
  const fetchEmailStats = async () => {
    if (!isConnected) return;
    
    setStatsLoading(true);
    setError(null);
    
    try {
      // Mock data for now - can be replaced with real API call later
      setEmailStats({
        total_emails: oauthStatus?.gmail_info?.messages_total || 0,
        total_threads: oauthStatus?.gmail_info?.threads_total || 0
      });
    } catch (err: any) {
      console.error('Email stats error:', err);
      setError('Failed to fetch email statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  // Test Gmail connectivity
  const testConnectivity = async () => {
    if (!isConnected) return;
    
    setConnectivityLoading(true);
    
    try {
      const result = await apiService.testGmailConnectivity();
      setConnectivity({
        status: result.status,
        connected: result.connected,
        last_checked: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('Connectivity test error:', err);
      setConnectivity({
        status: 'error',
        connected: false,
        last_checked: new Date().toISOString()
      });
    } finally {
      setConnectivityLoading(false);
    }
  };

  // Refresh all data
  const refreshAllData = async () => {
    await refreshStatus();
    if (isConnected) {
      await Promise.all([fetchEmailStats(), testConnectivity()]);
    }
  };

  // Load initial data
  useEffect(() => {
    if (isConnected && !gmailLoading) {
      fetchEmailStats();
      testConnectivity();
    }
  }, [isConnected, gmailLoading]);

  // Handle Gmail connection
  const handleConnect = async () => {
    try {
      await connectGmail();
    } catch (err: any) {
      setError(err.message || 'Failed to connect Gmail');
    }
  };

  // Handle Gmail disconnection
  const handleDisconnect = async () => {
    try {
      await disconnectGmail();
      setEmailStats(null);
      setConnectivity(null);
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect Gmail');
    }
  };

  // Format numbers for display
  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null || isNaN(num)) return 'N/A';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Gmail Bulk Manager
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Welcome back, {user?.username}!
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <IconButton 
              onClick={refreshAllData} 
              disabled={gmailLoading}
              title="Refresh all data"
            >
              <RefreshIcon />
            </IconButton>
            <Button variant="outlined" onClick={logout}>
              Logout
            </Button>
          </Stack>
        </Box>

        {/* Error Alert */}
        {(error || gmailError) && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error || gmailError}
          </Alert>
        )}

        {/* Gmail Connection Status */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <SecurityIcon color={isConnected ? 'success' : 'disabled'} />
                <Box>
                  <Typography variant="h6">
                    Gmail Connection
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isConnected ? 'Connected and authenticated' : 'Not connected'}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={isConnected ? 'Connected' : 'Disconnected'}
                  color={isConnected ? 'success' : 'default'}
                  icon={isConnected ? <ConnectIcon /> : <LinkOffIcon />}
                />
                
                {isConnected ? (
                  <Button 
                    variant="outlined" 
                    color="error"
                    onClick={handleDisconnect}
                    disabled={gmailLoading}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button 
                    variant="contained" 
                    onClick={handleConnect}
                    disabled={gmailLoading}
                  >
                    Connect Gmail
                  </Button>
                )}
              </Box>
            </Box>

            {/* OAuth Details */}
            {oauthStatus && isConnected && (
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Account:</strong> Connected
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Email Statistics - Only show basic stats */}
        {isConnected && (
          <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
            <Box sx={{ flex: 1 }}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <EmailIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {statsLoading ? <CircularProgress size={24} /> : 
                     formatNumber(emailStats?.total_emails || oauthStatus?.gmail_info?.messages_total)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Emails
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <EmailIcon sx={{ fontSize: 40, color: 'secondary.main', mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {statsLoading ? <CircularProgress size={24} /> : 
                     formatNumber(emailStats?.total_threads || oauthStatus?.gmail_info?.threads_total)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Conversations
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}

        {/* Main Action - Bulk Delete */}
        {isConnected && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <DeleteIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
                <Typography variant="h5" gutterBottom>
                  Bulk Email Management
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  Clean up your inbox by deleting emails in bulk by category and age
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<DeleteIcon />}
                  endIcon={<ArrowIcon />}
                  onClick={() => navigate('/bulk-operations')}
                  color="error"
                  sx={{ px: 4, py: 1.5 }}
                >
                  Start Bulk Delete
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Connectivity Status - Only show when connected */}
        {isConnected && connectivity && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Gmail API Status
                </Typography>
                <Button
                  size="small"
                  onClick={testConnectivity}
                  disabled={connectivityLoading}
                  startIcon={connectivityLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
                >
                  Test Connection
                </Button>
              </Box>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">Status:</Typography>
                  <Chip
                    size="small"
                    label={connectivity.connected ? 'Connected' : 'Disconnected'}
                    color={connectivity.connected ? 'success' : 'error'}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Last checked: {connectivity.last_checked ? new Date(connectivity.last_checked).toLocaleTimeString() : 'Never'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Not Connected State */}
        {!isConnected && !gmailLoading && (
          <Card sx={{ textAlign: 'center', py: 6 }}>
            <CardContent>
              <SecurityIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Connect your Gmail account
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                To get started, connect your Gmail account to enable bulk email management.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleConnect}
                disabled={gmailLoading}
                startIcon={gmailLoading ? <CircularProgress size={20} /> : <ConnectIcon />}
              >
                Connect Gmail Account
              </Button>
            </CardContent>
          </Card>
        )}
      </Box>
    </Container>
  );
};

export default Dashboard;