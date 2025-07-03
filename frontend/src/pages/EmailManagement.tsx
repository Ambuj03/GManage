import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useGmail } from '../contexts/GmailContext';

const EmailManagement: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected } = useGmail();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  
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
            Email Management
          </Typography>
        </Box>

        {/* Search and Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Search & Filter Emails
            </Typography>
            <Stack spacing={2}>
              <TextField
                fullWidth
                label="Search emails"
                placeholder="Enter search terms (e.g., from:sender@example.com, subject:important)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl sx={{ minWidth: 200 }}>
                  <InputLabel>Label</InputLabel>
                  <Select
                    value={selectedLabel}
                    label="Label"
                    onChange={(e) => setSelectedLabel(e.target.value)}
                  >
                    <MenuItem value="">All Labels</MenuItem>
                    <MenuItem value="INBOX">Inbox</MenuItem>
                    <MenuItem value="SENT">Sent</MenuItem>
                    <MenuItem value="DRAFT">Drafts</MenuItem>
                    <MenuItem value="SPAM">Spam</MenuItem>
                    <MenuItem value="TRASH">Trash</MenuItem>
                  </Select>
                </FormControl>
                
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={() => {/* Implement search */}}
                >
                  Search Emails
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* Email List Placeholder */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Email Results
            </Typography>
            <Alert severity="info">
              Email search and management features will be implemented in Phase 3B.
              <br />
              <strong>Coming soon:</strong> Email list, bulk selection, delete/recover actions.
            </Alert>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default EmailManagement;