import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Alert, Link } from '@mui/material';
import { supabase } from '../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 4, width: 360 }}>
        <Typography variant="h5" sx={{ mb: 0.5 }}>Reset your password</Typography>
        {sent ? (
          <>
            <Alert severity="success" sx={{ my: 2 }}>
              If an account exists for {email}, a reset link is on its way.
            </Alert>
            <Link component={RouterLink} to="/login">Back to sign in</Link>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your email and we'll send you a link to choose a new password.
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              <Button type="submit" variant="contained" disabled={submitting}>{submitting ? 'Sending…' : 'Send reset link'}</Button>
            </Box>
            <Typography variant="body2" sx={{ mt: 3 }}>
              <Link component={RouterLink} to="/login">Back to sign in</Link>
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
}
