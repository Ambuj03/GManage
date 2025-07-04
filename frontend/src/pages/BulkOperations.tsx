import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  TextField,
  Paper,
  Divider,
  Chip,
  Fade,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Delete as DeleteIcon,
  Restore as RestoreIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Visibility as PreviewIcon,
  PlayArrow as ExecuteIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useGmail } from '../contexts/GmailContext';
import { apiService } from '../services/api';
import { TaskStatus } from '../types/interfaces';

const TIME_PERIODS = [
  { value: '7d', label: '7 days', description: 'Emails older than 7 days' },
  { value: '30d', label: '30 days', description: 'Emails older than 30 days' },
  { value: '90d', label: '3 months', description: 'Emails older than 3 months' },
  { value: '180d', label: '6 months', description: 'Emails older than 6 months' },
  { value: '1y', label: '1 year', description: 'Emails older than 1 year' },
  { value: '2y', label: '2 years', description: 'Emails older than 2 years' },
];

const EMAIL_CATEGORIES = [
  { 
    value: 'category:promotions', 
    label: 'Promotions', 
    icon: '🏷️',
    description: 'Marketing emails, deals, and promotional content',
    color: 'warning' as const
  },
  { 
    value: 'category:updates', 
    label: 'Updates', 
    icon: '📄',
    description: 'Newsletters, notifications, and updates',
    color: 'info' as const
  },
  { 
    value: 'category:social', 
    label: 'Social', 
    icon: '👥',
    description: 'Social media notifications and updates',
    color: 'primary' as const
  },
  { 
    value: 'category:forums', 
    label: 'Forums', 
    icon: '💬',
    description: 'Forum posts and community discussions',
    color: 'secondary' as const
  },
  { 
    value: 'in:spam', 
    label: 'Spam', 
    icon: '🚫',
    description: 'Spam and unwanted emails',
    color: 'error' as const
  },
];

const QUICK_AMOUNTS = [
  { value: 100, label: '100' },
  { value: 500, label: '500' },
  { value: 1000, label: '1K' },
  { value: 2500, label: '2.5K' },
  { value: 5000, label: '5K' },
];

