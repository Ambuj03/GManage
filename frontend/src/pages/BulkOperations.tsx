import React from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  DeleteForever as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useGmail } from '../contexts/GmailContext';

const BulkOperations: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected } = useGmail();

  if (!isConnected) {
    navigate('/dashboard');
    return null;
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
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

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Bulk Delete & Recovery
            </Typography>
            <Alert severity="info">
              Bulk operations features will be implemented in Phase 4.
              <br />
              <strong>Coming soon:</strong> Mass delete by query, undo operations, deletion rules.
            </Alert>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default BulkOperations;