import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, Alert, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { api, saveBlob } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

export default function Parties({ type = 'customer' }) {
  const isCustomer = type === 'customer';
  const title = isCustomer ? 'Customers' : 'Suppliers';
  const singleLabel = isCustomer ? 'Customer' : 'Supplier';
  const endpoint = isCustomer ? '/customers' : '/suppliers';
  const queryKey = isCustomer ? ['customers'] : ['suppliers'];
  const pdfFilename = isCustomer ? 'customers-outstanding.pdf' : 'suppliers-outstanding.pdf';
  const emptyText = isCustomer ? 'No customers yet.' : 'No suppliers yet.';

  const { profile } = useAuth();
  const canEdit = hasRole(profile, 'manager');
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => api.get(endpoint) });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');

  const openNew = () => { setEditing(null); setName(''); setContact(''); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setName(p.name); setContact(p.contact || ''); setOpen(true); };

  const saveMutation = useMutation({
    mutationFn: () => (editing ? api.put(`${endpoint}/${editing.id}`, { name, contact }) : api.post(endpoint, { name, contact })),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); setOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`${endpoint}/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (err) => alert(err.message),
  });

  const downloadPdf = async () => {
    try {
      const blob = await api.blob(`${endpoint}/statement/pdf`);
      saveBlob(blob, pdfFilename);
    } catch (err) { alert(err.message); }
  };

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">{title}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={downloadPdf} disabled={!data?.length}>
            Export PDF
          </Button>
          {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Add</Button>}
        </Box>
      </Box>

      {data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell align="right">Outstanding</TableCell>
              {canEdit && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.contact}</TableCell>
                <TableCell align="right"><Money value={p.outstanding} /></TableCell>
                {canEdit && (
                  <TableCell align="right">
                    <Button size="small" onClick={() => openEdit(p)}>Edit</Button>
                    <IconButton size="small" onClick={() => deleteMutation.mutate(p.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? `Edit ${singleLabel}` : `New ${singleLabel}`}</DialogTitle>
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
