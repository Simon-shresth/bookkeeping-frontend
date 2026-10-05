import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, IconButton, Alert, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

const todayDate = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ date: todayDate(), categoryAccountId: '', note: '', amount: '', paymentAccountId: '' });

export default function Expenses() {
  const { profile } = useAuth();
  const canEdit = hasRole(profile, 'manager');
  const qc = useQueryClient();
  const { data: expenses, isLoading, error } = useQuery({ queryKey: ['expenses'], queryFn: () => api.get('/expenses') });
  const { data: accounts } = useQuery({ queryKey: ['account-options'], queryFn: () => api.get('/accounts/options') });

  const expenseAccounts = useMemo(() => (accounts || []).filter((a) => a.category === 'Expenses' && a.heading !== 'Cost of Goods Sold'), [accounts]);
  const liquidAccounts = useMemo(() => (accounts || []).filter((a) => a.heading === 'Cash' || a.heading === 'Bank'), [accounts]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = () => { setEditing(null); setForm({ ...emptyForm(), categoryAccountId: expenseAccounts[0]?.id || '', paymentAccountId: liquidAccounts[0]?.id || '' }); setOpen(true); };
  const openEdit = (e) => {
    setEditing(e);
    setForm({ date: e.date || todayDate(), categoryAccountId: e.category_account_id, note: e.note || '', amount: e.amount, paymentAccountId: e.payment_account_id });
    setOpen(true);
  };

  const body = () => ({ date: form.date, categoryAccountId: form.categoryAccountId, note: form.note, amount: +form.amount, paymentAccountId: form.paymentAccountId });

  const saveMutation = useMutation({
    mutationFn: () => (editing ? api.put(`/expenses/${editing.id}`, body()) : api.post('/expenses', body())),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
    onError: (err) => alert(err.message),
  });

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Expenses</Typography>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Add</Button>}
      </Box>

      {expenses.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No expenses recorded yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Category</TableCell><TableCell>Note</TableCell><TableCell>Paid From</TableCell><TableCell align="right">Amount</TableCell>{canEdit && <TableCell />}</TableRow></TableHead>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.date}</TableCell>
                <TableCell>{e.category_name}</TableCell>
                <TableCell>{e.note}</TableCell>
                <TableCell>{e.account_name}</TableCell>
                <TableCell align="right"><Money value={e.amount} /></TableCell>
                {canEdit && (
                  <TableCell align="right">
                    <Button size="small" onClick={() => openEdit(e)}>Edit</Button>
                    <IconButton size="small" onClick={() => deleteMutation.mutate(e.id)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? 'Edit Expense' : 'New Expense'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
          <TextField
            label="Date"
            type="date"
            value={form.date}
            onChange={set('date')}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <Select value={form.categoryAccountId} onChange={set('categoryAccountId')} displayEmpty fullWidth>
            <MenuItem value="" disabled>Category…</MenuItem>
            {expenseAccounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
          </Select>
          <TextField label="Note" value={form.note} onChange={set('note')} fullWidth />
          <TextField label="Amount" type="number" value={form.amount} onChange={set('amount')} fullWidth />
          <Select value={form.paymentAccountId} onChange={set('paymentAccountId')} displayEmpty fullWidth>
            <MenuItem value="" disabled>Paid from…</MenuItem>
            {liquidAccounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.categoryAccountId || !form.amount || !form.paymentAccountId || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
