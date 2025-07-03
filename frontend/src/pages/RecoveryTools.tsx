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
  RestoreFromTrash as RestoreIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useGmail } from '../contexts/GmailContext';

const RecoveryTools: React.FC = () => {
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
            Recovery Tools
          </Typography>
        </Box>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Email Recovery & Restoration
            </Typography>
            <Alert severity="info">
              Recovery tools will be implemented in Phase 5.
              <br />
              <strong>Coming soon:</strong> Restore deleted emails, undo bulk operations, recovery history.
            </Alert>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default RecoveryTools;