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
  RestoreFromTrash as RestoreIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  ConnectWithoutContact as ConnectIcon,
  Link as LinkOffIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useGmail } from '../contexts/GmailContext';
import { apiService } from '../services/api';
import { useNavigate } from 'react-router-dom'; // Add this import

interface EmailStats {
  total_emails: number;
  total_threads: number;
  total_size_mb: number;
  labels_count: number;
  last_checked?: string;
}

interface ConnectivityStatus {
  status: string;
  connected: boolean;
  response_time?: number;
  last_checked?: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate(); // Add this hook
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

  // Fetch email statistics - DISABLED for now
  const fetchEmailStats = async () => {
    if (!isConnected) return;
    
    setStatsLoading(true);
    setError(null);
    
    try {
      // const stats = await apiService.getEmailStats(); // DISABLED - API not ready
      // setEmailStats(stats);
      
      // Mock data for now
      setEmailStats({
        total_emails: 0,
        total_threads: 0,
        total_size_mb: 0,
        labels_count: 0
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

  // Format file size
  const formatSize = (mb: number | undefined | null): string => {
    if (mb === undefined || mb === null || isNaN(mb)) return 'N/A';
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Gmail Purge Dashboard
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
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Email: {oauthStatus.gmail_info?.email_address || 'Loading...'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Connected: {oauthStatus.created_at ? new Date(oauthStatus.created_at).toLocaleDateString() : 'Unknown'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Scopes: {oauthStatus.scopes?.length || 0} permissions granted
                  </Typography>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Gmail Statistics - Only show when connected */}
        {isConnected && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 3 
            }}>
              {/* Email Count */}
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

              {/* Thread Count */}
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

              {/* Storage Used */}
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <StorageIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {statsLoading ? <CircularProgress size={24} /> : 
                     formatSize(emailStats?.total_size_mb)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Storage Used
                  </Typography>
                </CardContent>
              </Card>

              {/* Labels Count */}
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <SecurityIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {statsLoading ? <CircularProgress size={24} /> : 
                     formatNumber(emailStats?.labels_count)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Labels
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}

        {/* Quick Actions - Only show when connected */}
        {isConnected && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                gap: 2 
              }}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<EmailIcon />}
                  onClick={() => navigate('/emails')}
                >
                  Manage Emails
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<DeleteIcon />}
                  color="warning"
                  onClick={() => navigate('/bulk-operations')}
                >
                  Bulk Delete
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<RestoreIcon />}
                  color="info"
                  onClick={() => navigate('/recovery')}
                >
                  Recovery Tools
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
                To get started, connect your Gmail account to enable email management features.
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