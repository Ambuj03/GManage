import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  TextField,
  Slider,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Delete as DeleteIcon,
  Restore as RestoreIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useGmail } from '../contexts/GmailContext';
import { apiService } from '../services/api';
import { TaskStatus } from '../types/interfaces';

const TIME_PERIODS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '3 months' },
  { value: '180d', label: '6 months' },
  { value: '1y', label: '1 year' },
  { value: '2y', label: '2 years' },
];

const EMAIL_CATEGORIES = [
  { value: 'category:promotions', label: 'Promotions', icon: '🏷️' },
  { value: 'category:updates', label: 'Updates', icon: '📄' },
  { value: 'category:social', label: 'Social', icon: '👥' },
  { value: 'category:forums', label: 'Forums', icon: '💬' },
  { value: 'in:spam', label: 'Spam', icon: '🚫' },
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
  
  // Execution state
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

  // FIXED: Generate query based on selection
  const generateQuery = (): string => {
    const parts: string[] = [];
    
    if (selectedCategory) {
      if (operation === 'recover') {
        // For recover, search in trash only
        parts.push('in:trash');
        // Note: Gmail doesn't support older_than with in:trash reliably
        // So we'll recover recent emails from trash
      } else {
        // For delete, search normally with category
        parts.push(selectedCategory);
        // Add time filter for delete operations
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
      
      console.log('Executing with params:', params); // Debug log
      
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
    <Container maxWidth="md">
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
            Bulk Operations
          </Typography>
        </Box>

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Main Operation Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack spacing={3}>
              {/* Operation Type */}
              <FormControl fullWidth>
                <InputLabel>Operation</InputLabel>
                <Select
                  value={operation}
                  label="Operation"
                  onChange={(e) => setOperation(e.target.value as 'delete' | 'recover')}
                >
                  <MenuItem value="delete">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <DeleteIcon sx={{ mr: 1 }} />
                      Delete Emails
                    </Box>
                  </MenuItem>
                  <MenuItem value="recover">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <RestoreIcon sx={{ mr: 1 }} />
                      Recover from Trash
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              {/* Category Selection */}
              <FormControl fullWidth>
                <InputLabel>Email Category</InputLabel>
                <Select
                  value={selectedCategory}
                  label="Email Category"
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {EMAIL_CATEGORIES.map((category) => (
                    <MenuItem key={category.value} value={category.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography sx={{ mr: 2 }}>{category.icon}</Typography>
                        <Typography variant="body1">{category.label}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Time Period Selection - Only for Delete */}
              {operation === 'delete' && (
                <FormControl fullWidth>
                  <InputLabel>Age of emails</InputLabel>
                  <Select
                    value={selectedTimePeriod}
                    label="Age of emails"
                    onChange={(e) => setSelectedTimePeriod(e.target.value)}
                  >
                    {TIME_PERIODS.map((period) => (
                      <MenuItem key={period.value} value={period.value}>
                        Older than {period.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* Gmail Limitation Warning for Recover */}
              {operation === 'recover' && (
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Note:</strong> Gmail doesn't support age filtering for trash recovery. 
                    This will recover the most recent emails from trash.
                  </Typography>
                </Alert>
              )}

              {/* Email Count Selection */}
              <Box>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  Number of emails to {operation}: <strong>{emailCount.toLocaleString()}</strong>
                </Typography>
                
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  {QUICK_AMOUNTS.map((amount) => (
                    <Button
                      key={amount.value}
                      variant={emailCount === amount.value ? "contained" : "outlined"}
                      size="small"
                      onClick={() => setEmailCount(amount.value)}
                    >
                      {amount.label}
                    </Button>
                  ))}
                </Stack>
                
                <TextField
                  type="number"
                  label="Custom amount"
                  value={emailCount}
                  onChange={(e) => setEmailCount(Math.min(10000, Math.max(1, parseInt(e.target.value) || 1)))}
                  inputProps={{ min: 1, max: 10000 }}
                  size="small"
                  sx={{ width: 150 }}
                />
              </Box>

              {/* Query Preview */}
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Query:</strong> {generateQuery() || 'Select category'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  <strong>Action:</strong> {operation === 'delete' ? 'Delete' : 'Recover'} up to {emailCount.toLocaleString()} emails
                </Typography>
              </Box>

              {/* Action Button */}
              <Button
                variant="contained"
                size="large"
                startIcon={operation === 'delete' ? <DeleteIcon /> : <RestoreIcon />}
                onClick={() => setExecuteOpen(true)}
                disabled={executing || !selectedCategory}
                color={operation === 'delete' ? 'error' : 'primary'}
                fullWidth
              >
                {operation === 'delete' ? 'Delete' : 'Recover'} {emailCount.toLocaleString()} Emails
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* Task Progress */}
        {currentTask && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {operation === 'delete' ? 'Deleting' : 'Recovering'} Emails
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box sx={{ mr: 2 }}>
                  {currentTask.status === 'PENDING' && <InfoIcon color="info" />}
                  {currentTask.status === 'PROGRESS' && <InfoIcon color="primary" />}
                  {currentTask.status === 'SUCCESS' && <SuccessIcon color="success" />}
                  {currentTask.status === 'FAILURE' && <ErrorIcon color="error" />}
                </Box>
                
                <Typography variant="body1">
                  {currentTask.status === 'PENDING' && 'Starting...'}
                  {currentTask.status === 'PROGRESS' && 'Processing...'}
                  {currentTask.status === 'SUCCESS' && 'Completed!'}
                  {currentTask.status === 'FAILURE' && 'Failed'}
                  {currentTask.progress?.current && currentTask.progress?.total && (
                    <> ({currentTask.progress.current}/{currentTask.progress.total})</>
                  )}
                </Typography>
              </Box>
              
              {currentTask.progress?.current && currentTask.progress?.total && (
                <LinearProgress
                  variant="determinate"
                  value={(currentTask.progress.current / currentTask.progress.total) * 100}
                  sx={{ mb: 2 }}
                />
              )}
              
              {currentTask.progress?.message && (
                <Typography variant="body2" color="text.secondary">
                  {currentTask.progress.message}
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Actions
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
              >
                🏷️ Delete 1,000 Promotions (3+ months old)
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
              >
                📄 Delete 2,000 Updates (6+ months old)
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
              >
                🚫 Delete 500 Spam (1+ month old)
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