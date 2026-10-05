import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Paper, CircularProgress, Alert, Button, Typography, TextField } from '@mui/material';
import { useAuth } from '../context/AuthContext';

// Shown when the user is authenticated but has no company row yet —
// either their onboarding failed or they confirmed email on a different device.
function CompleteSetup({ onComplete, onSignOut }) {
  const [companyName, setCompanyName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await onComplete(companyName.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 4, width: 380 }}>
        <Typography variant="h5" sx={{ mb: 0.5 }}>Set up your company</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your account is ready. Enter a company name to finish setting up your books.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            autoFocus
          />
          <Button type="submit" variant="contained" disabled={submitting || !companyName.trim()}>
            {submitting ? 'Creating…' : 'Create company'}
          </Button>
        </Box>
        <Button onClick={onSignOut} size="small" color="inherit" sx={{ mt: 2, opacity: 0.6 }}>
          Sign out
        </Button>
      </Paper>
    </Box>
  );
}

export default function ProtectedRoute({ children }) {
  const { loading, session, profile, profileError, profileLoading, pendingOnboarding, signOut, reloadProfile, completeOnboarding } = useAuth();
  const location = useLocation();

  if (loading || (session && !profile && !profileError && !pendingOnboarding) || profileLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (pendingOnboarding) {
    return <CompleteSetup onComplete={completeOnboarding} onSignOut={signOut} />;
  }

  if (!profile) return null;

  return children;
}
