import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Alert, Link } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const { signUpWithCompany } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSubmitting(true);
    const { data, error } = await signUpWithCompany(companyName.trim(), email, password);
    setSubmitting(false);
    if (error) { setError(error.message); return; }
    // If the Supabase project requires email confirmation, no session exists yet.
    // The company name stays stashed and onboarding finishes on first login.
    if (!data.session) setNeedsConfirmation(true);
    else navigate('/', { replace: true });
  };

  if (needsConfirmation) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Paper variant="outlined" sx={{ p: 4, width: 380 }}>
          <Typography variant="h5" sx={{ mb: 1 }}>Check your email</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            We sent a confirmation link to <strong>{email}</strong>. Confirm your address, then sign in — your
            company will be set up automatically the first time you do.
          </Typography>
          <Button component={RouterLink} to="/login" variant="contained" fullWidth>Go to sign in</Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 4, width: 380 }}>
        <Typography variant="h5" sx={{ mb: 0.5 }}>Create your company</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          You'll be the administrator and can invite teammates afterwards.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required autoFocus />
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required helperText="At least 8 characters" />
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create company'}
          </Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 3 }}>
          Already have an account? <Link component={RouterLink} to="/login">Sign in</Link>
        </Typography>
      </Paper>
    </Box>
  );
}
