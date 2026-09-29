import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, IconButton, Chip, Alert, CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

const NEW_PRODUCT = '__new__';
const emptyForm = {
  invoiceNumber: '', pragyapanNumber: '', supplierId: '', productId: '',
  newName: '', newSellPrice: '', newMinStock: 0,
  qty: 1, unitPrice: '', paidAmount: 0, accountId: '',
};

export default function Purchases() {
  const { profile } = useAuth();
  const canEdit = hasRole(profile, 'manager');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const { data: purchases, isLoading, error } = useQuery({ queryKey: ['purchases', search], queryFn: () => api.get(`/purchases${search ? `?q=${encodeURIComponent(search)}` : ''}`) });
  const { data: suppliers } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers') });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => api.get('/products') });
  const { data: accounts } = useQuery({ queryKey: ['liquid-accounts'], queryFn: () => api.get('/accounts/options') });
  const liquidAccounts = useMemo(() => (accounts || []).filter((a) => a.heading === 'Cash' || a.heading === 'Bank'), [accounts]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isNew = form.productId === NEW_PRODUCT;

  const openNew = () => { setEditing(null); setForm({ ...emptyForm, accountId: liquidAccounts[0]?.id || '' }); setOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      invoiceNumber: p.invoice_number || '', pragyapanNumber: p.pragyapan_number || '', supplierId: p.supplier_id, productId: p.product_id,
      newName: '', newSellPrice: '', newMinStock: 0, qty: p.qty, unitPrice: p.unit_price, paidAmount: p.paid_amount, accountId: p.payment_account_id,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (editing || isNew || !form.productId || !products) return;
    const p = products.find((x) => x.id === form.productId);
    if (p) setForm((f) => ({ ...f, unitPrice: p.purchase_price }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.productId]);

  const total = (+form.qty || 0) * (+form.unitPrice || 0);
  const paid = Math.min(+form.paidAmount || 0, total);
  const credit = Math.max(total - paid, 0);

  const body = () => ({
    invoiceNumber: form.invoiceNumber || undefined,
    pragyapanNumber: form.pragyapanNumber || undefined,
    supplierId: form.supplierId,
    ...(isNew
      ? { newProduct: { name: form.newName, sellPrice: form.newSellPrice ? +form.newSellPrice : undefined, minStock: +form.newMinStock || 0 } }
      : { productId: form.productId }),
    qty: +form.qty,
    unitPrice: +form.unitPrice,
    paidAmount: +form.paidAmount || 0,
    accountId: form.accountId,
  });

  const saveMutation = useMutation({
    mutationFn: () => (editing ? api.put(`/purchases/${editing.id}`, body()) : api.post('/purchases', body())),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['suppliers'] }); setOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/purchases/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchases'] }); qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['suppliers'] }); },
    onError: (err) => alert(err.message),
  });

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Purchase Invoices</Typography>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew} disabled={!suppliers?.length}>New Purchase</Button>}
      </Box>

      <TextField
        size="small" fullWidth placeholder="Search by invoice number, pragyapan patra number, supplier, or product…"
        value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2 }}
      />

      {purchases.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{search ? 'No purchases match that search.' : 'No purchases recorded yet.'}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell><TableCell>Invoice #</TableCell><TableCell>Pragyapan Patra #</TableCell><TableCell>Supplier</TableCell>
              <TableCell>Product</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Total</TableCell><TableCell>Status</TableCell>{canEdit && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {purchases.map((p) => {
              const status = p.credit_amount <= 0 ? 'Paid' : p.paid_amount > 0 ? `Partial · ${p.account_name}` : 'Credit';
              return (
                <TableRow key={p.id}>
                  <TableCell>{p.date}</TableCell>
                  <TableCell>{p.invoice_number}</TableCell>
                  <TableCell>{p.pragyapan_number}</TableCell>
                  <TableCell>{p.supplier_name}</TableCell>
                  <TableCell>{p.product_name}</TableCell>
                  <TableCell align="right">{p.qty}</TableCell>
                  <TableCell align="right"><Money value={p.total} /></TableCell>
                  <TableCell><Chip label={status} size="small" color={p.credit_amount <= 0 ? 'success' : 'default'} variant="outlined" /></TableCell>
                  {canEdit && (
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(p)}>Edit</Button>
                      <IconButton size="small" onClick={() => { if (confirm('Delete this purchase? Stock and ledger entries will be reversed.')) deleteMutation.mutate(p.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Update Purchase' : 'New Purchase'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Invoice Number" placeholder="e.g. PINV-1001" value={form.invoiceNumber} onChange={set('invoiceNumber')} fullWidth />
            <TextField label="Pragyapan Patra Number" placeholder="e.g. PP-2082-001" value={form.pragyapanNumber} onChange={set('pragyapanNumber')} fullWidth />
          </Box>
          <Select value={form.supplierId} onChange={set('supplierId')} displayEmpty fullWidth>
            <MenuItem value="" disabled>Supplier…</MenuItem>
            {(suppliers || []).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </Select>
          <Select value={form.productId} onChange={set('productId')} displayEmpty fullWidth>
            <MenuItem value="" disabled>Product…</MenuItem>
            {(products || []).map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            <MenuItem value={NEW_PRODUCT}>+ Add New Product</MenuItem>
          </Select>
          {isNew && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1.5, border: '1px solid', borderColor: 'divider' }}>
              <TextField label="New Product Name" value={form.newName} onChange={set('newName')} fullWidth />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="Selling Price" type="number" value={form.newSellPrice} onChange={set('newSellPrice')} fullWidth />
                <TextField label="Minimum Stock" type="number" value={form.newMinStock} onChange={set('newMinStock')} fullWidth />
              </Box>
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Quantity" type="number" value={form.qty} onChange={set('qty')} fullWidth />
            <TextField label="Purchase Price (per unit)" type="number" value={form.unitPrice} onChange={set('unitPrice')} fullWidth />
          </Box>
          <TextField label="Total" value={total.toFixed(2)} InputProps={{ readOnly: true }} fullWidth />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Amount Paid Now" type="number" value={form.paidAmount} onChange={set('paidAmount')} fullWidth />
            <Select value={form.accountId} onChange={set('accountId')} displayEmpty fullWidth>
              <MenuItem value="" disabled>Paid from…</MenuItem>
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
            disabled={!form.supplierId || !form.productId || (isNew && !form.newName) || !form.accountId || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {editing ? 'Update Purchase' : 'Record Purchase'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
