import { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Alert, Link } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError('Please enter your company name.');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error } = await signIn(email.trim(), password, companyName.trim());
    setSubmitting(false);
    if (error) { setError(error.message); return; }
    // Send them back to whatever page they originally tried to reach
    // (ProtectedRoute redirects here with that as location.state.from),
    // or the dashboard if they just landed here directly.
    navigate(location.state?.from || '/', { replace: true });
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Paper variant="outlined" sx={{ p: 4, width: 360 }}>
        <Typography variant="h5" sx={{ mb: 0.5 }}>Ledger</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Sign in to your company's books.</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required autoFocus />
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
          <Link component={RouterLink} to="/forgot-password">Forgot password?</Link>
          <Link component={RouterLink} to="/signup">Create a company</Link>
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Joining an existing company? Ask its administrator to invite you.
        </Typography>
      </Paper>
    </Box>
  );
}
