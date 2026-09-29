import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Alert, Link, CircularProgress } from '@mui/material';
import { supabase } from '../lib/supabase';

// Landing page for two email links, both of which arrive with a temporary
// Supabase session in the URL: (1) "forgot password" recovery links, and
// (2) teammate invite links, where the person needs to choose their first
// password. Either way the action is the same: set a new password.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) { setHasSession(true); setChecked(true); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => navigate('/', { replace: true }), 1200);
  };

  if (!checked) {
    return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={28} /></Box>;
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 4, width: 360 }}>
        <Typography variant="h5" sx={{ mb: 0.5 }}>Choose a password</Typography>
        {!hasSession ? (
          <>
            <Alert severity="warning" sx={{ my: 2 }}>This link is invalid or has expired. Request a new one.</Alert>
            <Link component={RouterLink} to="/forgot-password">Send a new reset link</Link>
          </>
        ) : done ? (
          <Alert severity="success" sx={{ mt: 2 }}>Password updated. Taking you in…</Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Set the password you'll use to sign in.</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus helperText="At least 8 characters" />
              <TextField label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              <Button type="submit" variant="contained" disabled={submitting}>{submitting ? 'Saving…' : 'Save password'}</Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
