import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Alert,
} from '@mui/material';
import { api } from '../lib/api';

export default function NewPartyDialog({ open, onClose, type = 'customer', onCreated }) {
  const isCustomer = type === 'customer';
  const label = isCustomer ? 'Customer' : 'Supplier';
  const endpoint = isCustomer ? '/customers' : '/suppliers';
  const queryKey = isCustomer ? ['customers'] : ['suppliers'];

  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');

  const createMutation = useMutation({
    mutationFn: () => api.post(endpoint, { name, contact: contact || undefined }),
    onSuccess: (newParty) => {
      qc.invalidateQueries({ queryKey });
      setName('');
      setContact('');
      if (onCreated) onCreated(newParty);
      onClose();
    },
  });

  const handleClose = () => {
    setName('');
    setContact('');
    createMutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>New {label}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {createMutation.error && <Alert severity="error">{createMutation.error.message}</Alert>}
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          fullWidth
          required
        />
        <TextField
          label="Contact (phone / email / address)"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!name.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
