import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  CheckCircle as CheckIcon,
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

// Memoized components for better performance
const CategoryCard = React.memo<{
  category: typeof EMAIL_CATEGORIES[0];
  isSelected: boolean;
  hasError: boolean;
  onClick: () => void;
}>(({ category, isSelected, hasError, onClick }) => (
  <Paper
    sx={{
      p: 2,
      border: 2,
      borderColor: isSelected ? `${category.color}.main` : 
                 hasError ? 'error.main' : 'grey.300',
      cursor: 'pointer',
      transition: 'all 0.2s',
      height: '100%',
      '&:hover': {
        borderColor: `${category.color}.main`,
        bgcolor: `${category.color}.50`
      }
    }}
    onClick={onClick}
  >
    <Box sx={{ textAlign: 'center', mb: 1 }}>
      <Typography sx={{ fontSize: { xs: 24, sm: 32 }, mb: 1 }}>{category.icon}</Typography>
      <Typography variant="h6" gutterBottom>
        {category.label}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {category.description}
      </Typography>
    </Box>
  </Paper>
));

const TimePeriodCard = React.memo<{
  period: typeof TIME_PERIODS[0];
  isSelected: boolean;
  hasError: boolean;
  onClick: () => void;
}>(({ period, isSelected, hasError, onClick }) => (
  <Paper
    sx={{
      p: 2,
      border: 2,
      borderColor: isSelected ? 'primary.main' : 
                 hasError ? 'error.main' : 'grey.300',
      cursor: 'pointer',
      transition: 'all 0.2s',
      height: '100%',
      '&:hover': {
        borderColor: 'primary.main',
        bgcolor: 'primary.50'
      }
    }}
    onClick={onClick}
  >
    <Box sx={{ textAlign: 'center' }}>
      <ScheduleIcon sx={{ fontSize: { xs: 24, sm: 32 }, color: 'primary.main', mb: 1 }} />
      <Typography variant="h6" gutterBottom>
        {period.label}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {period.description}
      </Typography>
    </Box>
  </Paper>
));

