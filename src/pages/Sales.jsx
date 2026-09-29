import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, IconButton, Chip, Alert, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { api, saveBlob } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

const emptyForm = { invoiceNumber: '', customerId: '', productId: '', qty: 1, price: '', paidAmount: 0, accountId: '' };

export default function Sales() {
  const { profile } = useAuth();
  const canEdit = hasRole(profile, 'manager');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const { data: sales, isLoading, error } = useQuery({ queryKey: ['sales', search], queryFn: () => api.get(`/sales${search ? `?q=${encodeURIComponent(search)}` : ''}`) });
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => api.get('/customers') });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => api.get('/products') });
  const { data: accounts } = useQuery({ queryKey: ['liquid-accounts'], queryFn: () => api.get('/accounts/options') });
  const liquidAccounts = useMemo(() => (accounts || []).filter((a) => a.heading === 'Cash' || a.heading === 'Bank'), [accounts]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, accountId: liquidAccounts[0]?.id || '' }); setOpen(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ invoiceNumber: s.invoice_number || '', customerId: s.customer_id, productId: s.product_id, qty: s.qty, price: s.price, paidAmount: s.paid_amount, accountId: s.payment_account_id });
    setOpen(true);
  };

  // Auto-fill selling price from the product's default when picking a new product (not while editing).
  useEffect(() => {
    if (editing || !form.productId || !products) return;
    const p = products.find((x) => x.id === form.productId);
    if (p) setForm((f) => ({ ...f, price: p.sell_price }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.productId]);

  const total = (+form.qty || 0) * (+form.price || 0);
  const paid = Math.min(+form.paidAmount || 0, total);
  const credit = Math.max(total - paid, 0);

  const body = () => ({
    invoiceNumber: form.invoiceNumber || undefined,
    customerId: form.customerId,
    productId: form.productId,
    qty: +form.qty,
    price: +form.price,
    paidAmount: +form.paidAmount || 0,
    accountId: form.accountId,
  });

  const saveMutation = useMutation({
    mutationFn: () => (editing ? api.put(`/sales/${editing.id}`, body()) : api.post('/sales', body())),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['customers'] }); setOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/sales/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['customers'] }); },
    onError: (err) => alert(err.message),
  });

  const downloadPdf = async (sale) => {
    try {
      const blob = await api.blob(`/sales/${sale.id}/pdf`);
      saveBlob(blob, `invoice-${(sale.invoice_number || sale.id).toString().replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`);
    } catch (err) {
      alert(err.message);
    }
  };

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Sales Invoices</Typography>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew} disabled={!customers?.length || !products?.length}>New Invoice</Button>}
      </Box>

      <TextField
        size="small" fullWidth placeholder="Search by invoice number, customer, or product…"
        value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2 }}
      />

      {sales.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{search ? 'No sales match that search.' : 'No sales recorded yet.'}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell><TableCell>Invoice #</TableCell><TableCell>Customer</TableCell><TableCell>Product</TableCell>
              <TableCell align="right">Qty</TableCell><TableCell align="right">Total</TableCell><TableCell>Status</TableCell><TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {sales.map((s) => {
              const status = s.credit_amount <= 0 ? 'Paid' : s.paid_amount > 0 ? `Partial · ${s.account_name}` : 'Credit';
              return (
                <TableRow key={s.id}>
                  <TableCell>{s.date}</TableCell>
                  <TableCell>{s.invoice_number}</TableCell>
                  <TableCell>{s.customer_name}</TableCell>
                  <TableCell>{s.product_name}</TableCell>
                  <TableCell align="right">{s.qty}</TableCell>
                  <TableCell align="right"><Money value={s.total} /></TableCell>
                  <TableCell><Chip label={status} size="small" color={s.credit_amount <= 0 ? 'success' : 'default'} variant="outlined" /></TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <IconButton size="small" title="Download PDF" onClick={() => downloadPdf(s)}><PictureAsPdfIcon fontSize="small" /></IconButton>
                    {canEdit && (
                      <>
                        <Button size="small" onClick={() => openEdit(s)}>Edit</Button>
                        <IconButton size="small" onClick={() => { if (confirm('Delete this sale? Stock and ledger entries will be reversed.')) deleteMutation.mutate(s.id); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Update Sale' : 'New Sale Invoice'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
          <TextField label="Invoice Number" placeholder="e.g. INV-1001" value={form.invoiceNumber} onChange={set('invoiceNumber')} fullWidth />
          <Select value={form.customerId} onChange={set('customerId')} displayEmpty fullWidth>
            <MenuItem value="" disabled>Customer…</MenuItem>
            {(customers || []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
          <Select value={form.productId} onChange={set('productId')} displayEmpty fullWidth>
            <MenuItem value="" disabled>Product…</MenuItem>
            {(products || []).map((p) => <MenuItem key={p.id} value={p.id}>{p.name} (stock: {p.stock})</MenuItem>)}
          </Select>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Quantity" type="number" value={form.qty} onChange={set('qty')} fullWidth />
            <TextField label="Selling Price (per unit)" type="number" value={form.price} onChange={set('price')} fullWidth />
          </Box>
          <TextField label="Total" value={total.toFixed(2)} InputProps={{ readOnly: true }} fullWidth />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Amount Received Now" type="number" value={form.paidAmount} onChange={set('paidAmount')} fullWidth />
            <Select value={form.accountId} onChange={set('accountId')} displayEmpty fullWidth>
              <MenuItem value="" disabled>Received into…</MenuItem>
              {liquidAccounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
            </Select>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            {credit > 0 ? <>On credit: <Money value={credit} /></> : 'Fully paid'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.customerId || !form.productId || !form.accountId || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {editing ? 'Update Sale' : 'Record Sale'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
