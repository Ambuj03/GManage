import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Link,
} from '@mui/material';
import { LoginRequest, RegisterRequest } from '../types/api';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'login' | 'register';

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login form state
  const [loginData, setLoginData] = useState<LoginRequest>({
    username: '',
    password: '',
  });

  // Registration form state - matching Django serializer
  const [registerData, setRegisterData] = useState<RegisterRequest>({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
  });

  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { login, register } = useAuth();

  // Validation functions
  const validateLogin = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!loginData.username.trim()) {
      errors.username = 'Username is required';
    }
    
    if (!loginData.password) {
      errors.password = 'Password is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateRegister = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!registerData.username.trim()) {
      errors.username = 'Username is required';
    } else if (registerData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }
    
    if (!registerData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(registerData.email)) {
      errors.email = 'Email is invalid';
    }
    
    if (!registerData.password) {
      errors.password = 'Password is required';
    } else if (registerData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (registerData.password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateLogin()) return;

    setLoading(true);
    try {
      await login(loginData);
      setSuccess('Login successful!');
      // Redirect will be handled by App.tsx routing
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateRegister()) return;

    setLoading(true);
    try {
      // Set password_confirm to match confirmPassword
      const registrationData = {
        ...registerData,
        password_confirm: confirmPassword
      };
      
      await register(registrationData);
      setSuccess('Registration successful! You are now logged in.');
    } catch (err: any) {
      const errorData = err.response?.data;
      if (typeof errorData === 'object' && errorData !== null) {
        // Handle field-specific errors
        const fieldErrors: Record<string, string> = {};
        Object.keys(errorData).forEach(field => {
          if (Array.isArray(errorData[field])) {
            fieldErrors[field] = errorData[field][0];
          } else {
            fieldErrors[field] = errorData[field];
          }
        });
        setValidationErrors(fieldErrors);
      } else {
        setError(errorData?.detail || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setSuccess('');
    setValidationErrors({});
    // Reset forms
    setLoginData({ username: '', password: '' });
    setRegisterData({ username: '', email: '', password: '', password_confirm: '' });
    setConfirmPassword('');
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            maxWidth: 400,
          }}
        >
          <Typography variant="h4" component="h1" align="center" gutterBottom>
            Gmail Purge Tool
          </Typography>
          
          <Typography variant="h5" component="h2" align="center" gutterBottom>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Username"
                value={loginData.username}
                onChange={(e) => {
                  setLoginData({ ...loginData, username: e.target.value });
                  if (validationErrors.username) {
                    setValidationErrors({ ...validationErrors, username: '' });
                  }
                }}
                margin="normal"
                required
                error={!!validationErrors.username}
                helperText={validationErrors.username}
                disabled={loading}
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={loginData.password}
                onChange={(e) => {
                  setLoginData({ ...loginData, password: e.target.value });
                  if (validationErrors.password) {
                    setValidationErrors({ ...validationErrors, password: '' });
                  }
                }}
                margin="normal"
                required
                error={!!validationErrors.password}
                helperText={validationErrors.password}
                disabled={loading}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Sign In'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <TextField
                fullWidth
                label="Username"
                value={registerData.username}
                onChange={(e) => {
                  setRegisterData({ ...registerData, username: e.target.value });
                  if (validationErrors.username) {
                    setValidationErrors({ ...validationErrors, username: '' });
                  }
                }}
                margin="normal"
                required
                error={!!validationErrors.username}
                helperText={validationErrors.username}
                disabled={loading}
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={registerData.email}
                onChange={(e) => {
                  setRegisterData({ ...registerData, email: e.target.value });
                  if (validationErrors.email) {
                    setValidationErrors({ ...validationErrors, email: '' });
                  }
                }}
                margin="normal"
                required
                error={!!validationErrors.email}
                helperText={validationErrors.email}
                disabled={loading}
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={registerData.password}
                onChange={(e) => {
                  setRegisterData({ ...registerData, password: e.target.value });
                  if (validationErrors.password) {
                    setValidationErrors({ ...validationErrors, password: '' });
                  }
                }}
                margin="normal"
                required
                error={!!validationErrors.password}
                helperText={validationErrors.password}
                disabled={loading}
              />
              <TextField
                fullWidth
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (validationErrors.confirmPassword) {
                    setValidationErrors({ ...validationErrors, confirmPassword: '' });
                  }
                }}
                margin="normal"
                required
                error={!!validationErrors.confirmPassword}
                helperText={validationErrors.confirmPassword}
                disabled={loading}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Create Account'}
              </Button>
            </form>
          )}

          <Divider sx={{ my: 2 }} />

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2">
              {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <Link
                component="button"
                variant="body2"
                onClick={switchMode}
                disabled={loading}
                sx={{ textDecoration: 'none' }}
              >
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default LoginPage;