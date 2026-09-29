import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, Switch, Alert, CircularProgress, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../lib/api';
import { useAuth, hasRole } from '../context/AuthContext';

const ROLES = [
  { value: 'viewer', label: 'Viewer — read-only' },
  { value: 'manager', label: 'Manager — record sales, purchases, expenses' },
  { value: 'accountant', label: 'Accountant — also journal entries & accounts' },
  { value: 'admin', label: 'Admin — everything, incl. managing users' },
];

export default function Users() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const isAdmin = hasRole(profile, 'admin');

  const { data, isLoading, error } = useQuery({ queryKey: ['users'], queryFn: () => api.get('/users'), enabled: isAdmin });

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [inviteNote, setInviteNote] = useState('');

  const inviteMutation = useMutation({
    mutationFn: () => api.post('/users/invite', { email, role }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setInviteNote(res.note || `Invitation sent to ${email}.`);
      setEmail(''); setRole('viewer'); setOpen(false);
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
    onError: (err) => alert(err.message),
  });

  if (!isAdmin) return <Alert severity="warning">Only administrators can manage users.</Alert>;
  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Users</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setInviteNote(''); setOpen(true); }}>Invite teammate</Button>
      </Box>

      {inviteNote && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInviteNote('')}>{inviteNote}</Alert>}

      <Table size="small">
        <TableHead>
          <TableRow><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Active</TableCell></TableRow>
        </TableHead>
        <TableBody>
          {data.map((u) => {
            const isSelf = u.id === profile.id;
            return (
              <TableRow key={u.id}>
                <TableCell>
                  {u.email} {isSelf && <Chip label="you" size="small" variant="outlined" sx={{ ml: 0.5, height: 18, fontSize: 11 }} />}
                </TableCell>
                <TableCell>
                  <Select
                    size="small" value={u.role} disabled={isSelf || patchMutation.isPending}
                    onChange={(e) => patchMutation.mutate({ id: u.id, body: { role: e.target.value } })}
                    sx={{ minWidth: 150 }}
                  >
                    {ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.value}</MenuItem>)}
                  </Select>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={u.is_active} disabled={isSelf || patchMutation.isPending}
                    onChange={(e) => patchMutation.mutate({ id: u.id, body: { isActive: e.target.checked } })}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Invite a teammate</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {inviteMutation.error && <Alert severity="error">{inviteMutation.error.message}</Alert>}
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus fullWidth />
          <Select value={role} onChange={(e) => setRole(e.target.value)} fullWidth>
            {ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </Select>
          <Typography variant="caption" color="text.secondary">
            They'll get an email with a link to set their password. You can change their role or deactivate them at any time.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!email || inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>Send invite</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
