import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, IconButton, Chip, Alert, CircularProgress,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ type: 'customer_receipt', partyId: '', amount: '', accountId: '', date: today(), reference: '' });

export default function Payments() {
  const { profile } = useAuth();
  const canEdit = hasRole(profile, 'manager');
  const qc = useQueryClient();

  const [filter, setFilter] = useState('all');
  const { data: payments, isLoading, error } = useQuery({
    queryKey: ['payments', filter],
    queryFn: () => api.get(`/payments${filter === 'all' ? '' : `?type=${filter}`}`),
  });
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => api.get('/customers') });
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers') });
  const { data: accounts } = useQuery({ queryKey: ['account-options'], queryFn: () => api.get('/accounts/options') });
  const liquidAccounts = useMemo(() => (accounts || []).filter((a) => a.heading === 'Cash' || a.heading === 'Bank'), [accounts]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const isReceipt = form.type === 'customer_receipt';
  const parties = (isReceipt ? customers : suppliers) || [];
  const selectedParty = parties.find((p) => p.id === form.partyId);

  const openNew = () => { setEditing(null); setForm({ ...emptyForm(), accountId: liquidAccounts[0]?.id || '' }); setOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      type: p.type, partyId: p.customer_id || p.supplier_id, amount: p.amount, accountId: p.account_id,
      date: String(p.date).slice(0, 10), reference: p.reference || '',
    });
    setOpen(true);
  };

  const refresh = () => {
    ['payments', 'customers', 'suppliers', 'journal', 'dashboard', 'report-ar', 'report-ap', 'report-bs', 'chart-of-accounts']
      .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };

  const body = () => ({
    type: form.type,
    partyId: form.partyId,
    amount: +form.amount,
    accountId: form.accountId,
    date: form.date || undefined,
    reference: form.reference || undefined,
  });

  const saveMutation = useMutation({
    mutationFn: () => (editing ? api.put(`/payments/${editing.id}`, body()) : api.post('/payments', body())),
    onSuccess: () => { refresh(); setOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/payments/${id}`),
    onSuccess: refresh,
    onError: (err) => alert(err.message),
  });

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Payments</Typography>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Record Payment</Button>}
      </Box>

      <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)} sx={{ mb: 2 }}>
        <ToggleButton value="all">All</ToggleButton>
        <ToggleButton value="customer_receipt">Received from customers</ToggleButton>
        <ToggleButton value="supplier_payment">Paid to suppliers</ToggleButton>
      </ToggleButtonGroup>

      {payments.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No payments recorded yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Party</TableCell><TableCell>Reference</TableCell>
              <TableCell>Account</TableCell><TableCell align="right">Amount</TableCell>{canEdit && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{String(p.date).slice(0, 10)}</TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined"
                    label={p.type === 'customer_receipt' ? 'Received' : 'Paid'}
                    color={p.type === 'customer_receipt' ? 'success' : 'default'} />
                </TableCell>
                <TableCell>{p.customer_name || p.supplier_name}</TableCell>
                <TableCell>{p.reference}</TableCell>
                <TableCell>{p.account_name}</TableCell>
                <TableCell align="right"><Money value={p.amount} /></TableCell>
                {canEdit && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" onClick={() => openEdit(p)}>Edit</Button>
                    <IconButton size="small" onClick={() => { if (confirm('Delete this payment? The ledger entry will be reversed.')) deleteMutation.mutate(p.id); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? 'Update Payment' : 'Record Payment'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
          <ToggleButtonGroup
            size="small" exclusive fullWidth value={form.type}
            onChange={(_, v) => v && setForm((f) => ({ ...f, type: v, partyId: '' }))}
          >
            <ToggleButton value="customer_receipt">Received from customer</ToggleButton>
            <ToggleButton value="supplier_payment">Paid to supplier</ToggleButton>
          </ToggleButtonGroup>

          <Select value={form.partyId} onChange={set('partyId')} displayEmpty fullWidth>
            <MenuItem value="" disabled>{isReceipt ? 'Customer…' : 'Supplier…'}</MenuItem>
            {parties.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </Select>
          {selectedParty && (
            <Typography variant="body2" color="text.secondary">
              Currently {isReceipt ? 'owes you' : 'owed to them'}: <Money value={selectedParty.outstanding} />
            </Typography>
          )}

          <TextField label="Amount" type="number" value={form.amount} onChange={set('amount')} fullWidth />
          <Select value={form.accountId} onChange={set('accountId')} displayEmpty fullWidth>
            <MenuItem value="" disabled>{isReceipt ? 'Received into…' : 'Paid from…'}</MenuItem>
            {liquidAccounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
          </Select>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Date" type="date" value={form.date} onChange={set('date')} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Reference (cheque / transfer no.)" value={form.reference} onChange={set('reference')} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.partyId || !(+form.amount > 0) || !form.accountId || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {editing ? 'Update Payment' : 'Record Payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
