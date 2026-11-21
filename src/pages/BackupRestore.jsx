import { useState } from 'react';
import { Box, Typography, Paper, Button, Alert, CircularProgress, Divider } from '@mui/material';
import CloudDownloadOutlined from '@mui/icons-material/CloudDownloadOutlined';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import { api, saveBlob } from '../lib/api';
import { useAuth, hasRole } from '../context/AuthContext';

export default function BackupRestore() {
  const { profile } = useAuth();
  const isAdmin = hasRole(profile, 'admin');

  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleBackup = async () => {
    try {
      setBackingUp(true);
      setError(null);
      setSuccessMsg(null);
      const blob = await api.blob('/backup/create');
      const dateStr = new Date().toISOString().slice(0, 10);
      saveBlob(blob, `bksys-backup-${dateStr}.sql`);
      setSuccessMsg('Backup downloaded successfully.');
    } catch (err) {
      setError(err.message || 'Failed to generate backup.');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('WARNING: Restoring a backup will overwrite the current database state! Are you sure you want to continue?')) {
      e.target.value = '';
      return;
    }

    try {
      setRestoring(true);
      setError(null);
      setSuccessMsg(null);

      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/backup/restore', formData);
      setSuccessMsg(res.message || 'Database restored successfully.');
    } catch (err) {
      setError(err.message || 'Failed to restore backup.');
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  if (!isAdmin) {
    return <Alert severity="warning">You must be an administrator to access system Backup and Restore.</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>System Backup & Restore</Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Secure your bookkeeping data by creating backups regularly or restore an existing backup file in case of system migration or data recovery.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

      <Paper sx={{ p: 3, mb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6">Download Backup</Typography>
        <Typography variant="body2" color="text.secondary">
          Export a complete database dump containing all accounts, journals, invoices, and audit logs.
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={backingUp ? <CircularProgress size={20} color="inherit" /> : <CloudDownloadOutlined />}
            onClick={handleBackup}
            disabled={backingUp}
          >
            {backingUp ? 'Generating Backup...' : 'Download Database Backup'}
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6">Restore System</Typography>
        <Typography variant="body2" color="text.secondary">
          Upload a previously saved `.sql` backup file to overwrite and restore the database state. This action is irreversible.
        </Typography>
        <Box>
          <Button
            variant="outlined"
            component="label"
            color="error"
            startIcon={restoring ? <CircularProgress size={20} color="inherit" /> : <CloudUploadOutlined />}
            disabled={restoring}
          >
            {restoring ? 'Restoring System...' : 'Upload & Restore Backup'}
            <input
              type="file"
              hidden
              accept=".sql"
              onChange={handleRestore}
            />
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
