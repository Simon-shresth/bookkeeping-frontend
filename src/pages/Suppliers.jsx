import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, Alert, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

export default function Suppliers() {
  const { profile } = useAuth();
  const canEdit = hasRole(profile, 'manager');
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers') });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');

  const openNew = () => { setEditing(null); setName(''); setContact(''); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setName(s.name); setContact(s.contact || ''); setOpen(true); };

  const saveMutation = useMutation({
    mutationFn: () => (editing ? api.put(`/suppliers/${editing.id}`, { name, contact }) : api.post('/suppliers', { name, contact })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/suppliers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
    onError: (err) => alert(err.message),
  });

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Suppliers</Typography>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Add</Button>}
      </Box>

      {data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No suppliers yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Contact</TableCell><TableCell align="right">Outstanding</TableCell>{canEdit && <TableCell />}</TableRow></TableHead>
          <TableBody>
            {data.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.contact}</TableCell>
                <TableCell align="right"><Money value={s.outstanding} /></TableCell>
                {canEdit && (
                  <TableCell align="right">
                    <Button size="small" onClick={() => openEdit(s)}>Edit</Button>
                    <IconButton size="small" onClick={() => deleteMutation.mutate(s.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus fullWidth />
          <TextField label="Contact" value={contact} onChange={(e) => setContact(e.target.value)} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!name || saveMutation.isPending} onClick={() => saveMutation.mutate()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