const QuickActionButton = React.memo<{
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
}>(({ icon, title, description, onClick, disabled }) => (
  <Button
    variant="outlined"
    fullWidth
    onClick={onClick}
    disabled={disabled}
    sx={{ textAlign: 'left', justifyContent: 'flex-start' }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <Typography sx={{ mr: 2 }}>{icon}</Typography>
      <Box>
        <Typography variant="body1">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
    </Box>
  </Button>
));

const BulkOperations: React.FC = React.memo(() => {
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
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [isFormValid, setIsFormValid] = useState(false);
  
  // Retry functionality
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Memoized validation function
  const validateForm = useCallback(() => {
    const errors: {[key: string]: string} = {};
    
    if (!selectedCategory) {
      errors.category = 'Please select an email category';
    }
    
    if (operation === 'delete' && !selectedTimePeriod) {
      errors.timePeriod = 'Please select email age';
    }
    
    if (emailCount < 1 || emailCount > 10000) {
      errors.emailCount = 'Email count must be between 1 and 10,000';
    }
    
    setValidationErrors(errors);
    const valid = Object.keys(errors).length === 0;
    setIsFormValid(valid);
    return valid;
  }, [selectedCategory, selectedTimePeriod, emailCount, operation]);

  // Validate whenever form values change
  useEffect(() => {
    validateForm();
  }, [validateForm]);

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
    setValidationErrors({});
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

  // Memoized query generation
  const generateQuery = useCallback((): string => {
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
  }, [selectedCategory, selectedTimePeriod, operation]);

  // Memoized error message function
  const getErrorMessage = useCallback((error: any): string => {
    if (!navigator.onLine) {
      return 'No internet connection. Please check your network and try again.';
    }
    
    if (error.response?.status === 401) {
      return 'Gmail authentication expired. Please reconnect your Gmail account from the Dashboard.';
    }
    
    if (error.response?.status === 429) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    
    if (error.response?.status >= 500) {
      return 'Server error occurred. Please try again in a few minutes.';
    }
    
    return error.response?.data?.error || error.message || 'An unexpected error occurred';
  }, []);

  const handleExecute = useCallback(async () => {
    // Validate before execution
    if (!validateForm()) {
      setError('Please fix the validation errors before proceeding');
      return;
    }

    const query = generateQuery();
    
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
      
      setSuccess(`${operation === 'delete' ? 'Delete' : 'Recovery'} operation started successfully! Processing up to ${emailCount.toLocaleString()} emails...`);
      setExecuteOpen(false);
      setRetryCount(0);
      
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
      
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      
      // Don't auto-retry on authentication errors
      if (err.response?.status !== 401) {
        // Show retry option for other errors
        if (retryCount < maxRetries) {
          setError(`${errorMessage} (Attempt ${retryCount + 1}/${maxRetries + 1})`);
        }
      }
    } finally {
      setExecuting(false);
    }
  }, [validateForm, generateQuery, emailCount, operation, getErrorMessage, retryCount, maxRetries]);

  // Memoized helper functions
  const getCategoryInfo = useCallback((categoryValue: string) => {
    return EMAIL_CATEGORIES.find(cat => cat.value === categoryValue);
  }, []);

  const getSelectedCategoryName = useCallback(() => {
    const category = getCategoryInfo(selectedCategory);
    return category ? category.label : selectedCategory;
  }, [getCategoryInfo, selectedCategory]);

  const retryOperation = useCallback(async () => {
    if (retryCount >= maxRetries) {
      setError('Maximum retry attempts reached. Please try again later.');
      return;
    }
    
    setRetryCount(prev => prev + 1);
    setError(null);
    await handleExecute();
  }, [retryCount, maxRetries, handleExecute]);

  // Reset retry count when operation changes
  useEffect(() => {
    setRetryCount(0);
  }, [operation, selectedCategory, selectedTimePeriod, emailCount]);

  // Memoized step status function
  const getStepStatus = useCallback((step: number): 'complete' | 'error' | 'pending' => {
    switch (step) {
      case 1: // Operation selection - always complete since it has default
        return 'complete';
      case 2: // Category selection
        if (validationErrors.category) return 'error';
        return selectedCategory ? 'complete' : 'pending';
      case 3: // Time period (only for delete)
        if (operation === 'recover') return 'complete';
        if (validationErrors.timePeriod) return 'error';
        return selectedTimePeriod ? 'complete' : 'pending';
      case 4: // Email count
        if (validationErrors.emailCount) return 'error';
        return emailCount >= 1 && emailCount <= 10000 ? 'complete' : 'pending';
      default:
        return 'pending';
    }
  }, [validationErrors, selectedCategory, operation, selectedTimePeriod, emailCount]);

  // Memoized category click handlers
  const handleCategoryClick = useCallback((categoryValue: string) => {
    setSelectedCategory(categoryValue);
  }, []);

  const handleTimePeriodClick = useCallback((periodValue: string) => {
    setSelectedTimePeriod(periodValue);
  }, []);

  const handleEmailCountClick = useCallback((amount: number) => {
    setEmailCount(amount);
  }, []);

  // Memoized quick action handlers
  const handleQuickAction1 = useCallback(() => {
    setOperation('delete');
    setSelectedCategory('category:promotions');
    setSelectedTimePeriod('90d');
    setEmailCount(1000);
  }, []);

  const handleQuickAction2 = useCallback(() => {
    setOperation('delete');
    setSelectedCategory('category:updates');
    setSelectedTimePeriod('180d');
    setEmailCount(2000);
  }, []);

  const handleQuickAction3 = useCallback(() => {
    setOperation('delete');
    setSelectedCategory('in:spam');
    setSelectedTimePeriod('30d');
    setEmailCount(500);
  }, []);

  const handleOperationChange = useCallback((newOperation: 'delete' | 'recover') => {
    setOperation(newOperation);
  }, []);

  const handleEmailCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailCount(Math.min(10000, Math.max(1, parseInt(e.target.value) || 1)));
  }, []);

  const handleExecuteDialogOpen = useCallback(() => {
    setExecuteOpen(true);
  }, []);

  const handleExecuteDialogClose = useCallback(() => {
    setExecuteOpen(false);
  }, []);

  const handleBackToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  const handleErrorClose = useCallback(() => {
    setError(null);
  }, []);

  const handleSuccessClose = useCallback(() => {
    setSuccess(null);
  }, []);

  // Memoized computed values
  const queryString = useMemo(() => generateQuery(), [generateQuery]);
  
  const selectedTimePeriodLabel = useMemo(() => {
    return TIME_PERIODS.find(p => p.value === selectedTimePeriod)?.label;
  }, [selectedTimePeriod]);

  const canRetry = useMemo(() => {
    return retryCount < maxRetries && !error?.includes('Authentication');
  }, [retryCount, maxRetries, error]);

  const hasValidationErrors = useMemo(() => {
    return Object.keys(validationErrors).length > 0;
  }, [validationErrors]);

  const validationErrorsList = useMemo(() => {
    return Object.values(validationErrors);
  }, [validationErrors]);

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
            onClick={handleBackToDashboard}
            sx={{ mr: 2 }}
          >
            Back to Dashboard
          </Button>
          <Typography variant="h4" component="h1">
            Bulk Email Operations
          </Typography>
        </Box>

        {/* Validation Summary */}
        {hasValidationErrors && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Please complete the following:</strong>
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrorsList.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Alerts */}
        <Fade in={Boolean(error)}>
          <Box sx={{ mb: 3 }}>
            {error && (
              <Alert 
                severity="error" 
                onClose={handleErrorClose}
                action={
                  canRetry ? (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={retryOperation}
                      disabled={executing}
                    >
                      Retry
                    </Button>
                  ) : null
                }
              >
                {error}
              </Alert>
            )}
          </Box>
        </Fade>
        
        <Fade in={Boolean(success)}>
          <Box sx={{ mb: 3 }}>
            {success && (
              <Alert severity="success" onClose={handleSuccessClose}>
                {success}
              </Alert>
            )}
          </Box>
        </Fade>

        {/* Main Layout */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', lg: 'row' }, 
          gap: { xs: 2, lg: 4 } 
        }}>
          {/* Left Column - Configuration */}
          <Box sx={{ flex: { lg: 2 } }}>
            {/* Operation Type Selection */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Step 1: Choose Operation
                  </Typography>
                  <CheckIcon 
                    sx={{ 
                      ml: 1, 
                      color: 'success.main',
                      fontSize: 20 
                    }} 
                  />
                </Box>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' }, 
                  gap: 2 
                }}>
                  <Box sx={{ flex: 1 }}>
                    <Paper
                      sx={{
                        p: { xs: 2, sm: 3 },
                        border: 2,
                        borderColor: operation === 'delete' ? 'error.main' : 'grey.300',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        height: { xs: 'auto', sm: '140px' },
                        display: 'flex',
                        alignItems: 'center',
                        '&:hover': {
                          borderColor: 'error.main',
                          bgcolor: 'error.50'
                        }
                      }}
                      onClick={() => handleOperationChange('delete')}
                    >
                      <Box sx={{ textAlign: 'center', width: '100%' }}>
                        <DeleteIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'error.main', mb: 1 }} />
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
                        p: { xs: 2, sm: 3 },
                        border: 2,
                        borderColor: operation === 'recover' ? 'primary.main' : 'grey.300',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        height: { xs: 'auto', sm: '140px' },
                        display: 'flex',
                        alignItems: 'center',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: 'primary.50'
                        }
                      }}
                      onClick={() => handleOperationChange('recover')}
                    >
                      <Box sx={{ textAlign: 'center', width: '100%' }}>
                        <RestoreIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'primary.main', mb: 1 }} />
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
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Step 2: Select Email Category
                  </Typography>
                  {getStepStatus(2) === 'complete' && (
                    <CheckIcon 
                      sx={{ 
                        ml: 1, 
                        color: 'success.main',
                        fontSize: 20 
                      }} 
                    />
                  )}
                  {getStepStatus(2) === 'error' && (
                    <ErrorIcon 
                      sx={{ 
                        ml: 1, 
                        color: 'error.main',
                        fontSize: 20 
                      }} 
                    />
                  )}
                </Box>
                {validationErrors.category && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {validationErrors.category}
                  </Alert>
                )}
                <Box sx={{ 
                  display: 'grid',
                  gridTemplateColumns: { 
                    xs: '1fr', 
                    sm: 'repeat(2, 1fr)', 
                    md: 'repeat(3, 1fr)' 
                  },
                  gap: 2
                }}>
                  {EMAIL_CATEGORIES.map((category) => (
                    <CategoryCard
                      key={category.value}
                      category={category}
                      isSelected={selectedCategory === category.value}
                      hasError={!!validationErrors.category}
                      onClick={() => handleCategoryClick(category.value)}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>

            {/* Time Period Selection - Only for Delete */}
            {operation === 'delete' && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Step 3: Choose Email Age
                    </Typography>
                    {getStepStatus(3) === 'complete' && (
                      <CheckIcon 
                        sx={{ 
                          ml: 1, 
                          color: 'success.main',
                          fontSize: 20 
                        }} 
                      />
                    )}
                    {getStepStatus(3) === 'error' && (
                      <ErrorIcon 
                        sx={{ 
                          ml: 1, 
                          color: 'error.main',
                          fontSize: 20 
                        }} 
                      />
                    )}
                  </Box>
                  {validationErrors.timePeriod && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {validationErrors.timePeriod}
                    </Alert>
                  )}
                  <Box sx={{ 
                    display: 'grid',
                    gridTemplateColumns: { 
                      xs: 'repeat(2, 1fr)', 
                      sm: 'repeat(3, 1fr)', 
                      md: 'repeat(6, 1fr)' 
                    },
                    gap: 2
                  }}>
                    {TIME_PERIODS.map((period) => (
                      <TimePeriodCard
                        key={period.value}
                        period={period}
                        isSelected={selectedTimePeriod === period.value}
                        hasError={!!validationErrors.timePeriod}
                        onClick={() => handleTimePeriodClick(period.value)}
                      />
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
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Step {operation === 'delete' ? '4' : '3'}: Set Email Count Limit
                  </Typography>
                  {getStepStatus(4) === 'complete' && (
                    <CheckIcon 
                      sx={{ 
                        ml: 1, 
                        color: 'success.main',
                        fontSize: 20 
                      }} 
                    />
                  )}
                  {getStepStatus(4) === 'error' && (
                    <ErrorIcon 
                      sx={{ 
                        ml: 1, 
                        color: 'error.main',
                        fontSize: 20 
                      }} 
                    />
                  )}
                </Box>
                {validationErrors.emailCount && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {validationErrors.emailCount}
                  </Alert>
                )}
                <Typography variant="body1" sx={{ mb: 2 }}>
                  Number of emails to {operation}: <strong>{emailCount.toLocaleString()}</strong>
                </Typography>
                
                <Stack 
                  direction={{ xs: 'column', sm: 'row' }} 
                  spacing={1} 
                  sx={{ mb: 2, flexWrap: 'wrap' }}
                >
                  {QUICK_AMOUNTS.map((amount) => (
                    <Chip
                      key={amount.value}
                      label={amount.label}
                      color={emailCount === amount.value ? "primary" : "default"}
                      onClick={() => handleEmailCountClick(amount.value)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
                
                <TextField
                  type="number"
                  label="Custom amount"
                  value={emailCount}
                  onChange={handleEmailCountChange}
                  inputProps={{ min: 1, max: 10000 }}
                  size="small"
                  fullWidth
                  sx={{ maxWidth: { sm: 200 } }}
                  error={!!validationErrors.emailCount}
                  helperText={validationErrors.emailCount || 'Between 1 and 10,000 emails'}
                />
              </CardContent>
            </Card>
          </Box>

          {/* Right Column - Preview & Actions */}
          <Box sx={{ flex: { lg: 1 } }}>
            {/* Query Preview */}
            <Card sx={{ 
              mb: 3, 
              position: { lg: 'sticky' }, 
              top: { lg: 20 } 
            }}>
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
                      <strong>Age:</strong> Older than {selectedTimePeriodLabel}
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
                  <Typography variant="body2" sx={{ 
                    fontFamily: 'monospace', 
                    color: 'text.primary',
                    wordBreak: 'break-all'
                  }}>
                    {queryString || 'Select category to see query'}
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  size="large"
                  startIcon={operation === 'delete' ? <DeleteIcon /> : <RestoreIcon />}
                  onClick={handleExecuteDialogOpen}
                  disabled={executing || !isFormValid}
                  color={operation === 'delete' ? 'error' : 'primary'}
                  fullWidth
                  sx={{ mb: 2 }}
                >
                  {operation === 'delete' ? 'Delete' : 'Recover'} {emailCount.toLocaleString()} Emails
                </Button>

                {/* Form validation status */}
                {!isFormValid && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Complete all required steps to proceed
                    </Typography>
                  </Alert>
                )}

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
              <QuickActionButton
                icon="🏷️"
                title="Delete 1,000 Promotions"
                description="3+ months old marketing emails"
                onClick={handleQuickAction1}
                disabled={executing}
              />
              
              <QuickActionButton
                icon="📄"
                title="Delete 2,000 Updates"
                description="6+ months old newsletters"
                onClick={handleQuickAction2}
                disabled={executing}
              />
              
              <QuickActionButton
                icon="🚫"
                title="Delete 500 Spam"
                description="1+ month old spam emails"
                onClick={handleQuickAction3}
                disabled={executing}
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog open={executeOpen} onClose={handleExecuteDialogClose} maxWidth="sm" fullWidth>
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
                  <strong>Age:</strong> Older than {selectedTimePeriodLabel}
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
            <Button onClick={handleExecuteDialogClose}>
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
});

export default BulkOperations;