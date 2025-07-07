import React, { useState } from 'react';
import {
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Info as InfoIcon,
  Security as SecurityIcon,
  Verified as VerifiedIcon,
  Schedule as ScheduleIcon,
  Code as CodeIcon,
} from '@mui/icons-material';

const AppVerificationInfo: React.FC = () => {
  const [open, setOpen] = useState(false);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  return (
    <>
      <IconButton
        onClick={handleOpen}
        size="small"
        sx={{ 
          color: 'info.main',
          '&:hover': { bgcolor: 'info.light', color: 'white' }
        }}
        title="App Verification Information"
      >
        <InfoIcon />
      </IconButton>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon color="primary" />
            App Verification Status
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Don't worry about the Google warning!</strong> This is normal for email management applications during the verification process.
            </Typography>
          </Alert>

          <Typography variant="h6" gutterBottom>
            What you need to know:
          </Typography>

          <List>
            <ListItem>
              <ListItemIcon>
                <ScheduleIcon color="warning" />
              </ListItemIcon>
              <ListItemText
                primary="Verification In Progress"
                secondary="Google verification is currently being processed. This can take 6+ months for email management apps."
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <SecurityIcon color="success" />
              </ListItemIcon>
              <ListItemText
                primary="App Is Secure"
                secondary="The application follows OAuth2 security standards and only requests necessary Gmail permissions."
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <CodeIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Open Source & Transparent"
                secondary="This is a portfolio project demonstrating Gmail API integration and bulk email management capabilities."
              />
            </ListItem>

            <ListItem>
              <ListItemIcon>
                <VerifiedIcon color="info" />
              </ListItemIcon>
              <ListItemText
                primary="How to Proceed Safely"
                secondary="Click 'Advanced' → 'Go to [Gmanage] (unsafe)' → Review permissions carefully before granting access."
              />
            </ListItem>
          </List>

          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>For employers/testers:</strong> This warning appears because Google requires extensive verification for apps that manage Gmail data. The app functionality is fully secure and operational.
            </Typography>
          </Alert>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} variant="contained">
            Got it!
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AppVerificationInfo;