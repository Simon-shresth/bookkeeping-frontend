import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, IconButton, Chip, Alert, CircularProgress,
  Checkbox, FormControlLabel, InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import SearchIcon from '@mui/icons-material/Search';
import { api, saveBlob } from '../lib/api';
import Money from '../components/Money';
import { useAuth, hasRole } from '../context/AuthContext';

const emptyLine = () => ({ productId: '', qty: 1, price: '' });
const emptyForm = () => ({ invoiceNumber: '', customerId: '', lines: [emptyLine()], discount: 0, cashSale: false, paidAmount: 0, accountId: '' });

export default function Sales() {
  const { profile } = useAuth();
  const canEdit = hasRole(profile, 'manager');
  const qc = useQueryClient();

  // Search only fires on Enter (or the search button) — not on every
  // keystroke — so the "committed" query and the input's live text are
  // tracked separately.
  const [search, setSearch] = useState('');
  const searchInputRef = useRef(null);
  const { data: sales, isLoading, error } = useQuery({ queryKey: ['sales', search], queryFn: () => api.get(`/sales${search ? `?q=${encodeURIComponent(search)}` : ''}`) });
  const runSearch = () => setSearch(searchInputRef.current.value);

  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => api.get('/customers') });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => api.get('/products') });
  const { data: accounts } = useQuery({ queryKey: ['liquid-accounts'], queryFn: () => api.get('/accounts/options') });
  const liquidAccounts = useMemo(() => (accounts || []).filter((a) => a.heading === 'Cash' || a.heading === 'Bank'), [accounts]);
  const productById = useMemo(() => Object.fromEntries((products || []).map((p) => [p.id, p])), [products]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setLine = (i, k, v) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));

  const openNew = () => { setEditing(null); setForm({ ...emptyForm(), accountId: liquidAccounts[0]?.id || '' }); setOpen(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({
      invoiceNumber: s.invoice_number || '',
      customerId: s.customer_id,
      lines: s.lines.map((l) => ({ productId: l.product_id, qty: l.qty, price: l.price })),
      discount: s.discount || 0,
      cashSale: s.cash_sale,
      paidAmount: s.paid_amount,
      accountId: s.payment_account_id || liquidAccounts[0]?.id || '',
    });
    setOpen(true);
  };

  const onProductChange = (i, productId) => {
    const p = productById[productId];
    setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, productId, price: p ? p.sell_price : l.price } : l)) }));
  };

  const subtotal = form.lines.reduce((s, l) => s + (+l.qty || 0) * (+l.price || 0), 0);
  const discount = Math.min(+form.discount || 0, subtotal);
  const total = Math.max(subtotal - discount, 0);
  const paid = form.cashSale ? total : Math.min(+form.paidAmount || 0, total);
  const credit = form.cashSale ? 0 : Math.max(total - paid, 0);

  const body = () => ({
    invoiceNumber: form.invoiceNumber || undefined,
    customerId: form.customerId,
    lines: form.lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, qty: +l.qty, price: +l.price })),
    discount: +form.discount || 0,
    cashSale: form.cashSale,
    paidAmount: form.cashSale ? 0 : (+form.paidAmount || 0),
    accountId: form.accountId,
  });

  const saveMutation = useMutation({
    mutationFn: () => (editing ? api.put(`/sales/${editing.id}`, body()) : api.post('/sales', body())),
    onSuccess: () => {
      ['sales', 'products', 'customers', 'journal', 'dashboard', 'chart-of-accounts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setOpen(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => api.del(`/sales/${id}`),
    onSuccess: () => ['sales', 'products', 'customers', 'journal', 'dashboard', 'chart-of-accounts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
    onError: (err) => alert(err.message),
  });

  const downloadPdf = async (sale) => {
    try {
      const blob = await api.blob(`/sales/${sale.id}/pdf`);
      saveBlob(blob, `invoice-${(sale.invoice_number || sale.id).toString().replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`);
    } catch (err) { alert(err.message); }
  };

  const canSubmit = form.customerId && form.lines.some((l) => l.productId && +l.qty > 0) && form.accountId;

  if (isLoading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Sales Invoices</Typography>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={openNew} disabled={!customers?.length || !products?.length}>New Invoice</Button>}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small" fullWidth inputRef={searchInputRef} defaultValue={search}
          placeholder="Search by invoice number, customer, or product — press Enter"
          onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
        />
        <Button variant="outlined" startIcon={<SearchIcon />} onClick={runSearch}>Search</Button>
      </Box>

      {sales.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{search ? 'No sales match that search.' : 'No sales recorded yet.'}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell><TableCell>Invoice #</TableCell><TableCell>Customer</TableCell><TableCell>Items</TableCell>
              <TableCell align="right">Total</TableCell><TableCell>Status</TableCell><TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {sales.map((s) => {
              const status = s.credit_amount <= 0 ? 'Paid' : s.paid_amount > 0 ? `Partial · ${s.account_name}` : 'Credit';
              const itemsLabel = s.lines.length ? `${s.lines[0].product_name}${s.lines.length > 1 ? ` +${s.lines.length - 1} more` : ''}` : '';
              return (
                <TableRow key={s.id}>
                  <TableCell>{s.date}</TableCell>
                  <TableCell>{s.invoice_number}</TableCell>
                  <TableCell>{s.customer_name}</TableCell>
                  <TableCell>{itemsLabel}</TableCell>
                  <TableCell align="right"><Money value={s.total} /></TableCell>
                  <TableCell><Chip label={s.cash_sale ? 'Cash Sale' : status} size="small" color={s.credit_amount <= 0 ? 'success' : 'default'} variant="outlined" /></TableCell>
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

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? 'Update Sale' : 'New Sale Invoice'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {saveMutation.error && <Alert severity="error">{saveMutation.error.message}</Alert>}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Invoice Number" placeholder="e.g. INV-1001" value={form.invoiceNumber} onChange={set('invoiceNumber')} fullWidth />
            <Select value={form.customerId} onChange={set('customerId')} displayEmpty fullWidth>
              <MenuItem value="" disabled>Customer…</MenuItem>
              {(customers || []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </Box>

          <Typography variant="body2" color="text.secondary">Products</Typography>
          {form.lines.map((line, i) => {
            const p = productById[line.productId];
            const lineTotal = (+line.qty || 0) * (+line.price || 0);
            return (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Select value={line.productId} onChange={(e) => onProductChange(i, e.target.value)} displayEmpty sx={{ flex: 3 }}>
                  <MenuItem value="" disabled>Product…</MenuItem>
                  {(products || []).map((prod) => <MenuItem key={prod.id} value={prod.id}>{prod.name} (stock: {prod.stock} {prod.unit})</MenuItem>)}
                </Select>
                <TextField type="number" label="Qty" value={line.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} sx={{ flex: 1 }}
                  InputProps={{ endAdornment: p ? <InputAdornment position="end">{p.unit}</InputAdornment> : null }} />
                <TextField type="number" label="Price" value={line.price} onChange={(e) => setLine(i, 'price', e.target.value)} sx={{ flex: 1 }} />
                <Typography variant="body2" sx={{ flex: 1, textAlign: 'right' }}><Money value={lineTotal} /></Typography>
                <IconButton size="small" disabled={form.lines.length <= 1} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            );
          })}
          <Button size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}>+ Add Product</Button>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField label="Subtotal" value={subtotal.toFixed(2)} InputProps={{ readOnly: true }} sx={{ flex: 1 }} />
            <TextField label="Discount" type="number" value={form.discount} onChange={set('discount')} sx={{ flex: 1 }} />
            <TextField label="Total" value={total.toFixed(2)} InputProps={{ readOnly: true }} sx={{ flex: 1 }} />
          </Box>

          <FormControlLabel
            control={<Checkbox checked={form.cashSale} onChange={(e) => setForm((f) => ({ ...f, cashSale: e.target.checked }))} />}
            label="Cash Sale (paid in full now, no credit)"
          />

          {form.cashSale ? (
            <Select value={form.accountId} onChange={set('accountId')} displayEmpty fullWidth>
              <MenuItem value="" disabled>Received into…</MenuItem>
              {liquidAccounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
            </Select>
          ) : (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Amount Received Now" type="number" value={form.paidAmount} onChange={set('paidAmount')} fullWidth />
              <Select value={form.accountId} onChange={set('accountId')} displayEmpty fullWidth>
                <MenuItem value="" disabled>Received into…</MenuItem>
                {liquidAccounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </Select>
            </Box>
          )}
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            {form.cashSale ? 'Fully paid (cash sale)' : credit > 0 ? <>On credit: <Money value={credit} /></> : 'Fully paid'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!canSubmit || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {editing ? 'Update Sale' : 'Record Sale'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