const BulkOperations: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected } = useGmail();
  
  // Form state
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTimePeriod, setSelectedTimePeriod] = useState('90d');
  const [emailCount, setEmailCount] = useState(1000);
  const [operation, setOperation] = useState<'delete' | 'recover'>('delete');
  
  // UI state
  const [activeStep, setActiveStep] = useState(0);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [currentTask, setCurrentTask] = useState<TaskStatus | null>(null);
  
  // General state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Redirect if not connected
  useEffect(() => {
    if (!isConnected) {
      navigate('/dashboard');
    }
  }, [isConnected, navigate]);

  // Clear alerts when switching modes
  useEffect(() => {
    setError(null);
    setSuccess(null);
    setActiveStep(0);
  }, [operation]);

  // Poll task status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (currentTask && ['PENDING', 'PROGRESS'].includes(currentTask.status)) {
      interval = setInterval(async () => {
        try {
          const status = await apiService.getTaskStatus(currentTask.task_id);
          setCurrentTask(status);
          
          if (status.status === 'SUCCESS') {
            const processed = status.result?.successful || status.result?.total || 0;
            setSuccess(`Operation completed! Processed ${processed} emails.`);
            setExecuting(false);
            setCurrentTask(null);
          } else if (status.status === 'FAILURE') {
            setError(`Operation failed: ${status.result?.error || 'Unknown error'}`);
            setExecuting(false);
            setCurrentTask(null);
          }
        } catch (err) {
          console.error('Failed to poll task status:', err);
        }
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentTask]);

  // Generate query based on selection
  const generateQuery = (): string => {
    const parts: string[] = [];
    
    if (selectedCategory) {
      if (operation === 'recover') {
        parts.push('in:trash');
      } else {
        parts.push(selectedCategory);
        if (selectedTimePeriod) {
          parts.push(`older_than:${selectedTimePeriod}`);
        }
      }
    }
    
    return parts.join(' ');
  };

  const handleExecute = async () => {
    const query = generateQuery();
    
    if (!query.trim()) {
      setError('Please select a category');
      return;
    }
    
    setExecuting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const params = { 
        q: query, 
        max_emails: emailCount 
      };
      
      const response = operation === 'delete' 
        ? await apiService.bulkDeleteByQuery(params)
        : await apiService.bulkRecoverByQuery(params);
      
      setCurrentTask({
        task_id: response.task_id,
        status: 'PENDING'
      });
      
      setExecuteOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to start ${operation} operation`);
      setExecuting(false);
    }
  };

  const getCategoryInfo = (categoryValue: string) => {
    return EMAIL_CATEGORIES.find(cat => cat.value === categoryValue);
  };

  const getSelectedCategoryName = () => {
    const category = getCategoryInfo(selectedCategory);
    return category ? category.label : selectedCategory;
  };

  if (!isConnected) {
    return null;
  }

  return (
    <Container maxWidth="lg">
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
            Bulk Email Operations
          </Typography>
        </Box>

        {/* Alerts */}
        <Fade in={Boolean(error)}>
          <Box sx={{ mb: 3 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
          </Box>
        </Fade>
        
        <Fade in={Boolean(success)}>
          <Box sx={{ mb: 3 }}>
            {success && (
              <Alert severity="success" onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            )}
          </Box>
        </Fade>

        {/* Main Layout */}
        <Box sx={{ display: 'flex', gap: 4 }}>
          {/* Left Column - Configuration */}
          <Box sx={{ flex: 2 }}>
            {/* Operation Type Selection */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Step 1: Choose Operation
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Paper
                      sx={{
                        p: 3,
                        border: 2,
                        borderColor: operation === 'delete' ? 'error.main' : 'grey.300',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        height: '140px', // Fixed height
                        display: 'flex',
                        alignItems: 'center',
                        '&:hover': {
                          borderColor: 'error.main',
                          bgcolor: 'error.50'
                        }
                      }}
                      onClick={() => setOperation('delete')}
                    >
                      <Box sx={{ textAlign: 'center', width: '100%' }}>
                        <DeleteIcon sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                        <Typography variant="h6" gutterBottom>
                          Delete Emails
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Move emails to trash based on category and age
                        </Typography>
                      </Box>
                    </Paper>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Paper
                      sx={{
                        p: 3,
                        border: 2,
                        borderColor: operation === 'recover' ? 'primary.main' : 'grey.300',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        height: '140px', // Fixed height
                        display: 'flex',
                        alignItems: 'center',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: 'primary.50'
                        }
                      }}
                      onClick={() => setOperation('recover')}
                    >
                      <Box sx={{ textAlign: 'center', width: '100%' }}>
                        <RestoreIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                        <Typography variant="h6" gutterBottom>
                          Recover Emails
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Restore emails from trash back to inbox
                        </Typography>
                      </Box>
                    </Paper>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Category Selection */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Step 2: Select Email Category
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {EMAIL_CATEGORIES.map((category) => (
                    <Box key={category.value} sx={{ flex: '1 1 200px' }}>
                      <Paper
                        sx={{
                          p: 2,
                          border: 2,
                          borderColor: selectedCategory === category.value ? `${category.color}.main` : 'grey.300',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          height: '100%',
                          '&:hover': {
                            borderColor: `${category.color}.main`,
                            bgcolor: `${category.color}.50`
                          }
                        }}
                        onClick={() => setSelectedCategory(category.value)}
                      >
                        <Box sx={{ textAlign: 'center', mb: 1 }}>
                          <Typography sx={{ fontSize: 32, mb: 1 }}>{category.icon}</Typography>
                          <Typography variant="h6" gutterBottom>
                            {category.label}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {category.description}
                          </Typography>
                        </Box>
                      </Paper>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>

            {/* Time Period Selection - Only for Delete */}
            {operation === 'delete' && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Step 3: Choose Email Age
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {TIME_PERIODS.map((period) => (
                      <Box key={period.value} sx={{ flex: '1 1 150px' }}>
                        <Paper
                          sx={{
                            p: 2,
                            border: 2,
                            borderColor: selectedTimePeriod === period.value ? 'primary.main' : 'grey.300',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            height: '100%',
                            '&:hover': {
                              borderColor: 'primary.main',
                              bgcolor: 'primary.50'
                            }
                          }}
                          onClick={() => setSelectedTimePeriod(period.value)}
                        >
                          <Box sx={{ textAlign: 'center' }}>
                            <ScheduleIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                            <Typography variant="h6" gutterBottom>
                              {period.label}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {period.description}
                            </Typography>
                          </Box>
                        </Paper>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Gmail Limitation Warning for Recover */}
            {operation === 'recover' && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Note:</strong> Gmail doesn't support age filtering for trash recovery. 
                  This will recover the most recent emails from trash.
                </Typography>
              </Alert>
            )}

            {/* Email Count Selection */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Step 4: Set Email Count Limit
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  Number of emails to {operation}: <strong>{emailCount.toLocaleString()}</strong>
                </Typography>
                
                <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
                  {QUICK_AMOUNTS.map((amount) => (
                    <Chip
                      key={amount.value}
                      label={amount.label}
                      color={emailCount === amount.value ? "primary" : "default"}
                      onClick={() => setEmailCount(amount.value)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
                
                <TextField
                  type="number"
                  label="Custom amount"
                  value={emailCount}
                  onChange={(e) => setEmailCount(Math.min(10000, Math.max(1, parseInt(e.target.value) || 1)))}
                  inputProps={{ min: 1, max: 10000 }}
                  size="small"
                  sx={{ width: 200 }}
                />
              </CardContent>
            </Card>
          </Box>

          {/* Right Column - Preview & Actions */}
          <Box sx={{ flex: 1 }}>
            {/* Query Preview */}
            <Card sx={{ mb: 3, position: 'sticky', top: 20 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Operation Summary
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Operation:</strong> {operation === 'delete' ? 'Delete' : 'Recover'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Category:</strong> {getSelectedCategoryName() || 'Not selected'}
                  </Typography>
                  {operation === 'delete' && (
                    <Typography variant="body2" color="text.secondary">
                      <strong>Age:</strong> Older than {TIME_PERIODS.find(p => p.value === selectedTimePeriod)?.label}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    <strong>Max emails:</strong> {emailCount.toLocaleString()}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'background.default', 
                  borderRadius: 1, 
                  mb: 2, 
                  border: 1, 
                  borderColor: 'divider' 
                }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Gmail Query:</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.primary' }}>
                    {generateQuery() || 'Select category to see query'}
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  size="large"
                  startIcon={operation === 'delete' ? <DeleteIcon /> : <RestoreIcon />}
                  onClick={() => setExecuteOpen(true)}
                  disabled={executing || !selectedCategory}
                  color={operation === 'delete' ? 'error' : 'primary'}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  {operation === 'delete' ? 'Delete' : 'Recover'} {emailCount.toLocaleString()} Emails
                </Button>

                {/* Preview Button - Future feature */}
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<PreviewIcon />}
                  disabled={!selectedCategory}
                  fullWidth
                  sx={{ mb: 1 }}
                >
                  Preview Emails (Coming Soon)
                </Button>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Quick Actions */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Common cleanup operations
            </Typography>
            
            <Stack spacing={2}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  setOperation('delete');
                  setSelectedCategory('category:promotions');
                  setSelectedTimePeriod('90d');
                  setEmailCount(1000);
                }}
                disabled={executing}
                sx={{ textAlign: 'left', justifyContent: 'flex-start' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Typography sx={{ mr: 2 }}>🏷️</Typography>
                  <Box>
                    <Typography variant="body1">Delete 1,000 Promotions</Typography>
                    <Typography variant="body2" color="text.secondary">
                      3+ months old marketing emails
                    </Typography>
                  </Box>
                </Box>
              </Button>
              
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  setOperation('delete');
                  setSelectedCategory('category:updates');
                  setSelectedTimePeriod('180d');
                  setEmailCount(2000);
                }}
                disabled={executing}
                sx={{ textAlign: 'left', justifyContent: 'flex-start' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Typography sx={{ mr: 2 }}>📄</Typography>
                  <Box>
                    <Typography variant="body1">Delete 2,000 Updates</Typography>
                    <Typography variant="body2" color="text.secondary">
                      6+ months old newsletters
                    </Typography>
                  </Box>
                </Box>
              </Button>
              
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  setOperation('delete');
                  setSelectedCategory('in:spam');
                  setSelectedTimePeriod('30d');
                  setEmailCount(500);
                }}
                disabled={executing}
                sx={{ textAlign: 'left', justifyContent: 'flex-start' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Typography sx={{ mr: 2 }}>🚫</Typography>
                  <Box>
                    <Typography variant="body1">Delete 500 Spam</Typography>
                    <Typography variant="body2" color="text.secondary">
                      1+ month old spam emails
                    </Typography>
                  </Box>
                </Box>
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog open={executeOpen} onClose={() => setExecuteOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <WarningIcon color="warning" sx={{ mr: 1 }} />
              Confirm {operation === 'delete' ? 'Delete' : 'Recovery'}
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {operation === 'delete' ? 'Delete' : 'Recover'} up to{' '}
              <strong>{emailCount.toLocaleString()}</strong> emails?
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Category:</strong> {getSelectedCategoryName()}
              </Typography>
              {operation === 'delete' && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Age:</strong> Older than {TIME_PERIODS.find(p => p.value === selectedTimePeriod)?.label}
                </Typography>
              )}
            </Box>
            
            <Alert severity={operation === 'delete' ? 'warning' : 'info'}>
              {operation === 'delete' 
                ? 'Emails will be moved to trash and can be recovered later.'
                : 'Emails will be restored from trash to your inbox.'
              }
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExecuteOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleExecute} 
              color={operation === 'delete' ? 'error' : 'primary'}
              variant="contained"
              startIcon={<ExecuteIcon />}
            >
              {operation === 'delete' ? 'Delete' : 'Recover'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default BulkOperations;