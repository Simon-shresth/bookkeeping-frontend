import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Alert, Button, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { loading, session, profile, profileError, profileLoading, signOut, reloadProfile } = useAuth();
  const location = useLocation();

  if (loading || (session && !profile && !profileError) || profileLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (profileError) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Box sx={{ maxWidth: 420 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Signed in, but this account isn't linked to a company yet: {profileError}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            An administrator needs to run the bootstrap-company script for this account, or add it to an
            existing company's users.
          </Typography>
          <Button onClick={reloadProfile} sx={{ mr: 1 }}>Try again</Button>
          <Button onClick={signOut} color="error">Sign out</Button>
        </Box>
      </Box>
    );
  }

  if (!profile) return null;

  return children;
}
